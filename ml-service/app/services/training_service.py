import io
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import joblib
import numpy as np
import pandas as pd
from fastapi import UploadFile
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from app.schemas import Metrics, PredictionResult, ReplenishmentResult, TrainingResult

SALES_COLUMNS = {
    "fecha",
    "id_producto",
    "cantidad_vendida",
    "nombre_producto",
    "categoria",
    "precio_venta_unitario",
}
PRODUCT_COLUMNS = {
    "id_producto",
    "nombre_producto",
    "categoria",
    "stock_actual",
    "stock_minimo_seguridad",
}
FEATURE_COLUMNS = [
    "id_producto",
    "categoria",
    "precio_venta_unitario",
    "dia_semana",
    "es_fin_de_semana",
    "tendencia",
    "lag_1",
    "lag_7",
    "lag_14",
    "media_movil_7",
    "media_movil_14",
]


class TrainingService:
    def __init__(self) -> None:
        self.model_dir = Path(os.getenv("ML_MODEL_DIR", "data/models"))
        self.upload_dir = Path(os.getenv("ML_UPLOAD_DIR", "data/uploads"))
        self.model_dir.mkdir(parents=True, exist_ok=True)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    async def train(self, sales_file: UploadFile, products_file: UploadFile) -> TrainingResult:
        sales = await self._read_csv(sales_file, SALES_COLUMNS, "ventas")
        products = await self._read_csv(products_file, PRODUCT_COLUMNS, "productos")
        prepared, rejected_rows = self._prepare_sales(sales)

        if prepared["id_producto"].nunique() < 2 or len(prepared) < 60:
            raise ValueError("El historial debe contener al menos 60 observaciones y dos productos")

        training_id = str(uuid4())
        self._save_upload(training_id, sales_file.filename or "ventas.csv", sales)
        self._save_upload(training_id, products_file.filename or "productos.csv", products)

        train, validation, test = self._split_by_date(prepared)
        candidates = {
            "baseline_mean": DummyRegressor(strategy="mean"),
            "linear_regression": LinearRegression(),
            "random_forest": RandomForestRegressor(
                n_estimators=250,
                min_samples_leaf=2,
                random_state=42,
                n_jobs=-1,
            ),
        }
        best_name, best_pipeline = self._select_model(candidates, train, validation)
        test_metrics = self._metrics(test["cantidad_vendida"], best_pipeline.predict(test[FEATURE_COLUMNS]))

        final_pipeline = self._build_pipeline(candidates[best_name])
        final_pipeline.fit(
            pd.concat([train, validation])[FEATURE_COLUMNS],
            pd.concat([train, validation])["cantidad_vendida"],
        )
        predictions = self._forecast(final_pipeline, prepared, 7)
        replenishments = self._replenishments(predictions, products)

        trained_at = datetime.now(timezone.utc)
        result = TrainingResult(
            id=training_id,
            status="COMPLETED",
            model_name=best_name,
            trained_at=trained_at,
            metrics=test_metrics,
            products_count=int(prepared["id_producto"].nunique()),
            observations_count=int(len(prepared)),
            validation_rows_rejected=rejected_rows,
        )
        joblib.dump(final_pipeline, self.model_dir / f"{training_id}.joblib")
        self._save_metadata(result, predictions, replenishments)
        return result

    def get_training(self, training_id: str) -> TrainingResult:
        metadata = self._read_metadata(training_id)
        return TrainingResult.model_validate(metadata["training"])

    def get_latest_predictions(self) -> list[PredictionResult]:
        return [PredictionResult.model_validate(item) for item in self._latest_metadata()["predictions"]]

    def get_latest_replenishments(self) -> list[ReplenishmentResult]:
        return [
            ReplenishmentResult.model_validate(item)
            for item in self._latest_metadata()["replenishments"]
        ]

    async def _read_csv(self, upload: UploadFile, required_columns: set[str], label: str) -> pd.DataFrame:
        if not upload.filename or not upload.filename.lower().endswith(".csv"):
            raise ValueError(f"El archivo de {label} debe ser CSV")
        content = await upload.read()
        try:
            frame = pd.read_csv(io.BytesIO(content), encoding="utf-8-sig")
        except UnicodeDecodeError as error:
            raise ValueError(f"El archivo de {label} debe usar codificación UTF-8") from error
        missing = required_columns.difference(frame.columns)
        if missing:
            raise ValueError(f"El archivo de {label} no contiene: {', '.join(sorted(missing))}")
        if frame.empty:
            raise ValueError(f"El archivo de {label} no contiene registros")
        return frame

    def _prepare_sales(self, sales: pd.DataFrame) -> tuple[pd.DataFrame, int]:
        frame = sales.copy()
        frame["fecha"] = pd.to_datetime(frame["fecha"], errors="coerce").dt.normalize()
        frame["cantidad_vendida"] = pd.to_numeric(frame["cantidad_vendida"], errors="coerce")
        frame["precio_venta_unitario"] = pd.to_numeric(
            frame["precio_venta_unitario"], errors="coerce"
        )
        valid = (
            frame["fecha"].notna()
            & frame["id_producto"].notna()
            & frame["cantidad_vendida"].notna()
            & (frame["cantidad_vendida"] >= 0)
        )
        rejected_rows = int((~valid).sum())
        frame = frame.loc[valid].copy()
        frame["id_producto"] = frame["id_producto"].astype(str).str.strip()
        frame["nombre_producto"] = frame["nombre_producto"].fillna(frame["id_producto"])
        frame["categoria"] = frame["categoria"].fillna("SIN_CATEGORIA")
        # Several tickets can belong to the same product and day; demand is their sum.
        frame = (
            frame.sort_values("fecha")
            .groupby(["fecha", "id_producto"], as_index=False)
            .agg({
                "cantidad_vendida": "sum",
                "nombre_producto": "last",
                "categoria": "last",
                "precio_venta_unitario": "last",
            })
        )

        daily_frames: list[pd.DataFrame] = []
        for product_id, group in frame.groupby("id_producto", sort=False):
            group = group.sort_values("fecha").set_index("fecha")
            dates = pd.date_range(group.index.min(), group.index.max(), freq="D")
            daily = group.reindex(dates)
            daily["id_producto"] = product_id
            daily["cantidad_vendida"] = daily["cantidad_vendida"].fillna(0.0)
            daily["nombre_producto"] = daily["nombre_producto"].ffill().bfill()
            daily["categoria"] = daily["categoria"].ffill().bfill()
            daily["precio_venta_unitario"] = daily["precio_venta_unitario"].ffill().bfill().fillna(0.0)
            daily.index.name = "fecha"
            daily_frames.append(daily.reset_index())

        prepared = pd.concat(daily_frames, ignore_index=True).sort_values(["id_producto", "fecha"])
        prepared["dia_semana"] = prepared["fecha"].dt.dayofweek
        prepared["es_fin_de_semana"] = (prepared["dia_semana"] >= 5).astype(int)
        prepared["tendencia"] = (prepared["fecha"] - prepared["fecha"].min()).dt.days
        grouped = prepared.groupby("id_producto", group_keys=False)["cantidad_vendida"]
        prepared["lag_1"] = grouped.shift(1)
        prepared["lag_7"] = grouped.shift(7)
        prepared["lag_14"] = grouped.shift(14)
        prepared["media_movil_7"] = grouped.transform(lambda values: values.shift(1).rolling(7).mean())
        prepared["media_movil_14"] = grouped.transform(lambda values: values.shift(1).rolling(14).mean())
        return prepared.dropna(subset=["lag_14", "media_movil_14"]).reset_index(drop=True), rejected_rows

    def _split_by_date(self, frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        dates = sorted(frame["fecha"].unique())
        if len(dates) < 45:
            raise ValueError("El historial debe cubrir al menos 45 días después de la preparación")
        test_dates = set(dates[-14:])
        validation_dates = set(dates[-28:-14])
        train = frame.loc[~frame["fecha"].isin(test_dates | validation_dates)]
        validation = frame.loc[frame["fecha"].isin(validation_dates)]
        test = frame.loc[frame["fecha"].isin(test_dates)]
        return train, validation, test

    def _select_model(
        self,
        candidates: dict[str, object],
        train: pd.DataFrame,
        validation: pd.DataFrame,
    ) -> tuple[str, Pipeline]:
        best_name = ""
        best_pipeline: Pipeline | None = None
        best_mae = float("inf")
        for name, estimator in candidates.items():
            pipeline = self._build_pipeline(estimator)
            pipeline.fit(train[FEATURE_COLUMNS], train["cantidad_vendida"])
            mae = mean_absolute_error(validation["cantidad_vendida"], pipeline.predict(validation[FEATURE_COLUMNS]))
            if mae < best_mae:
                best_name, best_pipeline, best_mae = name, pipeline, mae
        if best_pipeline is None:
            raise ValueError("No fue posible entrenar ningún modelo")
        return best_name, best_pipeline

    def _build_pipeline(self, estimator: object) -> Pipeline:
        categorical = ["id_producto", "categoria"]
        numeric = [column for column in FEATURE_COLUMNS if column not in categorical]
        transformer = ColumnTransformer(
            [("categorical", OneHotEncoder(handle_unknown="ignore"), categorical), ("numeric", "passthrough", numeric)]
        )
        return Pipeline([( "features", transformer), ("model", estimator)])

    def _metrics(self, actual: pd.Series, predicted: np.ndarray) -> Metrics:
        predicted = np.maximum(predicted, 0)
        non_zero = actual > 0
        mape = None
        if non_zero.any():
            mape = float(np.mean(np.abs((actual[non_zero] - predicted[non_zero]) / actual[non_zero])) * 100)
        total_actual = actual.sum()
        wape = float(np.abs(actual - predicted).sum() / total_actual * 100) if total_actual else 0.0
        return Metrics(
            mae=float(mean_absolute_error(actual, predicted)),
            rmse=float(np.sqrt(mean_squared_error(actual, predicted))),
            mape=mape,
            wape=wape,
        )

    def _forecast(self, pipeline: Pipeline, history: pd.DataFrame, horizon: int) -> list[PredictionResult]:
        results: list[PredictionResult] = []
        for product_id, group in history.groupby("id_producto", sort=False):
            group = group.sort_values("fecha").copy()
            values = group["cantidad_vendida"].astype(float).tolist()
            last_row = group.iloc[-1]
            daily_predictions: list[float] = []
            for offset in range(1, horizon + 1):
                forecast_date = last_row["fecha"] + timedelta(days=offset)
                row = pd.DataFrame([{
                    "id_producto": product_id,
                    "categoria": last_row["categoria"],
                    "precio_venta_unitario": last_row["precio_venta_unitario"],
                    "dia_semana": forecast_date.dayofweek,
                    "es_fin_de_semana": int(forecast_date.dayofweek >= 5),
                    "tendencia": int((forecast_date - history["fecha"].min()).days),
                    "lag_1": values[-1],
                    "lag_7": values[-7],
                    "lag_14": values[-14],
                    "media_movil_7": float(np.mean(values[-7:])),
                    "media_movil_14": float(np.mean(values[-14:])),
                }])
                prediction = max(0.0, float(pipeline.predict(row[FEATURE_COLUMNS])[0]))
                daily_predictions.append(round(prediction, 3))
                values.append(prediction)
            results.append(PredictionResult(
                product_id=product_id,
                product_name=str(last_row["nombre_producto"]),
                category=str(last_row["categoria"]),
                predicted_demand_7_days=round(sum(daily_predictions), 3),
                daily_predictions=daily_predictions,
            ))
        return results

    def _replenishments(
        self,
        predictions: list[PredictionResult],
        products: pd.DataFrame,
    ) -> list[ReplenishmentResult]:
        snapshot = products.copy()
        for column in ["stock_actual", "stock_minimo_seguridad"]:
            snapshot[column] = pd.to_numeric(snapshot[column], errors="coerce").fillna(0.0)
        prediction_by_product = {item.product_id: item for item in predictions}
        results: list[ReplenishmentResult] = []
        for row in snapshot.itertuples(index=False):
            prediction = prediction_by_product.get(str(row.id_producto))
            if prediction is None:
                continue
            stock = float(row.stock_actual)
            minimum = float(row.stock_minimo_seguridad)
            recommended = max(0.0, prediction.predicted_demand_7_days + minimum - stock)
            alert = "VERDE"
            if stock <= minimum:
                alert = "ROJO"
            elif recommended > 0:
                alert = "AMARILLO"
            results.append(ReplenishmentResult(
                product_id=prediction.product_id,
                product_name=prediction.product_name,
                category=prediction.category,
                stock_actual=stock,
                stock_minimo_seguridad=minimum,
                predicted_demand_7_days=prediction.predicted_demand_7_days,
                recommended_replenishment=round(recommended, 3),
                alert_status=alert,
            ))
        return sorted(results, key=lambda item: item.recommended_replenishment, reverse=True)

    def _save_upload(self, training_id: str, filename: str, frame: pd.DataFrame) -> None:
        safe_name = Path(filename).name
        frame.to_csv(self.upload_dir / f"{training_id}_{safe_name}", index=False)

    def _save_metadata(
        self,
        training: TrainingResult,
        predictions: list[PredictionResult],
        replenishments: list[ReplenishmentResult],
    ) -> None:
        metadata = {
            "training": training.model_dump(mode="json"),
            "predictions": [item.model_dump() for item in predictions],
            "replenishments": [item.model_dump() for item in replenishments],
        }
        path = self.model_dir / f"{training.id}.json"
        path.write_text(json.dumps(metadata, ensure_ascii=False), encoding="utf-8")
        (self.model_dir / "latest.json").write_text(json.dumps(metadata, ensure_ascii=False), encoding="utf-8")

    def _read_metadata(self, training_id: str) -> dict:
        path = self.model_dir / f"{training_id}.json"
        if not path.exists():
            raise FileNotFoundError(training_id)
        return json.loads(path.read_text(encoding="utf-8"))

    def _latest_metadata(self) -> dict:
        path = self.model_dir / "latest.json"
        if not path.exists():
            raise FileNotFoundError("latest")
        return json.loads(path.read_text(encoding="utf-8"))
