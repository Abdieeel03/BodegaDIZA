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


def optimize_replenishment_hill_climbing(
    replenishments: list[dict], products: pd.DataFrame, budget: float,
) -> dict[str, object]:
    """Mantiene el contrato existente; el optimizador de compras es independiente del ajuste ML."""
    from .purchase_optimizer import optimize
    return optimize(replenishments, products, budget)
