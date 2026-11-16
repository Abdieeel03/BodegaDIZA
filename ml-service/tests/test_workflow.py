from __future__ import annotations
from io import BytesIO
from pathlib import Path
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.ingestion import read_local,read_table
from app.preprocessing import prepare_products,prepare_providers,prepare_sales,coverage
from app.features import historical_features
from app.modeling import metrics
from app.replenishment import recommend
from app.storage import ModelStore
from app.training_engine import TrainingEngine
from scripts.sync_catalog import synthetic_ruc,sync

BASE=Path(__file__).parents[1]

@pytest.fixture(scope='session')
def data():
    return (read_local(BASE/'data/ventas.csv'),read_local(BASE/'data/productos.csv'),read_local(BASE/'data/proveedores.csv'))


def test_input_files(data):
    sales,products,providers=data
    assert (len(sales),len(products),len(providers))==(1500,20,6)
    assert products.stock_actual.min()>0


def test_supplier_references(data):
    _,products,providers=data
    loaded=prepare_providers(providers,prepare_products(products))
    assert len(loaded)==6


def test_unsupported_extension_rejected():
    with pytest.raises(ValueError,match='Solo se admiten'):
        read_table('bad.txt',b'abc')


def test_excel_reading(data):
    _,products,_=data
    buff=BytesIO()
    products.to_excel(buff,index=False)
    read=read_table('productos.xlsx',buff.getvalue())
    assert len(read)==20


def test_no_fabricated_zero_sales(data):
    sales,products,_=data
    prepared,_=prepare_sales(sales,prepare_products(products))
    assert len(prepared)==1500
    assert coverage(prepared)['coverageRatio']<0.1
    assert prepared['cantidad_vendida'].min()>=0


def test_lag_only_from_prior_observations(data):
    sales,products,_=data
    prepared,_=prepare_sales(sales,prepare_products(products))
    features=historical_features(prepared,prepared.fecha.min())
    bysku=prepared[prepared.id_producto=='P002'].sort_values('fecha')
    target=features[features.id_producto=='P002'].iloc[0]
    old=bysku[bysku.fecha<target.fecha]
    assert target.lag_1==pytest.approx(old.cantidad_vendida.iloc[-1])


def test_metrics_include_rmse_mae_r2():
    result=metrics([2,4,6],[2,3,7])
    assert set(['mae','rmse','r2']).issubset(result)
    assert result['rmse']>=result['mae']


def test_stock_replenishment_nonzero():
    p=[{'productId':'P017','productName':'Lavavajilla','category':'Limpieza','predictedDemand7Days':1.8}]
    catalog=pd.DataFrame([{'id_producto':'P017','stock_actual':4,'stock_minimo_seguridad':5}])
    result=recommend(p,catalog)
    assert result[0]['recommendedReplenishment']==3
    assert result[0]['alertStatus']=='ROJO'


def test_supplier_ruc_synthetic():
    assert synthetic_ruc('PRV001')=='20990000001'
    assert len(synthetic_ruc('PRV006'))==11
    with pytest.raises(ValueError):synthetic_ruc('NODATA')


def test_local_training_persists_compatible_contract(data,tmp_path):
    sales,products,providers=data
    store=ModelStore(tmp_path/'models')
    output=TrainingEngine(store).train(sales,products,providers)
    training=output['training']
    assert training['modelName'] in ('ridge','decision_tree','random_forest','hist_gradient_boosting','media_reciente')
    assert training['evaluatedObservations']>=5
    assert set(('mae','rmse','r2')).issubset(training['metrics'])
    assert training['forecastFromDate']=='2026-11-11'
    assert len(output['predictions'])==20
    assert len(output['predictions'][0]['dailyPredictions'])==7
    assert len(output['replenishments'])==20
    assert store.get(training['id'])['training']['id']==training['id']
    assert store.latest()['predictions']==output['predictions']
    assert (tmp_path/'models'/training['id']/'modelo.joblib').exists()
    with pytest.raises(ValueError): store.get('../secreto')


def test_http_routes(data,tmp_path,monkeypatch):
    import app.routes.training as module
    from app.services.training_service import TrainingService
    from app.main import app
    monkeypatch.setattr(module,'service',TrainingService(tmp_path/'models'))
    sales,products,providers=data
    client=TestClient(app)
    assert client.get('/health').json()['status']=='ok'
    assert client.get('/trainings/latest/predictions').status_code==404
    def csv(df):return df.to_csv(index=False).encode('utf-8-sig')
    response=client.post('/trainings',files={
      'sales_file':('ventas.csv',csv(sales),'text/csv'),
      'products_file':('productos.csv',csv(products),'text/csv'),
      'suppliers_file':('proveedores.csv',csv(providers),'text/csv'),
    })
    assert response.status_code==200,response.text
    body=response.json()
    assert body['metrics']['r2'] is not None
    assert len(client.get('/trainings/latest/predictions').json())==20
    assert len(client.get('/trainings/latest/replenishments').json())==20
    assert client.get('/trainings/'+body['id']).json()['id']==body['id']
    assert client.get('/trainings/latest/comparison').json()['training']['modelName']==body['modelName']
    infer=client.post('/trainings/latest/infer',files={
      'sales_file':('ventas.csv',csv(sales),'text/csv'),
      'products_file':('productos.csv',csv(products),'text/csv'),
    })
    assert infer.status_code==200,infer.text
    assert infer.json()['trainingId']==body['id']
    assert len(infer.json()['predictions'])==20


class FakeApi:
    def __init__(self,products):
        self.products=products
        self.calls=[]
    def get(self,path,params=None):
        self.calls.append(('GET',path))
        if path=='/test-data/resumen':return {'status':'ok'}
        if path=='/productos':return self.products
        if path=='/categorias':return [{'id':j,'nombre':name,'activa':True} for j,name in enumerate(['Lacteos','Abarrotes','Bebidas','Conservas','Snacks','Limpieza','Higiene'],1)]
        if path=='/proveedores':return [{'id':j,'nombre':name,'activo':True,'ruc':f'2099000000{j}'} for j,name in enumerate([
              'Distribuidora Lacteos DIZA','Mayorista de Abarrotes DIZA','Distribuidora de Bebidas DIZA',
              'Distribuidora de Conservas DIZA','Distribuidora de Snacks DIZA',
              'Distribuidora de Limpieza e Higiene DIZA'],1)]
        if path=='/inventario/lotes':return []
        raise RuntimeError(path)
    def send(self,*args,**kwargs):raise AssertionError('Dry-run no debe ejecutar POST/PUT')


def test_sync_dryrun_never_changes_database(data,tmp_path):
    _,products,providers=data
    fake=FakeApi([])
    report=sync(fake,products,providers,apply=False,output_dir=tmp_path)
    assert report['applied'] is False
    assert report['catalogProducts']==20
    assert report['catalogProviders']==6
    assert len([x for x in fake.calls if x[0]=='GET'])>=4
