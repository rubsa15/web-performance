## Cierre: `unused-javascript` (quitar `vendor/three.min.js`)

**Veredicto: revertido (compensación con empeoramiento importante).** El diff aprobado quitó la oportunidad `unused-javascript` y mejoró FCP y SI, pero TBT pasó a `poor` y el score cayó. La comparación `verdict` es `mixed`. Reporte antes `2026-10-22T07-39-28Z-mobile`, reporte después `2026-10-22T07-49-27Z-mobile` (ambos mobile, red `default`, 3 ejecuciones, misma URL `http://127.0.0.1:4173/`, servida con el mismo comando y puerto). Sin `warnings` en la comparación. Comparación completa: `.perf/comparacion.json` en case-4.

**Qué se cambió.** Se eliminó la línea 12 de `index.html` (`<script src="vendor/three.min.js"></script>`), sin borrar el fichero. Tras ver los resultados lo revertí con `git checkout -- index.html`. `git status --short` queda vacío: el árbol no tiene cambios míos. No hay commit.

**Antes -> después** (fuente: `wperf compare`)

| Clasificación | Métrica | Antes | Después | Cambio |
| --- | --- | --- | --- | --- |
| Mejora | FCP | 2495 ms (`needs-improvement`) | 1503 ms (`good`) | -992 ms (-39,8 %), `improved` |
| Mejora | SI | 2495 ms (`good`) | 1503 ms (`good`) | -992 ms (-39,8 %), `improved` |
| Empeora | TBT | 417 ms (`needs-improvement`) | 1243 ms (`poor`) | +826 ms (+198,1 %), `regressed` |
| Empeora | Score | 47 | 36 | -11, `regressed` |
| Ruido | LCP | 40729 ms (`poor`) | 39453 ms (`poor`) | -1276 ms (-3,1 %), `unchanged` |
| Ruido | CLS | 0,291 (`poor`) | 0,291 (`poor`) | 0, `unchanged` |
| Ruido | TTFB | 752 ms | 752 ms | 0, `unchanged` |

El elemento LCP no cambió (`lcpElement.changed: false`, sigue siendo `img.hero-img`).

Oportunidades:

| Oportunidad | `status` | `deltaMs` | `deltaBytes` |
| --- | --- | --- | --- |
| `unused-javascript` | `resolved` | -1050 | -120895 |
| `bootup-time` | `resolved` | -400 | 0 |
| `render-blocking-insight` | `better` | -1000 | 0 |
| `image-delivery-insight` | `same` | -200 | 0 |

**Por qué se revierte.** Los rangos min-max de TBT no se solapan (antes 309-610 ms, después 1162-1310 ms; fuente: reportes), así que no es ruido y no repetí la medición. La tabla de la skill dice que, si una métrica pasa a `poor`, hay que revertir. Hipótesis, sin medir: al desaparecer el script bloqueante, el primer pintado llega antes y la tarea larga de `buildSearchIndex` en `js/app.js` (la que arranca justo tras el primer pintado) cae dentro de la ventana que cuenta para TBT. El código de la librería no se usaba, pero retrasaba ese primer pintado. Es decir, quitarlo es correcto por sí mismo; lo que sale a la luz es otra causa (la tarea larga).

**Integridad de la página.** `page-check diff antes despues` dijo "La página sigue íntegra" (código de salida 0): mismo texto, mismo título, 7 imágenes cargadas, sin errores de consola nuevos, sin peticiones fallidas nuevas, índice de búsqueda de 150000 entradas en ambos lados. El único error de consola y la única petición fallida son los mismos en los dos lados (404 de `favicon.ico`). La captura de "después" no mostró cambios de layout visibles; el CLS no cambió. Faltaría que la mires tú.

Ficheros (en case-4, bajo `.perf/`, ignorado por git):
- `.perf/page-check/antes.json`, `.perf/page-check/antes.png`
- `.perf/page-check/despues.json`, `.perf/page-check/despues.png`
- `.perf/despues.json` (salida del audit), `.perf/comparacion.json`

**Qué queda** (no tocado). Los cambios de esta ronda no están commiteados, y como se revirtieron no hay nada pendiente de commit.
- Tarea larga en `js/app.js` (`bootup-time`, 1424 ms de `cpuMs` en el reporte base). Si se trocea o difiere antes, quitar `three.min.js` debería poder aplicarse sin empeorar TBT.
- Imágenes pesadas (`image-delivery-insight`, `hero.jpg` 3003499 B) y que bloquean el render (`render-blocking-insight`).
- `font-display` ausente e imágenes sin `width`/`height` (CLS 0,291).

¿Quieres que aborde la tarea larga de `js/app.js` primero y luego repita el arreglo de `three.min.js`?
