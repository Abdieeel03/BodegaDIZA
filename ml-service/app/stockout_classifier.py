"""Clasificador ML supervisado para predecir probabilidad y nivel de riesgo de agotamiento."""
from __future__ import annotations

from datetime import timedelta
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score, brier_score_loss, confusion_matrix
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.tree import DecisionTreeClassifier

from .stockout_scenarios import simulate_stockout_history, SEED, SCENARIO_DAYS

HORIZON_DAYS = 3
TARGET_VERSION = "STOCK_INSUFFICIENCY_3_CALENDAR_DAYS_V1"

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


def build_classification_dataset(sales: pd.DataFrame, products: pd.DataFrame,
                                 simulated: bool = False) -> pd.DataFrame:
    """Stock de cierre conocido y demanda de los siguientes 3 días completos.

    En escenarios, la demanda latente es conocida. En registros externos solo se
    conoce la venta registrada (proxy conservador, no demanda no atendida).
    Un día ausente nunca se transforma en cero ni en una etiqueta negativa.
    """
    if sales.empty or 'stock_final_dia' not in sales:
        return pd.DataFrame()
    x = sales.sort_values(['id_producto','fecha']).copy()
    target_col = 'demanda_latente' if simulated else 'cantidad_vendida'
    # Las fechas de etiqueta tienen que existir explícitamente para el mismo SKU.
    lookup = x[['id_producto','fecha',target_col]].copy()
    for offset in range(1,HORIZON_DAYS+1):
        shifted = lookup.rename(columns={target_col:f'future_{offset}'}).copy()
        shifted['fecha'] -= pd.Timedelta(days=offset)
        x = x.merge(shifted,on=['id_producto','fecha'],how='left',validate='one_to_one')
    future_cols = [f'future_{i}' for i in range(1,HORIZON_DAYS+1)]
    x['future_demand_3d'] = x[future_cols].sum(axis=1,min_count=HORIZON_DAYS)
    x['label_end'] = x['fecha'] + pd.Timedelta(days=HORIZON_DAYS)
    # El registro operativo contiene eventos de venta. Los ceros simulados solo
    # alimentan etiquetas, no se fabrican como observaciones para la inferencia.
    if simulated:
        x = x[x.cantidad_vendida > 0].copy()
    x = x.merge(products[['id_producto','stock_minimo_seguridad']],on='id_producto',how='left',validate='many_to_one')
    x = x.sort_values(['id_producto','fecha'])
    group = x.groupby('id_producto',sort=False)
    for n in (1,3,7):
        x[f'lag_{n}'] = group['cantidad_vendida'].shift(n-1)
    for n in (3,7,14):
        x[f'mean_{n}'] = group['cantidad_vendida'].transform(lambda v:v.rolling(n,min_periods=n).mean())
    x['std_7'] = group['cantidad_vendida'].transform(lambda v:v.rolling(7,min_periods=7).std(ddof=0))
    x['max_7'] = group['cantidad_vendida'].transform(lambda v:v.rolling(7,min_periods=7).max())
    x['cv_7'] = x['std_7']/np.maximum(x['mean_7'],.25)
    x['trend_ratio'] = x['mean_3']/np.maximum(x['mean_14'],.25)
    next_day = x['fecha']+pd.Timedelta(days=1)
    x['weekday'] = next_day.dt.dayofweek
    x['weekend'] = (x['weekday']>=5).astype(int)
    x['stock_actual'] = pd.to_numeric(x.stock_final_dia,errors='coerce')
    x = x[x.stock_actual.notna() & (x.stock_actual>=0) & x.future_demand_3d.notna()].copy()
    x['stock_ratio_min'] = x.stock_actual/np.maximum(x.stock_minimo_seguridad,1.)
    x['stock_buffer'] = x.stock_actual-x.stock_minimo_seguridad
    x['days_of_stock'] = x.stock_actual/np.maximum(x.mean_7,.25)
    # Falta de stock para cubrir la demanda de 3 días SIN entradas adicionales.
    # No usar stock mínimo como etiqueta (es una regla operativa distinta).
    x['target_stockout'] = (x.future_demand_3d > x.stock_actual).astype(int)
    x = x.dropna(subset=CLASSIFIER_FEATURES).copy()
    for col in CLASSIFIER_NUM_FEATURES:
        x[col]=x[col].astype(float)
    return x.reset_index(drop=True)


def temporal_partitions(dataset: pd.DataFrame):
    dates=sorted(dataset.fecha.unique())
    if len(dates)<45:
        raise ValueError('Historial insuficiente para clasificación temporal')
    validation=pd.Timestamp(dates[int(len(dates)*.60)])
    test=pd.Timestamp(dates[int(len(dates)*.80)])
    # Purga: ninguna etiqueta de entrenamiento mira al período siguiente.
    train_df=dataset[(dataset.fecha<validation)&(dataset.label_end<validation)]
    val_df=dataset[(dataset.fecha>=validation)&(dataset.fecha<test)&(dataset.label_end<test)]
    test_df=dataset[dataset.fecha>=test]
    if any(len(part)<15 or part.target_stockout.nunique()<2 for part in (train_df,val_df,test_df)):
        raise ValueError('Cada período necesita suficientes ejemplos de ambas clases')
    return train_df,val_df,test_df


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


def _classification_metrics(y_true: np.ndarray, y_pred: np.ndarray, y_prob: np.ndarray) -> dict:
    tn,fp,fn,tp=confusion_matrix(y_true,y_pred,labels=[0,1]).ravel()
    bins=[]
    for i in range(5):
        lo,hi=i/5,(i+1)/5
        mask=(y_prob>=lo)&((y_prob<hi) if i<4 else (y_prob<=hi))
        if mask.any():
            bins.append({'from':lo,'to':hi,'n':int(mask.sum()),
                         'meanProbability':round(float(y_prob[mask].mean()),4),
                         'observedRate':round(float(y_true[mask].mean()),4)})
    return {
        'accuracy':round(float(accuracy_score(y_true,y_pred)),4),
        'precision':round(float(precision_score(y_true,y_pred,zero_division=0)),4),
        'recall':round(float(recall_score(y_true,y_pred,zero_division=0)),4),
        'f1':round(float(f1_score(y_true,y_pred,zero_division=0)),4),
        'rocAuc':round(float(roc_auc_score(y_true,y_prob)),4) if len(set(y_true))>1 else None,
        'brierScore':round(float(brier_score_loss(y_true,y_prob)),4),
        'confusionMatrix':{'tn':int(tn),'fp':int(fp),'fn':int(fn),'tp':int(tp)},
        'reliabilityBins':bins,
    }


def _partition_summary(part: pd.DataFrame) -> dict:
    return {'from':part.fecha.min().date().isoformat(),'to':part.fecha.max().date().isoformat(),
            'labelEnd':part.label_end.max().date().isoformat(),'n':int(len(part)),
            'positive':int(part.target_stockout.sum()),'negative':int(len(part)-part.target_stockout.sum())}


def train_stockout_classifier(sales: pd.DataFrame, products: pd.DataFrame,
                              simulate: bool = False) -> tuple[Pipeline | None, dict | None]:
    source=simulate_stockout_history(sales,products) if simulate else sales
    dataset=build_classification_dataset(source,products,simulated=simulate)
    if len(dataset)<60:
        return None,None
    try:
        train_df,val_df,test_df=temporal_partitions(dataset)
    except ValueError:
        return None,None
    scores={}
    y_val=val_df.target_stockout.to_numpy(dtype=int)
    for candidate in CLASSIFIER_CANDIDATES:
        clf=_train_classifier_candidate(candidate,train_df)
        probs=clf.predict_proba(val_df[CLASSIFIER_FEATURES])[:,1]
        scores[candidate]={'metrics':_classification_metrics(y_val,(probs>=.5).astype(int),probs),'n':int(len(val_df))}
    selected=max(scores,key=lambda name:(scores[name]['metrics']['f1'],scores[name]['metrics']['rocAuc'],
                                        -scores[name]['metrics']['brierScore']))
    # Reajustar con train+validación; el test queda aislado hasta medir el ganador.
    evaluation_model=_train_classifier_candidate(selected,pd.concat([train_df,val_df],ignore_index=True))
    y_test=test_df.target_stockout.to_numpy(dtype=int)
    probs=evaluation_model.predict_proba(test_df[CLASSIFIER_FEATURES])[:,1]
    test_metrics=_classification_metrics(y_test,(probs>=.5).astype(int),probs)
    full_classifier=_train_classifier_candidate(selected,dataset)
    report={'modelName':selected,'metrics':test_metrics,'validationMetrics':scores[selected]['metrics'],
            'candidates':scores,'observationsCount':int(len(dataset)),
            'positiveRate':round(float(dataset.target_stockout.mean()),4),
            'horizonDays':HORIZON_DAYS,'targetVersion':TARGET_VERSION,'threshold':.5,
            'source':'ACADEMIC_INVENTORY_SCENARIOS' if simulate else 'OBSERVED_SALES_PROXY',
            'evaluationScope':'INDEPENDENT_TEMPORAL_TEST',
            'partitions':{'train':_partition_summary(train_df),'validation':_partition_summary(val_df),'test':_partition_summary(test_df)},
            'probabilityScope':'CONDITIONAL_NO_REPLENISHMENT_NOT_CALIBRATED_ON_REAL_OPERATIONS'}
    if simulate:
        report['scenario']={'seed':SEED,'days':SCENARIO_DAYS,'rows':int(len(source)),
                            'stockoutDays':int((source.stock_final_dia==0).sum()),
                            'unmetDemandDays':int((source.venta_no_atendida>0).sum())}
    return full_classifier,report


def _live_feature_row(
    sku: str,
    category: str,
    price: float,
    stock_actual: float,
    stock_minimo: float,
    history: pd.DataFrame,
    cutoff: pd.Timestamp | None = None,
) -> pd.DataFrame:
    values = history.sort_values('fecha')['cantidad_vendida'].to_numpy(dtype=float)
    last_date = pd.Timestamp(cutoff if cutoff is not None else history['fecha'].max())
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
    classifier: Pipeline | None,
    sales: pd.DataFrame,
    products: pd.DataFrame,
    replenishments: list[dict],
) -> list[dict]:
    """Calcula stockoutProbability, stockoutRiskLevel y daysOfStockRemaining para cada producto."""
    indexed_products = products.set_index('id_producto')
    sales_by_sku = {sku: grp for sku, grp in sales.groupby('id_producto', sort=False)}
    enriched: list[dict] = []
    cutoff = pd.Timestamp(sales.fecha.max())

    for item in replenishments:
        sku = str(item['productId'])
        stock_actual = float(item['stockActual'])
        stock_minimo = float(item['stockMinimoSeguridad'])
        demand_7d = float(item['predictedDemand7Days'])
        days_remaining = round(stock_actual / max(demand_7d / 7.0, 0.1), 1)

        history = sales_by_sku.get(sku)
        prob=None
        risk_level=None
        if classifier is not None and history is not None and len(history)>=14 and sku in indexed_products.index:
            price=float(indexed_products.loc[sku,'precio_venta_unitario'])
            row=_live_feature_row(sku,str(item['category']),price,stock_actual,stock_minimo,history,cutoff)
            prob=round(float(np.clip(classifier.predict_proba(row)[0,1],0.,1.)),4)
            risk_level='ALTO' if prob>=.65 else 'MEDIO' if prob>=.35 else 'BAJO'
        # No fabricar probabilidades para SKU sin historial o modelo no disponible.
        # El stock cero o bajo se informa por la regla operativa alertStatus.

        updated = dict(item)
        updated['stockoutProbability'] = prob
        updated['stockoutRiskLevel'] = risk_level
        updated['daysOfStockRemaining'] = days_remaining
        enriched.append(updated)

    return sorted(
        enriched,
        key=lambda v: (-float(v['stockoutProbability'] if v['stockoutProbability'] is not None else -1), -float(v['recommendedReplenishment']), str(v['productId'])),
    )
