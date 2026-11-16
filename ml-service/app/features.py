"""Variables temporales disponibles ANTES de predecir cada fecha."""
from __future__ import annotations
from datetime import timedelta
import numpy as np
import pandas as pd

FEATURES = ['id_producto','categoria','precio_venta_unitario','weekday','month','day_of_month',
            'day_of_year','weekend','trend_days','days_since_observed',
            'lag_1','lag_3','lag_7','mean_3','mean_7','mean_14']
CAT_FEATURES = ['id_producto','categoria']
NUM_FEATURES = [x for x in FEATURES if x not in CAT_FEATURES]


def historical_features(sales: pd.DataFrame, origin: pd.Timestamp) -> pd.DataFrame:
    x = sales.sort_values(['id_producto','fecha']).copy()
    group = x.groupby('id_producto',sort=False)
    for n in [1,3,7]:
        x[f'lag_{n}'] = group['cantidad_vendida'].shift(n)
    for n in [3,7,14]:
        x[f'mean_{n}'] = group['cantidad_vendida'].transform(lambda v:v.shift(1).rolling(n,min_periods=n).mean())
    x['days_since_observed'] = (x['fecha'] - group['fecha'].shift(1)).dt.days
    x['weekday'] = x['fecha'].dt.dayofweek
    x['month'] = x['fecha'].dt.month
    x['day_of_month'] = x['fecha'].dt.day
    x['day_of_year'] = x['fecha'].dt.dayofyear
    x['weekend'] = (x['weekday'] >= 5).astype(int)
    x['trend_days'] = (x['fecha'] - origin).dt.days
    x = x.dropna(subset=['mean_14','lag_7','days_since_observed']).copy()
    for col in NUM_FEATURES:
        x[col] = x[col].astype(float)
    return x.reset_index(drop=True)


def inference_row(sku: str, category: str, price: float, date: pd.Timestamp,
                  history: list[tuple[pd.Timestamp,float]], origin: pd.Timestamp) -> pd.DataFrame:
    values = [float(v) for _,v in history]
    if len(values) < 14:
        raise ValueError(f'{sku}: se requieren al menos 14 observaciones previas')
    last_date = history[-1][0]
    record = {
        'id_producto':sku,'categoria':category,'precio_venta_unitario':float(price),
        'weekday':float(date.dayofweek),'month':float(date.month),'day_of_month':float(date.day),
        'day_of_year':float(date.dayofyear),'weekend':float(int(date.dayofweek >= 5)),
        'trend_days':float((date-origin).days),
        'days_since_observed':float((date-last_date).days),
        'lag_1':values[-1],'lag_3':values[-3],'lag_7':values[-7],
        'mean_3':float(np.mean(values[-3:])),
        'mean_7':float(np.mean(values[-7:])),
        'mean_14':float(np.mean(values[-14:])),
    }
    return pd.DataFrame([record],columns=FEATURES)
