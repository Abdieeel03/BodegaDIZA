"""Bloque 03C: escenarios aislados; no hay escrituras ni conexión a PostgreSQL."""
from pathlib import Path
import numpy as np
import pandas as pd
import pytest
from app.stockout_scenarios import simulate_stockout_history, simulation_enabled_for_db
from app.stockout_classifier import (build_classification_dataset, temporal_partitions,
    train_stockout_classifier, predict_stockout_risk, CLASSIFIER_CANDIDATES, CLASSIFIER_FEATURES,
    TARGET_VERSION)
from app.preprocessing import prepare_sales, prepare_products

@pytest.fixture(scope='module')
def inputs():
    products=prepare_products(pd.DataFrame([dict(id_producto=f'P{i:03}',nombre_producto=f'Producto {i}',
        categoria='Abarrotes',precio_venta_unitario=3+i,stock_actual=20.,stock_minimo_seguridad=5+i,proveedor='Proveedor') for i in range(1,6)]))
    dates=pd.date_range('2026-01-01',periods=120)
    raw=pd.DataFrame([dict(fecha=d,id_producto=f'P{i:03}',cantidad_vendida=float(i*2+(d.day%3)),precio_venta_unitario=3+i) for d in dates for i in range(1,6)])
    sales,_=prepare_sales(raw,products)
    return sales,products

@pytest.fixture(scope='module')
def scenario(inputs):
    return simulate_stockout_history(*inputs)

def test_reproducible_and_balanced_inventory(inputs,scenario):
    pd.testing.assert_frame_equal(scenario,simulate_stockout_history(*inputs))
    assert len(scenario)==5*240
    assert (scenario.stock_apertura+scenario.entrada-scenario.cantidad_vendida==scenario.stock_final_dia).all()
    assert (scenario.stock_final_dia>=0).all()
    assert (scenario.demanda_latente>=scenario.cantidad_vendida).all()
    assert (scenario.venta_no_atendida>0).any()
    assert (scenario.stock_final_dia>0).any()
    assert (scenario.entrada>0).any()

def test_scenario_does_not_read_later_sales(inputs,scenario):
    sales,products=inputs
    later=sales.copy()
    later.loc[later.fecha>=later.fecha.unique()[60],'cantidad_vendida']*=20
    pd.testing.assert_frame_equal(scenario,simulate_stockout_history(later,products))

def test_target_three_days_and_no_future_features(inputs,scenario):
    _,products=inputs
    dataset=build_classification_dataset(scenario,products,simulated=True)
    r=dataset.iloc[0]
    future=scenario[(scenario.id_producto==r.id_producto)&(scenario.fecha>r.fecha)&(scenario.fecha<=r.label_end)]
    assert len(future)==3
    assert r.future_demand_3d==future.demanda_latente.sum()
    assert r.target_stockout==int(future.demanda_latente.sum()>r.stock_actual)
    assert (dataset.label_end-dataset.fecha).dt.days.eq(3).all()
    assert not set(['demanda_latente','future_demand_3d','label_end','venta_no_atendida']).intersection(CLASSIFIER_FEATURES)
    modified=scenario.copy()
    modified.loc[(modified.id_producto==r.id_producto)&(modified.fecha>r.fecha),'demanda_latente']+=100
    modified_row=build_classification_dataset(modified,products,simulated=True).query('id_producto == @r.id_producto and fecha == @r.fecha').iloc[0]
    pd.testing.assert_series_equal(r[CLASSIFIER_FEATURES],modified_row[CLASSIFIER_FEATURES],check_names=False)

def test_missing_stock_and_missing_days_excluded(inputs,scenario):
    sales,products=inputs
    assert build_classification_dataset(sales,products).empty
    sku=scenario.id_producto.iloc[0]; day=pd.Timestamp('2025-03-01')
    incomplete=scenario[~((scenario.id_producto==sku)&(scenario.fecha==day))].copy()
    incomplete.loc[(incomplete.id_producto==sku)&(incomplete.fecha==day+pd.Timedelta(days=3)),'stock_final_dia']=np.nan
    x=build_classification_dataset(incomplete,products,simulated=True)
    assert not ((x.id_producto==sku)&x.fecha.between(day-pd.Timedelta(days=3),day+pd.Timedelta(days=3))).loc[x.fecha.isin([day-pd.Timedelta(days=1),day-pd.Timedelta(days=2),day-pd.Timedelta(days=3),day,day+pd.Timedelta(days=3)])].any()

def test_temporal_purge(inputs,scenario):
    _,products=inputs
    train,val,test=temporal_partitions(build_classification_dataset(scenario,products,simulated=True))
    assert train.label_end.max()<val.fecha.min()
    assert val.label_end.max()<test.fecha.min()
    for part in (train,val,test): assert part.target_stockout.nunique()==2

@pytest.fixture(scope='module')
def trained(inputs):
    return train_stockout_classifier(*inputs,simulate=True)

def test_comparison_and_independent_test(trained):
    model,r=trained
    assert model is not None and r['targetVersion']==TARGET_VERSION
    assert r['source']=='ACADEMIC_INVENTORY_SCENARIOS'
    assert set(r['candidates'])==set(CLASSIFIER_CANDIDATES)
    assert sum(r['metrics']['confusionMatrix'].values())==r['partitions']['test']['n']
    assert sum(b['n'] for b in r['metrics']['reliabilityBins'])==r['partitions']['test']['n']
    assert 0<=r['metrics']['brierScore']<=1
    assert r['partitions']['train']['labelEnd']<r['partitions']['validation']['from']
    assert r['partitions']['validation']['labelEnd']<r['partitions']['test']['from']

def test_no_fabricated_probability(inputs,trained):
    sales,products=inputs; model,_=trained
    item=dict(productId='P001',productName='Producto 1',category='Abarrotes',stockActual=0.,stockMinimoSeguridad=6.,predictedDemand7Days=12.,recommendedReplenishment=18.,alertStatus='ROJO')
    assert predict_stockout_risk(None,sales,products,[item])[0]['stockoutProbability'] is None
    assert predict_stockout_risk(model,sales[sales.id_producto!='P001'],products,[item])[0]['stockoutProbability'] is None
    result=predict_stockout_risk(model,sales,products,[item])[0]
    assert 0<=result['stockoutProbability']<=1
    assert result['alertStatus']=='ROJO'

def test_no_synthetic_fallback_outside_test_database(inputs,monkeypatch):
    monkeypatch.setenv('DB_NAME','bodega_diza')
    assert not simulation_enabled_for_db()
    assert train_stockout_classifier(*inputs)==(None,None)
    monkeypatch.setenv('DB_NAME','bodega_diza_test')
    assert simulation_enabled_for_db()


def test_integrated_training_persists_independent_classifier(inputs,tmp_path):
    from app.storage import ModelStore
    from app.training_engine import TrainingEngine
    sales,products=inputs
    # Raw prepared observations have all required columns; engine prepares them again.
    store=ModelStore(tmp_path/'models')
    report=TrainingEngine(store).train(sales,products,simulate_stockout=True)
    assert report['training']['observationsCount']==len(sales)
    classifier=report['training']['classification']
    assert classifier['source']=='ACADEMIC_INVENTORY_SCENARIOS'
    assert classifier['scenario']['rows']==len(products)*240
    assert classifier['partitions']['test']['n']>0
    assert store.trusted_classifier(report['training']['id']) is not None
    assert len(report['predictions'])==len(products)
    assert all(len(x['dailyPredictions'])==7 for x in report['predictions'])
    assert all(x['stockoutProbability'] is not None for x in report['replenishments'])
