"""Pruebas adicionales APF3: algoritmos supervisados y reproducibilidad."""
from pathlib import Path
import numpy as np
import pytest
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeRegressor
from app.features import FEATURES, historical_features
from app.ingestion import read_local
from app.modeling import CANDIDATES, metrics, predict_one, train_model
from app.preprocessing import prepare_products, prepare_sales

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope='module')
def observations():
    products = prepare_products(read_local(ROOT/'data'/'productos.csv'))
    sales, _ = prepare_sales(read_local(ROOT/'data'/'ventas.csv'), products)
    features = historical_features(sales, sales.fecha.min())
    # Mantener el orden temporal para simular datos disponibles al entrenar.
    return features.loc[features.fecha < features.fecha.quantile(.75)].copy()


def test_apf3_comparacion_incluye_arbol_y_modelo_actual():
    assert set(CANDIDATES) == {'media_reciente', 'ridge', 'decision_tree',
                               'random_forest', 'hist_gradient_boosting'}


def test_arbol_de_decision_entrena_y_predice_sin_valores_negativos(observations):
    model = train_model('decision_tree', observations)
    assert isinstance(model.named_steps['algoritmo'], DecisionTreeRegressor)
    row = observations.iloc[[0]][FEATURES]
    prediction = predict_one(model, 'decision_tree', row)
    assert np.isfinite(prediction)
    assert prediction >= 0.0


def test_regresion_regularizada_tiene_escalado_y_arbol_no(observations):
    linear = train_model('ridge', observations)
    tree = train_model('decision_tree', observations)
    linear_numeric = linear.named_steps['preprocesamiento'].named_transformers_['numeros']
    tree_numeric_config = tree.named_steps['preprocesamiento'].transformers[1][1]
    assert isinstance(linear_numeric, Pipeline)
    assert isinstance(linear_numeric.named_steps['scale'], StandardScaler)
    assert tree_numeric_config == 'passthrough'


def test_metricas_r2_y_mae_reproducibles():
    scores = metrics([2, 4, 6, 8], [3, 3, 7, 8])
    assert scores['mae'] == pytest.approx(.75)
    assert scores['rmse'] == pytest.approx(np.sqrt(.75), abs=1e-4)
    assert scores['r2'] is not None
    assert scores['r2'] <= 1.0
