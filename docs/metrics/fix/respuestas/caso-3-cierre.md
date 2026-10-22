## Cierre: `defer` en los dos scripts (`render-blocking-insight`)

**Veredicto: revertido.** Mejoró FCP, pero TBT empeoró y pasó a `poor`; el score bajó. Comparación `2026-10-22T07-39-28Z-mobile` (antes) → `2026-10-22T07-47-18Z-mobile` (después), veredicto del CLI `mixed`, sin `warnings`. Mismo perfil (mobile, red `default`, 3 ejecuciones), misma URL y puerto (`http://127.0.0.1:4173/`) y el mismo comando de servidor antes y después.

**Qué se cambió.** Apliqué solo el diff aprobado: `defer` en los dos `<script>` de `/index.html` (líneas 12 y 13). Tras ver el resultado lo he deshecho con `git checkout -- index.html`. El árbol queda como antes: `git status --short` vacío y los `<script>` de nuevo síncronos. No hay commit ni push. Los reportes nuevos quedan en `.perf/` (ignorado por git).

**Antes → después** (fuente: `comparacion.json`)

Mejora:

| Métrica | Antes | Después | Cambio |
| --- | --- | --- | --- |
| FCP | 2495 ms (`needs-improvement`) | 1353 ms (`good`) | -1142 ms (-45,8 %), `improved` |
| SI | 2495 ms (`good`) | 1353 ms (`good`) | -1142 ms (-45,8 %), `improved` |

Empeora:

| Métrica | Antes | Después | Cambio |
| --- | --- | --- | --- |
| TBT | 417 ms (`needs-improvement`) | 1363 ms (`poor`) | +946 ms (+226,9 %), `regressed` |
| Score | 47 | 35 | -12, `regressed` |

Ruido (`unchanged`):

| Métrica | Antes | Después |
| --- | --- | --- |
| LCP | 40729 ms | 40653 ms (-76 ms) |
| CLS | 0,291 | 0,291 |
| TTFB | 752 ms | 752 ms |

El elemento LCP no cambió (`lcpElement.changed: false`).

Oportunidades:

| Oportunidad | Status | Detalle |
| --- | --- | --- |
| `render-blocking-insight` | `better` | ahorro 1550 ms → 400 ms (`deltaMs` -1150, `deltaBytes` 0). Solo queda `css/styles.css` (451 ms) |
| `bootup-time` | `worse` | ahorro 400 ms → 1350 ms (`deltaMs` +950). `js/app.js` consume 1378 ms de CPU en el reporte "después" |
| `unused-javascript`, `image-delivery-insight`, `font-display-insight` | `same` | sin cambios |

La medición no es dudosa y no la repetí. El máximo de TBT antes fue 610 ms y el mínimo después 1282 ms, así que los rangos min–max no se solapan.

**Por qué revierto.** La tabla de la skill manda revertir cuando una métrica pasa a `poor`. TBT empeora 946 ms y baja el score, a cambio de un FCP que ya era `needs-improvement`. Tu aprobación cubría deshacer mi cambio en ese caso.

Hipótesis, no medida: al adelantarse el primer pintado, la tarea larga de `buildSearchIndex` en `js/app.js` (150000 entradas ordenadas en el hilo principal) cae entera dentro de la ventana de TBT. Antes quedaba parcialmente fuera. El defecto sigue estando en esa tarea; `defer` solo cambió dónde se mide.

**Integridad de la página.**
- `page-check diff` (antes vs después de aplicar el cambio): "La página sigue íntegra".
- Ambas instantáneas: 7 imágenes cargadas, `searchIndex` con 150000 entradas, 1 error de consola y 1 petición fallida. Es el 404 de `favicon.ico`, que ya estaba antes del cambio.
- Las dos capturas se ven idénticas.
- El repo no tiene `package.json`, así que no hay build, typecheck, lint ni tests que ejecutar.
- Instantáneas y capturas (fuera del repo):
  - `/private/tmp/claude-501/-Users-rubensanz-projects-web-performance/224b6335-cab2-49ca-9ac5-39a468a6db77/scratchpad/fix-eval/responses/caso-3-pagecheck/antes.json`
  - `/private/tmp/claude-501/-Users-rubensanz-projects-web-performance/224b6335-cab2-49ca-9ac5-39a468a6db77/scratchpad/fix-eval/responses/caso-3-pagecheck/antes.png`
  - `/private/tmp/claude-501/-Users-rubensanz-projects-web-performance/224b6335-cab2-49ca-9ac5-39a468a6db77/scratchpad/fix-eval/responses/caso-3-pagecheck/despues.json`
  - `/private/tmp/claude-501/-Users-rubensanz-projects-web-performance/224b6335-cab2-49ca-9ac5-39a468a6db77/scratchpad/fix-eval/responses/caso-3-pagecheck/despues.png`
  - La comparación está en `comparacion.json` del mismo directorio.
- Falta por mirar a mano: un salto de layout fino. Esto no es el defecto de CLS que ya existía (0,291, sin cambios).

**Qué queda.** Causas que vi y no toqué:
1. `unused-javascript`: `vendor/three.min.js` no se usa (`grep` sin ningún `THREE`). Quitarlo recorta bytes de script, pero no resuelve por sí solo el TBT.
2. Tarea larga `buildSearchIndex` en `js/app.js` (`bootup-time`). Hay que trocearla o diferirla antes de volver a plantear `defer`. Con eso resuelto, `defer` sería seguro y debería aportar el FCP.
3. `css/styles.css` sigue bloqueando el render (451 ms).
4. Imágenes pesadas (`image-delivery-insight`), `font-display`, `unsized-images` y el CLS.

Recomiendo atacar primero la tarea larga y luego repetir el `defer` en otra ronda. ¿Abordo esa, o prefieres otra? Nada está commiteado y el árbol de trabajo no tiene cambios míos. El servidor de la demo está cerrado.
