from datetime import datetime
from pydantic import BaseModel, ConfigDict


def to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.title() for part in tail)


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Metrics(ApiModel):
    mae: float
    rmse: float
    mape: float | None
    wape: float


class TrainingResult(ApiModel):
    id: str
    status: str
    model_name: str
    trained_at: datetime
    metrics: Metrics
    products_count: int
    observations_count: int
    validation_rows_rejected: int


class PredictionResult(ApiModel):
    product_id: str
    product_name: str
    category: str
    predicted_demand_7_days: float
    daily_predictions: list[float]


class ReplenishmentResult(ApiModel):
    product_id: str
    product_name: str
    category: str
    stock_actual: float
    stock_minimo_seguridad: float
    predicted_demand_7_days: float
    recommended_replenishment: float
    alert_status: str
