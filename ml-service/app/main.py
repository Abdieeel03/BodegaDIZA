from fastapi import FastAPI

from app.routes.training import router as training_router

app = FastAPI(title="BodegaDIZA ML Service", version="1.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(training_router, prefix="/trainings", tags=["trainings"])
