# BodegaDIZA — Instrucciones para agentes de desarrollo

## 1. Objetivo y alcance
- Mejorar el sistema existente de gestión de inventario, ventas, demanda, reposición y alertas. No reescribirlo ni crear un proyecto paralelo.
- Es un sistema académico de simulación que representa una bodega profesional; no está en producción empresarial. Se autoriza generar ventas, productos, proveedores, compras, costos, lotes, vencimientos, movimientos, existencias y otros datos realistas necesarios para desarrollar, entrenar, evaluar o demostrar funciones. Mantener coherencia entre tablas, reglas verificables y escenarios reproducibles, con evaluación independiente. No añadir avisos, banners ni etiquetas de simulación en la interfaz ni modificar el informe académico por iniciativa propia.
- Trabajar en `feature/avance-final`. Punto de partida publicado: `66dcd44` (integración y pruebas automatizadas). Respetar los cambios posteriores del usuario y del equipo.
- Implementar el bloque solicitado; tomar decisiones técnicas autónomas que mejoren su funcionalidad, facilidad de uso, coherencia de datos y calidad sin complejidad innecesaria. Evitar restricciones empresariales desproporcionadas para el alcance académico. Documentar problemas ajenos al bloque sin ampliar el trabajo por iniciativa propia.

## 2. Arquitectura y entorno
- `frontend-sistema/`: React, Vite, TypeScript, CSS y componentes reutilizables. Dependencias con pnpm; preservar el lockfile salvo cambios necesarios y justificados.
- `api/`: Java 21, Spring Boot, Gradle, JPA, Spring Security/JWT y PostgreSQL.
- `ml-service/`: Python, FastAPI, pandas, scikit-learn y persistencia de modelos.
- `demo-db/`: snapshot y scripts de demostración del equipo; no modificar el dump sin petición explícita.
- Entorno habitual Windows PowerShell, raíz `C:\Proyectos\UNIVERSIDAD\BodegaDIZA`. React local 5173; API local 8081; PostgreSQL de pruebas 5433 (`bodega_diza_postgres_test`, BD `bodega_diza_test`); ML 8002 (`bodega_diza_ml_7d_validacion`). Los puertos pueden cambiar por configuración; no asumirlos en código de producción.
- El servicio ML local se actualizó copiando código al contenedor existente. Su imagen anterior no reproduce necesariamente el código vigente; informar esta limitación si resulta relevante.
- Reutilizar contenedores y servicios existentes; no reconstruir la infraestructura innecesariamente ni crear contenedores adicionales. Se autorizan ajustes coherentes de datos, migraciones y cambios de estructura técnicamente justificados en la base de pruebas, verificando previamente que `current_database()` sea exactamente `bodega_diza_test`. Ensayar las migraciones y reglas en un entorno aislado cuando sea posible. Esta autorización no se extiende a otras bases, a borrar volúmenes, a `docker system prune` ni a detener servicios ajenos al trabajo.
- No publicar secretos, tokens, contraseñas, archivos `.env`, dumps adicionales ni modelos entrenados. No copiar credenciales a código, fixtures, logs o documentación. Mantener las protecciones de Git.

## 3. Reglas de implementación
- Leer primero los archivos afectados, contratos API, pruebas y configuración real; verificar supuestos antes de modificar. Reutilizar servicios, DTO, repositorios y componentes existentes.
- Mantener validación en backend, transacciones, integridad referencial, autenticación y autorización. No confiar únicamente en validaciones del frontend.
- Mantener compatibilidad razonable con los consumidores actuales; si un contrato cambia, actualizar consumidores y pruebas de forma coordinada. No ocultar errores como ceros ni simular éxito.
- No duplicar stock, tickets, movimientos ni fuentes históricas. Verificar solapamientos entre `public.ventas`/`detalles_venta` y `staging_diza.ventas_csv`; no sumar dos veces ni borrar registros para resolver discrepancias.
- Distinguir stock físico de stock vendible; conservar precisión de cantidades y dinero, reglas de redondeo y coherencia del total del ticket. Todas las mutaciones de inventario deben tener trazabilidad.
- Evitar refactorizaciones amplias, nuevas dependencias o cambios de configuración no relacionados. No eliminar pruebas para lograr resultados verdes.

## 4. Lotes y vencimientos
- Registrar por lote, no por unidad. Permitir distintas fechas para un mismo producto; no fusionar silenciosamente lotes incompatibles.
- Diferenciar fecha confirmada (exacta o mes/año con precisión conservada), pendiente de verificación y no aplica. No inventar fechas ni inferir vencimientos a partir de la categoría.
- Mes/año: no convertir a fin de mes salvo que el significado esté confirmado; conservar la precisión y evitar ambigüedad en las decisiones de venta. Si no se puede determinar un límite seguro, dejar pendiente.
- No aplica debe estar justificado por política del producto; no usarlo para omitir el control de un alimento o producto que requiere vencimiento. Los lotes pendientes no se consideran vendibles hasta regularizar su situación.
- Conservar la historia y existencias de lotes preexistentes. No reclasificar todas las fechas antiguas automáticamente; ofrecer regularización explícita, sin duplicar cantidades. Detectar casos sospechosos como fechas genéricas sin afirmar que son falsas. Se permite ajustar datos de `bodega_diza_test` con coherencia y justificación; las fechas generadas pertenecen a escenarios reproducibles, sin atribuirles verificación física inexistente.
- FEFO: asignar primero lotes vendibles con vencimiento más cercano; excluir vencidos y pendientes, incluso si se selecciona un lote manualmente. Lotes válidos sin vencimiento se asignan después con criterio determinista (p. ej., FIFO). Conservar la regla existente sobre vencimiento en el día mientras no se apruebe otra.
- Mantener coherencia de stock vendible en inventario, ventas, dashboard, alertas y lectura ML. Ajustar consultas y consumidores de fechas nullable cuando sea necesario.
- Permitir regularizar una fecha con autorización y trazabilidad; si una cantidad corresponde a fechas diferentes, dividir el lote en una transacción sin duplicar stock ni alterar tickets históricos.
- En el bloque de seguimiento: horizontes 7, 15, 30, 90 días y todos; estados vencido (<0), hoy (0), crítico (1–3), próximo (4–7), preventivo (8–30) y seguimiento (>30), además de pendientes y no aplica cuando corresponda. No excluir vencidos con stock físico del seguimiento.

## 5. Machine Learning: restricciones académicas
- Conservar Random Forest Regressor, Decision Tree, Ridge, HistGradientBoosting y media reciente como candidatos/referencia de demanda. No fijar un ganador; seleccionar por evaluación temporal verificable.
- Conservar Gradient Boosting para clasificación del riesgo de agotamiento, reglas de reposición y Hill Climbing en dos usos distintos: optimización de hiperparámetros y optimización del presupuesto de compras. Verificar las clases concretas en el código antes de documentarlas.
- No agregar clustering, KNN, SVM, redes neuronales u otros algoritmos sin autorización y justificación. Horizonte de demanda: siete días.
- Distinguir última venta, fecha de corte, entrenamiento, generación de inferencia y horizonte. No presentar como vigente un período vencido. Si hay datos desactualizados, distinguir su antigüedad. Se permiten escenarios realistas de avance temporal con ventas, variaciones de demanda, agotamientos y reposiciones reproducibles; no imputar ceros como hechos observados sin cobertura ni generar datos solo para favorecer métricas.
- Separar entrenamiento de inferencia; reutilizar modelos persistidos compatibles y recalcular reposición con stock vendible actual. Una venta nueva no requiere por sí sola reentrenar todo el modelo.
- Detectar cambios de demanda por SKU con evidencia suficiente; evaluar ventanas recientes, tendencias y disponibilidad. Distinguir falta de información, cero confirmado y ventas limitadas por agotamiento. Tratar fechas faltantes según su cobertura, no imputarlas automáticamente como cero.
- Mantener evaluación cronológica sin fuga de información: validación walk-forward y prueba final separada, candidatos en los mismos cortes, ajuste de hiperparámetros solo con validación, semillas reproducibles. Comparar con media reciente y reportar cobertura, MAE, RMSE, R², MAPE, WAPE y resultados por SKU/período cuando proceda. Diferenciar demanda en días observados de pronóstico esperado por día calendario.
- Se pueden mejorar la implementación, entrenamiento, configuración y rendimiento de los algoritmos existentes de ML y Hill Climbing, conservándolos. No modificar ventas o métricas ni generar datos exclusivamente para obtener un resultado favorable. Mantener escenarios normales y de estrés separados, incluyendo el cambio reciente de demanda como caso de prueba. No prometer umbrales de precisión no demostrados.
- Clasificación: separar etiquetas realmente observadas de etiquetas heurísticas; reportar distribución, matriz de confusión y métricas pertinentes (precision, recall, F1, calibración cuando haya evidencia). No presentar una probabilidad heurística como una probabilidad validada.
- Compras: separar precio de venta de costo de adquisición, usar costo de compra verificable, no usar el precio de venta como costo silenciosamente. Respetar presupuesto, cantidades, unidades, stock y restricciones; el usuario confirma antes de generar una operación.

## 6. Interfaz y experiencia de usuario
- Mantener una interfaz SaaS sencilla, bonita, compacta, profesional y consistente; títulos Inter, menú lateral, sin encabezado global superior redundante. Respetar el orden del menú y ubicar Resumen operativo después de Predicción y reposición.
- Reutilizar componentes, estilos y patrones del proyecto. No reemplazar los gráficos existentes ni alterar la estructura del dashboard por iniciativa propia. Unificar encabezados de Inventario, Ventas, Predicción y Próximos a vencer sin perder funcionalidades.
- Mantener diseño adaptable a móvil sin cortes, superposiciones ni desplazamientos horizontales innecesarios. Estados vacío, carga, error y éxito claros y accesibles; no usar solo color para estados.
- Mantener Actualizar modelo como ventana/modal/página propia accesible desde su botón; métricas visibles, sin estado redundante de predicción. No confundir actualización de inferencia con reentrenamiento.
- Alertas operativas: stock, vencimientos y riesgo; evitar duplicados, enlazar producto/lote específico, refrescar después de operaciones y mostrar servicio no disponible cuando ML falla. No inventar alertas ni cifras.

## 7. Pruebas y flujo de trabajo
- Antes de editar: revisar `git status --short`, rama, diffs existentes y pruebas relevantes. No descartar cambios del usuario, aplicar stashes, cambiar de rama, hacer reset, commit, push ni abrir PR sin autorización.
- Verificar la configuración antes de ejecutar pruebas automatizadas: preferir H2 en memoria, fixtures o almacenamiento temporal aislado. Para migraciones, integración y demostración se autoriza `bodega_diza_test` tras verificar su identidad; no operar sobre otras bases. Mantener separados los escenarios de evaluación y no confundir resultados simulados con operación empresarial real.
- Frontend: desde `frontend-sistema/`, `pnpm run build`, pruebas Playwright específicas y `pnpm test` cuando sea pertinente. No alterar selectores para ocultar fallos de negocio.
- Backend: desde `api/`, `./gradlew.bat compileJava compileTestJava`, `./gradlew.bat test --console=plain` (en Linux usar `./gradlew`), verificar que el perfil sea seguro. Si una tarea queda UP-TO-DATE, no describirla como recién ejecutada.
- ML: revisar `ml-service/PROBAR_ML.ps1` y `requirements-dev.txt`; ejecutar pytest en entorno aislado compatible con las dependencias, sin reconstruir Docker ni instalar dependencias globales sin permiso.
- La integración base pasó 20/20 Playwright y compilaciones React/Java. No asumir que las nuevas modificaciones preservan esos resultados. JUnit fresco, pytest y consistencia histórica quedaron pendientes al comenzar.
- Añadir pruebas positivas y negativas relevantes; verificar también datos límite, errores, compatibilidad, transacciones y regresiones. No omitir fallos ni afirmar que se ejecutaron pruebas no realizadas.
- Entregar resumen de archivos modificados, decisiones, resultados de comandos y pruebas, limitaciones, riesgos, migraciones pendientes y pasos manuales mínimos. Dejar los cambios sin commit para revisión del usuario.

## 8. Orden de trabajo acordado
1. Lotes, regularización de vencimientos y seguimiento preventivo.
2. Alertas operativas e integración con inventario y ventas.
3. Predicción vigente, adaptación a cambios de demanda, evaluación y riesgo de agotamiento.
4. Compras, costos y Hill Climbing.
5. Unificación UI/UX, pruebas y aceptación final; preparación de despliegue sin afirmar que se desplegó.

## 9. Eficiencia de desarrollo
- Priorizar soluciones sencillas, funcionales y profesionales para el alcance académico.
- Revisar solo archivos necesarios; evitar análisis repetitivos, sobreingeniería y documentación extensa.
- Reutilizar componentes, servicios y funciones existentes; generar fixtures realistas cuando sean necesarios.
- Tomar decisiones técnicas autónomas y continuar desde el avance actual, sin reiniciar análisis resueltos.
- Ejecutar pruebas directamente relacionadas con los cambios; reservar suites completas para integración final.
- Conservar los algoritmos existentes de Machine Learning.
- Entregar resúmenes finales breves y concretos, con resultados reales y limitaciones relevantes.
