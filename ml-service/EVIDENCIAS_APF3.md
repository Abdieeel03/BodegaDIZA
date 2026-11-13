# APF3 — Evidencias de Inteligencia Artificial y Machine Learning (BodegaDIZA)

## Objetivo
Estimar la demanda de los productos para los próximos siete días y calcular recomendaciones de reposición a partir de las ventas históricas y del stock disponible en Inventario.

## Algoritmos estudiados y selección
Se comparan **promedio reciente**, **regresión Ridge** (regresión lineal regularizada), **DecisionTreeRegressor** (árbol de decisión para regresión), **RandomForestRegressor** (conjunto de árboles) y **HistGradientBoostingRegressor** (ensamble por boosting de árboles). Todos los regresores reciben variables de fecha, rezagos y estadísticas históricas de ventas; la selección se realiza por menor MAE de validación temporal. `StandardScaler` se aplica a la regresión Ridge; no es necesario para los árboles.

Los algoritmos K-Means y DBSCAN son de agrupamiento no supervisado, por lo que no son la opción principal para predecir unidades. KNN y SVR son alternativas supervisadas posibles, pero no es necesario incluir todos los algoritmos del sílabo; un árbol de decisión más la comparación con regresión permite justificar la elección académica.

## Arquitectura
`ingestion.py` (lectura CSV/Excel) → `preprocessing.py` (validación de productos, proveedores y ventas) → `features.py` (variables temporales) → `modeling.py` y `training_engine.py` (comparación, validación y métricas) → `forecasting.py` (pronóstico de 7 días) → `replenishment.py` (alertas y sugerencias) → `storage.py` (persistencia joblib y JSON) → `routes/training.py` (API REST FastAPI) → Spring Boot `/ml/...` → React.

## Evaluación previa ya observada (modelo de cuatro candidatos)
- Historial: 1 500 registros, 20 productos, 0 rechazados.
- Seleccionado: HistGradientBoostingRegressor.
- Validación: MAE 2.8377, RMSE 3.8929.
- Evaluación final: MAE 2.8758, RMSE 3.9140, R² 0.7766 y WAPE 24.83 %.
- Alcance: 55 observaciones de días con ventas registradas; cobertura histórica 7.177 %. **No representa precisión validada sobre todos los días calendario**.
- Pronóstico conservado: del 11 al 17 de noviembre de 2026 (7 días desde el último dato disponible).
- Integración visual comprobada: 20 productos pronosticados; arroz P002, 17 unidades de stock, 11 unidades sugeridas de reposición.

## Nueva comparación académica (cinco candidatos)

Comparación **ejecutada en copia aislada** con los 1 500 registros y los mismos cortes cronológicos (scikit-learn 1.8 en el entorno de verificación; repetir en Docker con versión 1.6.1 antes de usar cifras en la presentación):

| Candidato | MAE validación | RMSE validación | R² validación |
|---|---:|---:|---:|
| HistGradientBoosting | **2.8377** | **3.8929** | **0.6976** |
| Random Forest | 3.0115 | 4.1819 | 0.6510 |
| Ridge | 3.2320 | 4.2025 | 0.6475 |
| Promedio reciente | 3.3247 | 4.4716 | 0.6010 |
| DecisionTreeRegressor | 4.1161 | 5.7063 | 0.3502 |

**HistGradientBoosting conserva la menor MAE.** Estas métricas corresponden a ventas observadas, no a todos los días calendario.
Después de instalar este paquete, ejecutar `python -m scripts.apf3_comparacion` usando Python 3.12 y el entorno de dependencias del microservicio. El proceso entrena **en un directorio temporal**; **no modifica el modelo publicado ni los datos de PostgreSQL**. Guardar la salida como evidencia. No afirmar cifras nuevas hasta ejecutar la comparación con la misma versión de dependencias del proyecto.

## Pruebas funcionales
Se registraron **12 pruebas automáticas aprobadas** antes de introducir el árbol de decisión, ejecutadas con `pytest` en Docker. Esta actualización incorpora otras **4 pruebas**, que comprueban disponibilidad de los candidatos, entrenamiento/inferencia del árbol, escalado apropiado para Ridge y cálculo correcto de métricas. En una copia aislada se ejecutó toda la suite y se obtuvo **16 passed**. Repetirla en Docker para obtener la evidencia de tu computadora y adjuntar la salida final.

## Integración tecnológica
- **Python + FastAPI**: entrenar (`POST /trainings`), consultar comparación (`GET /trainings/latest/comparison`), predicciones (`GET /trainings/latest/predictions`) e inferir sin reentrenar (`POST /trainings/latest/infer`).
- **Spring Boot**: recibe y protege las solicitudes del frontend, consume el microservicio Python y sirve `/ml/predictions/latest`, `/ml/replenishments/latest`.
- **React**: presenta tendencias, demanda de 7 días y recomendaciones. Inventario y ventas obtienen las existencias de PostgreSQL.

## Capturas recomendadas para el informe
1. Salida de `pytest` mostrando el total de pruebas aprobadas.
2. Comparación de los cinco algoritmos (MAE/RMSE/R² de validación).
3. Métricas del algoritmo elegido en evaluación final.
4. JSON de FastAPI y pantalla React de Predicción de demanda, con datos coherentes.
5. Pantalla de Inventario (stock de P002) y Reposición (11 unidades sugeridas).

> Los resultados con el árbol de decisión añadido deben mostrarse a partir de una ejecución real. La mera inclusión del código no prueba que el nuevo candidato haya ganado ni garantiza una precisión comercial de producción.
