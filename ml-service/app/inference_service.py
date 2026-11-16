"""Inferencia desacoplada: reutiliza un modelo joblib previamente entrenado."""
from __future__ import annotations
from datetime import timedelta
import pandas as pd
from .database import load_from_db
from .preprocessing import prepare_products,prepare_sales
from .forecasting import HORIZON,predict_horizon,to_prediction_objects
from .replenishment import recommend
from .stockout_classifier import predict_stockout_risk
from .storage import ModelStore


class InferenceService:
    def __init__(self, store: ModelStore): self.store=store

    def latest(self, sales_input:pd.DataFrame,products_input:pd.DataFrame)->dict:
        latest=self.store.latest()
        training=latest['training']
        # Solo carga artefactos generados por este servicio.
        model=self.store.trusted_model(training['id'])
        return self._forecast(model,training,sales_input,products_input)

    def latest_from_db(self)->dict:
        sales,products,_=load_from_db()
        return self.latest(sales,products)

    def by_id(self,training_id:str,sales_input:pd.DataFrame,products_input:pd.DataFrame)->dict:
        training=self.store.get(training_id)['training']
        model=self.store.trusted_model(training_id)
        return self._forecast(model,training,sales_input,products_input)

    def _forecast(self,model,training,sales_input,products_input)->dict:
        products=prepare_products(products_input)
        sales,_=prepare_sales(sales_input,products)
        last=pd.Timestamp(sales.fecha.max())
        frame=predict_horizon(model,training['modelName'],sales,last,last+timedelta(days=1),HORIZON)
        predictions=to_prediction_objects(frame)
        replenishments=recommend(predictions,products)
        classifier=self.store.trusted_classifier(training['id'])
        if classifier is not None:
            replenishments=predict_stockout_risk(classifier,sales,products,replenishments)
        result={
            'trainingId':training['id'],'modelName':training['modelName'],
            'forecastFromDate':(last+timedelta(days=1)).date().isoformat(),
            'forecastToDate':(last+timedelta(days=HORIZON)).date().isoformat(),
            'predictions':predictions,'replenishments':replenishments,
        }
        return result
