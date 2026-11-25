"""Inferencia operativa con almacenamiento temporal y datos en memoria; sin PostgreSQL."""
from uuid import uuid4
from datetime import timedelta
import pandas as pd
import pytest

from app import operational_forecast as module
from app.storage import ModelStore


@pytest.fixture
def scenario(tmp_path, monkeypatch):
    dates = pd.date_range('2026-01-01', periods=80)
    sales = pd.DataFrame([{'fecha': d, 'id_producto': sku, 'cantidad_vendida': 8.0,
                           'precio_venta_unitario': 5.0}
                          for d in dates for sku in ('P001', 'P002')])
    products = pd.DataFrame([{'id_producto': sku, 'nombre_producto': sku, 'categoria': 'Abarrotes',
                              'stock_actual': 20.0, 'stock_minimo_seguridad': 5.0,
                              'precio_venta_unitario': 5.0, 'proveedor': 'PRUEBA'}
                             for sku in ('P001', 'P002')])
    store = ModelStore(tmp_path)
    def save(cutoff=None):
        training = {'id': str(uuid4()), 'status': 'COMPLETED', 'modelName': 'media_reciente',
                    'trainedAt': '2026-03-21T10:00:00+00:00', 'metrics': {'mae': 1.2, 'rmse': 1.8},
                    'salesCutoffDate': cutoff or dates[-1].date().isoformat()}
        store.save(training['id'], None, {'training': training, 'predictions': [], 'replenishments': []})
        return training
    training = save()
    data = {'sales': sales, 'products': products}
    monkeypatch.setattr(module, 'load_operational_inputs', lambda: (data['sales'].copy(), data['products'].copy()))
    service = module.OperationalForecast(store)
    original = service.inference.by_id
    calls = []
    def counted(*args):
        calls.append(args[0])
        return original(*args)
    monkeypatch.setattr(service.inference, 'by_id', counted)
    return service, data, store, training, calls, save


def test_unchanged_data_reuses_inference_and_preserves_artifacts(scenario):
    service, _, store, training, calls, _ = scenario
    before = service.latest()
    after = service.latest()
    assert before == after
    assert calls == [training['id']]
    assert before['training']['trainedAt'] == training['trainedAt']
    assert before['training']['forecastGeneratedAt']
    assert before['training']['forecastSalesCutoffDate'] == training['salesCutoffDate']
    assert store.latest()['training'] == training
    assert store.latest()['predictions'] == []
    before['predictions'].clear()
    assert len(service.latest()['predictions']) == 2


def test_sale_on_same_day_invalidates_cache(scenario):
    service, data, _, _, calls, _ = scenario
    before = service.latest()
    data['sales'].loc[data['sales'].index[-1], 'cantidad_vendida'] += 12
    after = service.latest()
    assert len(calls) == 2
    assert before['training']['forecastSalesCutoffDate'] == after['training']['forecastSalesCutoffDate']
    assert before['predictions'] != after['predictions']


def test_sale_on_new_day_updates_horizon_not_training(scenario):
    service, data, _, training, calls, _ = scenario
    before = service.latest()
    next_rows = data['sales'].tail(2).copy()
    next_rows['fecha'] += timedelta(days=1)
    data['sales'] = pd.concat([data['sales'], next_rows], ignore_index=True)
    after = service.latest()
    assert len(calls) == 2
    assert after['training']['id'] == training['id']
    assert after['training']['metrics'] == training['metrics']
    assert after['training']['salesCutoffDate'] == training['salesCutoffDate']
    assert after['training']['forecastSalesCutoffDate'] == before['training']['forecastFromDate']
    assert after['training']['forecastToDate'] > before['training']['forecastToDate']


def test_receipt_updates_replenishment_without_training(scenario):
    service, data, _, training, calls, _ = scenario
    before = service.latest()
    data['products'].loc[0, 'stock_actual'] += 100
    after = service.latest()
    assert calls == [training['id'], training['id']]
    assert before['predictions'] == after['predictions']
    by_id = {v['productId']: v for v in after['replenishments']}
    assert by_id['P001']['stockActual'] == 120
    assert by_id['P001']['recommendedReplenishment'] == 0


def test_new_model_invalidates_cache(scenario):
    service, _, _, _, calls, save = scenario
    first = service.latest()
    training = save()
    second = service.latest()
    assert first['training']['id'] != training['id'] == second['training']['id']
    assert calls[-1] == training['id'] and len(calls) == 2


def test_read_error_is_not_hidden_by_old_cache(scenario, monkeypatch):
    service, _, _, _, _, _ = scenario
    service.latest()
    def unavailable():
        raise RuntimeError('BD no disponible')
    monkeypatch.setattr(module, 'load_operational_inputs', unavailable)
    with pytest.raises(RuntimeError, match='BD no disponible'):
        service.latest()


def test_refuses_history_older_than_training_cutoff(scenario):
    service, _, _, _, _, save = scenario
    save('2026-05-01')
    with pytest.raises(ValueError, match='antes del corte'):
        service.latest()


def test_database_reads_share_transaction(monkeypatch):
    from app import database
    events = []
    class Connection:
        def __enter__(self):
            events.append('enter')
            return self
        def __exit__(self, *args):
            events.append('exit')
        def execute(self, sql):
            events.append(sql)
    connection = Connection()
    sales = pd.DataFrame({'sale': [1]})
    products = pd.DataFrame({'product': [2]})
    monkeypatch.setattr(database, '_connection', lambda: connection)
    monkeypatch.setattr(database, 'load_sales_from_db', lambda conn: sales if conn is connection else None)
    monkeypatch.setattr(database, 'load_products_from_db', lambda conn: products if conn is connection else None)
    a, b = database.load_operational_inputs()
    assert a is sales and b is products
    assert events == ['enter', 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY', 'exit']


def test_operational_http_route_keeps_training_and_forecast_dates(scenario, monkeypatch, tmp_path):
    from types import SimpleNamespace
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    monkeypatch.setenv('ML_MODEL_DIR', str(tmp_path / 'unused'))
    from app.routes import training as route
    service, data, _, training, _, _ = scenario
    monkeypatch.setattr(route, 'service', SimpleNamespace(operational=service))
    app = FastAPI()
    app.include_router(route.router, prefix='/trainings')
    client = TestClient(app)
    response = client.get('/trainings/latest/operational')
    assert response.status_code == 200
    payload = response.json()
    assert payload['training']['id'] == training['id']
    assert payload['training']['forecastGeneratedAt']
    assert len(payload['predictions'][0]['dailyPredictions']) == 7
    assert len(payload['replenishments']) == 2
    data['sales'] = data['sales'].iloc[0:0]
    assert client.get('/trainings/latest/operational').status_code == 422


def test_no_model_http_returns_404(monkeypatch, tmp_path):
    from types import SimpleNamespace
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    monkeypatch.setenv('ML_MODEL_DIR', str(tmp_path / 'unused'))
    from app.routes import training as route
    monkeypatch.setattr(route, 'service', SimpleNamespace(operational=module.OperationalForecast(ModelStore(tmp_path / 'empty'))))
    app = FastAPI()
    app.include_router(route.router, prefix='/trainings')
    assert TestClient(app).get('/trainings/latest/operational').status_code == 404


def test_purchase_inputs_share_operational_snapshot(scenario):
    service, data, _, training, calls, _ = scenario
    data['products']['costo_compra_unitario'] = 3.45
    first, catalogue = service.latest(with_products=True)
    assert first['training']['id'] == training['id']
    catalogue.loc[0, 'costo_compra_unitario'] = 99
    cached, catalogue = service.latest(with_products=True)
    assert cached == first and len(calls) == 1
    assert catalogue.loc[0, 'costo_compra_unitario'] == 3.45
    data['products'].loc[0, 'costo_compra_unitario'] = 3.50
    refreshed, catalogue = service.latest(with_products=True)
    assert refreshed['training']['id'] == training['id'] and len(calls) == 2
    assert catalogue.loc[0, 'costo_compra_unitario'] == 3.50


def test_purchase_route_uses_same_snapshot(monkeypatch):
    from datetime import date
    from types import SimpleNamespace
    from app.routes import training as route
    calls = []
    products = pd.DataFrame([dict(id_producto='P001', nombre_producto='Leche', categoria='Lacteos',
        stock_actual=1, stock_minimo_seguridad=4, precio_venta_unitario=4.20,
        costo_compra_unitario=3.45, proveedor='Proveedor')])
    snapshot = {'training': {'forecastToDate': (date.today()+timedelta(days=2)).isoformat()},
        'replenishments': [dict(productId='P001', productName='Leche', category='Lacteos', alertStatus='ROJO',
            recommendedReplenishment=3, stockActual=1, stockMinimoSeguridad=4, stockoutProbability=.9)]}
    def latest(*, with_products=False):
        calls.append(with_products)
        return snapshot, products
    monkeypatch.setattr(route, 'service', SimpleNamespace(operational=SimpleNamespace(latest=latest)))
    plan = route.optimize_replenishment(10.35)
    assert calls == [True] and plan['budgetUsed'] == 10.35
    assert plan['items'][0]['supplier'] == 'Proveedor'
