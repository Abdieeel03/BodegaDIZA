"""Predicción DEMO de demanda con pandas + scikit-learn, sin fuga temporal.

Uso:
  python entrenar_regresion.py --ventas preparados/ventas_diza_validado.csv \
      --productos preparados/productos_diza_validado.csv --salida resultados_ml

- División temporal por producto: primeros 90 días ENTRENAMIENTO, últimos 30 EVALUACIÓN.
- Entrena regresión lineal usando exclusivamente fecha (tendencia y día de semana).
- Compara contra baseline entrenado (promedio histórico por día de semana).
- Para el pronóstico FUTURO reentrena con todo el histórico disponible.
- Produce predicciones_demo.csv compatible con /test-data/importar?tipo=predicciones.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error

HORIZONTE = 14


def features(fechas: pd.Series, origen: pd.Timestamp) -> pd.DataFrame:
    fechas = pd.to_datetime(fechas)
    dias = (fechas - origen).dt.days.to_numpy(dtype=float)
    dow = fechas.dt.dayofweek.to_numpy(dtype=int)
    x = pd.DataFrame({"tendencia_semanal": dias / 7.0})
    # 6 indicadores dummies; domingo es categoría base. Mantiene columnas exactas.
    for d in range(6):
        x[f"dia_{d}"] = (dow == d).astype(float)
    return x


def metricas(y: np.ndarray, estimado: np.ndarray) -> dict[str, float]:
    return {
        "mae": round(float(mean_absolute_error(y, estimado)), 3),
        "rmse": round(float(np.sqrt(mean_squared_error(y, estimado))), 3),
    }


def ajustar(y: np.ndarray, fechas: pd.Series, origen: pd.Timestamp) -> LinearRegression:
    model = LinearRegression()
    model.fit(features(fechas, origen), y)
    return model


def predecir(model: LinearRegression, fechas: pd.Series, origen: pd.Timestamp) -> np.ndarray:
    # Cantidades no pueden ser negativas; preservar estimación continua para análisis.
    return np.maximum(0.0, model.predict(features(fechas, origen)))


def generar(ventas_path: Path, productos_path: Path | None, salida: Path) -> dict:
    salida.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(ventas_path, encoding="utf-8-sig", dtype={"id_producto": "string"})
    requisitos = {"fecha", "id_producto", "cantidad_vendida"}
    if not requisitos.issubset(df.columns):
        raise ValueError(f"Ventas: faltan columnas {sorted(requisitos-set(df.columns))}")
    df["fecha"] = pd.to_datetime(df["fecha"], format="%Y-%m-%d", errors="raise")
    df["cantidad_vendida"] = pd.to_numeric(df["cantidad_vendida"], errors="raise")
    if df[list(requisitos)].isna().any().any() or (df["cantidad_vendida"] < 0).any():
        raise ValueError("Ventas: faltan datos o cantidades negativas")
    if df.duplicated(["fecha", "id_producto"]).any():
        raise ValueError("Ventas: fecha + id_producto duplicados")
    if productos_path:
        catalogo = pd.read_csv(productos_path, encoding="utf-8-sig", dtype={"id_producto": "string"})
        if not df.id_producto.isin(catalogo.id_producto).all():
            raise ValueError("Hay ventas de productos ajenos al catálogo")

    predicciones = []
    por_producto = []
    reales_global = []
    estimados_global = []
    baseline_global = []
    data_grafico = {}
    for producto, g in df.sort_values("fecha").groupby("id_producto", sort=True):
        g = g.reset_index(drop=True)
        if len(g) < 45 or g["fecha"].nunique() != len(g):
            raise ValueError(f"{producto}: requiere al menos 45 fechas distintas")
        g_train, g_test = g.iloc[:-30], g.iloc[-30:]
        origen = g.fecha.iloc[0]
        y_train = g_train.cantidad_vendida.to_numpy(dtype=float)
        y_test = g_test.cantidad_vendida.to_numpy(dtype=float)

        modelo = ajustar(y_train, g_train.fecha, origen)
        y_hat = predecir(modelo, g_test.fecha, origen)
        # Baseline justo: media por día semanal calculada SOLO con entrenamiento.
        medias = g_train.groupby(g_train.fecha.dt.dayofweek)["cantidad_vendida"].mean()
        pred_base = g_test.fecha.dt.dayofweek.map(medias).fillna(g_train.cantidad_vendida.mean()).to_numpy(dtype=float)
        mae_rmse = metricas(y_test, y_hat)
        base_met = metricas(y_test, pred_base)
        reales_global.extend(y_test.tolist())
        estimados_global.extend(y_hat.tolist())
        baseline_global.extend(pred_base.tolist())
        por_producto.append({
            "producto": str(producto), "entrenamiento": int(len(g_train)), "evaluacion": int(len(g_test)),
            "mae": mae_rmse["mae"], "rmse": mae_rmse["rmse"],
            "mae_baseline": base_met["mae"], "rmse_baseline": base_met["rmse"],
        })
        for fecha, real, valor in zip(g_test.fecha, y_test, y_hat):
            predicciones.append({"id_producto": str(producto), "fecha": fecha.date().isoformat(),
                                "ventas_reales": float(real), "prediccion": round(float(valor),3), "periodo": "EVALUACION"})
        # Pronósticos después del corte: reentrenar SOLO para FUTURO con los 120 días observados.
        modelo_final = ajustar(g.cantidad_vendida.to_numpy(dtype=float), g.fecha, origen)
        futuro = pd.Series(pd.date_range(g.fecha.max() + pd.Timedelta(days=1), periods=HORIZONTE, freq="D"))
        fut_pred = predecir(modelo_final, futuro, origen)
        for fecha, valor in zip(futuro, fut_pred):
            predicciones.append({"id_producto": str(producto), "fecha": fecha.date().isoformat(),
                                "ventas_reales": "", "prediccion": round(float(valor),3), "periodo": "FUTURO"})
        data_grafico[str(producto)] = (g_test.fecha, y_test, y_hat, futuro, fut_pred)

    pred_df = pd.DataFrame(predicciones)
    pred_df = pred_df[["id_producto", "fecha", "ventas_reales", "prediccion", "periodo"]]
    pred_df.to_csv(salida / "predicciones_demo.csv", index=False, encoding="utf-8", float_format="%.3f")

    m = metricas(np.array(reales_global), np.array(estimados_global))
    b = metricas(np.array(reales_global), np.array(baseline_global))
    resumen = {
        "modelo": "Regresión lineal (scikit-learn): tendencia semanal + día de semana",
        "preprocesamiento": "pandas, validación de fechas/IDs y valores no negativos",
        "evaluacion": "30 últimas fechas por producto (sin entrenamiento con datos futuros)",
        "prediccion_futura": "reentrenar con todo el historial observado, horizonte de 14 días",
        "baseline": "promedio por día de semana calculado solo con entrenamiento",
        "advertencia": "Prototipo académico. No usar para compras reales sin validar con datos de la bodega.",
        "productos": len(por_producto), "predicciones_generadas": len(pred_df),
        "evaluaciones": len(reales_global),
        "mae_global": m["mae"], "rmse_global": m["rmse"],
        "mae_baseline": b["mae"], "rmse_baseline": b["rmse"],
        "por_producto": por_producto,
    }
    (salida / "metricas_modelo.json").write_text(json.dumps(resumen, ensure_ascii=False, indent=2), encoding="utf-8")

    # Gráficos reproducibles para exposición (no incluyen valores futuros como si fueran reales).
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        for producto in list(data_grafico)[:3]:
            test_dates, real, esperado, future_dates, fut = data_grafico[producto]
            fig, ax = plt.subplots(figsize=(9, 4.5))
            ax.plot(test_dates, real, label="Real (evaluación)", marker=".")
            ax.plot(test_dates, esperado, label="Predicción (evaluación)")
            ax.plot(future_dates, fut, label="Pronóstico futuro", linestyle="--")
            ax.axvline(test_dates.iloc[-1], linestyle=":", linewidth=1)
            ax.set(title=f"BodegaDIZA | {producto} | evaluación y 14 días futuros",
                   xlabel="Fecha", ylabel="Unidades vendidas por día")
            ax.legend(); fig.autofmt_xdate(); fig.tight_layout()
            fig.savefig(salida / f"grafico_{producto}.png", dpi=150)
            plt.close(fig)
    except ImportError:
        print("Aviso: Matplotlib no está instalado; se generaron métricas y CSV sin gráficos")

    print("Regresión lineal (scikit-learn) entrenada para", len(por_producto), "productos")
    print("Predicciones:", len(pred_df), "Evaluación:", len(reales_global))
    print("MAE:", m["mae"], "RMSE:", m["rmse"], "| Baseline MAE:", b["mae"])
    print("Archivo:", (salida / "predicciones_demo.csv").resolve())
    return resumen


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ventas", type=Path, required=True)
    parser.add_argument("--productos", type=Path)
    parser.add_argument("--salida", type=Path, default=Path("resultados_ml"))
    a = parser.parse_args()
    generar(a.ventas, a.productos, a.salida)

if __name__ == "__main__":
    main()
