"""Fachada: ingesta/entrenamiento/lectura independiente del framework HTTP."""
from __future__ import annotations
import os
from pathlib import Path
from fastapi import UploadFile
from starlette.concurrency import run_in_threadpool
from ..database import load_from_db
from ..ingestion import read_table
from ..schemas import TrainingResult,PredictionResult,ReplenishmentResult
from ..storage import ModelStore
from ..training_engine import TrainingEngine
from ..operational_forecast import OperationalForecast
from ..stockout_scenarios import simulation_enabled_for_db

class TrainingService:
    def __init__(self,model_dir:str|Path|None=None):
        self.store=ModelStore(model_dir or os.environ.get('ML_MODEL_DIR','data/models'))
        self.engine=TrainingEngine(self.store)
        self.operational=OperationalForecast(self.store)

    async def train(self,sales_file:UploadFile|None=None,products_file:UploadFile|None=None,
                    suppliers_file:UploadFile|None=None)->TrainingResult:
        if (sales_file is None) != (products_file is None):
            raise ValueError('Debes enviar ambos archivos (ventas y productos) o ninguno para usar la base de datos')
        if sales_file is not None and products_file is not None:
            sales=read_table(sales_file.filename or 'ventas.csv',await sales_file.read())
            products=read_table(products_file.filename or 'productos.csv',await products_file.read())
            suppliers=(read_table(suppliers_file.filename or 'proveedores.csv',await suppliers_file.read())
                       if suppliers_file else None)
        else:
            sales,products,suppliers=await run_in_threadpool(load_from_db)
        simulate = sales_file is None and simulation_enabled_for_db()
        output=await run_in_threadpool(self.engine.train,sales,products,suppliers,simulate_stockout=simulate)
        return TrainingResult.model_validate(output['training'])

    def get_training(self,training_id:str)->TrainingResult:
        return TrainingResult.model_validate(self.store.get(training_id)['training'])

    def get_latest_training(self)->TrainingResult:
        return TrainingResult.model_validate(self.store.latest()['training'])

    def get_latest_predictions(self)->list[PredictionResult]:
        return [PredictionResult.model_validate(x) for x in self.store.latest()['predictions']]

    def get_latest_replenishments(self)->list[ReplenishmentResult]:
        return [ReplenishmentResult.model_validate(x) for x in self.store.latest()['replenishments']]

    def get_latest_comparison(self)->dict:
        data=self.store.latest()
        keys=['training','validationCandidates','dataCoverage','providersCount']
        result={key:data[key] for key in keys}
        for optional_key in ('hillClimbing', 'classification'):
            if optional_key in data:
                result[optional_key] = data[optional_key]
        return result
