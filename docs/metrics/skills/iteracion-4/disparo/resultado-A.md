| nº | Skill | Motivo |
|---|---|---|
| 1 | perf-compare | Investigar por qué subió el TBT desde el último commit es una regresión; perf-compare cruza reportes con el historial de git. |
| 2 | NONE | Añadir un botón de login es una tarea de código normal sin relación con rendimiento. |
| 3 | NONE | Acelerar el pipeline de CI no es rendimiento web ni Lighthouse; ninguna skill encaja. |
| 4 | NONE | Optimizar una consulta SQL no tiene que ver con wperf ni con Lighthouse. |
| 5 | NONE | Re-renders de React y useMemo son una duda de código, no una auditoría con wperf. |
| 6 | perf-compare | Pide comparar la auditoría de antes con la de después de un cambio, justo lo que cubre perf-compare. |
| 7 | NONE | Es una pregunta conceptual sobre el LCP; se responde sin skill. |
| 8 | perf-fix | Pide aplicar un arreglo (defer a scripts bloqueantes) y comprobar que mejora, que es el ciclo de perf-fix (aplica, reaudita, compara). |
| 9 | perf-compare | Pregunta si el cambio ya aplicado mejoró el rendimiento; es validar el efecto de un arreglo comparando antes y después. |
| 10 | perf-compare | El historial de auditorías de una URL (`wperf history`) está en la descripción de perf-compare. |
| 11 | perf-fix | Pide corregir un problema concreto de rendimiento en el código de la web (imágenes sin width y height, que causan CLS). |
| 12 | perf-fix | Quitar un script no usado es un arreglo de rendimiento en el repo; "mide si mejora" lo cubre el ciclo de verificación de perf-fix. |
| 13 | perf-audit | Pide auditar una URL y priorizar qué mejorar primero. |
| 14 | perf-compare | La evolución de una URL durante la semana es `wperf history`, que cubre perf-compare. |
| 15 | perf-audit | "Va lenta en el móvil, ¿por dónde empiezo?" es diagnóstico y priorización, y perf-audit pregunta los perfiles de dispositivo. |
| 16 | perf-compare | Investigar si el LCP empeoró desde el último deploy es una regresión, que cubre perf-compare. |
| 17 | perf-fix | "Aplica la mejora 2" tras una auditoría aparece literalmente en la descripción de perf-fix. |
| 18 | perf-fix | Validar que el arreglo del defer no empeoró nada es la fase de validación e integridad de perf-fix (reaudita, compara, revierte). |
| 19 | perf-fix | Implementar lazy loading es una mejora de rendimiento en el código, y "lazy-load" figura en la descripción de perf-fix. |
| 20 | perf-fix | Pide corregir el LCP de la web, que es un arreglo (la skill localizaría el origen). |
| 21 | perf-audit | Medir LCP y CLS de una URL en 3g y 4g es medir en perfiles de red, justo lo que hace perf-audit. |
| 22 | perf-compare | Distinguir una mejora real de ruido de medición es el núcleo de perf-compare. |
| 23 | perf-audit | Interpretar un reporte guardado en `.perf/reports/` está nombrado en la descripción de perf-audit. |
| 24 | perf-fix | Pide arreglar el CLS y medir la mejora, que es el ciclo completo de perf-fix. |
| 25 | perf-audit | Pide una auditoría Lighthouse y qué arreglar primero; la descripción de perf-audit cubre ese caso aunque el mensaje esté en inglés. |
