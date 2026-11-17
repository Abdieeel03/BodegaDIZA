"""Reglas de inventario desacopladas del entrenamiento predictivo."""
from __future__ import annotations
import math
import pandas as pd


def recommend(predictions: list[dict], products: pd.DataFrame) -> list[dict]:
    indexed = products.set_index('id_producto')
    result=[]
    for p in predictions:
        sku=p['productId']
        if sku not in indexed.index:
            continue
        product=indexed.loc[sku]
        stock=float(product.stock_actual)
        minimum=float(product.stock_minimo_seguridad)
        demand=float(p['predictedDemand7Days'])
        if not all(math.isfinite(x) and x>=0 for x in [stock,minimum,demand]):
            raise ValueError(f'Inventario inválido para SKU {sku}')
        target=max(0.,demand+minimum-stock)
        # Unidades de venta: sugerir redondeo superior conservador
        replenishment=math.ceil(target)
        alert = 'ROJO' if stock<=minimum else 'AMARILLO' if replenishment>0 else 'VERDE'
        result.append({'productId':sku,'productName':p['productName'],
                       'category':p['category'],'stockActual':stock,
                       'stockMinimoSeguridad':minimum,'predictedDemand7Days':demand,
                       'recommendedReplenishment':float(replenishment),'alertStatus':alert})
    return sorted(result,key=lambda v:(-v['recommendedReplenishment'],v['productId']))
