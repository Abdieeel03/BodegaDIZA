"""Escenarios académicos reproducibles, independientes del inventario operativo.

La demanda latente solo se usa para etiquetas; el modelo recibe ventas atendidas.
No se escriben ventas, stock, lotes ni movimientos en PostgreSQL.
"""
from __future__ import annotations
import os
import numpy as np
import pandas as pd

SEED = 42
SCENARIO_DAYS = 240


def simulation_enabled_for_db() -> bool:
    # Autorizado para la base académica del equipo, nunca implícito en producción.
    return os.environ.get('DB_NAME', 'bodega_diza') == 'bodega_diza_test'


def simulate_stockout_history(sales: pd.DataFrame, products: pd.DataFrame,
                              seed: int = SEED, days: int = SCENARIO_DAYS) -> pd.DataFrame:
    if days < 90:
        raise ValueError('Se requieren al menos 90 días de escenario')
    # Aprender escalas solamente del tramo inicial, no de la prueba final de demanda.
    dates = sorted(sales.fecha.unique())
    initial = sales[sales.fecha <= dates[max(0, min(89, len(dates)//2-1))]]
    rng = np.random.default_rng(seed)
    calendar = pd.date_range('2025-01-01', periods=days)
    rows = []
    for p in products.sort_values('id_producto').itertuples(index=False):
        hist = initial[initial.id_producto == p.id_producto]
        if len(hist) < 7:
            continue
        mean = max(float(hist.cantidad_vendida.mean()), .5)
        by_day = hist.groupby(hist.fecha.dt.dayofweek).cantidad_vendida.mean().to_dict()
        # Revisión diaria, lotes de tamaños diversos y entregas con plazo variable.
        minimum = float(p.stock_minimo_seguridad)
        stock = float(round(max(minimum, mean*rng.uniform(2,6))))
        pending = None
        regime = 1.0
        for i, day in enumerate(calendar):
            if i % 14 == 0:
                regime = float(rng.choice([.45,.75,1.,1.2,1.65],p=[.12,.18,.40,.2,.10]))
            receipt = 0.0
            opening = stock
            if pending is not None and i == pending[0]:
                receipt = pending[1]
                stock += receipt
                pending = None
            rate = max(.1, float(by_day.get(day.dayofweek, mean))*regime)
            # Variación estocástica de ventas y picos ocasionales independientes de la reposición.
            latent = float(rng.poisson(rate * rng.gamma(5.,.2)))
            if rng.random() < .045:
                latent += float(rng.poisson(mean*1.5))
            sold = min(stock, latent)
            stock -= sold
            rows.append(dict(fecha=day,id_producto=str(p.id_producto),nombre_producto=p.nombre_producto,
                categoria=p.categoria,precio_venta_unitario=float(p.precio_venta_unitario),
                cantidad_vendida=sold,stock_final_dia=stock,demanda_latente=latent,
                stock_apertura=opening,entrada=receipt,venta_no_atendida=latent-sold))
            reorder = max(minimum*.75, mean*rng.uniform(1.4,3.8))
            if pending is None and stock <= reorder:
                lead = int(rng.integers(1,5)) + (int(rng.integers(2,5)) if rng.random()<.18 else 0)
                qty = float(max(1, round(mean*rng.uniform(3.0,8.0))))
                pending = (i+lead, qty)
    return pd.DataFrame(rows)
