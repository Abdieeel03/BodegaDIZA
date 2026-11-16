"""Entrenamiento temporal con candidatos comparables y test separado."""
from __future__ import annotations
from datetime import datetime,timezone,timedelta
from uuid import uuid4
import numpy as np
import pandas as pd
from .features import historical_features
from .modeling import CANDIDATES,train_model,metrics
from .forecasting import HORIZON, predict_horizon, to_prediction_objects, validate_on_observed_days
from .preprocessing import prepare_products,prepare_providers,prepare_sales,coverage
from .replenishment import recommend
from .storage import ModelStore


def cutoffs(sales:pd.DataFrame):
    dates=sorted(sales.fecha.unique())
    if len(dates) < 90:
        raise ValueError('Se necesitan al menos 90 fechas con ventas registradas')
    # Rangos temporales, no particiones aleatorias por filas.
    # Nos aseguramos de contar con >=14 eventos por SKU antes del primer corte.
    first_valid = max((g.sort_values('fecha').fecha.iloc[14] for _,g in sales.groupby('id_producto')))
    validation_start = max(pd.Timestamp(dates[int(len(dates)*.70)]),first_valid)
    test_start = pd.Timestamp(dates[int(len(dates)*.86)])
    last = pd.Timestamp(dates[-1])
    if validation_start >= test_start-timedelta(days=HORIZON):
        raise ValueError('No hay período de validación suficiente')
    if (last-test_start).days < 21:
        raise ValueError('No hay período de evaluación suficiente')
    return validation_start,test_start,last


def origins_in_window(start:pd.Timestamp,end:pd.Timestamp,count:int)->list[pd.Timestamp]:
    """Cortes espaciados, sin superposición entre ventanas de 7 días."""
    earliest=pd.Timestamp(start).normalize()
    latest=pd.Timestamp(end).normalize()-timedelta(days=HORIZON)
    if latest<earliest:
        return []
    possible=pd.date_range(earliest,latest,freq=f'{HORIZON}D')
    if len(possible)<=count:return list(possible)
    indices=np.linspace(0,len(possible)-1,count,dtype=int)
    return [possible[int(i)] for i in indices]


class TrainingEngine:
    def __init__(self,store:ModelStore):self.store=store

    def train(self,sales_input:pd.DataFrame,products_input:pd.DataFrame,
              providers_input:pd.DataFrame|None=None)->dict:
        products=prepare_products(products_input)
        providers=prepare_providers(providers_input,products)
        sales,rejected=prepare_sales(sales_input,products)
        validation_start,test_start,last_date=cutoffs(sales)
        features=historical_features(sales,sales.fecha.min())
        if len(features)<100:
            raise ValueError('No hay registros suficientes después de calcular variables temporales')
        training_data=features[features.fecha<validation_start]
        refit_data=features[features.fecha<test_start]
        if training_data.id_producto.nunique()<2:
            raise ValueError('No hay suficientes datos anteriores al corte temporal')
        validation_origins=origins_in_window(validation_start,test_start-timedelta(days=1),5)
        test_origins=origins_in_window(test_start,last_date,5)
        scores={}
        for candidate in CANDIDATES:
            model=train_model(candidate,training_data)
            actual,forecast=validate_on_observed_days(model,candidate,sales,validation_origins)
            if len(actual)<5:
                raise ValueError('Demasiados pocos días con ventas registradas en validación')
            scores[candidate]={'metrics':metrics(actual,forecast),'n':int(len(actual))}
        selected=min(scores,key=lambda name:(scores[name]['metrics']['mae'],scores[name]['metrics']['rmse']))
        # Test final: corte cronológico, selección ya fijada, y modelos entrenados
        # sin observaciones de la ventana test.
        evaluation_model=train_model(selected,refit_data)
        actual,forecast=validate_on_observed_days(evaluation_model,selected,sales,test_origins)
        if len(actual)<5:
            raise ValueError('Muy pocas observaciones en el período final de evaluación')
        test_metrics=metrics(actual,forecast)
        full_model=train_model(selected,features)
        future=predict_horizon(full_model,selected,sales,last_date,last_date+timedelta(days=1))
        predictions=to_prediction_objects(future)
        replenishments=recommend(predictions,products)
        now=datetime.now(timezone.utc).isoformat()
        training_id=str(uuid4())
        coverage_info=coverage(sales)
        report={
            'training':{
                'id':training_id,'status':'COMPLETED','modelName':selected,
                'trainedAt':now,'metrics':test_metrics,'validationMetrics':scores[selected]['metrics'],
                'productsCount':int(sales.id_producto.nunique()),'observationsCount':int(len(sales)),
                'validationRowsRejected':rejected,'evaluatedObservations':int(len(actual)),
                'forecastFromDate':(last_date+timedelta(days=1)).date().isoformat(),
                'forecastToDate':(last_date+timedelta(days=HORIZON)).date().isoformat(),
                'historyCoverageRatio':coverage_info['coverageRatio'],
                'evaluationScope':'RECORDED_SALE_DAYS_ONLY',
                'missingDatesPolicy':'UNKNOWN_NOT_ZERO',
            },
            'validationCandidates':scores,
            'dataCoverage':coverage_info,
            'providersCount':int(len(providers)),
            'predictions':predictions,
            'replenishments':replenishments,
        }
        self.store.save(training_id,full_model,report)
        return report
