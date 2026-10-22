# Evaluación de las skills `perf-audit` y `perf-compare`

**Iteraciones 1 a 3**, 2026-10-21 (macOS, Lighthouse 13.5.0, Chrome 155, mobile, 3 ejecuciones por auditoría).

## Método

- Cada skill la ejecuta un **subagente independiente** (contexto limpio) que lee su `SKILL.md` y la sigue como lo haría un usuario. A los subagentes se les prohibió leer `demo/site/ISSUES.md`, `tests/` y `docs/metrics/`.
- Las respuestas completas están en [skills/](skills/) y los reportes auditados en [skills/reports/](skills/reports/). Las auditorías corrieron una detrás de otra, nunca en paralelo.
- Las respuestas se comprueban sin LLM con `src/experiments/skill-eval.ts`:
  - `node dist/experiments/skill-eval.js recall <respuesta.md>`: cuántos de los 7 problemas de `ISSUES.md` menciona.
  - `node dist/experiments/skill-eval.js figures <respuesta.md> <reporte.json>...`: cifras de la respuesta que no salen del JSON (se admiten conversiones de unidad, redondeos y cifras dentro de los textos de Lighthouse).
- Las cifras que aparecen marcadas por `figures` se revisan **a mano** y se clasifican: inventada, derivada (suma o porcentaje de cifras del JSON) o de otra fuente (código, `curl`).

## Resultados

| Respuesta                                  | Recall (demo) | Cifras sin origen en el JSON | Clasificación de esas cifras                                                                                                                                                             |
| ------------------------------------------ | ------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `perf-audit` · demo (`audit-demo`)         | **7/7**       | 4                            | 0 inventadas. Dimensiones en píxeles de dos imágenes (`sips`) y tamaño del bucle de `app.js` (150 000), leídos fuera del reporte y declarados por el agente como "dato mío, no del CLI". |
| `perf-audit` · ametllerorigen.com          | n/a           | 5                            | 0 inventadas. Tamaño del HTML (`curl`), parámetros de URL (`q=90`, `sw=800`) y un `1 460 KiB` truncado en vez de redondeado (1 460,5).                                                   |
| `perf-audit` · bancosantander.es           | n/a           | 3                            | 0 inventadas. Suma de dos vídeos (7,26 MiB) y un porcentaje (80 %) calculados con cifras del JSON.                                                                                       |
| `perf-compare` · demo rota → arreglada     | n/a           | 1                            | 0 inventadas. Tamaño del bucle de `app.js` leído en el código.                                                                                                                           |
| `perf-compare` · dos auditorías de la demo | n/a           | 2                            | 0 inventadas. Diferencia de 43 s entre `createdAt` (cálculo) y el score de otra comparación (99).                                                                                        |

**Criterio de "hecho" (`perf-audit` ≥ 6/7 sin inventar cifras): cumplido** en esta iteración, con 7/7 y ninguna cifra inventada en las 5 respuestas. El recall sobre las webs públicas no aplica: los 7 problemas son específicos de la demo.

### Resultados de las auditorías

| Auditoría          | Score | LCP  | FCP               | TBT               | CLS  | SI                |
| ------------------ | ----- | ---- | ----------------- | ----------------- | ---- | ----------------- |
| Demo rota          | 45    | poor | needs-improvement | needs-improvement | poor | good              |
| ametllerorigen.com | 67    | good | good              | poor              | good | needs-improvement |
| bancosantander.es  | 33    | poor | needs-improvement | poor              | good | poor              |

Valores completos en los reportes de [skills/reports/](skills/reports/).

## Revisión manual de las webs públicas (pendiente)

Las recomendaciones de `audit-ametller.md` y `audit-santander.md` están sin validar por una persona. Hay que revisar, para cada una: ¿la causa raíz priorizada es correcta?, ¿las hipótesis están bien marcadas?, ¿la acción es accionable? El resultado se anota aquí.

## Hallazgos de la evaluación y qué se cambió

Fricciones que reportaron los subagentes y que se corrigieron en las skills tras esta iteración (cada punto se vuelve a medir en la iteración 2):

- **Hueco real**: la regla "toda cifra sale del JSON" no cubría cifras legítimas de verificar el código, un `curl` o un cálculo. Ahora esas cifras van en una línea con `(fuente: código|fichero|curl|cálculo)` y `skill-eval figures` las excluye de la comprobación (quedan para revisión manual).
- **Webs reales**: vídeo/`media` pesado no estaba en el mapa de causas (caso Santander, 7,92 MiB de vídeo); `cache-insight` (visitas repetidas) parecía lo más grande; `cpuMs` se mezclaba con TBT; los diagnósticos contradicen a veces las métricas (`server-response-time` 0 ms con TTFB 752 ms). Añadidos a `perf-audit`.
- **Ordenación**: "primero lo que mueve una métrica `poor`" pasa a ser una regla explícita en tres niveles; el `rating` cambia entre ejecuciones (el TBT de la demo salió `poor` y `needs-improvement` en auditorías distintas) y el orden del ejemplo no es una plantilla.
- **`perf-compare`**: caso "mismo commit y `dirty`" (el CLI no avisa y la causa solo está en los `items[]` de los reportes originales; nuevo [ejemplo-regresion.md](../../.claude/skills/perf-compare/references/ejemplo-regresion.md), sacado de la respuesta real del subagente); qué hacer cuando la regresión es un cambio de línea base y no hay nada que corregir; umbrales de `same`/`better`/`worse` y dónde leer los rangos min–max.
- Formato de cifras (ms, MiB, KiB, redondeo) unificado.

## Iteración 2: skills corregidas y auditoría en varios perfiles de red

Tras la iteración 1, `perf-audit` pasó a auditar por defecto tres perfiles de red (`default`, `3g`, `4g`; `wperf audit --network`) para un mismo dispositivo y a clasificar cada causa raíz según cómo responde a la red. Segunda ronda con subagentes nuevos (mismo método). Respuestas en [skills/iteracion-2/](skills/iteracion-2/) y reportes en [skills/iteracion-2/reports/](skills/iteracion-2/reports/): 3 perfiles × 3 sitios, auditados uno detrás de otro.

| Respuesta                                  | Recall (demo) | Cifras sin origen en el JSON | Clasificación                                                                                                                     |
| ------------------------------------------ | ------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `perf-audit` · demo, 3 redes               | **7/7**       | 0                            | —                                                                                                                                 |
| `perf-audit` · ametllerorigen.com, 3 redes | n/a           | 1                            | `641 KiB`: error de redondeo del agente (el JSON da 640,497 KiB). Ninguna inventada.                                              |
| `perf-audit` · bancosantander.es, 3 redes  | n/a           | 0                            | —                                                                                                                                 |
| `perf-compare` · demo rota → arreglada     | n/a           | 2                            | Puertos escritos como `(4173)`: artefacto del comprobador.                                                                        |
| `perf-compare` · dos auditorías de la demo | n/a           | 2                            | Score y LCP de un tercer reporte que el agente leyó con `wperf history` (reales; el comprobador solo recibía los dos comparados). |
| `perf-compare` · red 3g vs 4g              | n/a           | 0                            | El agente respetó el código 2 del CLI, no forzó una comparación y derivó a `perf-audit`.                                          |

Resultados notables:

- **El 7/7 se mantiene** con la skill multiperfil y no aparece ninguna cifra inventada en las 6 respuestas. Se corrigió además el comprobador (`figures` admite N reportes, ignora versiones de Chrome y parámetros propuestos como `q=75`).
- **Hallazgo medido sobre la demo:** el TBT no es independiente de la red (43, 518 y 1 406 ms en `3g`, `default` y `4g` en el reporte del ejemplo; 41, 573 y 1 353 ms en el de los subagentes), con una CPU casi igual (`app.js` entre 1 581 y 1 717 ms según `bootup-time`). En Santander, en cambio, el TBT es `poor` en las tres redes: un problema de CPU estable. La skill no presupone cuál de los dos casos es y lo deduce de los datos.
- **El score no ordena las redes** (en la demo sube de 44 a 49 en `3g` y baja a 36 en `4g`).
- Santander: el vídeo (`media`) es el 80 % del peso y no es una oportunidad de Lighthouse; el agente lo detectó por `resources.byType.media` y un único `curl`, que es lo que se añadió a la skill tras la iteración 1.

Fricciones de esta ronda y qué se cambió:

- **`perf-audit`:** reglas explícitas de orden (una causa con ahorro 0 sobre una métrica `poor` cuenta como `high`; desempate entre perfiles por nº de redes donde la métrica es `poor`), umbral numérico para clasificar sensible/independiente (cociente de `savingsMs` > 1,5 o ahorro 0 en algún perfil), tratamiento de `impact` y `affectedMetrics` que cambian entre perfiles, caso "TBT `poor` en las tres redes", `git` ignorable en webs ajenas, `min` 0 también como inestable, nombres de fichero por sitio y cómo localizar los reportes del lote, y los `items[]` parciales (los terceros se presentan como mínimo).
- **`perf-compare`:** fórmula completa del umbral (`max(absoluto, relativo × antes)` y rangos que no se solapan), qué hacer con "¿en qué red es peor?" (no se compara; se deriva a `perf-audit`), `items[]` que parecen contradecir la clasificación, mirar `wperf history` antes de dar una mejora por buena, y limitar `git diff --stat` a `*.html`, `*.css`, `*.js`.
- **CLI:** `wperf compare --network` (los dos últimos reportes de ese perfil), que la comparación 3g/4g mostró que faltaba.

Los cambios de esta última ronda **no se han vuelto a medir**: harían falta una iteración 3 y una revisión humana de las recomendaciones (más abajo).

## Iteración 3

Misma metodología, subagentes nuevos y casos de `perf-compare` distintos (ninguno repite los reportes de las rondas anteriores: dos mediciones idénticas de la misma demo, `compare --url … --network 3g` sin dar rutas, y demo rota → arreglada con otro "antes"). Respuestas en [skills/iteracion-3/](skills/iteracion-3/).

| Respuesta                                  | Recall (demo) | Cifras sin origen en el JSON | Clasificación                                                                                                    |
| ------------------------------------------ | ------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `perf-audit` · demo, 3 redes               | **7/7**       | 2                            | 0 inventadas. Dos cocientes bien calculados (767/402 = 1,9; 81 500/5 050 = 16,1), no marcados como cálculo.      |
| `perf-audit` · ametllerorigen.com, 3 redes | n/a           | 2                            | 0 inventadas. Dos cocientes de dispersión (1,88 y 1,30) sin marcar.                                              |
| `perf-audit` · bancosantander.es, 3 redes  | n/a           | 1                            | 0 inventadas. Suma de dos ahorros del JSON (75 050 + 28 921 = 103 971 B) sin marcar.                             |
| `perf-compare` · mismo sitio sin cambios   | n/a           | 0                            | Veredicto `unchanged`, TBT +55 ms tratado como ruido (umbral efectivo 259 ms, rangos solapados).                 |
| `perf-compare` · `--url … --network 3g`    | n/a           | 0                            | El CLI eligió bien el par de reportes 3g sin que el agente diera rutas. `unchanged`.                             |
| `perf-compare` · demo rota → arreglada     | n/a           | 7                            | Puertos (artefacto del comprobador) y dos valores (39 754, 40 730) de otros reportes leídos con `wperf history`. |

Lo que cambia respecto a las iteraciones anteriores: ya **no hay cifras sin origen que sean errores** (la de la iteración 2, un `641 KiB` mal redondeado, no se repite); lo que queda son cálculos correctos que el agente no marcó como `(fuente: cálculo)`. La skill ahora pide marcar también cocientes y sumas.

Correcciones tras esta ronda:

- **`perf-audit`:** la regla de orden queda sin ambigüedad (una sola causa sin ahorro por métrica `poor` sube al segundo puesto de su grupo; las demás, al final) y el ejemplo se reordenó para cumplirla; la inestabilidad de una métrica se define con los mismos umbrales de ruido que usa `compare` (antes "max > 2×min", que dejaba pasar un TBT de 402 a 767 ms); caso de ahorro 0 ms en los tres perfiles; conjunto de `items[]` distinto entre perfiles; `wastedMs` de un item frente al ahorro de la oportunidad; `cache-insight` trae ahorro en ms aunque mida visitas repetidas; hero y galería se separan por tipo de arreglo, no por tamaño; enlace al ejemplo multiperfil.
- **`perf-compare`:** el filtro de `git diff --no-index` va en un `grep` (con `--no-index` un pathspec hace fallar a git: lo había escrito mal en la iteración anterior); qué hacer cuando el CLI avisa de que "antes" es posterior a "después" en una comparación legítima; árbol de `demo/` de entonces que no está en git.

En las 6 respuestas de esta ronda no hay ninguna cifra inventada, y las comparaciones respetan la clasificación del CLI. No hay una iteración 4 planificada: los hallazgos restantes de esta ronda son de estilo (formato de cifras, nivel de detalle) o un límite del CLI que ya se ha resuelto después: el `Report` ahora identifica el elemento LCP (`lcp`, ver más abajo).

## Después de la iteración 3: elemento LCP en el `Report`

Los agentes marcaron en las tres rondas que no podían decir qué elemento era el LCP (`lcp-discovery-insight` salía vacío). Los LHR ya traen el nodo en `lcp-breakdown-insight` y `lcp-discovery-insight`; el normalizer lo descartaba. Ahora el `Report` incluye `lcp` (elemento con `selector`, `snippet` y `url`, desglose en cuatro subpartes y comprobaciones de descubrimiento) y `compare` avisa si el elemento cambia entre reportes. Sobre la demo real identifica `body > main > section.hero > img.hero-img` y su `img/hero.jpg`, con `fetchpriority=high` ausente. Hallazgo al implementarlo: con `throttling: simulate` el desglose se mide en la carga real de Chrome (≈ 600 ms en la demo) y no suma el LCP simulado (≈ 40 s), así que las skills lo usan por proporción. Las skills se actualizaron para usar el bloque; **este cambio no se ha vuelto a evaluar con subagentes**.

## Iteración 4

2026-10-22 (macOS, Lighthouse 13.5.0, Chrome 155, mobile, 3 ejecuciones por auditoría). Evalúa lo que cambió tras la iteración 3: el bloque `lcp` en el `Report`, `wperf audit` con listas en `--device`/`--network` (un solo comando para todos los perfiles) y el seguimiento movido a `references/seguimiento.md`, la skill `perf-audit` aligerada, los campos `threshold`, `rangeBefore`, `rangeAfter` y `rangesOverlap` en `wperf compare`, y la sección «Más de dos reportes» de `perf-compare` (series con `wperf history` y antes/después en varias redes). La de `perf-fix` está en [fix.md](fix.md#iteración-4).

### Método

- El de las iteraciones anteriores: un subagente independiente por caso, que lee solo el `SKILL.md` de la skill y la sigue. Tenían prohibido leer `demo/`, `tests/`, `docs/` y `ISSUES.md`. Respuestas en [skills/iteracion-4/](skills/iteracion-4/); reportes en [skills/iteracion-4/reports/](skills/iteracion-4/reports/) y comparaciones en [skills/iteracion-4/comparaciones/](skills/iteracion-4/comparaciones/).
- **Prueba más ciega que las anteriores:** antes de empezar se quitaron de `demo/site/js/app.js` los comentarios que citaban «problema 3/4/7 de `ISSUES.md`» y decían que `three.min.js` sobraba (commit `b10171f`). La demo mide igual (`compare`: `unchanged`) y `tests/demo.slow.test.ts` sigue detectando los 7 problemas.
- **Casos de `perf-audit`:** los dos auditaron ellos mismos, con un único comando `audit --network default,3g,4g`. **Casos de `perf-compare`:** se midió antes un lote (la demo rota y la arreglada servidas en el mismo puerto, `default` ×2, `3g` y `4g` cada una; ids y etiquetas `antes-*` y `despues-*` en [reports/](skills/iteracion-4/reports/)) y los tres agentes leyeron ese almacén sin auditar. Como no usan Chrome, se lanzaron a la vez; las mediciones y los casos de `perf-audit` y `perf-fix` fueron siempre en serie.
- **Comprobación sin LLM:** `skill-eval recall` y `skill-eval figures`. Como `skill-eval figures` por línea de comandos solo admite reportes, las cifras de las respuestas de `perf-compare` se comprobaron con un pequeño script que usa la misma función y acepta también el JSON de `compare` y de `history`. Las cifras marcadas `(fuente: cálculo)` no las comprueba la herramienta: se revisaron a mano.

### Resultados

| Respuesta                                                     | Recall (demo) | Cifras sin origen en el JSON | Clasificación                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------- | ------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `perf-audit` · demo, 3 redes (`audit-demo`)                   | **7/7**       | 1                            | `4173`: el puerto (artefacto del comprobador). Las cifras `(fuente: cálculo)` (cocientes 16,1 y 5,1, 97,6 %, 72,0 %, 81 %, 2,7 %, 1,10) y la suma de las 6 imágenes (5 487 844 B) se revisaron contra los reportes: correctas                                    |
| `perf-audit` · ametllerorigen.com, 3 redes (`audit-ametller`) | n/a           | 8                            | `2 939`, `603`, `1 238`, `303`, `823`, `607`, `932`, `876`: la cuenta de dispersión (rango `max − min` y umbral de ruido) de la sección de fiabilidad. **Todas correctas, ninguna inventada**, pero escritas como «cálculo mío» sin la marca `(fuente: cálculo)` |
| `perf-compare` · par con ruido (`compare-1`)                  | n/a           | 0                            | —                                                                                                                                                                                                                                                                |
| `perf-compare` · serie con `history` (`compare-2`)            | n/a           | 1                            | `4173`: el puerto. `representativeRun` 3 y 1, `loadDuration` 440 → 314 ms, `renderDelay` 100 → 25 ms y `cpuMs` de `app.js` 1 398 → 2 298 ms (leídos de los `items[]`) se revisaron: correctos                                                                    |
| `perf-compare` · antes/después en 3 redes (`compare-3`)       | n/a           | 0                            | —                                                                                                                                                                                                                                                                |

**Ninguna cifra inventada en las 5 respuestas.** El criterio de «hecho» de `perf-audit` (≥ 6/7 sin inventar) se cumple en la demo con 7/7.

Lo que sí hicieron los agentes, comportamiento nuevo de esta iteración:

- **Un solo comando** en segundo plano para todos los perfiles (ni bucle de bash ni un comando por perfil), con `Monitor` sobre el progreso con prefijo `[dispositivo/red]` y la línea `Terminado: 3 de 3 perfiles medidos`. En la demo la auditoría completa de las 3 redes tardó unos 45 s y llegaron 13 eventos casi seguidos; en Ametller, unos 90 s.
- **`perf-compare` cita `threshold` y `rangesOverlap` en vez de recalcular.** En el par con ruido explica que el TBT (608 → 1 133 ms, `threshold` 304 ms) supera el umbral pero los rangos se solapan (574–661 ms frente a 392–1 873 ms) y que el CLS no cambia (0,291 → 0,291) aunque su rango «después» llega a 0, es decir, una de las tres ejecuciones no repitió el desplazamiento.
- **Serie (`compare-2`):** encontró el único salto real (`2026-10-22T19-09-38Z` → `2026-10-22T19-10-57Z`, score 47 → 99), trató como ruido probable el otro que marcaba `vsPrevious` (solo el score, 41 → 47) y descartó la deriva lenta comparando los extremos y el tramo final. La hipótesis de causa fue correcta: el commit es el mismo con `dirty: false`, así que no es git y el sitio servido cambió entre medidas (lo apoyó con los `items[]`).
- **Antes/después en 3 redes (`compare-3`):** una fila por perfil, sin mezclar cifras de redes distintas. Hallazgo que cuenta: en `3g` el LCP pasa de `poor` a `needs-improvement` (90 753 → 3 904 ms), no a `good`, y el score queda en 86 frente a 99 y 100 en las otras redes.

### Fallos de las skills que salieron

1. **El score puede dar `improved` sin que se mueva ninguna métrica.** `antes-1` → `antes-2` son la misma página sin tocar y el CLI dice `improved` porque el score sube de 41 a 47 (umbral 5), mientras el TBT sube de 608 a 1 133 ms (rangos solapados) y las otras cinco métricas son `unchanged`. Los tres agentes de `perf-compare` lo señalaron y la skill no decía qué hacer: citaron el veredicto del CLI y explicaron que ninguna métrica cambió. **Pendiente de decidir:** si `compare` debería dejar de dar `improved`/`regressed` cuando solo se mueve el score (hoy `verdictOf` incluye el score).
2. **El atajo `compare --url <url> --network <n>` falla con varios reportes por lado.** La sección «Antes/después medido en varias redes», que se había añadido ese mismo día, lo recomendaba. Con dos «antes» y dos «después» en `default` toma los dos últimos y compara `despues-1` con `despues-2` (`unchanged`). El agente lo notó y usó ids explícitos.
3. **Hueco por la ausencia de oportunidades en un reporte:** `mainthread-work-breakdown` pasa a `resolved` (600 ms → —) en el par con ruido, con el sitio idéntico. La skill solo cubre `resolved` con ahorro 0. Los agentes lo trataron como ruido (hipótesis), sin regla que lo respalde.

### Qué se cambió

- **`perf-compare`** (commit `0a8b613`, [SKILL.md](../../plugins/wperf/skills/perf-compare/SKILL.md)): un veredicto disparado solo por el `score` se cita tal cual, se dice que ninguna métrica cambió y se trata como ruido probable (hipótesis); en una serie, una entrada en la que solo cambia el score no es un salto; el antes/después en varias redes usa ids explícitos y advierte del atajo, y con más de un reporte por lado se empareja el último de cada uno y se cita la diferencia entre ellos como línea de ruido.
- **Estos cambios no se han vuelto a medir** con subagentes.

### Fricciones menores sin resolver

- **`perf-audit`:** la excepción de orden «va la segunda» es ambigua en el segundo nivel (los dos agentes la aplicaron a casos distintos); falta un caso para «ahorro constante pero el rating de la métrica cambia por otras causas» (`font-display`); `unused-javascript` queda «sensible a la red» por la regla mecánica (cociente > 1,5 por un 0 en `3g`) aunque los bytes son idénticos; los `savingsBytes` de `image-delivery-insight` difieren un 2,7 % entre `default` y `3g`/`4g` con los mismos 7 items, caso que la regla de los bytes no contempla; la dispersión (6 métricas × 3 perfiles) se calcula a mano y es lo que más cifras derivadas sin marca produce (A2); la skill no dice qué hacer si no existe `AskUserQuestion`, ni qué `timeout_ms` dar a `Monitor`, ni que hay que parar con `TaskStop` el servidor que se arrancó; «una línea por evento» es ruido cuando todo dura 45 s; `rocket-loader.min.js` sale del propio dominio (`/cdn-cgi/`) y la regla de terceros por origen no lo detecta.
- **`perf-compare`:** no explica cómo pasar de una etiqueta a un id (`wperf history` las muestra); no cubre varios reportes de un mismo lado cuando difieren mucho entre sí más allá de citarlo; no cubre «mismo commit, `dirty: false` y contenido muy distinto» (los agentes lo dedujeron de los pasos 2 y 4); `ejemplo-serie.md` usa la misma URL y el mismo perfil que el caso, con riesgo de copiar su conclusión; los `items[]` salen de la ejecución representativa, que puede diferir entre reportes (`environment.representativeRun`), y la skill no lo dice. Los cinco agentes escribieron scripts propios para resumir el JSON (de `audit` o de `compare`) en lugar de leerlo entero.
- **CLI:** `wperf history` no muestra dispositivo, red ni número de ejecuciones (hubo que abrir el JSON a mano); `skill-eval figures` por línea de comandos no admite el JSON de `compare` ni el de `history`.

### Limitaciones de esta iteración

- **Los subagentes no tienen `AskUserQuestion`:** el flujo de las tres preguntas previas de `perf-audit` **no se ha evaluado**; los agentes escribieron las preguntas y asumieron las respuestas (`mobile`, tres redes, 3 ejecuciones). `PushNotification` devolvió «not sent (Remote Control inactive)».
- Una ejecución por caso y un solo modelo. Una persona sigue sin haber revisado las recomendaciones de `audit-ametller`.
- Lo que se evalúa es una medición simulada (`throttling: simulate`); las cifras del desglose del LCP son de la carga real de Chrome, no del LCP simulado.

## Limitaciones

- **Prueba no del todo ciega.** Los comentarios de `demo/site/js/app.js` citan "problema 3/4/7 de ISSUES.md", y el ejemplo de cada skill usa cifras de la propia demo. El recall 7/7 se apoya sobre todo en los ids del reporte, que no dependen de esa fuga, pero el 6 (lazy-load) y el análisis de código sí pudieron beneficiarse.
- Una ejecución por skill y caso (no se mide variabilidad entre ejecuciones del modelo).
- `skill-eval figures` comprueba que el número existe en el JSON, no que se atribuya al concepto correcto.
- Las medianas de las webs públicas son inestables entre ejecuciones (p. ej. LCP de 2 429 a 7 230 ms en Ametller); las skills ya lo advierten.
