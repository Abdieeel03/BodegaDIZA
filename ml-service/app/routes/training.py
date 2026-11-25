from __future__ import annotations
from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from starlette.concurrency import run_in_threadpool
import psycopg
from datetime import datetime
from zoneinfo import ZoneInfo
from ..hill_climbing import optimize_replenishment_hill_climbing
from ..schemas import TrainingResult,PredictionResult,ReplenishmentResult
from ..services.training_service import TrainingService

router=APIRouter()
service=TrainingService()

@router.post('',response_model=TrainingResult,status_code=200)
async def train(sales_file:UploadFile|None=File(default=None),products_file:UploadFile|None=File(default=None),
                suppliers_file:UploadFile|None=File(default=None)):
    try:
        return await service.train(sales_file,products_file,suppliers_file)
    except (ValueError,UnicodeError) as exc:
        raise HTTPException(status_code=422,detail=str(exc)) from exc

@router.get('/latest',response_model=TrainingResult)
def latest_training():
    try:return service.get_latest_training()
    except FileNotFoundError as exc:raise HTTPException(status_code=404,detail='No hay un modelo entrenado') from exc

@router.get('/latest/predictions',response_model=list[PredictionResult])
def latest_predictions():
    try:return service.get_latest_predictions()
    except FileNotFoundError as exc:raise HTTPException(status_code=404,detail='No hay un modelo entrenado') from exc

@router.get('/latest/replenishments',response_model=list[ReplenishmentResult])
def latest_replenishments():
    try:return service.get_latest_replenishments()
    except FileNotFoundError as exc:raise HTTPException(status_code=404,detail='No hay un modelo entrenado') from exc

@router.get('/latest/operational')
def latest_operational():
    """Consultar pronóstico actual sin entrenar ni cambiar el modelo guardado."""
    try:
        return service.operational.latest()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404,detail='No hay un modelo entrenado') from exc
    except ValueError as exc:
        raise HTTPException(status_code=422,detail=str(exc)) from exc
    except psycopg.Error as exc:
        raise HTTPException(status_code=503,detail='No fue posible consultar las ventas e inventario actuales') from exc


@router.get('/latest/comparison')
def latest_comparison():
    try:return service.get_latest_comparison()
    except FileNotFoundError as exc:raise HTTPException(status_code=404,detail='No hay un modelo entrenado') from exc

@router.get('/latest/optimize-replenishment')
def optimize_replenishment(budget:float=Query(...,gt=0,description='Presupuesto máximo en soles')):
    from ..preprocessing import prepare_products
    try:
        latest, raw_products=service.operational.latest(with_products=True)
        if latest['training']['forecastToDate'] < datetime.now(ZoneInfo('America/Lima')).date().isoformat():
            raise ValueError('El período del pronóstico ha finalizado; verifica las ventas registradas')
        products=prepare_products(raw_products)
        return optimize_replenishment_hill_climbing(latest['replenishments'],products,budget)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404,detail='No hay un modelo entrenado') from exc
    except ValueError as exc:
        raise HTTPException(status_code=422,detail=str(exc)) from exc
    except psycopg.Error as exc:
        raise HTTPException(status_code=503,detail='No fue posible consultar el inventario actual') from exc

@router.post('/latest/infer')
async def infer_latest(sales_file:UploadFile|None=File(default=None),products_file:UploadFile|None=File(default=None)):
    """Ejecutar un modelo ya entrenado con ventas y stock de BD o archivos enviados."""
    from ..ingestion import read_table
    from ..inference_service import InferenceService
    try:
        if (sales_file is None) != (products_file is None):
            raise ValueError('Debes enviar ambos archivos (ventas y productos) o ninguno para usar la base de datos')
        if sales_file is not None and products_file is not None:
            sales=read_table(sales_file.filename or 'ventas.csv',await sales_file.read())
            products=read_table(products_file.filename or 'productos.csv',await products_file.read())
            return await run_in_threadpool(InferenceService(service.store).latest,sales,products)
        return await run_in_threadpool(InferenceService(service.store).latest_from_db)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404,detail='No hay un modelo entrenado') from exc
    except (ValueError,UnicodeError) as exc:
        raise HTTPException(status_code=422,detail=str(exc)) from exc


@router.get('/{training_id}',response_model=TrainingResult)
def get_training(training_id:str):
    try:return service.get_training(training_id)
    except (ValueError,FileNotFoundError) as exc:raise HTTPException(status_code=404,detail='Entrenamiento no encontrado') from exc
