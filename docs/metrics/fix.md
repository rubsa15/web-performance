# Evaluación de la skill `perf-fix`

2026-10-22 (macOS, Lighthouse 13.5.0, mobile, red `default`, 3 ejecuciones por auditoría).

## Método

- **Una copia de la demo por caso.** `demo/site/` (sin `ISSUES.md`) se copia a un repo git con un único commit; `demo/serve.ts --root <copia> --port 4173` la sirve. Se midió una sola línea base ([reports/base.json](fix/reports/base.json), `git.dirty: false`) que se copia a los 7 repos; cada caso arregla **uno** de los 7 problemas partiendo de esa base (no son acumulativos).
- **Un subagente independiente por caso** (contexto limpio) lee `.claude/skills/perf-fix/SKILL.md` y la sigue. Tenía prohibido leer `demo/`, `tests/` y `docs/metrics/`. La petición del usuario nombra la causa como lo haría `perf-audit` (el problema 6 sin id de auditoría, porque no tiene oportunidad propia).
- **Dos fases por agente**, para probar la aprobación previa de verdad: fase 1 (pasos 1–3: línea base, localizar, proponer el diff) termina en la pregunta de aprobación y no toca nada; solo después se le responde y hace los pasos 4–7. Propuestas y cierres completos en [fix/respuestas/](fix/respuestas/); reportes en [fix/reports/](fix/reports/) y comparaciones en [fix/comparaciones/](fix/comparaciones/).
- Las mediciones se hicieron **una detrás de otra** (nunca dos Chrome a la vez), en el mismo puerto antes y después.
- **Comprobaciones mías, sin fiarme del agente**: el estado final de cada árbol (`git status`), `page-check` independiente de la base frente a cada árbol final, y `skill-eval figures` sobre cada cierre.

## Resultados

Cifras de `wperf compare` entre la base y el reporte posterior al arreglo.

| #   | Problema (arreglo propuesto)                                     | Métrica objetivo                                                                | Veredicto de `compare` | Resultado de la skill                                                                  | Página íntegra    |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------- | ----------------- |
| 1   | Hero enorme (3 variantes con `srcset`, `sizes`, `fetchpriority`) | LCP 40 729 → 24 381 ms (`improved`, sigue `poor`)                               | `improved`             | **Mejora medida.** `image-delivery-insight` `better`                                   | Sí (7/7 y a mano) |
| 2   | Imágenes sin dimensiones (`width`/`height` en las 7)             | CLS 0,291 → 0 (`poor` → `good`, `improved`)                                     | `improved`             | **Mejora medida.** `unsized-images` y `cls-culprits-insight` `resolved`; score 47 → 65 | Sí                |
| 3   | Bloqueantes (`defer` en los 2 scripts; CSS sin tocar)            | FCP 2 495 → 1 353 ms (`improved`); **TBT 417 → 1 363 ms (`regressed`, `poor`)** | `mixed`                | **Revertido** (TBT a `poor`, score 47 → 35)                                            | Sí                |
| 4   | JS sin usar (quitar el `<script>` de `three.min.js`)             | FCP 2 495 → 1 503 ms (`improved`); **TBT 417 → 1 243 ms (`regressed`, `poor`)** | `mixed`                | **Revertido** (score 47 → 36)                                                          | Sí                |
| 5   | Fuentes (`font-display: swap` en los 2 `@font-face`)             | FCP 2 495 → 2 490 ms (`unchanged`)                                              | `unchanged`            | **Corrección sin efecto medible.** `font-display-insight` `resolved`; se mantiene      | Sí                |
| 6   | Galería sin lazy (`loading="lazy"` + `decoding="async"`)         | LCP 40 729 → 27 379 ms (`improved`, sigue `poor`)                               | `improved`             | **Mejora medida, mecanismo no demostrado** (los bytes de imagen no bajan)              | Sí                |
| 7   | Tarea larga (índice de búsqueda a un Web Worker)                 | TBT 417 → 39 ms (`needs-improvement` → `good`, `improved`)                      | `improved`             | **Mejora medida.** `bootup-time` `resolved`; score 47 → 57                             | Sí                |

**4 de 7 corregidos con mejora medida de la métrica objetivo y sin romper la página**, uno más corregido sin efecto medible (5) y dos revertidos por la regla de la skill (3 y 4). Los 7 casos tienen antes/después documentado: el criterio de "hecho" de la fase 5 (≥ 5 casos) se cumple, aunque con la matización de que 2 de ellos son reversiones, que es el comportamiento previsto cuando el arreglo no se sostiene.

### Integridad de la página

Con `src/page-check.ts` (hoy `wperf check`; entonces se ejecutaba como script) (Chrome viewport móvil, recorre la página para disparar `lazy`, compara texto visible, imágenes cargadas, errores de consola, peticiones fallidas y el tamaño de `window.searchIndex`), la base frente a los 7 árboles finales: **7/7 "La página sigue íntegra"**. El 404 de `favicon.ico` está también en la base. La captura base y la del caso 1 están en [fix/capturas/](fix/capturas/); **la revisión visual humana de las capturas (cambios de layout, calidad del JPEG al 70 % en el hero) está pendiente** y la skill lo pide en el cierre.

### Comprobación de cifras

`skill-eval figures` sobre los 7 cierres, contra los dos reportes de cada caso y su comparación: **0 cifras inventadas**. Lo que marca, revisado a mano:

| Cifra          | Origen                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------- |
| `4173`         | El puerto (artefacto del comprobador).                                                        |
| `404`          | Código HTTP del favicon, de `page-check` (hoy la skill pide marcarlo `(fuente: page-check)`). |
| `150000`       | Tamaño de `window.searchIndex`, de `page-check`.                                              |
| `1600`, `1067` | Dimensiones intrínsecas de los JPEG, leídas con `file` (caso 2).                              |
| `0,86`, `2,95` | `wastedBytes` del reporte convertidos a MB decimales (caso 6).                                |
| `13`           | Número de línea de `index.html` (caso 3).                                                     |

## Hallazgos

1. **El orden de los arreglos importa.** Los casos 3 y 4 mejoran el FCP (−1 142 y −992 ms) pero empeoran el TBT hasta `poor`. La hipótesis de los agentes —al adelantarse el primer pintado, la tarea larga de `buildSearchIndex()` cae dentro de la ventana de TBT— se probó después, aplicando cada uno de esos dos cambios **sobre el arreglo del caso 7** y comparando con el reporte del caso 7 ([fix/comparaciones/](fix/comparaciones/)):

   | Cambio sobre el caso 7   | FCP                           | TBT                                                     | Veredicto |
   | ------------------------ | ----------------------------- | ------------------------------------------------------- | --------- |
   | `defer` en los 2 scripts | 2 492 → 1 356 ms (`improved`) | 39 → 269 ms (`regressed`, `good` → `needs-improvement`) | `mixed`   |
   | Quitar `three.min.js`    | 2 492 → 1 508 ms (`improved`) | 39 → 163 ms (`regressed`, se queda en `good`)           | `mixed`   |

   La hipótesis se confirma **en parte**: con la tarea larga fuera del hilo principal el empeoramiento del TBT es mucho menor (de +946 a +230 ms con `defer`, de +826 a +124 ms quitando la librería), pero sigue clasificado `regressed` por el CLI. Queda sin explicar el resto (hipótesis: la deserialización del `postMessage` del worker, y que el primer pintado más temprano mueve otras tareas); no se ha medido. La skill ahora avisa de esta interacción en la propuesta y recomienda el orden en el catálogo.

2. **LCP mejora sin que lo que se esperaba cambie** (caso 6): `loading="lazy"` baja el LCP simulado en 13 350 ms, pero `resources.byType.image` es idéntico antes y después y el desglose real del LCP no mejora (`loadDuration` 458 → 582 ms). El agente lo contó así —"mejora medida, mecanismo no demostrado"— y la skill lo recoge como regla (paso 6).
3. **Una corrección sin efecto medible es un resultado válido** (caso 5): `font-display` resuelve su oportunidad (300 ms) y ninguna métrica se mueve en este perfil. El agente aplicó la fila correspondiente de la tabla y mantuvo el cambio sin vender una mejora.
4. **Los agentes respetaron las reglas.** Ninguno editó antes de la aprobación (las 7 propuestas terminaron en la pregunta). Los dos que revirtieron lo hicieron con `git checkout -- <fichero>` y dejaron el árbol limpio (comprobado). Ninguno hizo commit. El agente del caso 6 propuso mezclar `width`/`height` con `lazy`, y avisó él mismo de que perdería la atribución; el evaluador aprobó solo la parte de `lazy` (una causa por ronda).
5. **El agente del caso 3 dejó el CSS bloqueante** (solo `defer` en los scripts) en vez de proponer CSS en línea, y explicó por qué (cambio mayor, riesgo de parpadeo sin estilos). El arreglo de referencia de `site-fixed/` lo mete en línea. Decisión razonable, pero explica que la oportunidad no quede `resolved`.

## Qué se cambió tras la evaluación

- `perf-fix`: aviso de interacciones entre causas en la propuesta (paso 3, punto 5), regla de no atribuir un mecanismo no medido (paso 6), orden recomendado de arreglos en el catálogo, la marca `(fuente: page-check)` y dos ejemplos reales (`ejemplo-salida.md`, `ejemplo-revertido.md`) con sus cifras guardadas como fixtures y comprobadas por los tests.
- `skill-eval figures` acepta `(fuente: page-check)`.

Estos cambios **no se han vuelto a medir** con subagentes.

## Limitaciones

- **La aprobación la dio el evaluador, no una persona.** El flujo en dos fases demuestra que la skill se detiene y pide el visto bueno, pero no que un usuario real lo habría dado con esos diffs; el 6 se aprobó recortado por criterio del evaluador.
- **Una ejecución por caso** y un solo modelo: no se mide la variabilidad entre ejecuciones del agente. Las métricas del TBT de la base oscilan entre ejecuciones (309–610 ms), así que los veredictos de TBT son los del CLI (rangos que no se solapan), no un promedio de repeticiones.
- **Prueba no del todo ciega.** Se quitó `ISSUES.md` de las copias, pero los comentarios de `js/app.js` siguen citando "problema 3/4/7". Ayudan a localizar el código, no a decidir el arreglo.
- **Casos independientes, no acumulativos.** No se evaluó aplicar los 7 arreglos en secuencia (lo más parecido es el seguimiento de 3 y 4 sobre 7).
- Las variantes del hero las genera `sips` (solo macOS); la calidad visual no se ha revisado a mano.
- Entorno controlado: Lighthouse con throttling simulado, latencia de 300 ms añadida a imágenes y fuentes en `demo/serve.ts`.
- Reproducir: `wperf check snapshot|diff` y `node dist/experiments/skill-eval.js figures` (ver `CLAUDE.md`).
