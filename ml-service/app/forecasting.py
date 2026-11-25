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


def demand_shift(history: pd.DataFrame, origin: pd.Timestamp) -> dict:
    """Cambio de nivel por SKU, usando solo observaciones disponibles al corte.

    Las ventanas son calendarias; las fechas sin registros no se convierten en cero.
    Los umbrales son una política inicial fija, no calibrada con el test final.
    """
    origin = pd.Timestamp(origin).normalize()
    ordered = history.loc[history.fecha <= origin].sort_values('fecha')
    recent = ordered.loc[ordered.fecha > origin - timedelta(days=14)].tail(7)
    previous = ordered.loc[(ordered.fecha <= origin - timedelta(days=14)) &
                           (ordered.fecha > origin - timedelta(days=120))].tail(21)
    result = {'recentObservations': int(len(recent)), 'previousObservations': int(len(previous)),
              'recentMean': None, 'previousMean': None, 'relativeChange': None,
              'adaptationWeight': 0.0, 'direction': 'INSUFFICIENT_DATA'}
    if len(recent) < 5 or len(previous) < 8:
        return result
    recent_mean = float(recent.cantidad_vendida.mean())
    previous_mean = float(previous.cantidad_vendida.mean())
    change = (recent_mean - previous_mean) / max(previous_mean, 1.0)
    # Umbral de 25% y cambio absoluto >= 1 unidad; peso gradual, máximo 90%.
    weight = min(0.90, max(0.0, (abs(change) - 0.25) / 0.60)) if abs(recent_mean - previous_mean) >= 1 else 0.0
    result.update(recentMean=recent_mean, previousMean=previous_mean,
                  relativeChange=round(change, 4), adaptationWeight=weight,
                  direction=('UP' if change > 0 else 'DOWN') if weight > 0 else 'STABLE')
    return result


def _event_probability(history: pd.DataFrame, weekday: int, origin: pd.Timestamp | None = None,
                       adaptive: bool = True) -> float:
    """Frecuencia de registros estimada; no afirma que los días omitidos sean ceros."""
    start, end = history.fecha.min(), history.fecha.max()
    n_days = max(1, int((end - start).days) + 1)
    global_rate = min(1., len(history) / n_days)
    dates = pd.date_range(start, end, freq='D')
    opportunities = int((dates.dayofweek == weekday).sum())
    events = int((history.fecha.dt.dayofweek == weekday).sum())
    base = float(np.clip((events + 8 * global_rate) / (opportunities + 8), 0.0, 1.0))
    if not adaptive or origin is None or (origin - start).days < 42:
        return base
    recent = history.loc[history.fecha > origin - timedelta(days=14)]
    previous = history.loc[(history.fecha > origin - timedelta(days=42)) &
                           (history.fecha <= origin - timedelta(days=14))]
    recent_rate, previous_rate = len(recent) / 14, len(previous) / 28
    # Solo elevar o reducir la frecuencia con evidencia de suficientes registros recientes.
    if len(recent) >= 5 and len(previous) >= 5 and abs(recent_rate - previous_rate) >= 0.20:
        return float(np.clip(0.25 * base + 0.75 * recent_rate, 0.0, 1.0))
    return base


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
                    horizon: int = HORIZON, *, adaptive: bool = True) -> pd.DataFrame:
    """Predecir 7 fechas sin acceder a observaciones posteriores a origin."""
    past = history[history.fecha <= origin]
    if past.empty:
        raise ValueError('No hay historial hasta la fecha de corte')
    baseline = past.fecha.min()
    specs = []
    records = []
    adjustments = []
    for sku, group in past.groupby('id_producto', sort=True):
        group = group.sort_values('fecha')
        if len(group) < 14:
            continue
        recent = list(zip(group.fecha.tolist(), group.cantidad_vendida.tolist()))
        last = group.iloc[-1]
        shift = demand_shift(group, origin) if adaptive else {}
        for i in range(horizon):
            date = start_date + timedelta(days=i)
            if date <= group.fecha.iloc[-1]:
                raise ValueError('La predicción debe comenzar después del historial conocido')
            records.append(inference_row(str(sku), str(last.categoria),
                         float(last.precio_venta_unitario), date, recent, baseline))
            specs.append((str(sku),str(last.nombre_producto),str(last.categoria),date,
                          _event_probability(group, int(date.dayofweek), origin, adaptive)))
            adjustments.append((float(shift.get("adaptationWeight", 0.0)), float(shift.get("recentMean") or 0.0)))
    if not records:
        raise ValueError('Historial insuficiente: se necesitan 14 ventas registradas por producto')
    predicted = predict_rows(model, model_name, pd.concat(records,ignore_index=True))
    result = pd.DataFrame(specs,columns=['id_producto','nombre_producto','categoria','fecha','frecuencia_estimada'])
    weights, levels = np.asarray(adjustments, dtype=float).T
    result['venta_si_registrada'] = (1.0 - weights) * predicted + weights * levels
    result['demanda_esperada'] = result['frecuencia_estimada'] * result['venta_si_registrada']
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
                              origins: list[pd.Timestamp], *, adaptive: bool = True):
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
        horizon = predict_horizon(model,model_name,historical,origin,origin+timedelta(days=1), adaptive=adaptive)
        seen = sales[(sales.fecha > origin) & (sales.fecha <= origin+timedelta(days=HORIZON))]
        matched = seen.merge(horizon[['id_producto','fecha','venta_si_registrada']],
                             on=['id_producto','fecha'],how='inner',validate='one_to_one')
        actuals.extend(matched.cantidad_vendida.tolist())
        predicted.extend(matched.venta_si_registrada.tolist())
    return np.asarray(actuals,dtype=float),np.asarray(predicted,dtype=float)
