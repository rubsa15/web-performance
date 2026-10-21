# Auditoría de rendimiento: `http://127.0.0.1:4173/` (mobile)

## Resumen

Tres perfiles de red, mismo dispositivo (`mobile`), 3 ejecuciones cada uno, Lighthouse 13.5.0, commit `55b5fde` (`git.dirty` = false), sin `warnings` en ningún reporte:

- `default` (referencia): `2026-10-21T21-08-09Z-mobile`
- `3g`: `2026-10-21T21-08-38Z-mobile-3g`
- `4g`: `2026-10-21T21-09-09Z-mobile-4g`

La página transfiere 8,30 MiB (`resources.totalBytes` = 8 699 348 B, igual en los tres), de los que 8,10 MiB son imágenes (`resources.byType.image`) y 165 KiB, scripts (`resources.byType.script`).

| Métrica | `default` (referencia)       | `3g`                         | `4g`            |
| ------- | ---------------------------- | ---------------------------- | --------------- |
| Score   | 42                           | 49                           | 37              |
| LCP     | 40 729 ms · poor             | 90 454 ms · poor             | 7 164 ms · poor |
| FCP     | 2 496 ms · needs-improvement | 4 596 ms · poor              | 1 097 ms · good |
| TBT     | 573 ms · needs-improvement   | 41 ms · good                 | 1 353 ms · poor |
| CLS     | 0,291 · poor                 | 0,291 · poor                 | 0,291 · poor    |
| SI      | 2 496 ms · good              | 4 596 ms · needs-improvement | 1 097 ms · good |
| TTFB    | 752 ms · good                | 1 202 ms · needs-improvement | 422 ms · good   |

Diagnóstico general: en estos tres perfiles el LCP es `poor` y el CLS es `poor` siempre; la red solo decide cuánto de mal: de 7 164 ms (`4g`) a 90 454 ms (`3g`) con exactamente los mismos bytes. El servidor responde bien (TTFB `good` en `default` y `4g`), así que el problema está en lo que se envía y en cómo se carga.

Fiabilidad y lecturas a tener en cuenta:

- **El score no ordena las redes**: sube en `3g` (49) y baja en `4g` (37), al revés que el LCP. _Hipótesis:_ el TBT, que se comporta al revés que la red (ver abajo), pesa mucho en la puntuación. No lo uses para decir que la web "va mejor" en 3G.
- **El TBT engaña.** Vale 41 ms (`good`) en `3g`, 573 ms en `default` y 1 353 ms (`poor`) en `4g`, pero `bootup-time` atribuye casi la misma CPU a `app.js` en los tres: 1 581 / 1 661 / 1 621 ms. _Hipótesis:_ el TBT solo cuenta las tareas largas entre FCP y TTI; con `3g` el FCP llega tan tarde (4 596 ms) que la tarea larga cae antes de esa ventana. El problema de CPU existe en los tres perfiles; solo `default` y `4g` lo ven en la métrica.
- **Dispersión**: en `4g` el CLS va de 0 a 0,291 entre ejecuciones (`min` 0, `max` 0,291; mediana 0,291), así que en ese perfil el CLS es inestable. En el resto de métricas el rango `min`–`max` es estrecho (el más amplio, TBT en `4g`: 1 230–1 711 ms; el LCP en `4g` va de 7 163 a 7 843 ms).
- Estos son tres perfiles simulados, no "los usuarios reales".

## Tabla priorizada

El orden sigue el de la skill: primero lo que afecta a una métrica `poor` en `default`; luego lo que solo es `poor` en otra red (se indica cuál); dentro de cada grupo, por `impact` y ahorro de `default`. Los ahorros se solapan: **no se suman**. Ahorro en formato `default` / `3g` / `4g`.

| #   | Problema (causa raíz)                               | Evidencia medida                                                                                               | Ante la red                                                                                              | Métricas afectadas          | Esfuerzo (hipótesis) |
| --- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------- | -------------------- |
| 1   | Imágenes sin optimizar (hero y galería)             | `image-delivery-insight`: 32 900 / 81 500 / 5 050 ms; siempre 7,78 MiB (8 154 587 B). `hero.jpg` solo 2,86 MiB | **Sensible**: mismos bytes, el tiempo lo decide la red                                                   | LCP (poor en los 3)         | M                    |
| 2   | Librería JS sin usar (`three.min.js`)               | `unused-javascript`: 1 050 / 0 / 160 ms; 118 KiB sin usar en los tres                                          | **Sensible, y el ahorro en ms llega a 0 en `3g`**: los bytes están, la métrica no los atribuye a esa red | FCP, LCP (en `3g` solo FCP) | S                    |
| 3   | Imágenes sin `width`/`height`                       | `unsized-images`: 7 imágenes; `cls-culprits-insight`; CLS 0,291 (poor). Sin ahorro medido                      | **Independiente**: CLS 0,291 en los tres (con la salvedad de la dispersión en `4g`)                      | CLS                         | S                    |
| 4   | CSS y JS que bloquean el render                     | `render-blocking-insight`: 1 550 / 3 050 / 600 ms; `three.min.js` 1 501 / 3 002 / 542 ms                       | **Sensible**. Es `poor` solo en `3g` (FCP 4 596 ms); `needs-improvement` en `default`, `good` en `4g`    | FCP                         | S                    |
| 5   | Tarea larga en el hilo principal                    | `bootup-time` / `mainthread-work-breakdown`: 550 / 50 / 1 350 ms; `app.js` 1 581 / 1 661 / 1 621 ms de CPU     | **Se mueve sin que cambie la CPU**. TBT `poor` solo en `4g` (1 353 ms); `needs-improvement` en `default` | TBT                         | M                    |
| 6   | Fuentes sin `font-display`                          | `font-display-insight`: 300 / 300 / 300 ms; `inter-latin-400.woff2` e `inter-latin-700.woff2`                  | **Independiente**                                                                                        | FCP                         | S                    |
| 7   | Galería sin `loading="lazy"` _(hallazgo indirecto)_ | `resources.byType.image` = 8,10 MiB; 6 `cafe-*.jpg` de 0,87–0,88 MiB cada una en `image-delivery-insight`      | Mismos bytes en los tres perfiles                                                                        | LCP (carga)                 | S                    |

Notas sobre el orden: las filas 1–3 son las que tocan una métrica `poor` en `default` (LCP y CLS). Con la regla estricta de `impact`, la fila 2 (`high`) va delante de la 3 (`low`), pero la 3 es una corrección de atributos de minutos que ataca una de las dos métricas `poor` de la referencia; en la práctica conviene hacerla a la vez que la 1. Las filas 4–6 apuntan a FCP/TBT, `needs-improvement` en `default` pero `poor` en otra red (`3g` y `4g` respectivamente).

## Detalle por problema

### 1. Imágenes sin optimizar — _medición_ + _hipótesis_

**Medido:** `image-delivery-insight` marca 7 imágenes. `hero.jpg` pesa 2,86 MiB (3 003 499 B) y ahorraría 2,81 MiB; cada `cafe-*.jpg` pesa entre 0,87 y 0,88 MiB y ahorraría entre 0,82 y 0,83 MiB. Ahorro total de bytes: 7,78 MiB (8 154 587 B), idéntico en los tres perfiles. Ahorro en tiempo sobre LCP: 32 900 ms (`default`), 81 500 ms (`3g`), 5 050 ms (`4g`). Las seis imágenes de la galería suman 5,23 MiB (fuente: cálculo, 919 938 + 917 437 + 916 573 + 912 745 + 911 511 + 909 640 B) frente a 2,86 MiB del hero.
**Hipótesis:** se sirven a su resolución original sin variantes responsive ni recompresión. Comprobado leyendo el código: ningún `<img>` de `index.html` lleva `srcset`/`sizes` (fuente: código). Los ficheros miden 3200×2000 px (`hero.jpg`) y 1600×1067 px (`cafe-*.jpg`) (fuente: fichero, `file`), mientras el CSS los muestra con `width: 100%` en una rejilla de columnas mínimas de 280 px (fuente: código).
**Qué elemento es el LCP:** `lcp-discovery-insight` viene vacío, así que el reporte no identifica el elemento LCP; no afirmo que sea `hero.jpg`, aunque es la imagen de mayor tamaño y la primera del documento.
**Esfuerzo M:** generar variantes de varios anchos y reescribir las etiquetas con `srcset`/`sizes`.
**Cómo comprobarlo:** tras regenerar, volver a auditar y comparar `image-delivery-insight` y `resources.byType.image`.

### 2. Librería JS sin usar (`three.min.js`) — _medición_ + _hipótesis_

**Medido:** `unused-javascript` lista `vendor/three.min.js`: 120 895 B (118 KiB) sin usar de 167 861 B (`default`, `3g`, `4g` por igual). Ahorro en ms: 1 050 / 0 / 160. Además `bootup-time` le asigna 91 / 93 / 93 ms de CPU. Que el ahorro en ms sea 0 en `3g` no significa que no importe: Lighthouse no lo atribuye a esa red.
**Hipótesis:** la librería ya no se usa. En `app.js` no hay ninguna referencia a ella salvo un comentario, y `index.html` solo la carga con `<script src>` (fuente: código).
**Esfuerzo S:** quitar la etiqueta `<script>` y el fichero, si nada más la necesita. Es el mismo fichero que el problema 4 (bloqueo de render): eliminarlo resuelve las dos filas, que se solapan.

### 3. Imágenes sin `width`/`height` — _medición_

**Medido:** `unsized-images` lista 7 imágenes (`hero.jpg` y `cafe-1.jpg` … `cafe-6.jpg`) y `cls-culprits-insight` señala el desplazamiento. CLS = 0,291, `poor`, en los tres perfiles. Ninguna trae ahorro medido: su efecto está en la métrica, no en el tiempo. En `4g` una de las ejecuciones midió CLS 0 (`min` 0, `max` 0,291).
**Hipótesis:** el navegador no tiene espacio reservado hasta que llega la imagen y empuja el contenido. Comprobado: ningún `<img>` de `index.html` tiene `width`/`height` y el CSS solo da `height: auto` (fuente: código).
**Esfuerzo S:** añadir `width` y `height` a cada `<img>` (o `aspect-ratio` en CSS).

### 4. CSS y JS que bloquean el render — _medición_ + _hipótesis_

**Medido:** `render-blocking-insight` lista `three.min.js`, `app.js` y `styles.css`. Ahorro 1 550 / 3 050 / 600 ms (`default` / `3g` / `4g`). Por recurso, `three.min.js`: 1 501 / 3 002 / 542 ms; `app.js`: 601 / 902 / 382 ms; `styles.css`: 451 / 602 / 342 ms. FCP: 2 496 ms (`needs-improvement`), 4 596 ms (`poor` en `3g`), 1 097 ms (`good`).
**Hipótesis:** los dos scripts están en `<head>` sin `defer`/`async` (fuente: código). Sensible a la red: el ahorro casi se duplica de `default` a `3g`.
**Esfuerzo S:** `defer` en `app.js`; `three.min.js` desaparece con el problema 2. El CSS puede dejarse (es pequeño) o llevarse el crítico a línea.

### 5. Tarea larga en el hilo principal — _medición_ + _hipótesis_

**Medido:** `bootup-time` y `mainthread-work-breakdown` repiten el mismo ahorro (550 / 50 / 1 350 ms): es un único problema. `app.js` gasta 1 581 ms de CPU en `default` (1 661 en `3g`, 1 621 en `4g`); el diagnóstico `long-tasks` dice "2 long tasks found" en los tres. El TBT es 573 ms (`needs-improvement`), 41 ms (`good`) y 1 353 ms (`poor`). El `cpuMs` es CPU total, no TBT; no son comparables entre sí.
**Hipótesis:** en `app.js`, `buildSearchIndex()` construye 150 000 entradas y las ordena con `localeCompare` en el hilo principal justo después del primer pintado (fuente: código, bucle `i < 150000`). El TBT bajo en `3g` no es una absolución: la tarea existe y solo cae fuera de la ventana de medida (hipótesis del apartado Resumen).
**Esfuerzo M:** trocear el trabajo, moverlo a un Web Worker o construir el índice bajo demanda.

### 6. Fuentes sin `font-display` — _medición_

**Medido:** `font-display-insight`: 300 ms de ahorro en los tres perfiles; recursos `inter-latin-400.woff2` e `inter-latin-700.woff2` (34 KiB entre las dos, `resources.byType.font` = 34 900 B). Prioridad estable con la red.
**Hipótesis:** los `@font-face` de `css/styles.css` no declaran `font-display` (fuente: código, sin coincidencias de `font-display`).
**Esfuerzo S:** añadir `font-display: swap` (o `optional`) a ambos `@font-face`.

### 7. Galería sin `loading="lazy"` — _hallazgo indirecto, hipótesis_

**Medido:** `resources.byType.image` = 8,10 MiB (8 492 779 B) para una página con 7 `<img>`; las seis `cafe-*.jpg` pesan 0,87–0,88 MiB cada una. Lighthouse 13 no tiene oportunidad `offscreen-images`, por lo que esto no figura como ahorro.
**Hipótesis (verificada en el código):** ninguna imagen tiene `loading="lazy"` ni `decoding="async"` (fuente: código). Las seis de la galería están en la sección `#cafes`, después del hero y de `features`, así que se descargan aunque queden bajo el pliegue. No se ha medido el ahorro de diferirlas.
**Esfuerzo S:** `loading="lazy"` en las seis `cafe-*.jpg` (no en el hero).

## Qué no está medido

- El problema 7 no tiene oportunidad propia; su efecto sobre LCP/TBT no está cuantificado.
- `unsized-images`, `cls-culprits-insight`, `lcp-discovery-insight` y `network-dependency-tree-insight` vienen con ahorro 0 (`lcp-discovery-insight` y `network-dependency-tree-insight` sin elementos): el elemento LCP no está identificado.
- `total-byte-weight` (10 recursos, sin ahorro) solo confirma los pesos; para el peso de la página uso `resources.totalBytes`. `server-response-time` dice "Root document took 0 ms" mientras `metrics.ttfb` es 752 ms en `default`: manda la métrica.
- No hay `cache-insight` en estos reportes, por lo que no se evalúan visitas repetidas.
- Tres redes simuladas no son todas las redes: el informe habla de estos perfiles, no de los usuarios reales.

## Siguiente paso

Recomiendo empezar por **1, 2 y 3** (más el `defer` de la fila 4): atacan el LCP y el CLS, las dos métricas `poor` en todos los perfiles, y salvo la 1 son cambios S. Después la 5, porque con la red rápida (`4g`) es la que deja el TBT en `poor`. ¿Cuáles quieres abordar? Para aplicarlos está `perf-fix`, y para medir el efecto después, `perf-compare` (con reportes del mismo perfil de red).
