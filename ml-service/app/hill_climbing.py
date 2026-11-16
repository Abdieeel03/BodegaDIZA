"""Optimización mediante búsqueda local Hill Climbing para hiperparámetros y compras."""
from __future__ import annotations

import math
import pandas as pd

from .forecasting import validate_on_observed_days
from .modeling import DEFAULT_PARAMS, metrics, train_model

TUNABLE_KEYS: dict[str, tuple[str, ...]] = {
    'ridge': ('alpha',),
    'decision_tree': ('max_depth', 'min_samples_leaf'),
    'random_forest': ('n_estimators', 'max_depth', 'min_samples_leaf'),
    'hist_gradient_boosting': ('learning_rate', 'max_leaf_nodes', 'min_samples_leaf', 'l2_regularization'),
}


def _tunable_subset(model_name: str, params: dict[str, object]) -> dict[str, float | int]:
    keys = TUNABLE_KEYS.get(model_name, ())
    result: dict[str, float | int] = {}
    for k in keys:
        v = params[k]
        result[k] = round(float(v), 4) if isinstance(v, float) else int(v)
    return result


def _param_key(model_name: str, params: dict[str, object]) -> tuple[tuple[str, float | int], ...]:
    return tuple((k, params[k]) for k in TUNABLE_KEYS.get(model_name, ()))


def _generate_neighbors(model_name: str, current: dict[str, object]) -> list[dict[str, object]]:
    neighbors: list[dict[str, object]] = []

    def add_variant(key: str, value: float | int) -> None:
        if value != current[key]:
            candidate = dict(current)
            candidate[key] = value
            neighbors.append(candidate)

    if model_name == 'random_forest':
        depth = int(current['max_depth'])
        leaf = int(current['min_samples_leaf'])
        for delta in (-2, 2):
            add_variant('max_depth', max(4, min(18, depth + delta)))
        for delta in (-1, 1):
            add_variant('min_samples_leaf', max(1, min(10, leaf + delta)))
    elif model_name == 'hist_gradient_boosting':
        lr = float(current['learning_rate'])
        nodes = int(current['max_leaf_nodes'])
        leaf = int(current['min_samples_leaf'])
        l2 = float(current['l2_regularization'])
        for delta in (-0.015, 0.015):
            add_variant('learning_rate', round(max(0.02, min(0.12, lr + delta)), 4))
        for delta in (-4, 4):
            add_variant('max_leaf_nodes', max(7, min(31, nodes + delta)))
        for delta in (-4, 4):
            add_variant('min_samples_leaf', max(8, min(32, leaf + delta)))
        for delta in (-2.0, 2.0):
            add_variant('l2_regularization', round(max(0.5, min(12.0, l2 + delta)), 2))
    elif model_name == 'decision_tree':
        depth = int(current['max_depth'])
        leaf = int(current['min_samples_leaf'])
        for delta in (-1, 1):
            add_variant('max_depth', max(3, min(12, depth + delta)))
        for delta in (-2, 2):
            add_variant('min_samples_leaf', max(2, min(15, leaf + delta)))
    elif model_name == 'ridge':
        alpha = float(current['alpha'])
        for candidate_alpha in (alpha * 0.5, alpha * 1.5, alpha - 5.0, alpha + 5.0):
            add_variant('alpha', round(max(0.5, min(100.0, candidate_alpha)), 2))

    return neighbors


def hill_climb_hyperparameters(
    model_name: str,
    training_data: pd.DataFrame,
    sales: pd.DataFrame,
    validation_origins: list[pd.Timestamp],
    initial_metrics: dict[str, float | None],
    max_iterations: int = 4,
) -> tuple[dict[str, object], dict[str, float | None], dict[str, object]]:
    """Refina hiperparámetros del algoritmo ganador mediante Hill Climbing sobre MAE/RMSE de validación."""
    if model_name == 'media_reciente' or model_name not in DEFAULT_PARAMS:
        return {}, initial_metrics, {
            'algorithm': 'hill_climbing',
            'modelName': model_name,
            'iterations': 0,
            'evaluatedNeighbors': 0,
            'improved': False,
            'initialMae': initial_metrics['mae'],
            'bestMae': initial_metrics['mae'],
            'bestParams': {},
            'history': [],
        }

    current_params = dict(DEFAULT_PARAMS[model_name])
    best_metrics = dict(initial_metrics)
    best_score = (float(best_metrics['mae']), float(best_metrics['rmse']))
    visited = {_param_key(model_name, current_params)}
    evaluated_neighbors = 0
    iterations = 0
    history: list[dict[str, object]] = []

    for step in range(1, max_iterations + 1):
        neighbors = _generate_neighbors(model_name, current_params)
        best_neighbor_params = None
        best_neighbor_metrics = None
        best_neighbor_score = best_score

        for neighbor in neighbors:
            key = _param_key(model_name, neighbor)
            if key in visited:
                continue
            visited.add(key)
            evaluated_neighbors += 1

            model = train_model(model_name, training_data, neighbor)
            actual, forecast = validate_on_observed_days(model, model_name, sales, validation_origins)
            if len(actual) < 5:
                continue
            cand_metrics = metrics(actual, forecast)
            cand_score = (float(cand_metrics['mae']), float(cand_metrics['rmse']))
            if cand_score < best_neighbor_score:
                best_neighbor_score = cand_score
                best_neighbor_params = neighbor
                best_neighbor_metrics = cand_metrics

        if best_neighbor_params is None or best_neighbor_metrics is None:
            break

        iterations = step
        current_params = best_neighbor_params
        best_metrics = best_neighbor_metrics
        best_score = best_neighbor_score
        history.append({
            'iteration': step,
            'mae': best_metrics['mae'],
            'rmse': best_metrics['rmse'],
            'params': _tunable_subset(model_name, current_params),
        })

    tuned = _tunable_subset(model_name, current_params)
    summary = {
        'algorithm': 'hill_climbing',
        'modelName': model_name,
        'iterations': iterations,
        'evaluatedNeighbors': evaluated_neighbors,
        'improved': len(history) > 0,
        'initialMae': initial_metrics['mae'],
        'bestMae': best_metrics['mae'],
        'bestParams': tuned,
        'history': history,
    }
    return current_params, best_metrics, summary


def _unit_utility(unit_index: int, recommended: int, min_deficit_units: int, alert_status: str) -> float:
    """Utilidad marginal de la unidad `unit_index` (1-indexed) con prioridad a alertas críticas."""
    if alert_status == 'ROJO':
        base = 3.0 if unit_index <= min_deficit_units else 1.8
    elif alert_status == 'AMARILLO':
        base = 1.5
    else:
        base = 1.0
    spread_bonus = 1.0 + 0.25 * (1.0 - (unit_index - 1) / max(recommended, 1))
    return base * spread_bonus


def optimize_replenishment_hill_climbing(
    replenishments: list[dict],
    products: pd.DataFrame,
    budget: float,
) -> dict[str, object]:
    """Asigna unidades de reposición dentro de un presupuesto usando Hill Climbing."""
    if not math.isfinite(budget) or budget < 0:
        raise ValueError('El presupuesto debe ser un número mayor o igual a cero')

    indexed = products.set_index('id_producto')
    candidates: list[dict[str, object]] = []
    for item in replenishments:
        sku = str(item['productId'])
        rec = int(math.ceil(float(item['recommendedReplenishment'])))
        if rec <= 0 or sku not in indexed.index:
            continue
        row = indexed.loc[sku]
        unit_cost = None
        if 'costo_compra_unitario' in indexed.columns and pd.notna(row.costo_compra_unitario):
            c = float(row.costo_compra_unitario)
            if math.isfinite(c) and c > 0:
                unit_cost = c
        if unit_cost is None:
            unit_cost = float(row.precio_venta_unitario)
        if not math.isfinite(unit_cost) or unit_cost <= 0:
            continue
        min_deficit = max(0.0, float(item['stockMinimoSeguridad']) - float(item['stockActual']))
        candidates.append({
            'productId': sku,
            'productName': item['productName'],
            'category': item['category'],
            'alertStatus': item['alertStatus'],
            'recommended': rec,
            'minDeficitUnits': int(math.ceil(min_deficit)),
            'unitCost': round(unit_cost, 2),
        })

    qty = {str(c['productId']): 0 for c in candidates}
    meta = {str(c['productId']): c for c in candidates}
    spent = 0.0
    total_score = 0.0
    iterations = 0

    while True:
        best_action = None
        best_gain = 1e-9
        best_cost_delta = 0.0

        # Vecinos +1 unidad
        for sku, c in meta.items():
            q = qty[sku]
            cost = float(c['unitCost'])
            if q < int(c['recommended']) and spent + cost <= budget + 1e-9:
                gain = _unit_utility(q + 1, int(c['recommended']), int(c['minDeficitUnits']), str(c['alertStatus']))
                if gain > best_gain + 1e-9 or (abs(gain - best_gain) <= 1e-9 and (best_action is None or cost < best_cost_delta)):
                    best_gain = gain
                    best_action = ('add', sku, None)
                    best_cost_delta = cost

        # Vecinos de intercambio (-1, +1) cuando el presupuesto restringe
        for drop_sku, drop_c in meta.items():
            q_drop = qty[drop_sku]
            if q_drop <= 0:
                continue
            loss = _unit_utility(q_drop, int(drop_c['recommended']), int(drop_c['minDeficitUnits']), str(drop_c['alertStatus']))
            drop_cost = float(drop_c['unitCost'])
            for add_sku, add_c in meta.items():
                if add_sku == drop_sku:
                    continue
                q_add = qty[add_sku]
                if q_add >= int(add_c['recommended']):
                    continue
                add_cost = float(add_c['unitCost'])
                cost_delta = add_cost - drop_cost
                if spent + cost_delta > budget + 1e-9:
                    continue
                gain = _unit_utility(q_add + 1, int(add_c['recommended']), int(add_c['minDeficitUnits']), str(add_c['alertStatus'])) - loss
                if gain > best_gain + 1e-9:
                    best_gain = gain
                    best_action = ('swap', add_sku, drop_sku)
                    best_cost_delta = cost_delta

        if best_action is None:
            break

        iterations += 1
        kind, add_sku, drop_sku = best_action
        if kind == 'add' and add_sku is not None:
            qty[add_sku] += 1
        elif kind == 'swap' and add_sku is not None and drop_sku is not None:
            qty[drop_sku] -= 1
            qty[add_sku] += 1
        spent = round(spent + best_cost_delta, 4)
        total_score += best_gain

    plan = []
    for c in candidates:
        sku = str(c['productId'])
        allocated = qty[sku]
        rec = int(c['recommended'])
        unit_cost = float(c['unitCost'])
        plan.append({
            'productId': sku,
            'productName': c['productName'],
            'category': c['category'],
            'alertStatus': c['alertStatus'],
            'recommendedReplenishment': rec,
            'allocatedUnits': allocated,
            'unmetUnits': rec - allocated,
            'unitCost': unit_cost,
            'totalCost': round(allocated * unit_cost, 2),
        })

    plan.sort(key=lambda item: (-int(item['allocatedUnits']), str(item['productId'])))
    return {
        'algorithm': 'hill_climbing',
        'budget': round(float(budget), 2),
        'budgetUsed': round(spent, 2),
        'budgetRemaining': round(max(0.0, float(budget) - spent), 2),
        'iterations': iterations,
        'coverageScore': round(total_score, 3),
        'items': plan,
    }
