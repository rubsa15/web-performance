# Ejemplo de cierre de `perf-fix`: arreglo revertido

Caso real (evaluación de la fase 5, `docs/metrics/fix.md`): `defer` en los dos scripts de `<head>` de la demo. Mejora el FCP y empeora el TBT hasta `poor`, así que se revierte (paso 6, última fila de la tabla). Cifras de `tests/fixtures/reports/ejemplo-fix-antes.json` y `ejemplo-fix-revertido-despues.json`. **No las reutilices.**

Antes de aplicar, la propuesta ya avisaba de que "si la re-auditoría empeora algo, lo deshago yo"; esa aprobación es la que cubre el revertir.

---

## Veredicto: revertido

FCP mejoró, pero el TBT empeoró y pasó a `poor`, y el score bajó. Comparación `2026-10-22T07-39-28Z-mobile` → `2026-10-22T07-47-18Z-mobile`, veredicto del CLI `mixed`, sin `warnings`. Mismo perfil (mobile, red `default`, 3 ejecuciones) y misma URL.

## Qué se cambió

Se aplicó solo el diff aprobado (`defer` en los dos `<script>` de `index.html`) y, tras ver el resultado, se deshizo con `git checkout -- index.html`. `git status --short` vacío: el árbol queda como estaba. Sin commit.

## Antes → después (cifras de `wperf compare`)

| Clasificación | Métrica | Antes                        | Después                | Cambio                    |
| ------------- | ------- | ---------------------------- | ---------------------- | ------------------------- |
| Mejora        | FCP     | 2495 ms (`needs-improvement`) | 1353 ms (`good`)       | -1142 ms (-45,8 %), `improved` |
| Mejora        | SI      | 2495 ms (`good`)             | 1353 ms (`good`)       | -1142 ms (-45,8 %), `improved` |
| Empeora       | TBT     | 417 ms (`needs-improvement`) | 1363 ms (`poor`)       | +946 ms (+226,9 %), `regressed` |
| Empeora       | Score   | 47                           | 35                     | -12, `regressed`          |
| Ruido         | LCP     | 40729 ms                     | 40653 ms               | -76 ms, `unchanged`       |
| Ruido         | CLS     | 0,291                        | 0,291                  | 0, `unchanged`            |

| Oportunidad               | `status` | `deltaMs` |
| ------------------------- | -------- | --------- |
| `render-blocking-insight` | `better` | -1150     |
| `bootup-time`             | `worse`  | +950      |

Los rangos min–max del TBT no se solapan (máximo antes 610 ms, mínimo después 1282 ms): no es ruido y no se repitió la medición.

## Por qué se revierte

La tabla del paso 6 manda revertir cuando una métrica pasa a `poor` y no hay mejora que lo compense: aquí el FCP ya solo estaba en `needs-improvement`.

**Hipótesis (no medida):** al adelantarse el primer pintado, la tarea larga de `buildSearchIndex()` en `js/app.js` cae entera dentro de la ventana que cuenta para el TBT; antes quedaba en parte fuera. El defecto sigue siendo esa tarea; `defer` solo cambió dónde se mide. Para confirmarlo: arreglar primero la tarea larga y repetir el `defer`.

## Integridad de la página

`page-check diff` (antes vs. después de aplicar el cambio): "La página sigue íntegra". Los errores de consola y peticiones fallidas son los mismos que antes (404 del favicon, fuente: page-check). Falta mirar a mano las capturas.

## Qué queda

Recomiendo atacar primero la tarea larga y después repetir el `defer`. Nada está commiteado y el árbol no tiene cambios míos. ¿Abordo esa, o prefieres otra?
