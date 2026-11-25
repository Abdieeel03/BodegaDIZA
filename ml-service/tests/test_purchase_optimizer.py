import random
from decimal import Decimal
import pandas as pd
import pytest
from app.hill_climbing import optimize_replenishment_hill_climbing as optimize


def data(specs):
    needs, products = [], []
    for sku, cost, need, risk, status in specs:
        needs.append(dict(productId=sku, productName=sku, category='Abarrotes', alertStatus=status,
                          recommendedReplenishment=need, stockActual=1, stockMinimoSeguridad=3,
                          stockoutProbability=risk))
        products.append(dict(id_producto=sku, costo_compra_unitario=cost, precio_venta_unitario=99,
                             proveedor='Proveedor '+sku[0], proveedor_activo=True))
    return needs, pd.DataFrame(products)


def test_cents_never_exceed_budget():
    needs, products = data([('A', .1, 9, .5, 'ROJO'), ('B', .2, 9, .5, 'ROJO')])
    plan = optimize(needs, products, .3)
    assert plan['budgetUsed'] == .3 and plan['budgetRemaining'] == 0
    assert sum(Decimal(str(i['totalCost'])) for i in plan['items']) == Decimal('.30')


@pytest.mark.parametrize('budget', [-1, .001, float('nan'), float('inf')])
def test_invalid_budget(budget):
    needs, products = data([('A', 2, 3, .5, 'ROJO')])
    with pytest.raises(ValueError, match='Presupuesto'):
        optimize(needs, products, budget)


def test_higher_risk_selected_with_equal_cost_and_priority():
    needs, products = data([('A', 2, 3, .1, 'ROJO'), ('B', 2, 3, .95, 'ROJO')])
    by_sku = {i['productId']: i for i in optimize(needs, products, 2)['items']}
    assert by_sku['B']['allocatedUnits'] == 1 and by_sku['A']['allocatedUnits'] == 0


def test_efficiency_and_multiunit_exchange():
    needs, products = data([('A', 10, 5, .95, 'ROJO'), ('B', 2, 5, .8, 'ROJO')])
    plan = optimize(needs, products, 10)
    assert plan['coverageScore'] > plan['initialCoverageScore']
    assert plan['totalAllocatedUnits'] >= 4


def test_full_budget_never_overbuys():
    needs, products = data([('A', 3, 2, None, 'ROJO'), ('B', 5, 3, .2, 'AMARILLO')])
    plan = optimize(needs, products, 100)
    assert plan['budgetUsed'] == 21 and plan['budgetRemaining'] == 79
    assert plan['coveragePercent'] == 100 and plan['totalUnmetUnits'] == 0
    assert plan['items'][0]['stockoutProbability'] is None


def test_insufficient_budget_keeps_unmet_items_and_supplier():
    needs, products = data([('A', 3, 2, None, 'ROJO'), ('B', 5, 3, .2, 'AMARILLO')])
    plan = optimize(needs, products, .01)
    assert plan['totalAllocatedUnits'] == 0 and plan['totalUnmetUnits'] == 5
    assert len(plan['items']) == 2 and plan['items'][0]['supplier'] == 'Proveedor A'


def test_inactive_supplier_rejected():
    needs, products = data([('A', 3, 2, .1, 'ROJO')])
    products.loc[0,'proveedor_activo'] = False
    with pytest.raises(ValueError, match='inactivo'):
        optimize(needs, products, 10)


def test_invariants_deterministic_random_catalogues():
    rng = random.Random(42)
    for _ in range(25):
        needs, products = data([(str(i), rng.randrange(1,1000)/100, rng.randrange(1,15), rng.random(), rng.choice(['ROJO','AMARILLO','VERDE'])) for i in range(6)])
        budget = rng.randrange(1,20000)/100
        plan = optimize(needs, products, budget)
        assert plan == optimize(list(reversed(needs)), products.iloc[::-1], budget)
        assert Decimal(str(plan['budgetUsed'])) + Decimal(str(plan['budgetRemaining'])) == Decimal(str(budget))
        assert sum(Decimal(str(i['totalCost'])) for i in plan['items']) == Decimal(str(plan['budgetUsed']))
        assert 0 <= plan['coveragePercent'] <= 100
        assert plan['coverageScore'] >= plan['initialCoverageScore']
        assert plan['totalNeededUnits'] == plan['totalAllocatedUnits'] + plan['totalUnmetUnits']
        for i in plan['items']:
            assert 0 <= i['allocatedUnits'] <= i['recommendedReplenishment']
            assert i['unmetUnits'] == i['recommendedReplenishment'] - i['allocatedUnits']
