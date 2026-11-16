"""Microservicio de predicción de demanda; no expone rutas para importar a PostgreSQL."""
from fastapi import FastAPI
from app.routes.training import router as training_router

app=FastAPI(title='BodegaDIZA · Predicción de demanda',version='2.0.0',
            description='Entrenamiento de modelos de demanda y pronósticos a 7 días.')

@app.get('/health')
def health()->dict[str,str]:return {'status':'ok'}

app.include_router(training_router,prefix='/trainings',tags=['Demanda'])
