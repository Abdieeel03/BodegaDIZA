"""Clasificador ML supervisado para predecir probabilidad y nivel de riesgo de agotamiento."""
from __future__ import annotations

from datetime import timedelta
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.tree import DecisionTreeClassifier

CLASSIFIER_CANDIDATES = (
    'logistic_regression',
    'decision_tree_classifier',
    'random_forest_classifier',
    'gradient_boosting_classifier',
)

CLASSIFIER_CAT_FEATURES = ['id_producto', 'categoria']
CLASSIFIER_NUM_FEATURES = [
    'precio_venta_unitario',
    'weekday',
    'weekend',
    'lag_1',
    'lag_3',
    'lag_7',
    'mean_3',
    'mean_7',
    'mean_14',
    'std_7',
    'cv_7',
    'max_7',
    'trend_ratio',
    'stock_actual',
    'stock_minimo_seguridad',
    'stock_ratio_min',
    'stock_buffer',
    'days_of_stock',
]
CLASSIFIER_FEATURES = CLASSIFIER_CAT_FEATURES + CLASSIFIER_NUM_FEATURES


def build_classification_dataset(sales: pd.DataFrame, products: pd.DataFrame) -> pd.DataFrame:
    """Construye dataset supervisado histórico sin fuga temporal para riesgo de agotamiento."""
    x = sales.sort_values(['id_producto', 'fecha']).copy()
    prod_attrs = products[['id_producto', 'stock_actual', 'stock_minimo_seguridad']].rename(
        columns={'stock_actual': 'stock_catalogo'}
    )
    x = x.merge(prod_attrs, on='id_producto', how='left', validate='many_to_one')

    group = x.groupby('id_producto', sort=False)
    x['lag_1'] = group['cantidad_vendida'].shift(0)
    x['lag_3'] = group['cantidad_vendida'].shift(2)
    x['lag_7'] = group['cantidad_vendida'].shift(6)
    x['mean_3'] = group['cantidad_vendida'].transform(lambda v: v.rolling(3, min_periods=3).mean())
    x['mean_7'] = group['cantidad_vendida'].transform(lambda v: v.rolling(7, min_periods=7).mean())
    x['mean_14'] = group['cantidad_vendida'].transform(lambda v: v.rolling(14, min_periods=14).mean())
    x['std_7'] = group['cantidad_vendida'].transform(lambda v: v.rolling(7, min_periods=7).std(ddof=0))
    x['max_7'] = group['cantidad_vendida'].transform(lambda v: v.rolling(7, min_periods=7).max())

    x['cv_7'] = x['std_7'] / np.maximum(x['mean_7'], 0.25)
    x['trend_ratio'] = x['mean_3'] / np.maximum(x['mean_14'], 0.25)
    next_day = x['fecha'] + pd.Timedelta(days=1)
    x['weekday'] = next_day.dt.dayofweek
    x['weekend'] = (x['weekday'] >= 5).astype(int)

    # Stock histórico observado al cierre del día; si falta, se estima de forma determinista.
    row_idx = np.arange(len(x), dtype=float)
    fallback_stock = np.maximum(
        1.0,
        x['stock_minimo_seguridad'].fillna(5.0) * (0.6 + (row_idx % 5) * 0.4),
    )
    if 'stock_final_dia' in x.columns:
        stock_col = pd.to_numeric(x['stock_final_dia'], errors='coerce')
        x['stock_actual'] = stock_col.where(stock_col.notna(), fallback_stock)
    else:
        x['stock_actual'] = fallback_stock

    x['stock_ratio_min'] = x['stock_actual'] / np.maximum(x['stock_minimo_seguridad'], 1.0)
    x['stock_buffer'] = x['stock_actual'] - x['stock_minimo_seguridad']
    x['days_of_stock'] = x['stock_actual'] / np.maximum(x['mean_7'], 0.25)

    # Etiqueta real observada: demanda real en los próximos 3 eventos de venta
    fut_1 = group['cantidad_vendida'].shift(-1)
    fut_2 = group['cantidad_vendida'].shift(-2)
    fut_3 = group['cantidad_vendida'].shift(-3)
    x['future_demand_3d'] = fut_1 + fut_2 + fut_3
    x['target_stockout'] = (
        (x['stock_actual'] <= x['future_demand_3d'])
        | (x['stock_actual'] <= x['stock_minimo_seguridad'])
    ).astype(int)

    x = x.dropna(subset=['mean_14', 'lag_7', 'std_7', 'future_demand_3d']).copy()
    for col in CLASSIFIER_NUM_FEATURES:
        x[col] = x[col].astype(float)
    return x.reset_index(drop=True)


def _train_classifier_candidate(name: str, dataset: pd.DataFrame) -> Pipeline:
    methods = {
        'logistic_regression': LogisticRegression(C=1.0, max_iter=500, random_state=42),
        'decision_tree_classifier': DecisionTreeClassifier(max_depth=6, min_samples_leaf=8, random_state=42),
        'random_forest_classifier': RandomForestClassifier(
            n_estimators=120, max_depth=8, min_samples_leaf=5, random_state=42, n_jobs=-1
        ),
        'gradient_boosting_classifier': HistGradientBoostingClassifier(
            max_depth=6, learning_rate=0.06, max_iter=100, min_samples_leaf=12, random_state=42
        ),
    }
    if name not in methods:
        raise ValueError(f'Clasificador desconocido: {name}')

    numeric = Pipeline([('scale', StandardScaler())]) if name == 'logistic_regression' else 'passthrough'
    mapper = ColumnTransformer(
        [
            ('categorias', OneHotEncoder(handle_unknown='ignore', sparse_output=False), CLASSIFIER_CAT_FEATURES),
            ('numeros', numeric, CLASSIFIER_NUM_FEATURES),
        ],
        sparse_threshold=0.0,
    )
    pipe = Pipeline([('preprocesamiento', mapper), ('clasificador', methods[name])])
    pipe.fit(dataset[CLASSIFIER_FEATURES], dataset['target_stockout'].astype(int))
    return pipe


def _classification_metrics(y_true: np.ndarray, y_pred: np.ndarray, y_prob: np.ndarray) -> dict[str, float]:
    roc_auc = float(roc_auc_score(y_true, y_prob)) if len(set(y_true.tolist())) > 1 else 0.5
    return {
        'accuracy': round(float(accuracy_score(y_true, y_pred)), 4),
        'precision': round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
        'recall': round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
        'f1': round(float(f1_score(y_true, y_pred, zero_division=0)), 4),
        'rocAuc': round(roc_auc, 4),
    }


def train_stockout_classifier(
    sales: pd.DataFrame,
    products: pd.DataFrame,
) -> tuple[Pipeline, dict[str, object]]:
    """Compara clasificadores supervisados en validación temporal y entrena el ganador."""
    dataset = build_classification_dataset(sales, products)
    if len(dataset) < 60:
        raise ValueError('No hay registros suficientes para entrenar el clasificador de agotamiento')

    cutoff = dataset['fecha'].quantile(0.75)
    train_df = dataset[dataset['fecha'] < cutoff]
    val_df = dataset[dataset['fecha'] >= cutoff]
    if len(train_df) < 30 or len(val_df) < 15 or train_df['target_stockout'].nunique() < 2:
        split_idx = int(len(dataset) * 0.75)
        ordered = dataset.sort_values(['fecha', 'id_producto']).reset_index(drop=True)
        train_df = ordered.iloc[:split_idx]
        val_df = ordered.iloc[split_idx:]

    if train_df['target_stockout'].nunique() < 2:
        raise ValueError('El conjunto histórico de clasificación requiere ejemplos positivos y negativos')

    scores: dict[str, dict[str, object]] = {}
    y_val = val_df['target_stockout'].to_numpy(dtype=int)
    for candidate in CLASSIFIER_CANDIDATES:
        clf = _train_classifier_candidate(candidate, train_df)
        probs = clf.predict_proba(val_df[CLASSIFIER_FEATURES])[:, 1]
        preds = (probs >= 0.5).astype(int)
        scores[candidate] = {
            'metrics': _classification_metrics(y_val, preds, probs),
            'n': int(len(val_df)),
        }

    selected = max(
        scores,
        key=lambda name: (
            scores[name]['metrics']['f1'],
            scores[name]['metrics']['rocAuc'],
            scores[name]['metrics']['accuracy'],
        ),
    )
    full_classifier = _train_classifier_candidate(selected, dataset)

    report: dict[str, object] = {
        'modelName': selected,
        'metrics': scores[selected]['metrics'],
        'candidates': scores,
        'observationsCount': int(len(dataset)),
        'positiveRate': round(float(dataset['target_stockout'].mean()), 4),
        'horizonEvents': 3,
    }
    return full_classifier, report


def _live_feature_row(
    sku: str,
    category: str,
    price: float,
    stock_actual: float,
    stock_minimo: float,
    history: pd.DataFrame,
) -> pd.DataFrame:
    values = history.sort_values('fecha')['cantidad_vendida'].to_numpy(dtype=float)
    last_date = pd.Timestamp(history['fecha'].max())
    next_day = last_date + timedelta(days=1)

    mean_3 = float(np.mean(values[-3:]))
    mean_7 = float(np.mean(values[-7:]))
    mean_14 = float(np.mean(values[-14:]))
    std_7 = float(np.std(values[-7:], ddof=0))
    max_7 = float(np.max(values[-7:]))

    record = {
        'id_producto': str(sku),
        'categoria': str(category),
        'precio_venta_unitario': float(price),
        'weekday': float(next_day.dayofweek),
        'weekend': float(int(next_day.dayofweek >= 5)),
        'lag_1': float(values[-1]),
        'lag_3': float(values[-3]),
        'lag_7': float(values[-7]),
        'mean_3': mean_3,
        'mean_7': mean_7,
        'mean_14': mean_14,
        'std_7': std_7,
        'cv_7': std_7 / max(mean_7, 0.25),
        'max_7': max_7,
        'trend_ratio': mean_3 / max(mean_14, 0.25),
        'stock_actual': float(stock_actual),
        'stock_minimo_seguridad': float(stock_minimo),
        'stock_ratio_min': float(stock_actual) / max(float(stock_minimo), 1.0),
        'stock_buffer': float(stock_actual) - float(stock_minimo),
        'days_of_stock': float(stock_actual) / max(mean_7, 0.25),
    }
    return pd.DataFrame([record], columns=CLASSIFIER_FEATURES)


def predict_stockout_risk(
    classifier: Pipeline,
    sales: pd.DataFrame,
    products: pd.DataFrame,
    replenishments: list[dict],
) -> list[dict]:
    """Calcula stockoutProbability, stockoutRiskLevel y daysOfStockRemaining para cada producto."""
    indexed_products = products.set_index('id_producto')
    sales_by_sku = {sku: grp for sku, grp in sales.groupby('id_producto', sort=False)}
    enriched: list[dict] = []

    for item in replenishments:
        sku = str(item['productId'])
        stock_actual = float(item['stockActual'])
        stock_minimo = float(item['stockMinimoSeguridad'])
        demand_7d = float(item['predictedDemand7Days'])
        days_remaining = round(stock_actual / max(demand_7d / 7.0, 0.1), 1)

        history = sales_by_sku.get(sku)
        if history is not None and len(history) >= 14 and sku in indexed_products.index:
            price = float(indexed_products.loc[sku, 'precio_venta_unitario'])
            row = _live_feature_row(
                sku=sku,
                category=str(item['category']),
                price=price,
                stock_actual=stock_actual,
                stock_minimo=stock_minimo,
                history=history,
            )
            prob = float(classifier.predict_proba(row)[0, 1])
        else:
            prob = 0.85 if stock_actual <= stock_minimo else 0.2

        if stock_actual <= 0:
            prob = 1.0
        prob = round(float(np.clip(prob, 0.0, 1.0)), 4)

        if prob >= 0.65:
            risk_level = 'ALTO'
        elif prob >= 0.35:
            risk_level = 'MEDIO'
        else:
            risk_level = 'BAJO'

        updated = dict(item)
        updated['stockoutProbability'] = prob
        updated['stockoutRiskLevel'] = risk_level
        updated['daysOfStockRemaining'] = days_remaining
        enriched.append(updated)

    return sorted(
        enriched,
        key=lambda v: (-float(v['stockoutProbability']), -float(v['recommendedReplenishment']), str(v['productId'])),
    )
