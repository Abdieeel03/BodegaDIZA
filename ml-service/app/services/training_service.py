"""Fachada: ingesta/entrenamiento/lectura independiente del framework HTTP."""
from __future__ import annotations
import os
from pathlib import Path
from fastapi import UploadFile
from starlette.concurrency import run_in_threadpool
from ..ingestion import read_table
from ..schemas import TrainingResult,PredictionResult,ReplenishmentResult
from ..storage import ModelStore
from ..training_engine import TrainingEngine

class TrainingService:
    def __init__(self,model_dir:str|Path|None=None):
        self.store=ModelStore(model_dir or os.environ.get('ML_MODEL_DIR','data/models'))
        self.engine=TrainingEngine(self.store)

    async def train(self,sales_file:UploadFile,products_file:UploadFile,
                    suppliers_file:UploadFile|None=None)->TrainingResult:
        sales=read_table(sales_file.filename or 'ventas.csv',await sales_file.read())
        products=read_table(products_file.filename or 'productos.csv',await products_file.read())
        suppliers=(read_table(suppliers_file.filename or 'proveedores.csv',await suppliers_file.read())
                   if suppliers_file else None)
        output=await run_in_threadpool(self.engine.train,sales,products,suppliers)
        return TrainingResult.model_validate(output['training'])

    def get_training(self,training_id:str)->TrainingResult:
        return TrainingResult.model_validate(self.store.get(training_id)['training'])

    def get_latest_predictions(self)->list[PredictionResult]:
        return [PredictionResult.model_validate(x) for x in self.store.latest()['predictions']]

    def get_latest_replenishments(self)->list[ReplenishmentResult]:
        return [ReplenishmentResult.model_validate(x) for x in self.store.latest()['replenishments']]

    def get_latest_comparison(self)->dict:
        data=self.store.latest()
        return {key:data[key] for key in ['training','validationCandidates','dataCoverage','providersCount']}
