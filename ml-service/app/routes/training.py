from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas import PredictionResult, ReplenishmentResult, TrainingResult
from app.services.training_service import TrainingService

router = APIRouter()
service = TrainingService()


@router.post("", response_model=TrainingResult)
async def train(
    sales_file: UploadFile = File(...),
    products_file: UploadFile = File(...),
) -> TrainingResult:
    try:
        return await service.train(sales_file, products_file)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/{training_id}", response_model=TrainingResult)
def get_training(training_id: str) -> TrainingResult:
    try:
        return service.get_training(training_id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Entrenamiento no encontrado") from error


@router.get("/latest/predictions", response_model=list[PredictionResult])
def get_latest_predictions() -> list[PredictionResult]:
    try:
        return service.get_latest_predictions()
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="No existe un entrenamiento completado") from error


@router.get("/latest/replenishments", response_model=list[ReplenishmentResult])
def get_latest_replenishments() -> list[ReplenishmentResult]:
    try:
        return service.get_latest_replenishments()
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="No existe un entrenamiento completado") from error
