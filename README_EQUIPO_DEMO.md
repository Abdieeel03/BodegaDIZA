# BodegaDIZA — Inicio rápido para el equipo (APF3)

**Objetivo:** que los integrantes ejecuten **la misma copia de demostración de la base `bodega_diza_test`** utilizada durante el desarrollo, sin acceder a la computadora de la responsable ni a su PostgreSQL original. La base se **clona**, no se comparte como conexión en vivo. Cada integrante puede experimentar sin alterar la base del resto.

> El respaldo de la base no está incluido en este paquete de scripts. **Solo puede crearse en la computadora que tiene la BD** mediante `CREAR_COPIA_DEMO.ps1`. Para que el inicio sea realmente automático en los clones, la responsable debe incluir o entregar por un canal autorizado el archivo `demo-db/bodega_diza_test_demo.dump`. Asegurar primero que los datos son sintéticos o compartibles. **No poner una copia con datos reales/personales en un repositorio público.**

## 1. Requisitos mínimos de cada integrante

- **Docker Desktop** funcionando con contenedores Linux y Compose v2.
- **Git**, si van a clonar desde GitHub.
- Acceso a Internet en el primer arranque para obtener las imágenes y dependencias.
- Los puertos libres por defecto: `5173` (React), `8081` (Spring Boot), `8002` (FastAPI) y `5543` (PostgreSQL **de equipo**). Se pueden cambiar en `.env.equipo` antes del arranque.

**No tienen que instalar Java, Python ni Node para simplemente probar la aplicación**: Docker los contiene. Para desarrollar, pueden utilizar VS Code, IntelliJ, etc. y el README general ofrece el arranque por servicios.

## 2. Primera vez: pasos del integrante

1. Clonar la rama ya publicada, no antes:

   ```powershell
   git clone --branch feature/cielo https://github.com/Abdieeel03/BodegaDIZA.git
   cd BodegaDIZA
   ```

2. Confirmar que existe el respaldo compartido:

   ```powershell
   Test-Path .\demo-db\bodega_diza_test_demo.dump
   ```

   Si muestra `False`, solicitar a la responsable la copia **revisada y autorizada**. Colocarla exactamente en esa ruta. No funcionará restaurar un archivo vacío ni usar el `.dump` personal anterior sin anonimizar.

3. Ejecutar desde la **raíz**:

   ```powershell
   Set-ExecutionPolicy -Scope Process Bypass -Force
   .\INICIAR_EQUIPO.ps1
   ```

   El script crea `.env.equipo` con claves **aleatorias locales**, compila e inicia los cuatro servicios con Compose y, cuando no hay modelo guardado, lo entrena desde los CSV de ejemplo. Para entrenar automáticamente hacen falta `ml-service/data/ventas.csv`, `ml-service/data/productos.csv` y `ml-service/data/proveedores.csv`, previamente revisados e incluidos por el equipo.

4. Abrir **<http://localhost:5173>**. Consultar `TEAM_ADMIN_EMAIL` y `TEAM_ADMIN_PASSWORD` en `.env.equipo` (**no subir ni capturar estas claves**). Es normal que la primera ejecución prepare imágenes y construya servicios; si el script avisa de un error, leer el mensaje antes de continuar.

5. Para detener sin perder datos:

   ```powershell
   .\DETENER_EQUIPO.ps1
   ```

   `docker compose down` mantiene los volúmenes; **NO usar `down -v`** porque borraría la BD y el modelo del equipo.

**Puertos personalizados:** editar `TEAM_WEB_PORT`, `TEAM_API_PORT`, `TEAM_ML_PORT` y/o `TEAM_DB_PORT` en `.env.equipo`. Así se evita competir con otro proyecto en la misma computadora. La interfaz siempre apunta al puerto público elegido para la API. Si ya se levantó la aplicación, reconstruir/recrear el frontend tras cambiar los puertos: `docker compose --env-file .env.equipo -f docker-compose.equipo.yml up -d --build`.

## 3. Una sola vez: pasos de la responsable de la BD de pruebas

**Atención:** los siguientes pasos **se ejecutan únicamente en el equipo donde existe `bodega_diza_postgres_test`**, mientras Docker Desktop está activo.

1. Instalar estos archivos en el repositorio usando `INSTALAR_EQUIPO_DEMO.ps1`. No se altera la aplicación ni la base existente. Se respaldará el README previo.
2. Comprobar con el equipo que el contenido de la BD es ficticio o que su uso compartido está autorizado. Revisar especialmente proveedores, posibles clientes y el histórico CSV. `public.usuarios` se excluirá automáticamente del respaldo, pero **las otras tablas no se anonimizan por sí solas**.
3. Ejecutar:

   ```powershell
   cd C:\Proyectos\UNIVERSIDAD\BodegaDIZA
   .\CREAR_COPIA_DEMO.ps1
   ```

4. El archivo resultante estará en `demo-db/bodega_diza_test_demo.dump`. Incluye el esquema compatible y datos de inventario/ventas/historial, **pero no las filas originales de `public.usuarios`**. Durante la restauración, las referencias de tickets a usuarios históricos se reemplazan por cuentas ficticias **inhabilitadas**; Spring Boot crea un administrador **nuevo y local** con las claves de `.env.equipo`.
5. Para validar sin interferir con tus servicios existentes, **antes de ejecutar `INICIAR_EQUIPO.ps1`** configura puertos no ocupados en `.env.equipo` (ver sección 5), o detén tus servicios locales. Verifica el login y los módulos. No publiques el snapshot hasta comprobarlo y aprobar su contenido.

### Cómo compartir el respaldo

- **Recomendado si hay cualquier duda de privacidad:** por Drive/OneDrive con acceso restringido a los compañeros. El archivo permanece fuera de Git.
- **Opcional si todos los registros son datos de ejemplo sintéticos y están autorizados:** incluir el snapshot en el repositorio tras revisarlo. La configuración `.gitignore` lo bloquea de forma preventiva; **solo después de revisarlo**, se puede ejecutar de forma deliberada `git add -f demo-db/bodega_diza_test_demo.dump` y comprobar `git diff --cached --stat` antes de hacer commit. No usar `git add .` sin revisar el contenido.

**Importante:** no compartir directamente el puerto `5433` de tu PostgreSQL local por Internet, no publicar `.env`, y no incluir un backup no anonimizado como `bodega_pre_sincronizacion.dump` en GitHub.

## 4. ¿Qué información encontrarán tus compañeros?

El snapshot puede conservar los productos, categorías, proveedores, existencias, lotes, movimientos, ventas operativas y las filas históricas importadas **que realmente estén presentes al exportar**. Las estadísticas pueden diferir de capturas anteriores si desde entonces se registraron nuevas operaciones.

- **Inventario:** datos operativos de la copia; al vender o registrar una entrada en esa copia se modifica **solo la BD local del compañero**.
- **Ventas operativas:** tickets reales del entorno de demostración y descuento de stock. Los tickets antiguos referencian usuarios ficticios deshabilitados.
- **Ventas históricas:** registros diarios de análisis; no son tickets y no descuentan stock de nuevo.
- **Predicción de demanda:** **NO se guarda en PostgreSQL**; el modelo Python vive en un volumen Docker independiente. La primera vez se reconstruye con los CSV compartidos, de modo que la reproducción exige esos tres archivos. Sus resultados pueden variar si cambian datos, versiones de paquetes o fechas de referencia.
- **Ingresos estimados en S/:** pronóstico de unidades multiplicado por el precio de venta actual; **no** son ingresos ya cobrados ni ganancias.

## 5. Puertos y conexión entre servicios

| Servicio | En el navegador / PC | Dirección dentro de Docker |
|---|---|---|
| React Vite | `http://localhost:5173` | `frontend:5173` |
| Java Spring Boot | `http://localhost:8081` | `api:8081` |
| ML FastAPI | `http://localhost:8002/health` | `ml:8000` |
| PostgreSQL copia | `localhost:5543` | `postgres:5432` |

La API se conecta a `postgres:5432` y `ml:8000` **dentro de Docker**. Por eso **no** debe configurar `DB_HOST=localhost` desde el contenedor de Spring Boot. En la computadora de cada compañero el Postgres local de la copia escucha en `5543`, distinto del `5433` de la responsable.

Si la responsable desea probar esta versión **sin detener sus servicios actuales**, debe crear el archivo `.env.equipo` con estos puertos **antes del primer inicio** (al iniciar, el script reutilizará las claves existentes):

```dotenv
TEAM_DB_PORT=5543
TEAM_API_PORT=8091
TEAM_ML_PORT=8012
TEAM_WEB_PORT=5183
TEAM_DB_PASSWORD=REEMPLAZAR_POR_SECRETO_LOCAL
TEAM_JWT_SECRET=REEMPLAZAR_POR_BASE64_DE_32_BYTES
TEAM_ADMIN_EMAIL=admin.equipo@bodegadiza.local
TEAM_ADMIN_PASSWORD=REEMPLAZAR_POR_CLAVE_LOCAL
```

**Preferible:** ejecutar `.\INICIAR_EQUIPO.ps1 -SoloConfigurar` para generar `.env.equipo` sin iniciar Docker. Editar después únicamente los cuatro valores `TEAM_*_PORT` y, por último, ejecutar `.\INICIAR_EQUIPO.ps1`. No copiar contraseñas públicas del ejemplo.

## 6. Pruebas de aceptación para el equipo

1. `docker compose --env-file .env.equipo -f docker-compose.equipo.yml ps` muestra cuatro servicios ejecutándose.
2. Se puede acceder a `http://localhost:8002/health` (o puerto configurado), y `GET /trainings/latest/predictions` devuelve una lista después del entrenamiento.
3. Login por JWT correcto con el administrador local. Si falla, revisar `ADMIN_EMAIL`/`ADMIN_PASSWORD` de `.env.equipo`, y los logs de Spring Boot.
4. Inventario contiene productos, cantidades y categorías; se pueden consultar sin 401.
5. Se consulta el historial separado de ventas operativas; un CSV histórico **no** disminuye stock.
6. Registrar una **venta pequeña en esta copia de pruebas**, verificar descuento de stock y total de ticket.
7. Predicción de siete días por producto en unidades y soles; modelo y CSV compatibles.
8. `corepack pnpm build` en React / `./gradlew test` en Java / `pytest` en Python son verificaciones recomendadas; el resultado depende del código de la rama publicada.

> **Pruebas ya verificadas por la responsable antes de esta entrega:** React `141 modules transformed`, 16 pruebas Python aprobadas, comparación de cinco algoritmos y visualización de ventas. **Aún no está verificada una instalación de cuatro contenedores desde un clon nuevo**: ese será el criterio de aceptación antes de declarar el paquete reproducible al 100 %.

## 7. Errores típicos

| Mensaje | Causa y solución |
|---|---|
| `bind: address already in use` | Otro servicio ocupa 5173, 8081, 8002 o 5543. Cambiar los puertos `TEAM_*_PORT` en `.env.equipo`. |
| `No se encontró el snapshot` | Falta `demo-db/bodega_diza_test_demo.dump`; la responsable debe generarlo y compartirlo. |
| `No hay un modelo entrenado` | Faltan los 3 CSV de `ml-service/data` o todavía no terminó el entrenamiento inicial. |
| `401` en API | Verificar usuario creado en el arranque, token y contraseña local. |
| `relation ... does not exist` | La restauración falló, o se compartió un respaldo de otra versión de BD. Inspeccionar logs de PostgreSQL. |
| `Port 5174` | Se inició Vite manualmente además del contenedor; detener uno o ajustar puertos. |
| `java.lang... validate schema` | El esquema del respaldo y las entidades Java no coinciden. No cambiar a `ddl-auto=update` para ocultarlo: revisar versiones/migraciones. |

Para consultar logs:

```powershell
docker compose --env-file .env.equipo -f docker-compose.equipo.yml logs --tail=100 postgres api ml frontend
```

**Prohibido:** `docker compose down -v`, `docker volume rm`, `DROP DATABASE`, o ejecutar importaciones sobre la base **original** sin autorización/backup. Los comandos de este paquete **no hacen commit ni push** y no modifican el contenedor `bodega_diza_postgres_test` salvo la lectura necesaria para el `pg_dump`.

## 8. ¿Y la base verdadera?

Este entorno es para **demostración y desarrollo**, no producción. Cuando la bodega disponga de su PostgreSQL real, **Spring Boot podrá conectarse con otras variables** (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`) si el esquema es compatible, con respaldo previo, gestión de usuarios/roles, `DIZA_DEMO_ENABLED=false`, controles de seguridad y migraciones. No apuntar este Compose de demostración a la base real: crea una configuración de despliegue separada y supervisada. El modelo deberá volver a entrenarse/evaluarse con ventas reales autorizadas.

## 9. Pendientes APF3 y trabajo colaborativo

- [x] Modelo modular e inferencia de siete días implementados.
- [x] Cinco candidatos comparados; HistGradientBoosting seleccionado por MAE.
- [x] 16 pruebas Python aprobadas y React compilado localmente.
- [x] Gráficas de ventas por día y por mes verificadas.
- [ ] **Exportar, revisar y compartir el snapshot de pruebas**, sin credenciales.
- [ ] **Publicar `ml-service/`, API y frontend actualizados en `feature/cielo`**, con los CSV de demostración autorizados.
- [ ] **Validar la puesta en marcha con `INICIAR_EQUIPO.ps1` desde un clon limpio**, probar login, inventario, ventas, reportes, ML y Docker Compose.
- [ ] Ejecutar/verificar pruebas Java y flujo de extremo a extremo en el entorno del compañero.
- [ ] Confrontar los resultados con la **rúbrica académica del APF3** y adjuntar capturas, métricas y limitaciones de fechas incompletas.
- [ ] Revisar recomendaciones de reposición cuando cambia el stock y endurecimiento de seguridad para uso real.

**Responsabilidad del equipo:** no compartir credenciales, no enviar el snapshot fuera del grupo autorizado, documentar incidencias y no hacer merge a `main` sin revisión.
