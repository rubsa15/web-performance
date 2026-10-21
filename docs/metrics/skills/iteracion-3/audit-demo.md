## Resumen

Auditoría de `http://127.0.0.1:4173/` · mobile · 3 ejecuciones por perfil · Lighthouse 13.5.0 (simulate) · sin `warnings` en ningún reporte. Reportes (uno por perfil de red):

- `default` (referencia): `2026-10-21T21-24-14Z-mobile`
- `3g`: `2026-10-21T21-24-40Z-mobile-3g`
- `4g`: `2026-10-21T21-25-07Z-mobile-4g`

| Métrica | `default` (referencia)       | `3g`                         | `4g`            |
| ------- | ---------------------------- | ---------------------------- | --------------- |
| Score   | 43                           | 49                           | 36              |
| LCP     | 40 729 ms · poor             | 90 454 ms · poor             | 7 244 ms · poor |
| FCP     | 2 495 ms · needs-improvement | 4 596 ms · poor              | 1 097 ms · good |
| TBT     | 542 ms · needs-improvement   | 41 ms · good                 | 1 464 ms · poor |
| CLS     | 0,291 · poor                 | 0,291 · poor                 | 0,291 · poor    |
| SI      | 2 495 ms · good              | 4 596 ms · needs-improvement | 1 097 ms · good |
| TTFB    | 752 ms · good                | 1 202 ms · needs-improvement | 422 ms · good   |

La página transfiere 8,30 MiB (`resources.totalBytes` = 8 699 348 B), de los que 8,10 MiB son imágenes (`resources.byType.image`), 165 KiB scripts y 34 KiB fuentes. Es la misma en los tres perfiles.

Diagnóstico general: **el LCP es `poor` en los tres perfiles** (de 7 244 ms con `4g` a 90 454 ms con `3g`; los rangos `min`–`max` no se solapan) y el **CLS es `poor` e idéntico (0,291) en los tres**. Dependen mucho de la red el LCP, el FCP y los ahorros de render-blocking e imágenes; no dependen el CLS ni las fuentes. El TBT se comporta al revés que la red y no es de fiar para absolver la web (ver más abajo).

Tres lecturas con cuidado:

- **El score no ordena las redes.** Sube en `3g` (49) y baja en `4g` (36), al revés que el LCP. No lo uses para decir qué perfil "va mejor". _Hipótesis:_ el TBT, que se mueve al revés que la red, pesa mucho en la puntuación.
- **El TBT engaña.** Vale 41 ms en `3g` (rango 41–44), 542 ms en `default` (rango 402–767) y 1 464 ms en `4g` (rango 1 303–1 476), con la misma CPU: `bootup-time` atribuye 1 759 ms de CPU a `app.js` en `3g`, 1 550 ms en `default` y 1 745 ms en `4g`. _Hipótesis:_ el TBT solo cuenta las tareas largas entre FCP y TTI; con `3g` el FCP llega tan tarde (4 596 ms) que la tarea larga cae antes de esa ventana. El problema de CPU existe en las tres redes; solo en `default` y `4g` la métrica lo ve. Un TBT `good` en `3g` no es una absolución.
- **Dispersión:** en `default` el TBT va de 402 a 767 ms (el máximo es 1,9 veces el mínimo): la mediana es válida pero algo inestable. El resto de métricas es estable: `max` no llega al doble de `min` en ninguna.

Estos son tres perfiles simulados, no los usuarios reales.

## Prioridades

Orden: primero causas ligadas a una métrica `poor` en `default`; después las que solo son `poor` en otro perfil. Ahorros por perfil: `default` / `3g` / `4g`. Los ahorros se solapan; **no se suman**.

| #   | Problema (causa raíz)                                               | Evidencia medida (ahorro `default` / `3g` / `4g`)                                                                                                                     | Ante la red                                                                    | Métricas afectadas                               | Esfuerzo (hipótesis) |
| --- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------ | -------------------- |
| 1   | Imágenes sin optimizar (hero y galería)                             | `image-delivery-insight`: 32 900 / 81 500 / 5 050 ms, siempre 7,78 MiB (8 154 587 B) de ahorro; `hero.jpg` 2,86 MiB; 6 `cafe-*.jpg` de 0,87–0,88 MiB cada una         | **Sensible**: mismos bytes, el tiempo lo decide la red (ratio 16,1)            | LCP (los 3 perfiles)                             | M                    |
| 2   | JavaScript sin usar (`three.min.js`)                                | `unused-javascript`: 1 050 / 0 / 160 ms; 118 KiB sin usar de 164 KiB en `vendor/three.min.js` en los tres                                                             | **Sensible**: el ahorro en ms llega a 0 en `3g`; los 118 KiB están en los tres | `default`: FCP, LCP · `3g`: FCP · `4g`: FCP, LCP | S                    |
| 3   | Imágenes sin `width`/`height`                                       | `unsized-images`: 7 imágenes; `cls-culprits-insight` (sin items); CLS 0,291 poor en los tres. **Sin ahorro medido** (`impact: low`, pero apunta a una métrica `poor`) | **Independiente** (mismo CLS en los tres)                                      | CLS                                              | S                    |
| 4   | CSS y JS que bloquean el render                                     | `render-blocking-insight`: 1 550 / 3 050 / 600 ms; `three.min.js` 1 502 / 3 002 / 542 ms, `app.js` 602 / 902 / 382 ms, `styles.css` 452 / 602 / 342 ms                | **Sensible** (ratio 5,1). FCP es `poor` solo en `3g`                           | FCP                                              | S                    |
| 5   | Tarea larga en el hilo principal                                    | `bootup-time`: 550 / 50 / 1 450 ms (`mainthread-work-breakdown`: 550 / 50 / 1 500 ms); `app.js` 1 550 / 1 759 / 1 745 ms de CPU; `long-tasks`: 3 / 2 / 3 tareas       | **Se mueve sin que cambie la CPU** (ver TBT arriba). TBT `poor` solo en `4g`   | TBT                                              | M                    |
| 6   | Fuentes sin `font-display`                                          | `font-display-insight`: 300 / 300 / 300 ms; `inter-latin-400.woff2` (17 KiB) e `inter-latin-700.woff2` (18 KiB)                                                       | **Independiente**                                                              | FCP                                              | S                    |
| 7   | Galería bajo el pliegue sin `loading="lazy"` _(hallazgo indirecto)_ | `resources.byType.image` = 8,10 MiB; sin oportunidad propia en Lighthouse                                                                                             | Bytes iguales en los tres                                                      | LCP/carga (hipótesis)                            | S                    |

Notas de orden: la fila 1 va primera porque el LCP es `poor` en los tres perfiles y es el mayor ahorro. La fila 2 apunta a LCP `poor` en `default`; la 3 sube por tener ahorro 0 con CLS `poor` (se ordena como `high`). Las filas 4 y 5 son `poor` solo en un perfil (FCP en `3g`, TBT en `4g`) y, a igualdad, va antes la de mayor ahorro entre perfiles (render-blocking, 3 050 ms). La 5 merece subir en la práctica: el perfil donde el TBT parece bueno oculta una tarea larga que existe en todos. Las filas 2 y 4 comparten `three.min.js` (se solapan; no se suman).

## Detalle

### 1. Imágenes sin optimizar — _medición_ + _hipótesis_

**Medido:** `image-delivery-insight` marca 7 imágenes. `hero.jpg` pesa 2,86 MiB (3 003 499 B) y podría ahorrar 2,81 MiB (2 949 349 B); cada `cafe-*.jpg` pesa 0,87–0,88 MiB y ahorraría 0,82–0,83 MiB. El ahorro estimado sobre el LCP es 32 900 ms (`default`), 81 500 ms (`3g`) y 5 050 ms (`4g`), con los mismos 7,78 MiB (8 154 587 B). Las seis `cafe-*.jpg` suman 5,23 MiB (fuente: cálculo, 919 938 + 917 437 + 916 573 + 912 745 + 911 511 + 909 640 = 5 487 844 B).
**Qué elemento es el LCP:** `lcp-discovery-insight` viene sin items, así que el elemento LCP no está identificado; no se afirma que sea el hero.
**Hipótesis:** las imágenes se sirven a su resolución original sin variantes responsive. `hero.jpg` mide 3200×2000 px y las `cafe-*.jpg` 1600×1067 px (fuente: fichero, `file`), mientras que el CSS las muestra con `width: 100%` de su contenedor (fuente: código, `demo/site/css/styles.css`) y sin `srcset`/`sizes` (fuente: código, `demo/site/index.html`).
**Cómo comprobarlo:** comparar dimensiones del fichero con las mostradas en DevTools; regenerar variantes a varios anchos, formato moderno y añadir `srcset`/`sizes`. **Esfuerzo M**: varias variantes y reescribir las 7 etiquetas.

### 2. JavaScript sin usar (`three.min.js`) — _medición_ + _hipótesis_

**Medido:** `unused-javascript` marca 120 895 B (118 KiB) sin usar de `vendor/three.min.js` (167 861 B, 164 KiB) en los tres perfiles. Ahorro: 1 050 ms (`default`), 0 ms (`3g`), 160 ms (`4g`). En `3g` hay bytes sin usar pero Lighthouse no los atribuye en tiempo: no es "no importa", es que esa red no lo mide.
**Hipótesis (verificada en código):** la librería se carga en el `<head>` pero ni `index.html` ni `js/app.js` hacen referencia a `THREE` (fuente: código; un comentario de `app.js` dice que era para un visor 3D que ya no existe). Si se elimina la etiqueta, también desaparece su parte en la fila 4.
**Esfuerzo S:** quitar una línea de `index.html` y el fichero.

### 3. Imágenes sin `width`/`height` — _medición_ + _hipótesis_

**Medido:** `unsized-images` lista 7 imágenes (`hero.jpg`, `cafe-1.jpg` … `cafe-6.jpg`) y `cls-culprits-insight` señala el desplazamiento. CLS = 0,291 `poor`, igual en los tres perfiles. Ninguna de las dos auditorías trae ahorro medido: su efecto está en la métrica, no en el tiempo.
**Hipótesis (verificada en código):** ninguna de las 7 `<img>` de `index.html` tiene `width`/`height` y el CSS pone `height: auto` (fuente: código). Al cargar las imágenes el navegador reserva el espacio tarde y empuja el contenido.
**Esfuerzo S:** añadir `width`/`height` (o `aspect-ratio`) a 7 etiquetas.

### 4. CSS y JS que bloquean el render — _medición_ + _hipótesis_

**Medido:** `render-blocking-insight` suma 1 550 / 3 050 / 600 ms. Por recurso (`default` / `3g` / `4g`): `three.min.js` 1 502 / 3 002 / 542 ms, `app.js` 602 / 902 / 382 ms, `styles.css` 452 / 602 / 342 ms. Afecta a FCP, que es `needs-improvement` en `default` (2 495 ms), `poor` en `3g` (4 596 ms) y `good` en `4g` (1 097 ms).
**Hipótesis (verificada en código):** `three.min.js` y `app.js` se cargan como `<script src>` síncronos en el `<head>` sin `defer` (fuente: código). `styles.css` es CSS normal en `<head>` (955 B), y es el menos costoso.
**Esfuerzo S:** `defer` en `app.js` (y quitar `three.min.js`, ver 2); el CSS pesa casi nada y puede quedarse.

### 5. Tarea larga en el hilo principal — _medición_ + _hipótesis_

**Medido:** `bootup-time` pone a `app.js` en 1 550 ms (`default`), 1 759 ms (`3g`) y 1 745 ms (`4g`) de CPU; el diagnóstico `long-tasks` encuentra 3 / 2 / 3 tareas largas. Ahorro de `bootup-time`: 550 / 50 / 1 450 ms. TBT: 542 ms (needs-improvement) / 41 ms (good) / 1 464 ms (poor). El `cpuMs` es CPU total, no TBT: no son comparables.
**Hipótesis (verificada en código):** `app.js` construye en `buildSearchIndex` un array de 150 000 entradas y lo ordena con `localeCompare` de una sola vez, justo tras `DOMContentLoaded` (fuente: código, `demo/site/js/app.js`).
**Esfuerzo M:** trocear el trabajo, diferirlo con `requestIdleCallback`, moverlo a un worker o no construirlo hasta que se use.

### 6. Fuentes sin `font-display` — _medición_ + _hipótesis_

**Medido:** `font-display-insight` marca 300 ms en los tres perfiles para `inter-latin-400.woff2` e `inter-latin-700.woff2` (17 KiB y 18 KiB).
**Hipótesis (verificada en código):** los dos `@font-face` de `styles.css` no declaran `font-display` (fuente: código). **Esfuerzo S:** añadir `font-display: swap`.

### 7. Galería sin `loading="lazy"` — _hallazgo indirecto_

**Medido:** `resources.byType.image` = 8,10 MiB (8 492 779 B), muy alto para una página móvil con 7 imágenes; Lighthouse 13 no tiene una oportunidad `offscreen-images`.
**Hipótesis (verificada en código):** ninguna de las 6 imágenes de la galería (sección `#cafes`, situada tras el hero y la sección `#origen`) tiene `loading="lazy"` (fuente: código). Compiten por ancho de banda con el recurso principal. **Esfuerzo S:** atributo `loading="lazy"` (y `decoding="async"`) en las 6 `cafe-*.jpg`, dejando el hero sin él.

## Qué no está medido

- La fila 7 no tiene oportunidad propia: se deduce de `resources.byType.image` y de leer `index.html`, no de un ahorro medido.
- `unsized-images` y `cls-culprits-insight` no traen ahorro.
- El elemento LCP no está identificado (`lcp-discovery-insight` y `network-dependency-tree-insight` vienen sin items y con ahorro 0).
- `server-response-time` dice "Root document took 0 ms" mientras `ttfb` es 752 / 1 202 / 422 ms: se usa `metrics.ttfb` (`good` en `default` y `4g`, `needs-improvement` en `3g`) y el diagnóstico solo como pista.
- `total-byte-weight` (sin ahorro ni métricas afectadas) solo repite los 10 recursos más pesados; para el peso total se usa `resources.totalBytes`.
- Tres redes simuladas no son todas las redes: este informe habla de estos perfiles, no de usuarios reales.

## Siguiente paso

¿Cuáles de estos 7 quieres abordar? Recomiendo empezar por 1, 3 y 2: atacan el LCP y el CLS, que son `poor` en los tres perfiles, y 3 y 2 son de esfuerzo S. Después 4 y 5, que cubren el FCP de `3g` y el TBT de `4g`. Para aplicarlos, `perf-fix`; para medir el efecto después, `perf-compare`.
