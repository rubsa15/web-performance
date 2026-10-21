# Comparación: demo v0 (4173) vs demo fixed v0 (4174)

> Comando: `npx wperf compare <antes> <después> --format json` (código de salida 0). Todas las cifras salen del JSON de `wperf compare`, salvo las marcadas con `(fuente: ...)`.

## Aviso de fiabilidad (leer primero)

- **Son dos versiones del sitio, no la misma URL.** `warnings` del CLI: "Las URLs son distintas (http://127.0.0.1:4173/ vs http://127.0.0.1:4174/)". La comparación es válida (mismo device `mobile`, mismo perfil de red `default`), pero mide "demo rota" frente a "demo arreglada", no un antes/después de la misma URL.
- Ambos reportes tienen 3 ejecuciones, y mismo commit `3bbc3a2` con `dirty: true`. Con 3 ejecuciones la confianza en los rangos es limitada.
- **Git no puede explicar la diferencia** (mismo commit en ambos, y URLs distintas). Como preguntas por la causa, he comparado los directorios (ver "Causas probables").
- El reporte "antes" ya era una base degradada respecto a reportes anteriores de la misma URL (ver "Cierre").

## 1. Veredicto

|         | Antes                                                         | Después                                                             |
| ------- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| Reporte | `2026-10-21T19-42-38Z-mobile` (demo v0), 21/10/2026 19:42:38Z | `2026-10-21T19-43-21Z-mobile` (demo fixed v0), 21/10/2026 19:43:21Z |
| URL     | http://127.0.0.1:4173/                                        | http://127.0.0.1:4174/                                              |
| Score   | 41                                                            | 99                                                                  |

**Veredicto del CLI: `improved`.** Score 41 → 99 (delta +58, `change`: `improved`).

**¿Es real la mejora?** Sí, según el CLI: cinco de seis métricas son `improved` y los rangos min-max de ambos lados no se solapan en ninguna de ellas (fuente: fichero; ver más abajo). Con la salvedad de que se comparan dos versiones del sitio.

## 2. Métricas

### Mejoradas (`improved`)

| Métrica | Antes     | Después  | Delta      | %       | Rating                   |
| ------- | --------- | -------- | ---------- | ------- | ------------------------ |
| LCP     | 40 728 ms | 2 104 ms | -38 624 ms | -94,8 % | poor → good              |
| FCP     | 2 495 ms  | 1 413 ms | -1 082 ms  | -43,4 % | needs-improvement → good |
| TBT     | 641 ms    | 17 ms    | -624 ms    | -97,3 % | poor → good              |
| CLS     | 0,291     | 0        | -0,291     | -100 %  | poor → good              |
| SI      | 2 495 ms  | 1 413 ms | -1 082 ms  | -43,4 % | good → good              |

### Regresiones (`regressed`)

Ninguna.

### Sin cambio / ruido (`unchanged`)

| Métrica | Antes  | Después | Delta | Rating      |
| ------- | ------ | ------- | ----- | ----------- |
| TTFB    | 752 ms | 752 ms  | 0     | good → good |

Rangos min-max de los reportes originales (fuente: fichero), para ver que la mejora supera el ruido:

| Métrica  | Antes (min-max)    | Después (min-max) |
| -------- | ------------------ | ----------------- |
| LCP      | 40 728 - 40 728 ms | 2 103 - 2 104 ms  |
| FCP / SI | 2 494 - 2 496 ms   | 1 411 - 1 415 ms  |
| TBT      | 470 - 647 ms       | 15 - 24 ms        |
| CLS      | 0,291              | 0                 |
| TTFB     | 752 - 752 ms       | 752 - 752 ms      |

Con 3 ejecuciones por lado el rango es una estimación limitada de la dispersión. El TBT "antes" es el más disperso (470 - 647 ms), aunque su rango sigue lejos del "después".

Nota: SI y FCP tienen valores idénticos en ambos reportes (2 495 / 1 413 ms); no son dos mejoras independientes. El TTFB no cambia: el servidor local responde igual, la mejora está en lo que viaja y se ejecuta después.

## 3. Oportunidades

**Resueltas (`resolved`)**

| Oportunidad                              | Ahorro que tenía              | Lectura                                             |
| ---------------------------------------- | ----------------------------- | --------------------------------------------------- |
| `render-blocking-insight`                | 1 550 ms                      | Bloqueo de render eliminado                         |
| `unused-javascript`                      | 1 050 ms, 118 KiB (120 895 B) | JS sin usar eliminado                               |
| `font-display-insight`                   | 300 ms                        | Fuentes sin `font-display` resuelto                 |
| `cls-culprits-insight`, `unsized-images` | 0 (sin cifra)                 | Problema de CLS resuelto (imágenes sin dimensiones) |
| `lcp-discovery-insight`                  | 0 (sin cifra)                 | Descubrimiento del recurso LCP resuelto             |
| `total-byte-weight`                      | 0 (sin cifra)                 | Ya no se marca peso de red enorme                   |

Las `resolved` con ahorro 0 son buen dato (el problema desapareció) pero no tienen cifra de mejora propia; el efecto cuantificable está en las métricas.

**Mejores (`better`)**

| Oportunidad                 | Antes                             | Después                     | Delta                                |
| --------------------------- | --------------------------------- | --------------------------- | ------------------------------------ |
| `image-delivery-insight`    | 32 900 ms, 7,78 MiB (8 154 587 B) | 150 ms, 534 KiB (546 774 B) | -32 750 ms, -7,26 MiB (-7 607 813 B) |
| `bootup-time`               | 650 ms                            | 0 ms                        | -650 ms                              |
| `mainthread-work-breakdown` | 650 ms                            | 0 ms                        | -650 ms                              |

`bootup-time` y `mainthread-work-breakdown` repiten el mismo ahorro de TBT: es un único problema, no dos. `image-delivery-insight` sigue presente con impacto `high` en el "después" (150 ms, 534 KiB): queda margen en imágenes.

**Nuevas / peores:** ninguna. **Iguales (`same`):** `network-dependency-tree-insight`.

### Por causa raíz

- **Imágenes sin optimizar**: `image-delivery-insight` casi eliminada. Es el grueso de la mejora (de 32 900 ms de ahorro potencial a 150 ms).
- **Imágenes sin dimensiones (CLS)**: `unsized-images` + `cls-culprits-insight` resueltas, coherente con CLS 0,291 → 0.
- **Bloqueo de render + JS sin usar**: `render-blocking-insight` y `unused-javascript` resueltas.
- **Hilo principal (TBT)**: `bootup-time` + `mainthread-work-breakdown` pasan de 650 ms a 0 ms; TBT 641 → 17 ms.
- **Fuentes**: `font-display-insight` resuelta.
- **LCP por descubrimiento**: `lcp-discovery-insight` resuelta.

## 4. Recursos

| Tipo        | Antes                  | Después             | Delta                    |
| ----------- | ---------------------- | ------------------- | ------------------------ |
| Total       | 8,30 MiB (8 699 348 B) | 885 KiB (906 437 B) | -7,43 MiB (-7 792 911 B) |
| Imágenes    | 8,10 MiB               | 847 KiB             | -7,27 MiB                |
| Scripts     | 165 KiB                | 1 KiB               | -164 KiB                 |
| Stylesheets | 1 KiB                  | 0                   | -1 KiB                   |
| Documento   | 1 KiB                  | 2 KiB               | +883 B                   |
| Fuentes     | 34 KiB                 | 34 KiB              | 0                        |

Casi todo el peso eliminado son imágenes (-7,27 MiB), y a continuación el script (-164 KiB). El stylesheet pasa a 0 y el documento crece 883 B (fuente: cálculo con valores del JSON): coherente con CSS incrustado en el HTML (hipótesis, ver abajo).

## 5. Causas probables (hipótesis)

Git no sirve aquí (mismo commit `3bbc3a2` con `dirty: true` en ambos, y distinta URL). Como preguntas por la causa, he comparado los directorios con `git diff --no-index --stat demo/site demo/site-fixed` y leído el diff de `index.html` y `js/app.js` (fuente: código). Todo lo siguiente son **hipótesis** apoyadas en la evidencia de los reportes:

1. **Imágenes redimensionadas con `srcset` y carga diferida (principal candidata a LCP y peso).**
   - Evidencia medida: `items[]` de `image-delivery-insight` en el "antes" son `/img/hero.jpg` (3 003 499 B, 2,86 MiB) y `cafe-1.jpg`...`cafe-6.jpg` (entre 888 y 898 KiB cada una); en el "después" son `hero-960.jpg` (64 KiB) y `cafe-N-960.jpg` (130-131 KiB cada una) (fuente: fichero).
   - Evidencia en código (fuente: código): `site-fixed/img/` tiene variantes `-480`, `-960` y `hero-1600`; `index.html` usa `srcset`/`sizes`, `fetchpriority="high"` en el hero, `loading="lazy"` y `decoding="async"` en la galería.
   - Cómo confirmarlo: servir `site-fixed` con las imágenes originales (o el `site` con solo las imágenes nuevas) y repetir `wperf audit` + `wperf compare`.
2. **`width`/`height` en las imágenes (CLS 0,291 → 0).** En el "antes", `unsized-images` lista las 7 imágenes (hero y cafe-1...6) (fuente: fichero); en `site-fixed/index.html` todas llevan `width`/`height` (fuente: código). Confirmar: quitar solo los atributos y re-auditar.
3. **JS: `three.min.js` eliminado y `app.js` con `defer`.**
   - Evidencia medida: `unused-javascript` lista `/vendor/three.min.js` con 120 895 B sin usar de 167 861 B; en `render-blocking-insight`, `three.min.js` aportaba 1 502 ms, `app.js` 602 ms y `styles.css` 452 ms (fuente: fichero). Los scripts bajan de 165 KiB a 1 KiB.
   - Código: `site-fixed` ya no tiene `vendor/`; `index.html` usa `<script src="js/app.js" defer>` y CSS en `<style>` incrustado, que explicaría la desaparición de `render-blocking-insight` (fuente: código).
4. **Tarea larga troceada (TBT 641 → 17 ms).** El `app.js` corregido construye y ordena el índice de 150 000 entradas en trozos de 5 000 con `setTimeout`, cediendo el hilo (fuente: código). Cautela: en `items[]` de `bootup-time`, el `cpuMs` de `app.js` pasa de 1 650 a 2 361 (fuente: fichero), es decir, el trabajo total no baja, solo se reparte. Eso encaja con que el TBT caiga sin que baje el CPU total, pero es hipótesis: el CLI no mide el reparto de tareas.
5. **Fuentes**: `site-fixed/index.html` declara `font-display: swap` y precarga `inter-latin-400.woff2` (fuente: código). Hipótesis para la resolución de `font-display-insight`.

Nota de interpretación: LCP, FCP, TBT y CLS mejoran a la vez por causas distintas; no se puede atribuir una cifra concreta de mejora a cada cambio con estas dos mediciones. Para repartir el efecto habría que aplicar los cambios de uno en uno y auditar tras cada uno.

## 6. Qué confirmar

- Aplicar los cambios por separado (imágenes, `defer`/CSS, quitar `three.min.js`, troceo de la tarea) y comparar tras cada uno.
- Repetir la medición con más ejecuciones (`--runs 5`) si se quiere reforzar la confianza en los rangos.
- Revisar lo que queda: `image-delivery-insight` sigue con 150 ms y 534 KiB de ahorro potencial.

## Cierre

- **Línea base degradada**: el "antes" (`2026-10-21T19-42-38Z-mobile`, score 41) no es la primera medición de esa URL. El historial de `127.0.0.1:4173` (`wperf history`) muestra scores de 74 (`19-40-34Z`) y 57 (`19-41-55Z`) con la misma etiqueta `demo v0` y el mismo commit `3bbc3a2*`; en esos reportes el script bloqueante era otro (`vendor/lodash.js` y luego `vendor/lodash.min.js`, no `three.min.js`) (fuente: fichero). Es decir, el sitio "v0" cambió entre medidas sin commit. Una referencia sensata si quieres medir contra "la demo rota original" es `2026-10-21T19-40-34Z-mobile`. Esto se detalla en la segunda comparación.
- **¿Confirmas estas causas o quieres que investigue otra?** No hay regresión de código que arreglar, así que no hace falta `perf-fix`; sí podría usarse para atacar el ahorro restante de imágenes (`image-delivery-insight`).
