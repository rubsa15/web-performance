## Veredicto: revertido

`defer` en los dos scripts mejoró el FCP, pero el TBT empeoró (624 → 1595 ms, ya era `poor` y el CLI lo marca `regressed`) y el score bajó. Por la regla de la skill (paso 6) lo he deshecho. Comparación `2026-10-22T19-13-10Z-mobile` → `2026-10-22T20-10-55Z-mobile`, veredicto global del CLI `mixed`, `warnings` vacío. Mismo perfil en ambos lados (mobile, red `default`, 3 ejecuciones) y misma URL (`http://127.0.0.1:4173/`), servida con el mismo comando y puerto. La URL no cambió. `lcpElement.changed` es `false`.

## Qué se cambió

Se aplicó solo el diff aprobado (`defer` en los dos `<script>` de `index.html`). Tras la re-auditoría se deshizo con `git checkout -- index.html`. `git status --short` está vacío: el árbol queda como estaba. Sin commit.

## Antes → después (cifras de `wperf compare`)

| Clasificación | Métrica | Antes                         | Después           | Cambio                          |
| ------------- | ------- | ----------------------------- | ----------------- | ------------------------------- |
| Mejora        | FCP     | 2496 ms (`needs-improvement`) | 1353 ms (`good`)  | -1143 ms (-45,8 %), `improved`  |
| Mejora        | SI      | 2496 ms (`good`)              | 1353 ms (`good`)  | -1143 ms (-45,8 %), `improved`  |
| Empeora       | TBT     | 624 ms (`poor`)               | 1595 ms (`poor`)  | +971 ms (+155,6 %), `regressed` |
| Empeora       | Score   | 41                            | 34                | -7, `regressed`                 |
| Ruido         | LCP     | 40729 ms (`poor`)             | 40653 ms (`poor`) | -76 ms, `unchanged`             |
| Ruido         | CLS     | 0,291 (`poor`)                | 0,291 (`poor`)    | 0, `unchanged`                  |
| Ruido         | TTFB    | 752 ms                        | 752 ms            | 0, `unchanged`                  |

| Oportunidad                 | `status` | `deltaMs` |
| --------------------------- | -------- | --------- |
| `render-blocking-insight`   | `better` | -1150     |
| `bootup-time`               | `worse`  | +950      |
| `mainthread-work-breakdown` | `worse`  | +1000     |

La oportunidad `render-blocking-insight` pasó de 1550 ms a 400 ms estimados. Tras el cambio solo queda `css/styles.css` (`wastedMs` 452). El resto de oportunidades siguen `same`.

Los rangos min–max del TBT no se solapan: 446–742 ms antes y 1442–1648 ms después. No es ruido y no repetí la medición. En el LCP el rango «después» (37353–40654) y el «antes» (40728–40806) tampoco se solapan, pero el CLI lo clasifica `unchanged` (el delta de -76 ms no supera su umbral). No lo cuento como mejora.

## Por qué se revierte

La tabla del paso 6 manda revertir cuando una métrica que ya era `poor` y el CLI marca `regressed` sube de forma importante: un TBT de 624 ms que pasa a 1595 ms no es un detalle aunque «ya estuviera mal». Que aceptaras el riesgo al aprobar no sustituye esa regla. La mejora de FCP no la compensa: el FCP solo estaba en `needs-improvement` y ahora está en `good`, pero el score global bajó.

**Hipótesis (no medida):** al adelantarse el primer pintado, la tarea larga de `buildSearchIndex()` en `js/app.js` (en `bootup-time` aparece con 1608 ms de CPU después, y con 1632 ms antes) cae entera dentro de la ventana que cuenta para el TBT. El defecto sigue siendo esa tarea; `defer` solo cambió dónde se mide. Para confirmarlo, hay que arreglar primero la tarea larga y repetir el `defer`.

Si quieres aplicar igualmente el `defer` pese a esto, puedo reaplicar el mismo diff.

## Integridad de la página

`wperf check diff` (antes vs. después de aplicar el cambio): «La página sigue íntegra». En ambas instantáneas: 7 imágenes, 1 error de consola, 1 petición fallida y un índice de búsqueda de 150000 entradas (fuente: page-check). Los errores y la petición fallida son los mismos de antes. El proyecto no tiene `package.json`, ni build ni tests. Una vez revertido no hay nada que revisar en la página. **Falta mirar a mano** las capturas `.perf/check/antes.png` y `.perf/check/despues.png` (no las he abierto): un salto de layout no lo ve el diff de texto.

## Qué queda

Causas vistas y no tocadas:

- **La tarea larga de `buildSearchIndex()`** (TBT `poor`). Es la que hay que resolver antes del `defer`.
- Imágenes pesadas (`image-delivery-insight`, LCP `poor`).
- Imágenes sin `width`/`height` (CLS `poor`).
- `font-display`.
- `three.min.js` sin usar (`unused-javascript`).
- El CSS bloqueante (`css/styles.css`), que no se tocó.

Nada está commiteado y el árbol no tiene cambios míos. ¿Abordo primero la tarea larga y después repito el `defer`, o prefieres otra?
