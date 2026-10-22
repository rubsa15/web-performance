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

## Iteración 4

2026-10-22 (macOS, Lighthouse 13.5.0, mobile, red `default`). Evalúa tres cambios de `perf-fix` hechos después de la primera evaluación: la **instantánea previa obligatoria** (`wperf check snapshot` antes de editar), **5 ejecuciones cuando la métrica objetivo es el TBT** (y no reutilizar una base con menos) y el orden recomendado del catálogo presentado como hipótesis. También el aviso de interacción con el TBT del paso 3. El resto de la iteración está en [skills.md](skills.md#iteración-4).

### Método

- El de la primera evaluación: una copia de la demo (sin `ISSUES.md`) por caso, en un repo git con **el mismo commit** (`6971180`, mismo árbol y fecha fijos, para que una sola línea base valga para las tres) y `wperf` enlazado en `node_modules/.bin` como en un proyecto de usuario; un subagente independiente por caso, en dos fases (hasta la pregunta de aprobación y, tras aprobar, pasos 4 a 7). Demo ya sin las pistas de `app.js` (commit `b10171f`).
- **Una sola línea base** de 3 ejecuciones (`base`, [reports/base-3-ejecuciones.json](fix/iteracion-4/reports/base-3-ejecuciones.json), `git.dirty: false`) copiada a las tres: en F1 la tenían que **rechazar** (el objetivo es el TBT), en F2 y F3 reutilizar.
- Mediciones siempre en serie; los agentes arrancaban y paraban su servidor (`demo/serve.ts --root <copia> --port 4173`). La web se sirve desde disco: no hace falta reiniciarla tras editar.
- Comprobaciones mías, sin fiarme del agente: `git status` de cada árbol, la **fecha de los ficheros** (instantánea previa frente a la edición), que el puerto 4173 quedara libre y `figures` sobre cada cierre, contra los dos reportes y su comparación. Cierres en [fix/iteracion-4/](fix/iteracion-4/), reportes en [reports/](fix/iteracion-4/reports/), comparaciones en [comparaciones/](fix/iteracion-4/comparaciones/), instantáneas de `check` en [capturas/](fix/iteracion-4/capturas/) y el diff que quedó aplicado en [diffs/](fix/iteracion-4/diffs/). **Las propuestas de la fase 1 no se guardaron enteras**: lo que importa de cada una está citado abajo.

### Resultados

Cifras de `wperf compare` entre la base y el reporte posterior.

| Caso                                 | Qué comprueba                                   | Resultado                                                                                                                                                                                                                 | Instantánea previa antes de editar     | Cifras sin origen                                      |
| ------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------ |
| **F1** tarea larga (TBT)             | Rechaza la base de 3 ejecuciones y mide con 5   | Re-auditó con 5 (base 5: TBT 625 ms, rango 515–1 591). **TBT 625 → 44 ms** (`poor` → `good`, `improved`; rangos 515–1 591 y 43–45 ms), score 41 → 57. **Mejora medida.** Página íntegra                                   | 6 s antes (21:33:56 frente a 21:34:02) | 0                                                      |
| **F2** `defer` en los 2 scripts      | La propuesta avisa de la interacción con el TBT | La propuesta lo avisó (ver abajo). Tras aplicar: FCP 2 496 → 1 354 ms (`improved`), **TBT 624 → 1 499 ms (`regressed`, +140,2 %)**, score 41 → 34, veredicto `mixed`. **No revirtió**: dejó el cambio aplicado y preguntó | 3 s antes (21:38:52 frente a 21:38:55) | 0                                                      |
| **F3** imágenes sin `width`/`height` | La instantánea se hace antes de editar          | **CLS 0,291 → 0** (`poor` → `good`, `improved`), score 41 → 56, `unsized-images` y `cls-culprits-insight` `resolved`. **Mejora medida.** Página íntegra                                                                   | 4 s antes (21:42:49 frente a 21:42:53) | 2 (`1600`, `1067`: dimensiones de `sips`, verificadas) |

Evidencia de las reglas nuevas:

- **TBT con 5 ejecuciones (F1).** El agente escribió en su registro que el reporte previo cumplía todo salvo las ejecuciones («la skill dice que la base debe tener "las ejecuciones que toca"») y re-auditó con 5 también en el «después». La base de 3 ejecuciones medía 624 ms (446–742); la de 5, 625 ms (515–1 591): el rango más ancho que salió con 5 justifica el aviso de la skill.
- **Aviso de interacción (F2).** La propuesta de F2 decía: «Si `defer` adelanta el primer pintado, esa tarea larga puede caer dentro de la ventana que cuenta para el TBT. Entonces el FCP mejoraría y el TBT empeoraría», recomendaba arreglar antes la tarea larga y ofrecía la alternativa. Después se midió exactamente eso.
- **Instantánea (los tres).** Se hizo siempre antes de editar y `check diff` dijo «La página sigue íntegra» en los tres. El 404 de `favicon.ico` está también antes.
- **Alcance mínimo y verificación.** F1 aplicó el diff aprobado (+56/−9, merge sort troceado que cede el hilo cada 5 ms; el agente anotó en sus fricciones que ya no era un diff «pequeño») y comprobó con `git diff` que coincidía; F3 aplicó el diff de 7 líneas, con una línea por `<img>` (el diff propuesto reflujaba el hero; el contenido es el mismo).
- **F1 y el mecanismo.** El agente dijo que el troceo reparte la CPU y no la reduce (`cpuMs` de `app.js` 1 633 → 1 567 ms) y que `bootup-time` sigue listándolo: la mejora del TBT está medida y el mecanismo se marca como hipótesis coherente con los datos.

### Fallo de la skill que salió: F2 no se revierte

La tabla del paso 6 decía: compensación → «pregunta al usuario»; «si empeora algo importante (una métrica **pasa a** `poor`), revierte». En F2 el TBT **ya era `poor`** (624 ms) y se multiplicó por 2,4: no «pasó a `poor`», así que la regla no se activó y el agente dejó el cambio aplicado con una recomendación de revertir. Es el caso contrario del de la primera evaluación (allí el TBT pasaba de `needs-improvement` a `poor` y se revertía).

**Factor de confusión:** la aprobación de F2 incluía «asumiendo el riesgo de que el TBT empeore» y la instrucción de la fase 2 («si la medición lo respalda, mantén; si no, revierte») chocaba con la skill, y el agente eligió la skill. El resultado es válido, pero una instrucción más limpia habría dejado más claro quién manda en ese choque.

### Qué se cambió

- **`perf-fix`** (commit `0a8b613`, [SKILL.md](../../plugins/wperf/skills/perf-fix/SKILL.md)): además de la métrica que pasa a `poor`, se revierte también la que **ya era `poor` y el CLI marca `regressed`**; se dice con las cifras y se ofrece reaplicar el mismo diff, y aceptar el riesgo al aprobar no sustituye esta regla. Se quitó también la frase suelta «el CLI ya comprobado en el paso 0» del paso 1 (la marcaron tres agentes).
- **Estos cambios no se han vuelto a medir.**

### Fricciones menores sin resolver

- Dónde guardar las instantáneas (los agentes usaron `.perf/check/`); qué hacer sin `package.json` ni README para averiguar el servidor (en esta prueba se lo dio el enunciado); cómo demostrar que el diff aplicado es el aprobado (la skill no lo pide) y si un cambio solo de formato exige volver a pedir aprobación; falta un ejemplo de cierre «compensación» (los dos de la skill son casos cerrados); `wperf history` no muestra dispositivo, red ni ejecuciones; la regla de repetir la re-auditoría solo contempla «rangos solapados» o «apenas supera el umbral», no «rangos separados con delta bajo el umbral» (LCP de F2: −3 375 ms, `unchanged`, rangos separados); la tabla del paso 6 no contempla «objetivo `improved` y la oportunidad solo `better`» (F1); la propuesta de F1 tuvo que citar una cifra no medida por el CLI (458 → 920 ms de un prototipo en Node) que no encaja en las cuatro marcas de fuente.

### Limitaciones de esta iteración

- **La aprobación la dio el evaluador, no una persona**, y los diffs se aprobaron tal cual se propusieron.
- Una ejecución por caso y un solo modelo. Solo se probaron 3 de los 7 problemas, cada uno a partir de la misma base (casos independientes, no acumulativos).
- Las capturas se compararon a ojo (visualmente idénticas); la revisión visual humana sigue pendiente.
- Los árboles de F1, F2 y F3 quedaron con el cambio sin commit en la copia de pruebas; no afecta al repo.

## Limitaciones

- **La aprobación la dio el evaluador, no una persona.** El flujo en dos fases demuestra que la skill se detiene y pide el visto bueno, pero no que un usuario real lo habría dado con esos diffs; el 6 se aprobó recortado por criterio del evaluador.
- **Una ejecución por caso** y un solo modelo: no se mide la variabilidad entre ejecuciones del agente. Las métricas del TBT de la base oscilan entre ejecuciones (309–610 ms), así que los veredictos de TBT son los del CLI (rangos que no se solapan), no un promedio de repeticiones.
- **Prueba no del todo ciega.** Se quitó `ISSUES.md` de las copias, pero los comentarios de `js/app.js` siguen citando "problema 3/4/7". Ayudan a localizar el código, no a decidir el arreglo.
- **Casos independientes, no acumulativos.** No se evaluó aplicar los 7 arreglos en secuencia (lo más parecido es el seguimiento de 3 y 4 sobre 7).
- Las variantes del hero las genera `sips` (solo macOS); la calidad visual no se ha revisado a mano.
- Entorno controlado: Lighthouse con throttling simulado, latencia de 300 ms añadida a imágenes y fuentes en `demo/serve.ts`.
- Reproducir: `wperf check snapshot|diff` y `node dist/experiments/skill-eval.js figures` (ver `CLAUDE.md`).
