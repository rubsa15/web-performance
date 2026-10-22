| Nº | Skill | Motivo |
|---|---|---|
| 1 | perf-audit | Pide medir LCP y CLS de una URL en varios perfiles de red, que es lo que hace la auditoría. |
| 2 | perf-compare | Valida que un arreglo ya aplicado no ha empeorado nada, que es comparar antes/después. |
| 3 | perf-compare | El cambio ya está hecho y pregunta si el rendimiento ha mejorado, así que hay que comparar antes/después. |
| 4 | perf-fix | "Aplica la mejora 2" tras una tabla de auditoría coincide literalmente con la descripción de perf-fix. |
| 5 | perf-audit | Pide auditar una URL y priorizar qué mejorar primero. |
| 6 | NONE | Es una pregunta conceptual sobre el LCP, que se responde sin skill ni medición. |
| 7 | perf-audit | Pide una auditoría Lighthouse y qué arreglar primero (en inglés). |
| 8 | perf-compare | Pide la evolución de una URL en el tiempo, que cubre `wperf history`, citado en la descripción. |
| 9 | perf-fix | Pide modificar el código (defer a scripts bloqueantes) y comprobar la mejora, el flujo de perf-fix. |
| 10 | perf-fix | Pide corregir el LCP en el código de la web. |
| 11 | perf-fix | Pide arreglar el CLS y cuantificar la mejora, que perf-fix ya hace al re-auditar y comparar. |
| 12 | NONE | Es una consulta SQL lenta, no tiene que ver con el rendimiento web. |
| 13 | perf-fix | Pide implementar lazy-load, que la descripción de perf-fix cita como mejora de rendimiento en el repo. |
| 14 | perf-compare | Investiga una regresión de TBT entre dos puntos (el último commit). |
| 15 | perf-fix | Pide quitar un script sin uso (cambio de código de rendimiento) y medir si mejora. |
| 16 | NONE | Es una funcionalidad de UI (botón de login) sin relación con el rendimiento. |
| 17 | NONE | Se refiere al rendimiento del pipeline de CI, no al de la web. |
| 18 | perf-compare | Pregunta por una regresión de LCP entre dos momentos (el último deploy). |
| 19 | perf-compare | Pregunta si una mejora es real o ruido, que perf-compare cita expresamente ("saber si una mejora fue real"). |
| 20 | perf-compare | Pide el historial de auditorías, que cubre `wperf history`. |
| 21 | perf-compare | Pide comparar explícitamente dos auditorías antes/después. |
| 22 | perf-fix | Pide corregir en el código las imágenes sin width y height, que causan CLS. |
| 23 | NONE | Es un problema de renders de React, no de las métricas Lighthouse que cubre `wperf`. |
| 24 | perf-audit | Pide interpretar un reporte guardado en `.perf/reports/`, que perf-audit cubre expresamente. |
| 25 | perf-audit | "Va lenta" y "por dónde empiezo" piden diagnóstico y priorización, no un arreglo concreto. |

Dudas: 3 (perf-compare vs perf-audit), 11 y 15 (perf-fix vs perf-compare), 9 (perf-fix vs perf-audit), 19 (perf-compare vs perf-audit), 25 (perf-audit vs perf-fix), 10 (perf-fix vs perf-audit), 23 (NONE vs perf-audit).
