"""Pronósticos a 7 días sin inferir que las fechas omitidas tuvieron ventas cero.

Si el archivo aporta eventos de venta y no un calendario diario completo, la
probabilidad de un evento se estima mediante la frecuencia observada. Esa
hipótesis se expone explícitamente en los metadatos y NO sustituye registros
contables ni permite afirmar que la demanda diaria real fue observada.
"""
from __future__ import annotations
from collections import defaultdict
from datetime import timedelta
import numpy as np
import pandas as pd
from .features import FEATURES, inference_row

HORIZON = 7


def _event_probability(history: pd.DataFrame, weekday: int) -> float:
    """Suavizado bayesiano por día de semana para un evento registrado."""
    start, end = history.fecha.min(), history.fecha.max()
    n_days = max(1, int((end - start).days) + 1)
    global_rate = min(1., len(history) / n_days)
    dates = pd.date_range(start, end, freq='D')
    opportunities = int((dates.dayofweek == weekday).sum())
    events = int((history.fecha.dt.dayofweek == weekday).sum())
    return float(np.clip((events + 8 * global_rate) / (opportunities + 8), 0.0, 1.0))


def predict_rows(model, model_name: str, rows: pd.DataFrame) -> np.ndarray:
    if len(rows) == 0:
        return np.zeros(0, dtype=float)
    if model_name == 'media_reciente':
        values = rows['mean_7'].to_numpy(dtype=float)
    else:
        values = model.predict(rows[FEATURES]).astype(float)
    return np.maximum(values, 0.)


def predict_horizon(model, model_name: str, history: pd.DataFrame,
                    origin: pd.Timestamp, start_date: pd.Timestamp,
                    horizon: int = HORIZON) -> pd.DataFrame:
    """Predecir 7 fechas sin acceder a observaciones posteriores a origin."""
    past = history[history.fecha <= origin]
    if past.empty:
        raise ValueError('No hay historial hasta la fecha de corte')
    baseline = history.fecha.min()
    specs = []
    records = []
    for sku, group in past.groupby('id_producto', sort=True):
        group = group.sort_values('fecha')
        if len(group) < 14:
            continue
        recent = list(zip(group.fecha.tolist(), group.cantidad_vendida.tolist()))
        last = group.iloc[-1]
        for i in range(horizon):
            date = start_date + timedelta(days=i)
            if date <= group.fecha.iloc[-1]:
                raise ValueError('La predicción debe comenzar después del historial conocido')
            records.append(inference_row(str(sku), str(last.categoria),
                         float(last.precio_venta_unitario), date, recent, baseline))
            specs.append((str(sku),str(last.nombre_producto),str(last.categoria),date,
                          _event_probability(group, int(date.dayofweek))))
    if not records:
        raise ValueError('Historial insuficiente: se necesitan 14 ventas registradas por producto')
    predicted = predict_rows(model, model_name, pd.concat(records,ignore_index=True))
    result = pd.DataFrame(specs,columns=['id_producto','nombre_producto','categoria','fecha','frecuencia_estimada'])
    result['venta_si_registrada'] = predicted
    result['demanda_esperada'] = result['frecuencia_estimada'] * predicted
    return result


def to_prediction_objects(forecast: pd.DataFrame) -> list[dict]:
    response=[]
    for sku, block in forecast.sort_values('fecha').groupby('id_producto',sort=True):
        days=[round(float(v),3) for v in block.demanda_esperada]
        row=block.iloc[0]
        response.append({'productId':str(sku),'productName':str(row.nombre_producto),
                         'category':str(row.categoria),'predictedDemand7Days':round(sum(days),3),
                         'dailyPredictions':days})
    return response


def validate_on_observed_days(model, model_name: str, sales: pd.DataFrame,
                              origins: list[pd.Timestamp]):
    """Métrica condicional a días observados, SIN falsos ceros.

    Se congelan los lags en cada corte y se pronostican los siete días siguientes.
    Solo se comparan pares SKU/fecha que sí aparecen en el CSV.
    """
    actuals=[]; predicted=[]
    for origin in origins:
        origin = pd.Timestamp(origin).normalize()
        historical = sales[sales.fecha <= origin]
        if historical.empty:
            continue
        horizon = predict_horizon(model,model_name,historical,origin,origin+timedelta(days=1))
        seen = sales[(sales.fecha > origin) & (sales.fecha <= origin+timedelta(days=HORIZON))]
        matched = seen.merge(horizon[['id_producto','fecha','venta_si_registrada']],
                             on=['id_producto','fecha'],how='inner',validate='one_to_one')
        actuals.extend(matched.cantidad_vendida.tolist())
        predicted.extend(matched.venta_si_registrada.tolist())
    return np.asarray(actuals,dtype=float),np.asarray(predicted,dtype=float)
