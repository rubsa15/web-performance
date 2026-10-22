## Sí, el cambio funcionó en las tres redes, pero no por igual: `default` y `4g` quedan en verde y `3g` mejora mucho sin llegar a "good"

Comparé cada red con su pareja (`antes-*` contra `despues-*`) y nunca entre redes. Las tres comparaciones dan veredicto `improved` y `warnings` vacío. Todas son mobile, con 3 ejecuciones por reporte y la misma URL (`http://127.0.0.1:4173/`).

| Red     | Veredicto  | Score          | LCP                           | FCP                          | TBT                       | CLS                     | SI                           |
| ------- | ---------- | -------------- | ----------------------------- | ---------------------------- | ------------------------- | ----------------------- | ---------------------------- |
| default | `improved` | 47 → 99 (+52)  | `improved`: 40 954 → 2 104 ms | `improved`: 2 498 → 1 410 ms | `improved`: 1 133 → 13 ms | `unchanged` (ver abajo) | `improved`: 2 498 → 1 410 ms |
| 3g      | `improved` | 49 → 86 (+37)  | `improved`: 90 753 → 3 904 ms | `improved`: 4 600 → 2 162 ms | `unchanged` (ver abajo)   | `improved`: 0,291 → 0   | `improved`: 4 600 → 2 162 ms |
| 4g      | `improved` | 37 → 100 (+63) | `improved`: 7 163 → 963 ms    | `improved`: 1 096 → 860 ms   | `improved`: 1 304 → 9 ms  | `improved`: 0,291 → 0   | `improved`: 1 096 → 860 ms   |

En ninguna red hay regresiones. TTFB es `unchanged` en las tres, como era de esperar si no se tocó el servidor.

### Lo que cuentan las tres redes

- **El hallazgo principal es `3g`.** Mejora muchísimo, pero el LCP pasa de `poor` a `needs-improvement` (3 904 ms), no a `good`. El FCP también acaba en `needs-improvement` (2 162 ms), y el score se queda en 86 frente a 99 y 100 en las otras redes.
- **TTFB en 3g** vale 1 202 ms antes y después, con rating `needs-improvement`. El cambio no lo toca, así que ahí hay un suelo que el arreglo no mueve.
- **`default`** acaba con score 99 y el LCP en `good`.
- **`4g`** acaba con score 100.

### Detalle por red

#### default (`antes-2` → `despues-2`)

- **Reportes:** `2026-10-22T19-09-38Z-mobile` → `2026-10-22T19-11-22Z-mobile`, ambos con commit `b10171f` (sin `dirty`). Aquí hay dos reportes de "antes" y dos de "después" (ver más abajo), y tomé el último de cada lado.
- **Métricas `improved`:**

  | Métrica | Antes     | Después  | Δ                    | Rating                   |
  | ------- | --------- | -------- | -------------------- | ------------------------ |
  | LCP     | 40 954 ms | 2 104 ms | −38 850 ms (−94,9 %) | poor → good              |
  | FCP     | 2 498 ms  | 1 410 ms | −1 088 ms (−43,6 %)  | needs-improvement → good |
  | TBT     | 1 133 ms  | 13 ms    | −1 120 ms (−98,9 %)  | poor → good              |
  | SI      | 2 498 ms  | 1 410 ms | −1 088 ms (−43,6 %)  | good → good              |

- **Ruido (`unchanged`):**
  - **CLS:** 0,291 → 0. El delta supera el umbral (0,02), pero `rangesOverlap` es `true`. El rango de "antes" es 0–0,291, así que una de sus 3 ejecuciones ya salió con CLS 0. Con 3 ejecuciones por lado la confianza es limitada. Que el CLS sea `unchanged` aquí no significa que el problema siguiera: en "después" las 3 ejecuciones dan 0.
  - **TTFB:** 752 → 752 ms.
- **Elemento LCP:** `lcpElement.changed` es `false`. Es el mismo elemento, `body > main > section.hero > img.hero-img`.

#### 3g (`antes-3g` → `despues-3g`)

- **Reportes:** `2026-10-22T19-10-05Z-mobile-3g` → `2026-10-22T19-11-47Z-mobile-3g`. Solo hay un reporte por lado en esta red.
- **Métricas `improved`:**

  | Métrica | Antes     | Después  | Δ                    | Rating                   |
  | ------- | --------- | -------- | -------------------- | ------------------------ |
  | LCP     | 90 753 ms | 3 904 ms | −86 849 ms (−95,7 %) | poor → needs-improvement |
  | FCP     | 4 600 ms  | 2 162 ms | −2 438 ms (−53,0 %)  | poor → needs-improvement |
  | SI      | 4 600 ms  | 2 162 ms | −2 438 ms (−53,0 %)  | needs-improvement → good |
  | CLS     | 0,291     | 0        | −0,291               | poor → good              |

- **Ruido (`unchanged`):**
  - **TBT:** 45 → 13 ms. El delta (−32 ms) no supera el umbral de 50 ms, y el rating es `good` antes y después. No lo cuento como mejora.
  - **TTFB:** 1 202 → 1 202 ms.
- **Elemento LCP:** `changed: false`, el mismo `img.hero-img`.

#### 4g (`antes-4g` → `despues-4g`)

- **Reportes:** `2026-10-22T19-10-31Z-mobile-4g` → `2026-10-22T19-12-12Z-mobile-4g`. Solo hay un reporte por lado en esta red.
- **Métricas `improved`:**

  | Métrica | Antes    | Después | Δ                   | Rating      |
  | ------- | -------- | ------- | ------------------- | ----------- |
  | LCP     | 7 163 ms | 963 ms  | −6 200 ms (−86,6 %) | poor → good |
  | FCP     | 1 096 ms | 860 ms  | −236 ms (−21,5 %)   | good → good |
  | TBT     | 1 304 ms | 9 ms    | −1 295 ms (−99,3 %) | poor → good |
  | CLS     | 0,291    | 0       | −0,291              | poor → good |
  | SI      | 1 096 ms | 860 ms  | −236 ms (−21,5 %)   | good → good |

- **Ruido (`unchanged`):** TTFB, 422 → 421 ms.
- **Elemento LCP:** `changed: false`.

### Oportunidades (por causa raíz)

En las tres redes se resuelven las mismas causas:

- **Bloqueo de render:** `render-blocking-insight` está `resolved`. Su ahorro era de 1 550 ms en default, 3 050 ms en 3g y 600 ms en 4g.
- **JavaScript sin usar:** `unused-javascript` está `resolved` (−120 895 B, unos 118 KiB). En default quitaba 1 050 ms, en 3g 0 ms y en 4g 160 ms.
- **Fuentes:** `font-display-insight` está `resolved` (300 ms en las tres).
- **CLS por imágenes sin dimensiones:** `unsized-images` y `cls-culprits-insight` están `resolved` (sin ahorro medido, el problema desapareció).
- **Descubrimiento del LCP y peso total:** `lcp-discovery-insight` y `total-byte-weight` están `resolved`.
- **Imágenes:** `image-delivery-insight` está `better` en las tres redes. Pasa de 32 900 → 150 ms en default, de 81 500 → 300 ms en 3g y de 5 000 → 50 ms en 4g. El ahorro en bytes baja 7 607 813 B (unos 7,26 MiB) en las tres.
- **Sin cambio:** `network-dependency-tree-insight`.

Hay diferencias entre redes:

- **`bootup-time`** está `better` en default (−350 ms) y en 4g (−1 250 ms), pero `same` en 3g (−50 ms, por debajo de su umbral de 100 ms). Es coherente con el TBT `unchanged` de 3g.
- **`mainthread-work-breakdown`** aparece como `new` con ahorro 0 en default y 4g. Es un cambio de estado sin ahorro, no una regresión.

### Recursos

Los recursos son idénticos entre redes porque es el mismo contenido:

| Recurso         | Antes                  | Después              |
| --------------- | ---------------------- | -------------------- |
| Total           | 8 699 207 B (8,30 MiB) | 906 437 B (0,86 MiB) |
| Imágenes        | 8 492 779 B            | 867 692 B            |
| Scripts         | 169 118 B              | 1 507 B              |
| Hojas de estilo | 955 B                  | 0 B                  |
| Documento       | 1 455 B                | 2 338 B              |
| Fuentes         | 34 900 B               | 34 900 B             |

### Causas probables (hipótesis)

**Git no sirve para atribuir la diferencia.** Todos los reportes (`antes-*` y `despues-*`) tienen el mismo commit, `b10171f`, con `dirty: false`, y es el commit actual. `git log b10171f..HEAD` está vacío. Los reportes sí muestran que el sitio servido en `:4173` cambió entre las medidas sin que haya un commit de por medio. Esto es medición, sacada de los `items[]` de los reportes (fuente: fichero):

- **Imágenes:** el LCP era `img/hero.jpg` (3 003 499 B) y las 6 imágenes de cafés pesaban entre 909 640 y 919 938 B cada una. Después, el LCP es `img/hero-960.jpg` y los cafés son variantes `*-960.jpg` de unos 133 000 B (hero-960: 65 506 B).
- **Elemento `<img>` del hero:** antes no tenía `width`, `height`, `srcset` ni `fetchpriority`. Después tiene `srcset`, `sizes="100vw"`, `width="1600"`, `height="1000"` y `fetchpriority="high"`.
- **Scripts y estilos:** `vendor/three.min.js` (168 137 B, bloqueante y casi todo sin usar) ya no aparece. `css/styles.css` tampoco (stylesheet 955 → 0 B) y el documento crece 883 B.

La explicación es una hipótesis. Cuadra con que se hayan creado imágenes responsivas, se haya añadido `fetchpriority` y dimensiones, se haya quitado la librería y se haya metido el CSS en el HTML. No he visto el código, así que no puedo confirmarlo. Si quieres comprobarlo, mira qué carpeta se sirvió en cada medición, o revierte el cambio y vuelve a auditar.

**La tabla de `default` depende de qué reportes empareje.** Hay dos reportes de cada lado, y las cuatro parejas posibles dan `improved`. LCP, FCP, TBT y SI son `improved` en las cuatro, pero el CLS no:

- Con `antes-1` (CLS 0,291 en las 3 ejecuciones) el CLS es `improved`.
- Con `antes-2` es `unchanged`, por el solapamiento de rangos explicado arriba.

### Fiabilidad y caveats

- **Los dos "antes" de default no son iguales entre sí.** `antes-1` → `antes-2` (mismo código) sale `unchanged` en todas las métricas. Pero su TBT va de 608 a 1 133 ms (rango de `antes-2`: 392–1 873 ms) y el score de 41 a 47. Ese +6 de score el CLI lo marca como `improved` (umbral 5), aunque las métricas no se muevan. Es ruido de medición que no debes leer como mejora: la variación entre ejecuciones de "antes" es grande, sobre todo en TBT.
- **Los dos "después" de default son estables.** `despues-1` → `despues-2` es `unchanged` en todo, con score 99 en ambos.
- **En 3g y 4g solo hay una medida por lado.** Sus rangos min–max salen de 3 ejecuciones, pero no sé cuánta variación hay entre reportes. El salto es enorme y no hay solapamiento en las métricas `improved`, así que la conclusión es sólida, pero no tengo una segunda medida para confirmarla.

### Siguiente paso

¿Confirmas que el cambio entre "antes" y "después" es el que esperabas (imágenes responsivas, quitar `three.min.js`, CSS inline)? Si 3g te importa, queda margen: el LCP sigue en `needs-improvement` (3 904 ms). Para atacarlo, `perf-fix` puede aplicar los arreglos uno a uno y medir cada uno con `wperf compare`.
