"""Instantánea operativa con inferencia bajo demanda, sin reentrenamiento."""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone, timedelta, date
from hashlib import sha256
from threading import Lock
import pandas as pd

from .database import load_operational_inputs
from .inference_service import InferenceService
from .storage import ModelStore


def _fingerprint(frame: pd.DataFrame) -> bytes:
    # Las consultas PostgreSQL entregan filas ordenadas por fecha/SKU o SKU.
    # Incluir valores, tipos y nombres, no solo fecha máxima o número de filas:
    # una venta del mismo día o un cambio de stock también invalida la caché.
    digest = sha256()
    digest.update(repr(list(zip(frame.columns, map(str, frame.dtypes)))).encode())
    digest.update(pd.util.hash_pandas_object(frame, index=False).to_numpy().tobytes())
    return digest.digest()


class OperationalForecast:
    def __init__(self, store: ModelStore):
        self.store = store
        self.inference = InferenceService(store)
        self._lock = Lock()
        self._key = None
        self._snapshot = None

    def latest(self) -> dict:
        """Leer datos vigentes y calcular solo cuando cambian entradas o modelo.

        La caché es por proceso; nunca modifica los artefactos del entrenamiento.
        Ante errores no se devuelve una instantánea vieja como si fuera vigente.
        """
        with self._lock:
            training = self.store.latest()['training']
            sales, products = load_operational_inputs()
            key = (training['id'], _fingerprint(sales), _fingerprint(products))
            if key == self._key and self._snapshot is not None:
                return deepcopy(self._snapshot)

            forecast = self.inference.by_id(training['id'], sales, products)
            cutoff = date.fromisoformat(forecast['forecastFromDate']) - timedelta(days=1)
            original_cutoff = training.get('salesCutoffDate')
            if original_cutoff and cutoff < date.fromisoformat(original_cutoff):
                raise ValueError('El historial operativo termina antes del corte del modelo entrenado; verifica la fuente de datos')
            metadata = dict(training)
            metadata.update(
                forecastGeneratedAt=datetime.now(timezone.utc).isoformat(),
                forecastSalesCutoffDate=cutoff.isoformat(),
                forecastFromDate=forecast['forecastFromDate'],
                forecastToDate=forecast['forecastToDate'],
            )
            snapshot = {
                'training': metadata,
                'predictions': forecast['predictions'],
                'replenishments': forecast['replenishments'],
            }
            self._key, self._snapshot = key, snapshot
            return deepcopy(snapshot)
