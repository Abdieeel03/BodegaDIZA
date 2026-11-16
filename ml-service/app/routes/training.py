from fastapi import APIRouter, File, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from ..schemas import PredictionResult, ReplenishmentResult, TrainingResult
from ..services.training_service import TrainingService

router = APIRouter()
service = TrainingService()


@router.post("", response_model=TrainingResult)
async def train(
    sales_file: UploadFile = File(...),
    products_file: UploadFile = File(...),
    suppliers_file: UploadFile | None = File(default=None),
) -> TrainingResult:
    try:
        return await service.train(sales_file, products_file, suppliers_file)
    except (ValueError, UnicodeError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/latest/predictions", response_model=list[PredictionResult])
def latest_predictions() -> list[PredictionResult]:
    try:
        return service.get_latest_predictions()
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="No hay un modelo entrenado") from error


@router.get("/latest/replenishments", response_model=list[ReplenishmentResult])
def latest_replenishments() -> list[ReplenishmentResult]:
    try:
        return service.get_latest_replenishments()
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="No hay un modelo entrenado") from error


@router.get("/latest/comparison")
def latest_comparison() -> dict:
    try:
        return service.get_latest_comparison()
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="No hay un modelo entrenado") from error


@router.post("/latest/infer")
async def infer_latest(
    sales_file: UploadFile = File(...), products_file: UploadFile = File(...)
) -> dict:
    from ..inference_service import InferenceService
    from ..ingestion import read_table

    try:
        sales = read_table(sales_file.filename or "ventas.csv", await sales_file.read())
        products = read_table(products_file.filename or "productos.csv", await products_file.read())
        return await run_in_threadpool(InferenceService(service.store).latest, sales, products)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="No hay un modelo entrenado") from error
    except (ValueError, UnicodeError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/{training_id}", response_model=TrainingResult)
def get_training(training_id: str) -> TrainingResult:
    try:
        return service.get_training(training_id)
    except (ValueError, FileNotFoundError) as error:
        raise HTTPException(status_code=404, detail="Entrenamiento no encontrado") from error
