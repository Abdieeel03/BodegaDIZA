"""El precio de venta nunca sustituye al costo de adquisición."""
import pandas as pd
import pytest
from app.hill_climbing import optimize_replenishment_hill_climbing


def need(sku='P001', quantity=3):
    return {'productId': sku, 'productName': 'Leche', 'category': 'Lacteos', 'alertStatus': 'ROJO',
            'recommendedReplenishment': quantity, 'stockActual': 1, 'stockMinimoSeguridad': 4}


def test_uses_acquisition_cost_not_sale_price():
    products = pd.DataFrame([{'id_producto':'P001', 'precio_venta_unitario':4.20, 'costo_compra_unitario':3.45}])
    plan = optimize_replenishment_hill_climbing([need()], products, 10.35)
    assert plan['items'][0]['allocatedUnits'] == 3
    assert plan['items'][0]['unitCost'] == 3.45
    assert plan['budgetUsed'] == 10.35


@pytest.mark.parametrize('cost', [None, 0, -1, float('nan'), float('inf')])
def test_missing_or_invalid_cost_is_rejected(cost):
    products = pd.DataFrame([{'id_producto':'P001', 'precio_venta_unitario':4.20, 'costo_compra_unitario':cost}])
    with pytest.raises(ValueError, match='P001'):
        optimize_replenishment_hill_climbing([need()], products, 20)


def test_absent_cost_column_is_not_replaced_with_sale_price():
    products = pd.DataFrame([{'id_producto':'P001', 'precio_venta_unitario':4.20}])
    with pytest.raises(ValueError, match='P001'):
        optimize_replenishment_hill_climbing([need()], products, 20)


def test_no_need_does_not_require_cost():
    products = pd.DataFrame([{'id_producto':'P001', 'precio_venta_unitario':4.20}])
    plan = optimize_replenishment_hill_climbing([need(quantity=0)], products, 20)
    assert plan['items'] == [] and plan['budgetUsed'] == 0
