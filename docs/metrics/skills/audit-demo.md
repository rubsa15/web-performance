## Resumen

Auditoría `2026-10-21T20-45-14Z-mobile` · `http://127.0.0.1:4173/` · mobile · 3 ejecuciones (representativa: la 3) · Lighthouse 13.5.0 · Chrome 155.0.0.0 · throttling `simulate` · commit `098fd26` con el árbol de trabajo sucio (`dirty: true`) · sin `warnings` · `score` **45**.

| Métrica | Valor     | Rango min–max (3 ejec.) | Rating            |
| ------- | --------- | ----------------------- | ----------------- |
| LCP     | 40 730 ms | 40 730 – 40 803 ms      | poor              |
| FCP     | 2 497 ms  | 2 497 – 2 501 ms        | needs-improvement |
| TBT     | 476 ms    | 442 – 721 ms            | needs-improvement |
| CLS     | 0,291     | 0,291 – 0,291           | poor              |
| SI      | 2 497 ms  | 2 497 – 2 501 ms        | good              |
| TTFB    | 752 ms    | 752 – 752 ms            | good              |

La página transfiere 8,30 MiB (`resources.totalBytes` = 8 699 348 B), de los que 8,10 MiB son imágenes (`resources.byType.image` = 8 492 779 B). LCP (40,7 s) y CLS están en `poor`; el servidor responde bien (TTFB `good`), así que el problema está en lo que se envía (imágenes enormes) y en cómo se carga. Las tres ejecuciones coinciden en LCP, FCP y CLS; el TBT es el único con dispersión apreciable (442–721 ms), por lo que su valor es menos fiable.

## Prioridades

| #   | Problema (causa raíz)                                               | Evidencia medida                                                                                                                      | Métricas    | Esfuerzo (hipótesis) |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------- |
| 1   | Imágenes sin optimizar (hero y galería)                             | `image-delivery-insight`: 32 900 ms y 7,78 MiB de ahorro; `hero.jpg` solo, 2,86 MiB (ahorro 2,81 MiB); `total-byte-weight` sin ahorro | LCP (poor)  | M                    |
| 2   | Imágenes sin `width`/`height`                                       | `unsized-images`: 7 imágenes; `cls-culprits-insight`; CLS 0,291 (poor). Sin ahorro medido                                             | CLS (poor)  | S                    |
| 3   | CSS y JS que bloquean el render                                     | `render-blocking-insight`: 1 550 ms; `three.min.js` 1 502 ms, `app.js` 602 ms, `styles.css` 452 ms                                    | FCP         | S                    |
| 4   | Librería JS sin usar (`three.min.js`)                               | `unused-javascript`: 1 050 ms y 118 KiB sin usar en `three.min.js`                                                                    | FCP, LCP    | S                    |
| 5   | Tarea larga en el hilo principal (`app.js`)                         | `bootup-time`: 500 ms de ahorro; `app.js` 1 483 ms de CPU; `long-tasks`: 3 tareas largas; TBT 476 ms (needs-improvement)              | TBT         | M                    |
| 6   | Fuentes sin `font-display`                                          | `font-display-insight`: 300 ms; `inter-latin-400.woff2` (305 ms) e `inter-latin-700.woff2` (300 ms)                                   | FCP         | S                    |
| 7   | Galería bajo el pliegue sin `loading="lazy"` _(hallazgo indirecto)_ | `resources.byType.image` = 8,10 MiB; 6 imágenes `cafe-*.jpg` de 0,87–0,88 MiB cada una. Sin oportunidad propia en Lighthouse 13       | LCP (carga) | S                    |

Los ahorros de Lighthouse se solapan; **no se suman**. El orden sube la fila 2 sobre otras con más ahorro porque CLS está en `poor` aunque Lighthouse no le asigne ahorro (`impact: low`). El TBT está en `needs-improvement` en esta ejecución (no `poor`), por eso el hilo principal queda en 5 y no más arriba.

## Detalle

### 1. Imágenes sin optimizar (hero y galería) — _medición_ + _hipótesis_

**Medido:** `image-delivery-insight` (`impact: high`, métrica afectada: LCP) estima 32 900 ms y 7,78 MiB (8 154 587 B) de ahorro en 7 imágenes. `hero.jpg` pesa 2,86 MiB (3 003 499 B) y se podrían ahorrar 2,81 MiB (2 949 349 B). Cada `cafe-*.jpg` pesa entre 0,87 y 0,88 MiB y ahorraría entre 0,82 y 0,83 MiB. `total-byte-weight` lista los mismos ficheros sin ahorro propio. El LCP es 40 730 ms (`poor`).
**Hipótesis (verificada leyendo `demo/site/index.html`):** los `<img>` no tienen `srcset` ni `sizes`, así que se sirve un único fichero a resolución original. Los ficheros miden 3200×2000 px (`hero.jpg`) y 1600×1067 px (`cafe-1.jpg`) según `sips` (dato mío sobre el fichero, no del CLI), muy por encima de lo que necesita una pantalla móvil. Comprobación: comparar el ancho intrínseco con el ancho renderizado y probar con una compresión/formato moderno (WebP/AVIF).
**Esfuerzo M (hipótesis):** hay que generar variantes de varios anchos y reescribir las etiquetas con `srcset`/`sizes`. Como el hero domina el LCP y la galería no, conviene separar el trabajo: primero el hero, luego el resto.

### 2. Imágenes sin `width`/`height` — _medición_ + _hipótesis_

**Medido:** `unsized-images` lista 7 imágenes (`hero.jpg`, `cafe-1.jpg` … `cafe-6.jpg`); `cls-culprits-insight` señala el desplazamiento (sin `items[]`). CLS = 0,291, `poor`, idéntico en las 3 ejecuciones. Ninguna de las dos auditorías trae ahorro medido: su efecto está en la métrica, no en el tiempo.
**Hipótesis (verificada en `index.html`):** ninguna `<img>` declara `width`/`height`; el CSS solo da `width: 100%; height: auto`, por lo que el navegador no reserva alto hasta que la imagen carga y empuja el contenido.
**Esfuerzo S (hipótesis):** añadir `width` y `height` (o `aspect-ratio`) a las 7 etiquetas.

### 3. CSS y JS que bloquean el render — _medición_ + _hipótesis_

**Medido:** `render-blocking-insight` (`impact: high`, métrica afectada: FCP) suma 1 550 ms; por recurso: `vendor/three.min.js` 1 502 ms (168 137 B), `js/app.js` 602 ms (1 122 B), `css/styles.css` 452 ms (955 B). FCP = 2 497 ms (`needs-improvement`).
**Hipótesis (verificada en `index.html`):** ambos `<script>` están en `<head>` sin `defer`/`async`. El CSS es render-blocking por naturaleza; su coste es pequeño (955 B), el grueso lo ponen los scripts.
**Esfuerzo S (hipótesis):** `defer` en los dos scripts (o eliminar `three.min.js`, ver 4).

### 4. Librería JS sin usar — _medición_ + _hipótesis_

**Medido:** `unused-javascript` (`impact: high`; FCP y LCP) marca 1 050 ms y 120 895 B (118 KiB) sin usar de los 167 861 B de `vendor/three.min.js`. En `bootup-time` ese script gasta 92 ms de CPU.
**Hipótesis (verificada en el comentario de `js/app.js`):** `three.min.js` se cargó para un visor 3D que ya no existe; el HTML no lo usa. Si es así, se puede eliminar entera y resolvería también parte de la fila 3. Comprobación: `grep -r THREE demo/site` fuera del vendor.
**Esfuerzo S (hipótesis):** quitar la etiqueta `<script>` (y el fichero).

### 5. Tarea larga en el hilo principal — _medición_ + _hipótesis_

**Medido:** `bootup-time` (`impact: high`, métrica afectada: TBT) con 500 ms de ahorro; `js/app.js` consume 1 483 ms de CPU, "Unattributable" 267 ms, el documento 136 ms, `three.min.js` 92 ms. El diagnóstico `long-tasks` indica "3 long tasks found" y `mainthread-work-breakdown` marca 2.0 s. TBT = 476 ms (`needs-improvement`), con rango 442–721 ms entre ejecuciones.
**Hipótesis (verificada en `js/app.js`):** `buildSearchIndex()` construye y ordena 150 000 entradas con `localeCompare` en una sola tarea justo tras el primer pintado. Comprobación: medir en DevTools (Performance) que la tarea larga corresponde a esa función.
**Esfuerzo M (hipótesis):** trocear el trabajo, moverlo a un Web Worker o construir el índice bajo demanda; es un cambio de lógica, no de atributo.

### 6. Fuentes sin `font-display` — _medición_ + _hipótesis_

**Medido:** `font-display-insight` (FCP): 300 ms de ahorro; `inter-latin-400.woff2` 305 ms y `inter-latin-700.woff2` 300 ms.
**Hipótesis (verificada en `css/styles.css`):** los dos `@font-face` no declaran `font-display`.
**Esfuerzo S (hipótesis):** añadir `font-display: swap` (u `optional`) a ambos.

### 7. Galería bajo el pliegue sin `loading="lazy"` — _hallazgo indirecto_

**Medido:** `resources.byType.image` = 8 492 779 B (8,10 MiB) de 8 699 348 B totales; las 6 imágenes `cafe-*.jpg` pesan entre 0,87 y 0,88 MiB cada una según `image-delivery-insight`.
**Hipótesis (verificada en `index.html`):** las 6 `<img>` de `.catalog` están en la sección "Nuestros cafés", tras hero y features, y no llevan `loading="lazy"` ni `decoding="async"`, así que se descargan al cargar la página aunque no se vean. Lighthouse 13 no genera una oportunidad para esto, por eso no hay ahorro medido.
**Esfuerzo S (hipótesis):** `loading="lazy"` y `decoding="async"` (nunca en el hero).

## Qué no está medido

- El problema 7 (galería sin `loading="lazy"`) no tiene oportunidad propia en Lighthouse 13: se deduce de `resources.byType.image` y de leer `index.html`.
- `unsized-images` y `cls-culprits-insight` no traen ahorro (0 ms, 0 B); `lcp-discovery-insight` y `network-dependency-tree-insight` tampoco, y sin `items[]`. No hay evidencia en el reporte de que el hero se descubra tarde: su problema medido es el peso, no la prioridad.
- `total-byte-weight` no trae ahorro propio; sus ficheros se tratan dentro del problema 1.
- Las dimensiones en píxeles de las imágenes (3200×2000 y 1600×1067) vienen de inspeccionar los ficheros, no del reporte del CLI.
- El esfuerzo S/M/L y todas las causas son hipótesis mías.
- Fiabilidad: 3 ejecuciones, sin avisos, pero el árbol de git estaba sucio (`dirty: true`) y el TBT varía entre ejecuciones (442–721 ms).

## Siguiente paso

¿Cuáles de estos 7 quieres abordar? Recomiendo empezar por 1 y 2, que atacan las dos métricas en `poor` (LCP y CLS); la 2 es un cambio de atributos de bajo esfuerzo, y 3, 4 y 6 también son S. Para aplicarlos, `perf-fix`; para medir el efecto después, `perf-compare`.
