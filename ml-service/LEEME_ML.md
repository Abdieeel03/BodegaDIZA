# BodegaDIZA — Modelo de predicción de demanda (7 días)

Versión modular de Python/FastAPI que **conserva los endpoints actuales** de BodegaDIZA. La estructura separa ingesta, validación, *feature engineering*, selección de algoritmo, pronósticos, reglas de reposición, almacenamiento y rutas HTTP. No se modificó React, Spring Boot, la base de datos ni el repositorio remoto para generar esta entrega.

## Datos de entrada

- `data/ventas.csv`: 1 500 registros observados de ventas, del **01/01/2024 al 10/11/2026**; 20 productos, 75 registros por producto. Tiene fechas faltantes por SKU.
- `data/productos.csv`: catálogo de 20 SKU; todas las existencias de referencia son **mayores a cero**.
- `data/proveedores.csv`: catálogo independiente de seis proveedores. `productos.proveedor` referencia su nombre; se valida que todos existan.
- `data/proveedores_con_ruc.csv`: mismos seis proveedores con RUC numéricos de 11 cifras **sintéticos**, generados para el entorno de desarrollo. No tienen validez tributaria.
- `data/auditoria_datos.json`: diagnóstico de conciliación de stock. Ninguno de los 20 snapshots coincide con el último saldo del histórico; hay inconsistencias entre inicial, entradas, ventas y cierre en parte de las filas. No se corrige ni inventa información sin evidencias.
- `data/resultados_evaluacion_referencia.json`: evaluación efectuada sobre los CSV recibidos. Los resultados pueden variar ligeramente entre versiones de scikit-learn.

**Muy importante:** las ventas históricas son eventos registrados, no un libro diario completo. No se presupone que los días ausentes tuvieron ventas cero. Por ello las métricas MAE, RMSE y R² evalúan **cantidades en fechas con ventas registradas**, no una exactitud validada sobre todos los días del calendario. La demanda diaria esperada utiliza como aproximación el pronóstico condicional × la frecuencia de eventos registrados (suavizada por día de semana). Es una estimación útil para validar el flujo, pero requiere más datos diarios completos para confirmar la demanda real en producción.

## Estructura

```
ml-service/
  app/
    main.py                       FastAPI
    schemas.py                    contratos API existentes y métricas R²
    ingestion.py                  lectura CSV UTF-8 o Excel .xlsx
    preprocessing.py              validación, faltantes, catálogo, cobertura
    features.py                   variables de fecha, rezagos y medias móviles
    modeling.py                   4 candidatos de algoritmos y métricas
    training_engine.py            validación cronológica y selección
    forecasting.py                pronóstico siete días y frecuencia observada
    inference_service.py          inferencia sin reentrenamiento con nuevos archivos
    replenishment.py              alertas y reposición usando stock del catálogo
    storage.py                    joblib y metadatos JSON atomizados
    services/training_service.py  orquestación de entrenamiento
    routes/training.py            endpoints FastAPI
  scripts/
    train_local.py                entrenamiento por consola
    data_audit.py                 auditoría de stock
    sync_catalog.py              sincronización segura por API a PostgreSQL
  tests/test_workflow.py          pruebas automáticas
  data/catalogo/                  CSV originales + proveedores con RUC
  requirements.txt
  Dockerfile
```

Principios SOLID: responsabilidad única por módulo; `TrainingEngine` coordina servicios especializados; `ModelStore` encapsula persistencia; `predict_horizon` recibe el modelo y no depende de FastAPI o de PostgreSQL; las pruebas usan un cliente de API simulado para evitar efectos externos.

## Instalación sobre tu rama actual (Windows)

1. Asegúrate de que el repositorio sea `C:\Proyectos\UNIVERSIDAD\BodegaDIZA` y la rama `feature/cielo`.
2. Descomprime este ZIP y abre PowerShell dentro de la carpeta **BodegaDIZA_ML_7D_INTEGRABLE**.
3. Ejecuta:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\INSTALAR_ML_7D.ps1
```

El instalador crea una **copia de seguridad completa del código anterior de ml-service** en la carpeta del usuario. Conserva el contenido de `ml-service/data/models` y cualquier historial de entrenamiento en disco; no realiza ninguna operación Git, de base de datos o Docker.

**Importante:** si el Docker actual utiliza almacenamiento no persistente, copia sus modelos antes de eliminar o recrear el contenedor. El instalador no lo detiene ni lo reemplaza. Para activar el código nuevo en Docker se necesita **reconstruir y reiniciar únicamente el servicio de ML** y conservar el volumen de modelos. React y Spring Boot continúan usando las mismas rutas.

## Entrenamiento local desde Python

Desde la carpeta `ml-service` del repositorio, usa Python 3.12 y un entorno virtual:

```powershell
cd C:\Proyectos\UNIVERSIDAD\BodegaDIZA\ml-service
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
python -m pytest -q
python -m scripts.data_audit --ventas data\catalogo\ventas.csv --productos data\catalogo\productos.csv
python -m scripts.train_local --ventas data\catalogo\ventas.csv --productos data\catalogo\productos.csv --proveedores data\catalogo\proveedores.csv --modelo-dir data\models
```

Si no tienes el lanzador `py -3.12`, utiliza una instalación de Python 3.12 compatible. `requirements.txt` está fijado según la imagen de Python de ML para reproducir resultados. El entrenamiento guarda:

```
data/models/latest.json
data/models/<uuid>/resultado.json
data/models/<uuid>/modelo.joblib
```

Solo carga archivos `.joblib` propios; nunca modelos recibidos de terceros sin verificar su procedencia.

## FastAPI y endpoints compatibles

Para ejecutar el microservicio localmente, con el contenedor ML anterior **apagado** o usando otro puerto:

```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Endpoints:

- `GET /health`
- `POST /trainings` (multipart con `sales_file`, `products_file`, y `suppliers_file` opcional; CSV o Excel)
- `GET /trainings/{id}`
- `GET /trainings/latest/predictions` (20 productos; siete predicciones diarias por SKU)
- `GET /trainings/latest/replenishments` (alertas y reposición)
- `GET /trainings/latest/comparison` (comparación y cobertura)
- `POST /trainings/latest/infer` (multipart `sales_file`, `products_file`; reutiliza el `.joblib` guardado para inferir sin reentrenar)
- `GET /docs` (Swagger)

El contrato de respuesta conserva `modelName`, `metrics`, `predictedDemand7Days`, `dailyPredictions`, `recommendedReplenishment`, `alertStatus`, etc. `metrics` ahora incorpora `r2` además de `mae`, `rmse`, `wape`, `mape`.

El servicio no debe exponerse directamente a Internet sin autenticación, límite de solicitudes y supervisión. En despliegue debe permanecer detrás del gateway del backend Java o de una red privada.

## Sincronizar proveedores y stock con PostgreSQL TEST

**El sincronizador no toca las ventas históricas ni ejecuta sentencias SQL directas.** Usa las rutas existentes de Spring Boot (`/proveedores`, `/categorias`, `/productos`, `/inventario/entradas`). Verifica que el endpoint de carga histórica (`/test-data/resumen`) esté habilitado, lo que requiere `DIZA_DEMO_ENABLED=true`. Restringido a la URL `http://localhost:8081`, donde tienes la conexión `bodega_diza_test` en el puerto 5433. Verifica también la configuración del backend antes de aplicar cambios.

1. Deja Spring Boot 8081 y PostgreSQL de desarrollo 5433 encendidos.
2. Desde `ml-service`, primero consulta lo que cambiaría (**sin guardar nada**):

```powershell
python -m scripts.sync_catalog --productos data\catalogo\productos.csv --proveedores data\catalogo\proveedores.csv
```

3. Cuando revises las acciones y confirmes que la API utiliza `bodega_diza_test`, aplica:

```powershell
python -m scripts.sync_catalog --productos data\catalogo\productos.csv --proveedores data\catalogo\proveedores.csv --apply
```

Se solicitará la contraseña del administrador; no se imprime ni se guarda. Los proveedores existentes se buscan por nombre y por los alias del catálogo anterior. Puede renombrar los seis proveedores equivalentes a los nombres nuevos del CSV, conservando sus RUC previos (también sintéticos). Si se necesita uno nuevo, genera un RUC numérico de 11 cifras. Los productos nuevos se crean con lote inicial; para SKU existentes solo se genera una entrada si tenían stock cero **y nunca tuvieron la carga inicial de ese SKU**. Las existencias positivas con movimientos se conservan, por ejemplo `P002` con 17 unidades, incluso si el archivo de productos indica 29. Si el stock no coincide, se informa; no se sobreescribe el kardex.

Al completar se genera `data/sync/productos_para_ml.csv`, un catálogo con existencias tomadas **directamente de la API de inventario**. Utilízalo como archivo de productos en Entrenamiento ML (en lugar de `productos.csv`) para que las alertas y recomendaciones reflejen lo que hay en PostgreSQL. Los costos del CSV se mantienen únicamente en ese archivo: el modelo de producto actual de Spring Boot no contiene un campo para costo de compra.

**Lotes sintéticos:** si la fuente no incluye vencimientos, se generan fechas futuras a un año únicamente para habilitar lotes en el entorno de desarrollo; esa fecha no representa la caducidad verdadera de un producto. Antes de operar con mercancía real, registrar fechas verificadas y cambiar esta política.

**No mezcles los 1 500 registros con los 2 400 existentes de forma automática.** Son históricos distintos que necesitan deduplicación y conciliación previa. La carga de proveedores/productos no importa ventas.

## Etiquetas de la interfaz

El paquete incluye `NORMALIZAR_ETIQUETAS_UI.ps1` para cambiar únicamente los textos visibles que dicen «TEST» o «prueba» en Ventas, Agregar producto y el resumen del Dashboard, con respaldo previo y sin alterar los endpoints ni las operaciones. Esta acción es **opcional e independiente** de la instalación ML, para evitar sobrescribir otras modificaciones del frontend. Ejecútala desde la carpeta del ZIP si quieres la interfaz con lenguaje normal de negocio:

```powershell
.\NORMALIZAR_ETIQUETAS_UI.ps1
```

El modo de base de datos de desarrollo y la ruta técnica `/test-data/resumen` continúan activos internamente; cambiar rótulos no convierte el entorno en producción.

## Resultados de evaluación del archivo recibido

Se evaluaron cuatro candidatos con cortes temporales y ventanas de siete días. Sobre 44 observaciones de validación, ganó `hist_gradient_boosting` (MAE 2.8377, RMSE 3.8929). Sobre 55 observaciones fuera de selección: **MAE 2.8758; RMSE 3.9140; R² 0.7766**. Estas métricas son sobre **días observados** y no se deben comparar directamente con el MAE 1.43 del conjunto anterior de 2 400 filas, porque las distribuciones y métodos de evaluación son distintos.

## Seguridad, continuidad y límites

- Nunca subas `.env`, JWT o contraseñas a Git.
- Mantén versionado de dependencias, un almacenamiento persistente para `data/models`, control de acceso a las rutas de entrenamiento y límites de carga.
- `joblib.load` puede ejecutar código si el artefacto es malicioso. Solo cargar modelos generados por nuestro propio servicio.
- Para pronósticos diarios auditables en producción, registra todas las ventas de cada día, incluidos explícitamente los días sin ventas y sus cierres. Hasta entonces, los nuevos CSV permiten comprobar la funcionalidad, pero no demostrar precisión de demanda real con cobertura completa.
- No se ha comprobado tu entorno Windows o Docker local desde esta sesión; las pruebas automatizadas se ejecutaron en el entorno de generación del paquete.
