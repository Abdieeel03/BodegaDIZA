"""Microservicio de predicción de demanda; no expone rutas para importar a PostgreSQL."""
from contextlib import asynccontextmanager
import logging
import os
from fastapi import FastAPI
from starlette.concurrency import run_in_threadpool
from app.database import load_from_db
from app.stockout_scenarios import simulation_enabled_for_db
from app.routes.training import router as training_router, service as training_service

logger = logging.getLogger('uvicorn.error')


def _auto_train_if_missing() -> None:
    try:
        training_service.store.latest()
        return
    except FileNotFoundError:
        pass
    try:
        logger.info('No hay modelo persistido; iniciando entrenamiento automático desde PostgreSQL...')
        sales, products, suppliers = load_from_db()
        result = training_service.engine.train(sales, products, suppliers, simulate_stockout=simulation_enabled_for_db())
        logger.info('Modelo inicial entrenado automáticamente: %s', result['training']['id'])
    except Exception as exc:
        logger.warning('No fue posible auto-entrenar el modelo al iniciar: %s', exc)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if os.environ.get('ML_AUTO_TRAIN_ON_STARTUP', '').strip().lower() == 'true':
        await run_in_threadpool(_auto_train_if_missing)
    yield


app=FastAPI(title='BodegaDIZA · Predicción de demanda',version='2.0.0',
            description='Entrenamiento de modelos de demanda y pronósticos a 7 días.',
            lifespan=lifespan)

@app.get('/health')
def health()->dict[str,str]:return {'status':'ok'}

app.include_router(training_router,prefix='/trainings',tags=['Demanda'])
