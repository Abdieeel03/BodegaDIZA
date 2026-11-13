"""Contrato HTTP compatible con los consumidores Spring Boot / React."""
from __future__ import annotations
from datetime import datetime,date
from pydantic import BaseModel, ConfigDict,Field


def camel(value: str)->str:
    first,*parts=value.split('_')
    return first+''.join(x.title() for x in parts)

class ApiModel(BaseModel):
    model_config=ConfigDict(alias_generator=camel,populate_by_name=True)

class Metrics(ApiModel):
    mae:float
    rmse:float
    r2:float|None=None
    mape:float|None=None
    wape:float|None=None

class TrainingResult(ApiModel):
    id:str
    status:str
    model_name:str
    trained_at:datetime
    metrics:Metrics
    products_count:int
    observations_count:int
    validation_rows_rejected:int
    validation_metrics:Metrics|None=None
    evaluated_observations:int=0
    forecast_from_date:date|None=None
    forecast_to_date:date|None=None
    history_coverage_ratio:float=0.0
    evaluation_scope:str='RECORDED_SALE_DAYS_ONLY'
    missing_dates_policy:str='UNKNOWN_NOT_ZERO'

class PredictionResult(ApiModel):
    product_id:str
    product_name:str
    category:str
    predicted_demand_7_days:float
    daily_predictions:list[float]=Field(min_length=7,max_length=7)

class ReplenishmentResult(ApiModel):
    product_id:str
    product_name:str
    category:str
    stock_actual:float
    stock_minimo_seguridad:float
    predicted_demand_7_days:float
    recommended_replenishment:float
    alert_status:str

class ModelComparison(ApiModel):
    training:TrainingResult
    validation_candidates:dict
    data_coverage:dict
    providers_count:int
