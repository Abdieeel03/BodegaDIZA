"""Pruebas de adaptación temporal sin acceso a PostgreSQL ni modelos persistentes."""
from datetime import timedelta

import numpy as np
import pandas as pd
import pytest

from app.forecasting import demand_shift, predict_horizon, validate_on_observed_days
from app.modeling import CANDIDATES
from app.training_engine import origins_in_window, TrainingEngine
from app.storage import ModelStore


def history(before=25.0, after=3.0, length=80, change_days=12, sku='P001'):
    dates = pd.date_range('2026-01-01', periods=length)
    quantities = np.full(length, before, dtype=float)
    if change_days:
        quantities[-change_days:] = after
    return pd.DataFrame({'fecha': dates, 'id_producto': sku,
                         'cantidad_vendida': quantities, 'categoria': 'Abarrotes',
                         'nombre_producto': sku, 'precio_venta_unitario': 5.0})


class ConstantModel:
    def __init__(self, value):
        self.value = value

    def predict(self, frame):
        return np.full(len(frame), self.value, dtype=float)


@pytest.mark.parametrize('before,after,direction', [(25., 3., 'DOWN'), (3., 25., 'UP')])
def test_adapts_to_level_shift(before, after, direction):
    sales = history(before, after)
    cutoff = sales.fecha.max()
    info = demand_shift(sales, cutoff)
    assert info['direction'] == direction
    assert 0 < info['adaptationWeight'] <= .90
    model = ConstantModel(before)
    args = model, 'random_forest', sales, cutoff, cutoff + timedelta(days=1)
    old = predict_horizon(*args, adaptive=False)
    new = predict_horizon(*args)
    assert len(new) == 7
    assert np.abs(new.venta_si_registrada - after).mean() < np.abs(old.venta_si_registrada - after).mean()
    assert (new.demanda_esperada >= 0).all()


def test_stable_and_missing_data():
    sales = history(10, 10)
    cutoff = sales.fecha.max()
    assert demand_shift(sales, cutoff)['direction'] == 'STABLE'
    args = ConstantModel(12), 'random_forest', sales, cutoff, cutoff + timedelta(days=1)
    pd.testing.assert_frame_equal(predict_horizon(*args), predict_horizon(*args, adaptive=False))
    sparse = sales.loc[sales.fecha <= cutoff - timedelta(days=12)]
    assert demand_shift(sparse, cutoff)['direction'] == 'INSUFFICIENT_DATA'
    assert demand_shift(sparse, cutoff)['recentMean'] is None


def test_future_observations_cannot_affect_forecast():
    sales = history()
    cutoff = sales.fecha.iloc[-8]
    past = sales.loc[sales.fecha <= cutoff]
    future_modified = sales.copy()
    future_modified.loc[future_modified.fecha > cutoff, 'cantidad_vendida'] = 9999
    args = ConstantModel(25), 'random_forest'
    a = predict_horizon(*args, past, cutoff, cutoff + timedelta(days=1))
    b = predict_horizon(*args, future_modified, cutoff, cutoff + timedelta(days=1))
    pd.testing.assert_frame_equal(a, b)
    assert demand_shift(sales, cutoff) == demand_shift(future_modified, cutoff)


def test_frequency_adapts_when_records_become_more_frequent():
    sales = history(10, 10, length=100)
    cutoff = sales.fecha.max()
    sales = sales.loc[(sales.fecha > cutoff - timedelta(days=14)) | (sales.fecha.dt.dayofyear % 3 == 0)]
    args = ConstantModel(10), 'random_forest', sales, cutoff, cutoff + timedelta(days=1)
    old, new = predict_horizon(*args, adaptive=False), predict_horizon(*args)
    assert new.frecuencia_estimada.mean() > old.frecuencia_estimada.mean()
    assert new.frecuencia_estimada.between(0, 1).all()
    assert (new.venta_si_registrada == old.venta_si_registrada).all()


def test_rolling_origins_include_last_complete_week_and_respect_boundaries():
    sales = history(length=100)
    start = sales.fecha.iloc[70]
    end = sales.fecha.max()
    cuts = origins_in_window(start, end, 5, sales)
    assert cuts[-1] + timedelta(days=7) == end
    assert cuts[0] + timedelta(days=1) >= start
    assert all(b - a >= timedelta(days=7) for a, b in zip(cuts, cuts[1:]))
    actual, predicted = validate_on_observed_days(ConstantModel(25), 'random_forest', sales, cuts)
    assert len(actual) == len(predicted) == len(cuts) * 7


def test_training_contract_and_diagnostics(tmp_path):
    # Escenario de prueba determinista, con varias series, no datos del negocio.
    sales = pd.concat([history(25, 3, length=150, sku='P001'),
                       history(8, 8, length=150, sku='P002'),
                       history(4, 12, length=150, sku='P003')], ignore_index=True)
    # Existencias de cierre conocidas en este escenario: ejemplos con y sin riesgo.
    sales['stock_final_dia'] = np.where(sales.fecha.dt.dayofyear % 3 == 0, 3.0, 100.0)
    products = pd.DataFrame([{'id_producto': sku, 'nombre_producto': sku,
                              'categoria': 'Abarrotes', 'stock_actual': 20,
                              'stock_minimo_seguridad': 5,
                              'precio_venta_unitario': 5.0, 'proveedor': 'PRUEBA'}
                             for sku in ['P001', 'P002', 'P003']])
    providers = pd.DataFrame([{'codigo_referencia': 'PRV001', 'nombre': 'PRUEBA'}])
    store = ModelStore(tmp_path)
    report = TrainingEngine(store).train(sales, products, providers)
    training = report['training']
    assert set(report['validationCandidates']) == set(CANDIDATES)
    assert training['modelName'] in CANDIDATES
    assert training['salesCutoffDate'] == sales.fecha.max().date().isoformat()
    details = report['dataCoverage']['evaluationDetails']
    assert 'withoutAdaptation' in details and 'recentMeanBaseline' in details
    assert max(details['validationOrigins']) < min(details['testOrigins'])
    assert len(report['predictions']) == 3
    assert all(len(p['dailyPredictions']) == 7 for p in report['predictions'])
    assert store.latest()['training']['id'] == training['id']
