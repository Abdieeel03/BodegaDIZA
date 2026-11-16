from __future__ import annotations
from fastapi import APIRouter, File,HTTPException,UploadFile
from starlette.concurrency import run_in_threadpool
from ..schemas import TrainingResult,PredictionResult,ReplenishmentResult
from ..services.training_service import TrainingService

router=APIRouter()
service=TrainingService()

@router.post('',response_model=TrainingResult,status_code=200)
async def train(sales_file:UploadFile=File(...),products_file:UploadFile=File(...),
                suppliers_file:UploadFile|None=File(default=None)):
    try:
        return await service.train(sales_file,products_file,suppliers_file)
    except (ValueError,UnicodeError) as exc:
        raise HTTPException(status_code=422,detail=str(exc)) from exc

@router.get('/latest/predictions',response_model=list[PredictionResult])
def latest_predictions():
    try:return service.get_latest_predictions()
    except FileNotFoundError as exc:raise HTTPException(status_code=404,detail='No hay un modelo entrenado') from exc

@router.get('/latest/replenishments',response_model=list[ReplenishmentResult])
def latest_replenishments():
    try:return service.get_latest_replenishments()
    except FileNotFoundError as exc:raise HTTPException(status_code=404,detail='No hay un modelo entrenado') from exc

@router.get('/latest/comparison')
def latest_comparison():
    try:return service.get_latest_comparison()
    except FileNotFoundError as exc:raise HTTPException(status_code=404,detail='No hay un modelo entrenado') from exc

@router.post('/latest/infer')
async def infer_latest(sales_file:UploadFile=File(...),products_file:UploadFile=File(...)):
    """Ejecutar un modelo ya entrenado con nuevas ventas y stock actualizado."""
    from ..ingestion import read_table
    from ..inference_service import InferenceService
    try:
        sales=read_table(sales_file.filename or 'ventas.csv',await sales_file.read())
        products=read_table(products_file.filename or 'productos.csv',await products_file.read())
        return await run_in_threadpool(InferenceService(service.store).latest,sales,products)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404,detail='No hay un modelo entrenado') from exc
    except (ValueError,UnicodeError) as exc:
        raise HTTPException(status_code=422,detail=str(exc)) from exc


@router.get('/{training_id}',response_model=TrainingResult)
def get_training(training_id:str):
    try:return service.get_training(training_id)
    except (ValueError,FileNotFoundError) as exc:raise HTTPException(status_code=404,detail='Entrenamiento no encontrado') from exc
