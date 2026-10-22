(Preguntas que habría hecho con `AskUserQuestion`; no tengo esa herramienta en esta sesión, así que asumí las respuestas indicadas.)

1. Dispositivos: `mobile` (recomendado) y/o `desktop`. Asumido: `mobile`.
2. Presets de red: `default`, `3g`, `4g`, con los tres recomendados para poder cruzarlos en `mobile`. Asumido: los tres.
3. Ejecuciones por preset: `3` (recomendada), `5` o `1`. Coste: 1 dispositivo × 3 presets × 3 ejecuciones = 9 cargas en serie. Asumido: 3.

Auditoría hecha. La demo no respondía en el puerto 4173, así que la arranqué con `npm run demo`. Los tres perfiles se midieron: 3 de 3, sin fallos.

---

# Auditoría de http://127.0.0.1:4173/

**Resumen corto:** lo primero que hay que mejorar son las **imágenes** (8,10 MiB de imágenes en una página de 8,30 MiB). Después, el **CLS** (0,291, `poor` en las tres redes) y el **JavaScript de `three.min.js`**.

## 1. Resumen

- URL: `http://127.0.0.1:4173/`. Dispositivo: `mobile`. Lighthouse 13.5.0, Chrome 155, throttling `simulate` (las cifras son simuladas). 3 ejecuciones por perfil (la cifra es la mediana).
- Reportes de esta auditoría (ids):
  - `2026-10-22T19-15-01Z-mobile` (default)
  - `2026-10-22T19-15-22Z-mobile-3g`
  - `2026-10-22T19-15-43Z-mobile-4g`
- `warnings` vacío en los tres. `git.dirty` es `false`, así que no hay cambios sin commitear.
- Fiabilidad: ningún rango `min`–`max` supera el umbral de ruido de `wperf compare`.
  - El TBT es la métrica más dispersa. Rangos: 535–607 ms en default y 1 255–1 433 ms en 4g, frente a umbrales de 281 ms y 687 ms (cálculo: máx(50 ms, 50 % de la mediana)).
  - Las medianas son fiables.

| Métrica | `default` (referencia)                | `3g`                           | `4g`                           |
| ------- | ------------------------------------- | ------------------------------ | ------------------------------ |
| score   | 43                                    | 49                             | 36                             |
| LCP     | 40 730 ms (`poor`)                    | 90 455 ms (`poor`)             | 7 164 ms (`poor`)              |
| FCP     | 2 498 ms (`needs-improvement`)        | 4 599 ms (`poor`)              | 1 097 ms (`good`)              |
| TBT     | 562 ms (`needs-improvement`; 535–607) | 44 ms (`good`; 40–45)          | 1 373 ms (`poor`; 1 255–1 433) |
| CLS     | 0,291 (`poor`)                        | 0,291 (`poor`)                 | 0,291 (`poor`)                 |
| SI      | 2 498 ms (`good`)                     | 4 599 ms (`needs-improvement`) | 1 097 ms (`good`)              |
| TTFB    | 752 ms (`good`)                       | 1 203 ms (`needs-improvement`) | 422 ms (`good`)                |

**Diagnóstico general:**

- El LCP es `poor` en las tres redes y el CLS no cambia con la red. Son dos problemas estructurales.
- Lo que sí depende de la red es el coste en tiempo de los bytes: el ahorro de imágenes pasa de 5 050 ms (4g) a 81 500 ms (3g) con casi los mismos bytes.
- El TBT se comporta de forma distinta en cada perfil: `good` en 3g, `poor` en 4g (ver problema 5).
- El `score` no ordena las redes. Es más alto en 3g (49), que tiene el peor LCP.

Peso de la página (`resources`, igual en los tres): 8 699 207 B (8,30 MiB). De ellos, 8 492 779 B (8,10 MiB) son imágenes, 169 118 B (165 KiB) scripts y 34 900 B (34 KiB) fuentes. Las imágenes son el 97,6 % del peso (fuente: cálculo, 8 492 779 / 8 699 207).

## 2. Tabla priorizada

Esfuerzo y causa son **hipótesis**; la evidencia es **medición**. Los ahorros de las filas se solapan: no los sumes.

| #   | Problema (ids)                                                                                                                                                    | Evidencia medida                                                                                                                                                                                                                                       | Ante la red (ahorro default / 3g / 4g)                                                                            | Métricas                                                        | Esfuerzo (hip.)                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | **Imágenes sin optimizar**: el hero y 6 imágenes de galería pesan unos 0,9–3 MB cada una (`image-delivery-insight`, `total-byte-weight`, `lcp-discovery-insight`) | `img/hero.jpg` 3 003 499 B (2,86 MiB), de los que 2 985 817 B son desperdicio. Las 6 `cafe-N.jpg` pesan 909 640–919 938 B cada una. Ahorro: 8 381 381 B (7,99 MiB) en default y 8 154 587 B (7,78 MiB) en 3g/4g. El hero no tiene `fetchpriority=high` | **Sensible a la red**: 33 800 ms / 81 500 ms / 5 050 ms (cociente 16,1; fuente: cálculo, 81 500 / 5 050)          | LCP (`poor` en los 3 perfiles)                                  | M (regenerar variantes y `srcset`/`sizes`); la parte de `fetchpriority` es S |
| 2   | **Imágenes sin dimensiones, el contenido salta** (`unsized-images`, `cls-culprits-insight`)                                                                       | 7 imágenes sin `width`/`height` (hero y `cafe-1` a `cafe-6`). CLS 0,291                                                                                                                                                                                | **Independiente**: sin ahorro medido (0 ms) y CLS 0,291 en los tres                                               | CLS (`poor` en los 3)                                           | S                                                                            |
| 3   | **`three.min.js` casi sin usar** (`unused-javascript`)                                                                                                            | `vendor/three.min.js`: 120 895 B (118 KiB) sin usar de 167 861 B (164 KiB), el 72,0 % (fuente: cálculo)                                                                                                                                                | **Sensible a la red**: 1 050 ms / 0 ms / 160 ms. Los bytes son iguales en los tres                                | FCP y LCP (default y 4g); solo FCP en 3g                        | S si se puede quitar; M si hay que cargarlo bajo demanda                     |
| 4   | **Recursos que bloquean el render** (`render-blocking-insight`)                                                                                                   | 3 recursos síncronos en `<head>`: `vendor/three.min.js`, `js/app.js` y `css/styles.css`                                                                                                                                                                | **Sensible a la red**: 1 550 ms / 3 050 ms / 600 ms (cociente 5,1; fuente: cálculo, 3 050 / 600)                  | FCP: `needs-improvement` en default, `poor` en 3g, `good` en 4g | S (`defer`); `styles.css` pesa 955 B, así que ahí el margen es pequeño       |
| 5   | **Hilo principal ocupado, el TBT depende del perfil** (`bootup-time`, `mainthread-work-breakdown`, diagnóstico `long-tasks`)                                      | `js/app.js`: `cpuMs` 1 570 / 1 498 / 1 641 (no es el TBT). El archivo pesa solo 981 B                                                                                                                                                                  | **Solo visible en algunos perfiles**: 550 ms / 50 ms / 1 350 ms. TBT 562 / 44 / 1 373 ms. `long-tasks`: 4 / 3 / 3 | TBT: `needs-improvement`, `good`, `poor`                        | M–L                                                                          |
| 6   | **Fuentes sin `font-display` adecuado** (`font-display-insight`)                                                                                                  | `inter-latin-400.woff2` (16 912 B) e `inter-latin-700.woff2` (17 988 B)                                                                                                                                                                                | **Ahorro constante** en los tres: 300 ms (cociente 1,0). El FCP cambia de rating por otras causas                 | FCP                                                             | S                                                                            |
| 7   | **Imágenes bajo el pliegue sin `loading="lazy"`** (hallazgo indirecto)                                                                                            | El HTML tiene 6 `<img>` de galería sin `loading` (fuente: curl). Pesan 5 487 844 B (5,23 MiB) (fuente: cálculo, suma de los 6 `totalBytes` de `image-delivery-insight`)                                                                                | Sin ahorro medido                                                                                                 | Sin métrica asignada por el CLI                                 | S                                                                            |

**Por qué este orden:**

- Filas 1–3: afectan a una métrica `poor` en el perfil de referencia (LCP y CLS). El CLS va segundo porque no tiene ahorro medido pero explica una métrica `poor`.
- Filas 4–6: afectan a métricas `poor` solo en otro perfil. Las desempato por `savingsMs` máximo en cualquier perfil: FCP `poor` solo en 3g con 3 050 ms, TBT `poor` solo en 4g con 1 350 ms y fuentes con 300 ms. Las tres son `poor` en un único perfil.
- Fila 7: hallazgo indirecto, sin métrica asignada.
- `three.min.js` aparece en las filas 3 y 4. Los ahorros se solapan y no se suman. Las dejo separadas porque el arreglo difiere: quitar o cargar bajo demanda frente a `defer`.

## 3. Detalle por problema

**1. Imágenes sin optimizar** (LCP)

- Qué pasa: el elemento LCP es `img.hero-img` (`img/hero.jpg`) y las 6 fotos de la galería pesan casi lo mismo entre sí.
- Evidencia: el desglose del LCP (medido en la carga real, no suma el valor simulado) reparte 500 de 616 ms en carga: el 81 % (fuente: cálculo, 500 / (7+12+500+97)) en default. En 3g es el 82 % y en 4g el 83 %, así que la carga de bytes domina. `discovery`: `priorityHinted: false`, `requestDiscoverable: true`, `eagerlyLoaded: true`. El elemento LCP es el mismo en los tres perfiles.
- Causa probable (_hipótesis_): imágenes en resolución original sin `srcset`/`sizes` ni recompresión.
- Cómo comprobarlo: mira las dimensiones reales de los ficheros y el tamaño al que se pintan en DevTools.
- Sobre la red: los `savingsBytes` son idénticos entre 3g y 4g (8 154 587 B) y el tiempo cambia, así que la causa son los bytes. El default difiere un 2,7 % en bytes (fuente: cálculo, 226 794 / 8 381 381), con los mismos 7 items.

**2. Imágenes sin dimensiones** (CLS)

- Qué pasa: sin `width`/`height` el navegador no reserva espacio y el contenido salta al llegar las imágenes.
- Evidencia: `unsized-images` lista 7 imágenes (hero y `cafe-1` a `cafe-6`). Sale con `impact: low` y ahorro 0, pero el CLS es 0,291 (`poor`) en los tres perfiles, con rango `min`–`max` nulo.
- Causa probable (_hipótesis_): faltan `width`/`height` (o `aspect-ratio` en CSS) en las `<img>`. En el HTML descargado, ninguna `<img>` lo tiene (fuente: curl). Falta confirmar que el salto viene de ahí y no de otro elemento.
- Cómo comprobarlo: abre DevTools, Performance y busca los _layout shifts_.

**3. `three.min.js` sin usar** (FCP/LCP)

- Evidencia: `unused-javascript` solo lista este recurso (118 KiB sin usar de 164 KiB).
- Causa probable (_hipótesis_): se carga la librería 3D completa para un uso muy parcial o nulo. No he mirado el código para saber qué hace con ella.
- Sobre la red: el ahorro llega a 0 ms en 3g, con los mismos bytes. Es sensible a la red por regla mecánica, pero los 120 895 B son los mismos en los tres.
- Cómo comprobarlo: busca dónde se usa `THREE` en la web.

**4. Recursos que bloquean el render** (FCP)

- Evidencia: `render-blocking-insight` lista `three.min.js`, `app.js` y `styles.css`. El HTML los carga con `<link rel="stylesheet">` y `<script src>` en `<head>` sin `defer` ni `async` (fuente: curl).
- Causa probable (_hipótesis_): scripts síncronos en `<head>`. `app.js` pesa solo 981 B, así que su coste es su ejecución, no la descarga (ver 5).
- Sobre la red: el ahorro y la gravedad crecen con una red lenta (3 050 ms en 3g, FCP `poor`).
- Cómo comprobarlo: añade `defer` y vuelve a medir.

**5. Hilo principal ocupado** (TBT)

- Evidencia: `bootup-time` marca `js/app.js` con `cpuMs` 1 570 (default), 1 498 (3g) y 1 641 (4g), el mayor consumidor de CPU. El `cpuMs` es CPU total, no TBT.
- La CPU es parecida en los tres (cociente 1,10; fuente: cálculo, 1 641 / 1 498), pero el TBT va de 44 ms (3g, `good`) a 1 373 ms (4g, `poor`).
- Hipótesis: con 3g el FCP se retrasa tanto (4 599 ms) que la tarea larga cae fuera de la ventana que cuenta el TBT. El problema de CPU sigue ahí en 3g aunque la métrica lo oculte; no es una absolución.
- `long-tasks`: 4 tareas largas en default y 3 en 3g/4g.
- Causa probable (_hipótesis_): `app.js` hace trabajo pesado y síncrono al cargar. Con 981 B de código es probable un bucle o cálculo grande, pero no lo he leído.
- Cómo comprobarlo: perfila el arranque en DevTools, Performance.

**6. Fuentes**

- Evidencia: `font-display-insight` mide 300 ms en los tres perfiles, para dos `woff2` de Inter.
- Causa probable (_hipótesis_): `@font-face` sin `font-display: swap`. No he comprobado el CSS.

**7. Imágenes sin lazy (indirecto)**

- Evidencia: en el HTML descargado, ninguna de las 6 imágenes de galería lleva `loading` (fuente: curl). El CLI no tiene una oportunidad para esto.
- Causa probable (_hipótesis_): la galería está bajo el pliegue y se descarga entera al cargar. Falta comprobar la posición real de la galería en pantalla.

## 4. Qué no está medido

- El hallazgo indirecto de la fila 7 no tiene ahorro asociado.
- `lcp-discovery-insight`, `network-dependency-tree-insight` y `cls-culprits-insight` salen con 0 ms de ahorro. Los he usado como evidencia en las filas 1 y 2, no como filas propias.
- `server-response-time` dice "Root document took 0 ms" mientras `metrics.ttfb` es 752 / 1 203 / 422 ms. Me fío de la métrica y descarto el diagnóstico.
- Peso total: uso `resources.totalBytes` (8 699 207 B). `total-byte-weight` e `image-delivery-insight` miden por su cuenta; por eso el hero sale como 3 003 705 B en uno y 3 003 499 B en el otro.
- No aparecen `cache-insight` ni vídeo (`resources.byType.media` es 0).
- Son tres redes simuladas, no usuarios reales.

## 5. Siguiente paso

Mi propuesta es empezar por la **fila 1** (imágenes). Es la que más pesa en el LCP, que es `poor` en los tres perfiles. La **fila 2** (dimensiones de las imágenes, esfuerzo S) y la **fila 7** (lazy en la galería, esfuerzo S) se aplican junto con la 1, porque tocan las mismas `<img>`.

¿Cuáles quieres abordar? Con `perf-fix` puedo aplicar las mejoras elegidas y luego validarlas con `perf-compare`.
