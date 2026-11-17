<!-- DIZA_EQUIPO_DEMO_START -->
## Inicio rápido para el equipo — Base de pruebas compartida (APF3)

Para **probar** BodegaDIZA sin instalar Java, Python ni Node, usa Docker Desktop y consulta **[README_EQUIPO_DEMO.md](README_EQUIPO_DEMO.md)**. Con una copia autorizada en `demo-db/bodega_diza_test_demo.dump` puedes iniciar React, Spring Boot, FastAPI y PostgreSQL mediante:

```powershell
.\INICIAR_EQUIPO.ps1
```

Las claves de cada integrante se generan localmente en `.env.equipo`, **nunca se suben a GitHub**. La copia de PostgreSQL es independiente de la base original; no se exportan cuentas del usuario original. La responsable debe crear y revisar primero el snapshot con `.\CREAR_COPIA_DEMO.ps1`.

<!-- DIZA_EQUIPO_DEMO_END -->
# BodegaDIZA · Prototipo avanzado (APF3)

Sistema de **gestión de inventario, ventas y predicción de demanda a 7 días** para una bodega. Integra **React + TypeScript (frontend)**, **Java 21 + Spring Boot 4 (API)**, **PostgreSQL 16 (persistencia operativa)** y **Python 3.12 + FastAPI + scikit-learn (Machine Learning)**.

> **Estado de esta entrega:** prototipo funcional para revisión académica. Las pruebas Python y la compilación React se ejecutaron satisfactoriamente en el entorno de desarrollo de la rama `feature/cielo`; **cada integrante debe repetirlas después de clonar**. Esta guía no certifica un despliegue en producción. Los datos CSV históricos, las ventas operativas y el modelo entrenado son fuentes distintas.

## 1. Funcionalidades

- Autenticación JWT, panel Inicio y rutas protegidas.
- Productos, proveedores, categorías e inventario con movimientos y stock por lotes.
- Registro de ventas operativas que sí descuentan stock.
- Importación/consulta de ventas históricas CSV **para análisis**; no generan tickets ni descuentan stock.
- Informes por períodos (día, semana, mes, año y todo el historial); gráficos diarios y resúmenes mensuales.
- Entrenamiento y comparación de cinco candidatos: promedio reciente, Ridge, árbol de decisión, Random Forest e HistGradientBoosting.
- Pronóstico por producto para **7 días**, ingresos estimados en **S/** según los precios de venta actuales y sugerencias de reposición.

**Limitación importante:** los resultados del modelo guardado provienen del conjunto de datos con el que se entrenó. El inicio de su horizonte está asociado al final de ese historial, **no necesariamente al día de hoy**. Las recomendaciones de stock guardadas deben recalcularse/actualizarse si cambia el inventario; no asumir que cambian automáticamente después de cada venta. La estimación en S/ es ingreso potencial, **no venta realizada ni ganancia neta**.

## 2. Estructura esperada

```text
BodegaDIZA/
├── README.md                      ← esta guía
├── api/                           ← Spring Boot + Gradle Wrapper
│   ├── .env.example
│   ├── docker-compose.yml         ← configuración anterior para PostgreSQL
│   ├── gradlew.bat
│   └── src/
├── frontend-sistema/              ← React + Vite + pnpm
│   ├── .env.example
│   ├── pnpm-lock.yaml
│   └── src/
└── ml-service/                    ← FastAPI, entrenamiento, scripts y pruebas
    ├── Dockerfile
    ├── requirements.txt
    ├── app/
    ├── scripts/
    ├── tests/
    └── data/                     ← CSV de ejemplo, si se incluyen en la entrega
```

> **Antes de iniciar:** si `ml-service/` no aparece tras clonar `feature/cielo`, la rama remota todavía no recibió ese componente. No se solucionará instalando dependencias: se debe añadir y subir el código Python correspondiente. Revisa igualmente las rutas de la API ML, los nuevos módulos React y los archivos `.env.example`.

## 3. Requisitos y comprobación inicial

- Git; Windows 10/11 + PowerShell (comandos de esta guía). En macOS/Linux, adaptar sintaxis de shell.
- **JDK 21**, `java -version`.
- **Node.js 24** compatible con Vite 8; `node -v`. Gestor `pnpm` a través de Corepack (`corepack pnpm -v`) o instalar pnpm compatible con el `pnpm-lock.yaml`.
- **Docker Desktop** activo; `docker version` y `docker compose version`.
- PostgreSQL 16 mediante Docker o servidor PostgreSQL accesible. **No está diseñado para MySQL/SQLite sin cambios.**
- Python 3.12 **opcional** si se ejecuta el servicio ML y sus pruebas enteramente en Docker; necesario para ejecutar scripts ML directamente en Windows.

Clonar la rama de integración para revisión:

```powershell
git clone --branch feature/cielo https://github.com/Abdieeel03/BodegaDIZA.git
cd BodegaDIZA
```

Si ya tienes un clon propio, no clones encima. Comprueba la rama con `git branch --show-current` y revisa tus cambios antes de hacer `git pull`.

## 4. Base de datos: elegir UNO de los escenarios

La API espera **PostgreSQL**, con el esquema compatible con las entidades de Spring Boot. Un nombre de base arbitrario sirve **siempre que su usuario tenga permisos y se pueda crear/migrar el esquema requerido**. Una base de otro proyecto sin las tablas de BodegaDIZA no permite usar los módulos tal cual.

### Opción A — Base de prueba nueva y aislada (RECOMENDADA)

Usa el puerto **5433**, para no interferir con una base original que pueda estar en **5432**. Estos comandos se ejecutan desde cualquier carpeta en PowerShell:

```powershell
# Solicitar una contraseña local sin mostrarla en pantalla ni escribirla en el historial.
$env:POSTGRES_PASSWORD = [System.Net.NetworkCredential]::new('', (Read-Host 'Contraseña del PostgreSQL de prueba' -AsSecureString)).Password

# Ejecutar SOLO si este contenedor aún NO existe.
docker run -d --name bodega_diza_postgres_test `
  -p 5433:5432 `
  -e POSTGRES_DB=bodega_diza_test `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD `
  -v bodega_diza_postgres_test_data:/var/lib/postgresql/data `
  postgres:16-alpine

# Verificar disponibilidad
docker exec bodega_diza_postgres_test pg_isready -U postgres -d bodega_diza_test
```

Si el contenedor **ya existe**, usa `docker start bodega_diza_postgres_test` en lugar de ejecutar nuevamente `docker run`. Un volumen con datos previos **no se reinicializa al cambiar `POSTGRES_DB` o la contraseña**.

**No uses `docker compose down -v`, `docker volume rm`, `DROP DATABASE` ni importaciones con `--clean` sobre una base que contenga información que desees conservar.**

### Opción B — Base original / una copia de la base original

1. **Preferible:** restaurar una copia autorizada a una **nueva base aislada**, sin tocar la original.
2. Si se va a utilizar un servidor PostgreSQL existente, confirmar `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, contraseña y esquema. No iniciar otro contenedor en un puerto ocupado.
3. Hacer respaldo y verificarlo antes de conectar el backend. Si hay datos personales, no enviarlos por GitHub ni chats del equipo.
4. Al trabajar sobre datos originales, **no habilitar la importación de históricos ni los scripts de sincronización de inventario sin revisión**. La aplicación registra ventas reales en la base a la que se conecta.
5. Hibernate con `ddl-auto=update` puede modificar el esquema. Para una base original existente y compatible, evaluar `SPRING_JPA_HIBERNATE_DDL_AUTO=validate`; si no es compatible, preparar migraciones o clonar la base de manera controlada antes de probar.

El `api/docker-compose.yml` actualmente define un contenedor con nombre `bodega_diza_postgres` y puerto por defecto 5432. **No ejecutes simultáneamente ese Compose y el contenedor original si comparten nombre/puerto.** Para el escenario A utilizamos `docker run` precisamente para evitar esa colisión.

### Base nueva ≠ catálogo con datos

Una BD recién creada puede arrancar con tablas vacías. Para demostrar Inventario y Ventas se requieren **categorías, proveedores, productos, lotes y un usuario válido**. Para demostrar reportes históricos, además se deben importar los CSV de históricos autorizados mediante la interfaz/API de desarrollo. **No se generan ventas históricas al crear PostgreSQL**. Evitar cargar dos veces un CSV o aplicar sincronizadores contra una BD equivocada.

## 5. API Spring Boot (puerto 8081 recomendado)

En una terminal nueva:

```powershell
cd .\api
Copy-Item .env.example .env     # solo la primera vez
notepad .env
```

Para la **base de prueba A**, editar los siguientes valores de `api/.env` (conservar las demás claves de `.env.example`):

```dotenv
SERVER_PORT=8081
DB_HOST=localhost
DB_PORT=5433
DB_NAME=bodega_diza_test
DB_USER=postgres
DB_PASSWORD=COLOCAR_LA_CONTRASENA_DEL_CONTENEDOR
SPRING_JPA_HIBERNATE_DDL_AUTO=update
SPRING_JPA_SHOW_SQL=false
CORS_ALLOWED_ORIGIN=http://localhost:5173
JWT_SECRET=COLOCAR_UN_SECRETO_BASE64_DE_32_BYTES_O_MAS
JWT_EXPIRATION=86400000
ADMIN_EMAIL=admin@bodegadiza.com
ADMIN_PASSWORD=CREAR_UNA_CONTRASENA_LOCAL_SEGURA
ADMIN_NOMBRE=Administrador Diza
DIZA_DEMO_ENABLED=true
ML_SERVICE_BASE_URL=http://localhost:8002
```

Para usar la opción B, sustituir **únicamente** host, puerto, base, usuario y contraseña por los correspondientes a la BD elegida, después de verificar que realmente es la base prevista. En la base original, se recomienda dejar `DIZA_DEMO_ENABLED=false` y evaluar `ddl-auto=validate` si el esquema es compatible. Algunas versiones del backend pueden no incluir aún las dos últimas propiedades; comprobar que el código actualizado de la API está incluido en la rama.

Generar un secreto JWT aleatorio, en PowerShell (copiar el valor resultante **solo a tu `.env`**, no al repositorio):

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
[Convert]::ToBase64String($bytes)
```

`ADMIN_EMAIL` y `ADMIN_PASSWORD` son credenciales de arranque del **entorno local**; si la BD ya contiene usuarios, utilizar las credenciales autorizadas de esa instalación. No compartir una contraseña administrativa ni un secreto JWT por GitHub.

Arrancar la API desde `api/`:

```powershell
.\gradlew.bat bootRun --console=plain
```

Si tu versión del backend no lee el `.env` recién editado, comprueba su `application.properties` y las variables de entorno de esa misma terminal. Verifica en los logs que la conexión JDBC apunta a **`localhost:5433/bodega_diza_test`** antes de realizar operaciones. Puedes probar la compilación en otra terminal:

```powershell
cd .\api
.\gradlew.bat test
.\gradlew.bat build
```

**Atención:** `gradlew.bat test` y `build` son pasos recomendados de aceptación para cada integrante; el equipo debe verificar sus resultados. No se deben declarar «aprobados» hasta ejecutarlos en un clon limpio.

## 6. FastAPI / Machine Learning (puerto 8002)

Si usas Docker, no necesitas instalar Python en Windows. Desde la **raíz del repositorio**:

```powershell
# Construir la imagen a partir del código que se acaba de clonar
docker build -t bodegadiza-ml-7d-verificacion .\ml-service

# En una instalación nueva, crear contenedor y volumen persistente
docker run -d --name bodega_diza_ml_7d_validacion `
  -p 8002:8000 `
  -v bodega_diza_ml_7d_models:/app/data/models `
  bodegadiza-ml-7d-verificacion

curl.exe http://localhost:8002/health
```

Si el contenedor ya existe, utilizar `docker start bodega_diza_ml_7d_validacion`; si necesitas desplegar nueva imagen en un contenedor existente, planificar su recreación **conservando el mismo volumen de modelos**. No levantar dos servidores usando 8002.

**No se incluye automáticamente el modelo `.joblib` entrenado del equipo.** Un contenedor fresco necesita un entrenamiento inicial (o un artefacto confiable transferido por un canal apropiado). Si no existe, las rutas `/trainings/latest/...` devolverán 404.

### Entrenamiento inicial desde archivos de ejemplo

Si el equipo recibió y revisó los CSV de entrenamiento, colocarlos en:

```text
ml-service/data/ventas.csv
ml-service/data/productos.csv
ml-service/data/proveedores.csv
```

Su estructura debe ser compatible con el validador de `ml-service/app/preprocessing.py` y los ejemplos compartidos. Esos **no son necesariamente** los mismos CSV de `staging_diza` usados en reportes históricos.

En PowerShell, desde `ml-service/`, enviar los archivos al servicio:

```powershell
cd .\ml-service
curl.exe -X POST http://localhost:8002/trainings `
  -F "sales_file=@data/ventas.csv" `
  -F "products_file=@data/productos.csv" `
  -F "suppliers_file=@data/proveedores.csv"

curl.exe http://localhost:8002/trainings/latest/predictions
curl.exe http://localhost:8002/trainings/latest/replenishments
```

Alternativamente, ejecutar el entrenamiento local desde Python 3.12 con `python -m scripts.train_local --ventas data/ventas.csv --productos data/productos.csv --proveedores data/proveedores.csv --modelo-dir data/models`. **Ese entrenamiento local guarda el modelo en Windows, no en el volumen del contenedor**; para que FastAPI en Docker lo utilice, entrena mediante el endpoint o transfiere el artefacto de forma controlada.

Documentación interactiva del microservicio: <http://localhost:8002/docs>.

### Pruebas automáticas Python

Desde `ml-service/` (con imagen construida):

```powershell
docker run --rm --user root `
  -v "${PWD}:/workspace:ro" `
  -w /workspace `
  bodegadiza-ml-7d-verificacion `
  sh -c "python -m pip install --no-cache-dir -q pytest==8.4.2 && PYTHONDONTWRITEBYTECODE=1 python -m pytest -q -p no:cacheprovider"
```

En la ejecución verificada para APF3: **16 passed, 1 warning**; el warning corresponde a una API deprecada de Starlette/AnyIO, sin pruebas fallidas. Una instalación nueva debe confirmar el número final de pruebas y cualquier cambio de dependencias.

Para reproducir la comparación con CSV locales:

```powershell
docker run --rm --user root `
  -e PYTHONPATH=/workspace `
  -v "${PWD}:/workspace:ro" `
  -w /workspace `
  bodegadiza-ml-7d-verificacion `
  python scripts/apf3_comparacion.py
```

### Qué consulta Spring Boot

La API Java actúa como intermediaria y exige un JWT válido para sus rutas protegidas. En la integración actual se utilizan **`GET /ml/predictions/latest`** y **`GET /ml/replenishments/latest`** sobre `http://localhost:8081`. La API obtiene los resultados desde FastAPI en `http://localhost:8002/trainings/latest/...` y React consulta únicamente a Spring Boot. No exponer FastAPI sin controles a Internet.

## 7. Frontend React (puerto 5173)

En una **tercera terminal**, desde la raíz del repositorio:

```powershell
cd .\frontend-sistema
corepack pnpm install --frozen-lockfile
Copy-Item .env.example .env.local   # solo primera vez
notepad .env.local
```

Configuración de ejemplo:

```dotenv
VITE_API_BASE_URL=http://localhost:8081
VITE_INVENTORY_MODE=api
VITE_INVENTORY_ENDPOINT=/productos
```

A continuación:

```powershell
corepack pnpm build
corepack pnpm dev
```

Abrir <http://localhost:5173>. Si Vite cambia a **5174**, detener el proceso anterior que está ocupando 5173 o ajustar `CORS_ALLOWED_ORIGIN` en Spring Boot. Confirmar que el inicio de sesión usa el **usuario realmente existente** en la BD de destino. No utilizar el archivo `.env.local` de otro compañero sin revisar sus puertos.

## 8. Orden recomendado para levantar todo

1. Docker Desktop → PostgreSQL test en **5433** (o BD autorizada), verificar `pg_isready`.
2. FastAPI en **8002**, verificar `/health`, y entrenar/cargar **un modelo válido** si no existe.
3. Spring Boot en **8081**, confirmar logs JDBC y URL ML.
4. React en **5173**, verificar compilación y login.
5. Probar `Inventario`, `Ventas`, `Predicción de demanda` y `Inicio`.

| Servicio | URL local | Comprobación |
|---|---|---|
| PostgreSQL de prueba | `localhost:5433` | `docker exec ... pg_isready` |
| ML / FastAPI | <http://localhost:8002/health> | `{"status":"ok"}` |
| Swagger ML | <http://localhost:8002/docs> | documentación de endpoints |
| Spring Boot | <http://localhost:8081> | arranca sin error, login JWT funciona |
| React | <http://localhost:5173> | login, Inventario, Ventas y predicciones |

Si no aparece una predicción, comprobar **primero** que hay un entrenamiento persistido. Si Inventario muestra 401, comprobar JWT y credenciales válidas, no crear accesos de bypass.

## 9. Datos históricos vs. ventas reales

- **Ventas operativas:** registradas por `/ventas`, con tickets y movimientos de inventario. Son datos de la BD seleccionada.
- **Histórico de análisis CSV:** registros diarios por producto, cargados en una zona de análisis (`staging_diza` / rutas `/test-data` en la instalación de pruebas). **No son tickets ni vuelven a disminuir stock.** Solo funcionan si existen los datos y las rutas correspondientes; en desarrollo se requiere `DIZA_DEMO_ENABLED=true`.
- **Entrenamiento ML:** puede utilizar un conjunto separado de ventas históricas y productos; su modelo permanece en `data/models` o el volumen persistente de Docker. La última evaluación del APF3 utilizó **1 500 registros** para 20 productos. La pantalla de históricos operativos importó otro conjunto de **2 400 registros**. No sumarlos ni reemplazarlos entre sí sin conciliación.
- **Ingresos proyectados:** predicciones de unidades × precio de venta vigente. No sumarlos automáticamente a las ventas realizadas.

**Punto pendiente para el equipo:** dejar una colección de datos de ejemplo **sintéticos o anonimizados**, documentados, con las categorías/proveedores necesarios y el orden de carga; de lo contrario, un clon nuevo podrá compilar, pero no reproducir exactamente el Dashboard mostrado en la exposición.

## 10. Evidencias verificadas para APF3

| Verificación | Resultado observado |
|---|---|
| Compilación React | `tsc -b && vite build` correcto; 141 módulos transformados |
| Pruebas Python Docker | **16 passed**, 1 `DeprecationWarning` |
| Selección por validación cronológica | `hist_gradient_boosting`, menor MAE (**2.8377**) |
| Comparación | HistGradientBoosting, Random Forest, Ridge, promedio reciente, árbol de decisión |
| Evaluación final fuera de selección | **MAE 2.8758**, **RMSE 3.914**, **R² 0.7766**, WAPE 24.83 %, MAPE 26.03 % |
| Integración visual | Predicción de 7 días, unidades, ingresos S/ y reposición; gráficas de ventas históricas verificadas |

**Interpretación responsable:** R² = 0.7766 significa varianza explicada en el conjunto final evaluado; no es «77.66 % de precisión». El histórico es **disperso** y las métricas se calculan sobre **fechas con ventas registradas**, no sobre un calendario diario completo. El pronóstico de siete días **no equivale a una garantía de ventas**.

### Revisión pendiente antes de declarar el APF3 completo

- [ ] Confirmar las **indicaciones y rúbrica exactas** del APF3: entregables académicos, diagramas, estructura del informe y ponderaciones. Este README no sustituye esa revisión.
- [ ] Publicar todos los componentes en `feature/cielo` (en especial `ml-service/` y adaptaciones de la API/Frontend que aún no figuran en el remoto).
- [ ] Probar **clon limpio** en otra computadora: Postgres, ML con entrenamiento, Spring Boot, React y acceso JWT.
- [ ] Ejecutar y registrar `api/.\gradlew.bat test` y `build`, y probar login, productos, venta, inventario, reporte y predicciones extremo a extremo.
- [ ] Documentar CSV de ejemplo, credenciales locales de creación (no sus contraseñas), secuencia de importación y plan de recuperación de respaldos.
- [ ] Decidir la política de actualización del stock al generar nuevas recomendaciones; actualmente pueden reflejar un stock guardado en el entrenamiento.
- [ ] Incluir capturas de los resultados **reales** y de las métricas; distinguir validación y evaluación final.
- [ ] Antes de uso real, endurecer seguridad (roles/autorización, control de acceso ML, validación de cargas, manejo seguro de datos, migraciones formales).

## 11. Guía de Git para cada integrante

**El código de `feature/cielo` está destinado a revisión, no a una aplicación productiva.** Antes del push, desde la **raíz**:

```powershell
git branch --show-current
git status --short
git diff --check
git ls-files api/.env frontend-sistema/.env.local ml-service/.env
```

Si `git ls-files` imprime alguno de esos archivos, ya está rastreado: **NO hagas push** hasta retirarlo del índice de Git sin borrar el archivo local y comprobar la historia pertinente. Revisar igualmente `git status` para identificar `data/models`, respaldos `.dump`, secretos, CSV reales, `node_modules`, `.venv`, `dist` y salidas generadas. **No se debe usar `git add -A` sin antes auditar su resultado.**

Después de revisar qué se publicará, se puede preparar el commit en la rama de trabajo y revisar los archivos efectivamente incluidos:

```powershell
git add README.md api frontend-sistema ml-service
git diff --cached --name-only
git diff --cached --check
git status
```

`git add` es solamente un ejemplo **tras haber aplicado exclusiones y comprobado que el contenido es compartible**: también puede incorporar datos CSV o modelos que deben mantenerse privados. Para el primer envío del ML revisar cuidadosamente `ml-service/data/`.

Tras aprobación de la lista staged y ejecución de pruebas, el integrante dueño de la rama puede hacer `git commit` y `git push origin feature/cielo`. No hacer push forzado. Abrir un **Pull Request de `feature/cielo` a `main`** para revisión del equipo; no hacer merge hasta que el resto compruebe instalación, base de prueba y funcionalidades.

## 12. Solución de problemas frecuentes

| Síntoma | Qué revisar |
|---|---|
| `ModuleNotFoundError: app` en scripts ML | Ejecutar desde `ml-service/` con `-e PYTHONPATH=/workspace` en Docker o `python -m scripts...` local |
| ML `/health` OK pero `/trainings/latest/predictions` 404 | No hay modelo entrenado en **ese volumen**; entrenar desde CSV autorizados |
| Spring Boot no conecta a PostgreSQL | Puerto **5433** vs. **5432**, nombre real de la BD, contraseña, contenedor activo, logs JDBC |
| `401 Unauthorized` en productos/categorías | Token JWT ausente/vencido, credenciales incorrectas o frontend apuntando a otra API |
| CORS desde React | Vite en 5173/5174, `CORS_ALLOWED_ORIGIN`, API 8081 correcta |
| `pnpm` no existe | Verificar `corepack pnpm -v` y disponibilidad de Corepack/pnpm para Node instalado |
| `gradlew` no corre en PowerShell | Usar `.\gradlew.bat` **dentro de `api/`**, con Java 21 |
| No se ven CSV históricos | Revisar carga inicial de datos, permisos de `/test-data` y `DIZA_DEMO_ENABLED` SOLO en test |
| Pronóstico en soles 0 o faltante | Revisar precios en catálogo; los productos sin precio no deben sumarse como ingresos válidos |
| Dos Postgres o Vite compiten por puerto | `docker ps`, `netstat -ano | findstr :5433`, cerrar procesos duplicados sin borrar datos |

## 13. Responsabilidades y advertencias

- **No** subir `.env`, contraseñas, tokens JWT, copias de bases de datos ni registros reales de clientes.
- No borrar volúmenes de Docker que contengan el único modelo o los únicos datos.
- Los modelos `.joblib` tienen riesgo al deserializarse: cargar solo artefactos propios y verificados.
- Un entorno original debe estar protegido con respaldos y privilegios mínimos. Los datos de ejemplo y la base de prueba son la vía recomendada para la revisión entre compañeros.
- **No asumir que el README basta** para un clon reproducible: verificar archivos versionados, dataset de demostración compartible, esquemas y las credenciales que cada integrante crea localmente.

---

**Guía elaborada para facilitar la revisión de la rama `feature/cielo` en el APF3.** Cada integrante puede anotar problemas y evidencias en su Pull Request antes de integrar cambios a `main`.
