# Pruebas automáticas de BodegaDIZA

La suite permite demostrar funcionalidad sin hacer clic manualmente ni preparar una base de datos. Playwright abre Chromium, inicia React y la API Spring Boot, crea datos sintéticos mediante HTTP y compara los resultados con valores esperados. Las peticiones de negocio no se simulan.

## Ejecutar desde cero

Requisitos: Java 21 (configurar `JAVA_HOME` si hay varias versiones), Node 24 y pnpm 10. La primera instalación requiere Internet para dependencias de Gradle, JavaScript y Chromium. No se necesita Docker, PostgreSQL, una cuenta existente ni archivos `.env`.

Desde la raíz, instalar una vez:

```powershell
cd frontend-sistema
corepack pnpm@10 install --frozen-lockfile
corepack pnpm@10 exec playwright install chromium
cd ..
```

Después, ejecutar en PowerShell:

```powershell
.\EJECUTAR_PRUEBAS.ps1
```

Para mostrar el navegador durante la exposición:

```powershell
.\EJECUTAR_PRUEBAS.ps1 -MostrarNavegador
```

También se puede ejecutar solo la suite nueva desde `frontend-sistema`:

```powershell
npm test
npm run test:headed
npm run test:report
```

Los dos primeros comandos son alternativas. El último abre el reporte HTML de la última ejecución. El script devuelve un error si alguna suite falla; no declara éxito cuando hay fallos.

## Qué se comprueba

| Caso | Acción automatizada y resultado esperado |
|---|---|
| AUTO-01 (3 casos) | Abrir inventario, ventas y predicción sin sesión → login |
| AUTO-02 | Contraseña incorrecta → HTTP 401 y mensaje visible |
| AUTO-03 | Login válido → navegación; cerrar sesión → rutas protegidas inaccesibles |
| AUTO-04 | Buscar SKU y nombre → producto persistido y stock exacto |
| AUTO-05 | Buscar un SKU inexistente → sin resultados; limpiar → listado visible |
| AUTO-06 | Filtrar categoría y estado → distinguir stock bajo y agotado |
| AUTO-07 | Carrito vacío → registro deshabilitado; producto agotado no seleccionable |
| AUTO-08 (3 casos) | Cantidad 0, negativa o con cuatro decimales → rechazo y stock intacto |
| AUTO-09 | Agregar 6 y luego 5 unidades con stock 10 → rechazo de la segunda cantidad |
| AUTO-10 | Quitar del carrito → sin ticket ni descuento de stock |
| AUTO-11 | Venta de varios productos → importe 16.50, ticket visible y stock 7 y 1 |
| AUTO-12 | Vender 0.500 unidades → importe 2.25, stock 9.5 y movimiento de salida |
| AUTO-13 | Enviar venta sin JWT → HTTP 401, stock intacto |
| AUTO-14 | Venta con un segundo producto insuficiente → sin ticket, movimientos ni descuentos parciales |
| AUTO-15 | Enviar cantidad cero y SKU duplicado a la API → rechazo sin duplicar producto |
| AUTO-16 | Venta entre dos lotes → consumir primero el que vence antes (FEFO) |

Son **20 ejecuciones**: AUTO-01 y AUTO-08 se ejecutan tres veces cada uno. AUTO-01 a AUTO-12 interactúan con el navegador; AUTO-13 a AUTO-16 comprueban directamente reglas y seguridad por HTTP. La preparación de datos usa la API real. No hay casos omitidos deliberadamente en esta suite.

## Aislamiento y alcance

- API exclusiva en `127.0.0.1:18081`; React en `127.0.0.1:15173`. Si algún puerto está ocupado, la ejecución falla en lugar de reutilizar otro servidor.
- La tarea Gradle `bootE2e` usa H2 en memoria y configuración exclusiva del classpath de pruebas. No importa `.env`, y fija por argumentos la conexión H2, el dialecto y el esquema temporal. Las tablas desaparecen al cerrar el proceso.
- Cada caso crea SKUs, categoría y proveedor propios. El login usa una cuenta sintética creada automáticamente en esa base. La contraseña incluida en las pruebas no pertenece a una cuenta real.
- La sesión del frontend vive en memoria. Después del login, los tests navegan mediante enlaces del menú; recargar con `page.goto` cerraría la sesión. Se corrigió este problema también en el archivo Playwright preexistente.
- Estas pruebas verifican React, JWT, controladores, servicios y persistencia H2. No certifican compatibilidad completa con PostgreSQL, envío SMTP, importación de históricos ni predicciones del servicio Python.
- El formulario de alta de productos de la UI actualmente está restringido a `localhost:8081` y al modo demo. En esta suite el catálogo se prepara por API; el alta desde ese formulario sigue fuera de cobertura.

## Pruebas anteriores

Se conservan las pruebas JUnit existentes de autenticación, persistencia, inventario/ventas, recuperación de contraseña, reportes y reposición. Se ejecutan con `api/gradlew.bat test`; su reporte está en `api/build/reports/tests/test/index.html`.

Las pruebas Python continúan en `ml-service/tests`. Requieren Python 3.12, las dependencias de `requirements-dev.txt` y los CSV descritos por el proyecto. Esos CSV no están versionados, por lo que esta nueva automatización de GitHub no ejecuta la suite Python ni supone que sus datos existen. El comando siguiente prepara un entorno virtual, instala todas las dependencias (incluido `psycopg[binary]`), verifica su integridad y ejecuta la suite con reporte XML:

```powershell
.\ml-service\PROBAR_ML.ps1
```

Para incluir ML junto con Java y Playwright, desde la raíz: `.\EJECUTAR_PRUEBAS.ps1 -IncluirML`. Si todavía no existe `.venv` y Python 3.12 no está en el lanzador `py`, preparar primero ML con `PROBAR_ML.ps1 -PythonExe 'C:\ruta\a\Python312\python.exe'`. El reporte Python queda en `ml-service/test-results/pytest.xml`. No usar el Python global 3.14 para instalar las versiones científicas fijadas para este proyecto.

La suite Playwright anterior se conserva como `npm run test:existing`. Requiere el sistema previamente iniciado, `E2E_EMAIL`, `E2E_PASSWORD`, catálogo y modelo entrenado. Su prueba de escritura sigue sujeta a `E2E_ALLOW_SALE=SI_SOLO_BD_TEST` y modifica la base configurada. Para una exposición reproducible, usar la nueva suite `npm test`.

## Evidencias para la entrega

- `frontend-sistema/playwright-report/index.html`: reporte navegable, resultado y duración por caso.
- `frontend-sistema/test-results/functional.xml`: resultados JUnit para integración continua.
- Ante un fallo: captura, vídeo y traza de Playwright. AUTO-11 adjunta además una captura del inventario después de vender, incluso cuando pasa.
- `.github/workflows/pruebas.yml`: al subir cambios o abrir un PR, ejecuta Java, compilación React y la nueva suite. Guarda los reportes como artefacto `resultados-pruebas` durante 14 días.

La configuración de GitHub queda preparada en el repositorio; su primera ejecución remota ocurrirá al publicar estos archivos. Los reportes locales no se versionan: se regeneran y se pueden adjuntar al informe de la profesora. Registrar fecha y resultado real de cada ejecución; no confundir pruebas aprobadas con porcentaje de cobertura de todo el sistema.

## Verificación local del 21 de noviembre de 2026

| Verificación | Resultado observado |
|---|---|
| JUnit, con `test --rerun-tasks --offline` | 19 aprobadas, 0 fallidas, 0 omitidas |
| Comando único `EJECUTAR_PRUEBAS.ps1` | Finalizó con código 0; Java reutilizó el resultado anterior y Playwright ejecutó los 20 casos |
| Playwright, configuración automática | 20 aprobadas en 1.4 minutos, 0 fallidas, 0 omitidas |
| Compilación React, `npm run build` | Correcta |
| Oxlint sobre tests y configuraciones Playwright | Sin errores ni advertencias |
| Suite Python | No pudo recolectar los tests: faltan `numpy` y `pandas` en el Python local 3.14; no se declara aprobada |
| GitHub Actions | Configuración preparada; todavía no ejecutada remotamente |

La ejecución local utilizó Java 21 mediante `JAVA_HOME`. Estos resultados corresponden a esta revisión; cada integrante debe ejecutar las pruebas en su equipo.
