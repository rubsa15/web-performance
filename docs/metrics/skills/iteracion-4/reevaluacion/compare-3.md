## Resultado: sí, el cambio funcionó en las tres redes, pero no por igual

Veredicto del CLI: `improved` en `default`, `3g` y `4g`. Comparé cada red solo con su pareja (`antes-*` contra `despues-*`) y no mezclé cifras entre redes. Las auditorías son mobile, de 3 ejecuciones por lado, con el mismo Lighthouse y la misma URL (`http://127.0.0.1:4173/`). El campo `warnings` del CLI está vacío en las tres comparaciones.

| Red     | Score antes → después | Métricas que mejoran (`improved`) | Métricas sin cambio (`unchanged`, ruido) |
| ------- | --------------------- | --------------------------------- | ---------------------------------------- |
| default | 47 → 99 (+52)         | LCP, FCP, TBT, SI                 | CLS, TTFB                                |
| 3g      | 49 → 86 (+37)         | LCP, FCP, CLS, SI                 | TBT, TTFB                                |
| 4g      | 37 → 100 (+63)        | LCP, FCP, TBT, CLS, SI            | TTFB                                     |

Nada empeora en ninguna red. Los dos matices que importan:

- **3g es la red que sigue peor.** El LCP baja de 90 753 ms a 3 904 ms y pasa de `poor` a `needs-improvement`, no a `good`. El FCP también queda en `needs-improvement` (2 162 ms).
- **En `default` el CLS aparece como `unchanged`** aunque pasa de 0,291 a 0. No lo cuento como mejora (explicación en el detalle de `default`).

### Cómo de fiable es la comparación

- **Base de `default`.** Hay dos "antes" (`antes-1`, `antes-2`) y dos "después" (`despues-1`, `despues-2`). Comparé el último de cada lado: `antes-2` (`2026-10-22T19-09-38Z-mobile`) contra `despues-2` (`2026-10-22T19-11-22Z-mobile`). En `3g` y `4g` solo hay una pareja.
- **Ruido de la web en `default`.** `antes-1` frente a `antes-2` es la misma versión del sitio medida dos veces. El CLI da `improved` solo por el score (41 → 47, umbral 5), con todas las métricas `unchanged`. El TBT va de 608 ms a 1 133 ms, y el rango de `antes-2` es 392–1 873 ms. Es ruido, y por eso no leo como mejora ningún salto de TBT que no supere ese rango.
- **Los "después" de `default` son estables.** `despues-1` y `despues-2` no muestran cambio significativo entre sí: LCP de 2 104 ms en ambos y TBT de 19 ms y 13 ms.
- **Con 3 ejecuciones por lado**, los rangos min–max dan una confianza limitada.

### Detalle por red

#### default

| Métrica | Antes     | Después  | Δ                    | Cambio    | Rating                   |
| ------- | --------- | -------- | -------------------- | --------- | ------------------------ |
| LCP     | 40 954 ms | 2 104 ms | −38 850 ms (−94,9 %) | improved  | poor → good              |
| FCP     | 2 498 ms  | 1 410 ms | −1 088 ms (−43,6 %)  | improved  | needs-improvement → good |
| TBT     | 1 133 ms  | 13 ms    | −1 120 ms (−98,9 %)  | improved  | poor → good              |
| SI      | 2 498 ms  | 1 410 ms | −1 088 ms (−43,6 %)  | improved  | good → good              |
| CLS     | 0,291     | 0        | −0,291               | unchanged | poor → good              |
| TTFB    | 752 ms    | 752 ms   | 0                    | unchanged | good → good              |

- **LCP, FCP, SI y TBT** son mejoras claras. Los rangos de antes y después no se solapan: LCP 40 728–43 504 ms frente a 2 103–2 104 ms, y TBT 392–1 873 ms frente a 9–19 ms.
- **CLS (`unchanged`).** El delta (0,291) supera el `threshold` (0,02), pero `rangesOverlap` es `true`: `rangeBefore` es 0–0,291, es decir, una de las ejecuciones de "antes" ya dio 0. Con 3 ejecuciones el CLI no puede afirmar la mejora. En `3g` y `4g`, donde el "antes" dio 0,291 en las tres ejecuciones, sí sale `improved`.
- **TTFB** no cambia (`unchanged`, el servidor no se tocó).
- **Oportunidades resueltas:**
  - `render-blocking-insight` (−1 550 ms).
  - `unused-javascript` (−1 050 ms, −120 895 B ≈ 118 KiB).
  - `font-display-insight` (−300 ms).
  - `unsized-images`, `cls-culprits-insight`, `lcp-discovery-insight` y `total-byte-weight` (sin ahorro medido: el problema desapareció).
  - `unsized-images` y `cls-culprits-insight` resueltas son coherentes con que se corrigió el problema de CLS, aunque la métrica quede `unchanged` por el solape.
- **Oportunidades mejoradas:**
  - `image-delivery-insight` (−32 750 ms, −7 607 813 B ≈ 7,26 MiB). Aún marca un ahorro de 150 ms y 546 774 B.
  - `bootup-time` (−350 ms).
- **Sin cambio:** `network-dependency-tree-insight`.
- **Nueva:** `mainthread-work-breakdown`, con ahorro 0 (sin relevancia).

#### 3g

| Métrica | Antes     | Después  | Δ                    | Cambio    | Rating                                |
| ------- | --------- | -------- | -------------------- | --------- | ------------------------------------- |
| LCP     | 90 753 ms | 3 904 ms | −86 849 ms (−95,7 %) | improved  | poor → needs-improvement              |
| FCP     | 4 600 ms  | 2 162 ms | −2 438 ms (−53,0 %)  | improved  | poor → needs-improvement              |
| SI      | 4 600 ms  | 2 162 ms | −2 438 ms (−53,0 %)  | improved  | needs-improvement → good              |
| CLS     | 0,291     | 0        | −0,291               | improved  | poor → good                           |
| TBT     | 45 ms     | 13 ms    | −32 ms               | unchanged | good → good                           |
| TTFB    | 1 202 ms  | 1 202 ms | 0                    | unchanged | needs-improvement → needs-improvement |

- **TBT (`unchanged`).** El delta (−32 ms) no supera el `threshold` (50 ms). Además ya era `good` antes, así que no hay nada que mejorar.
- **TTFB** queda en `needs-improvement`. No cambió ni debía, y es lo que limita el FCP en esta red.
- **Oportunidades resueltas:**
  - `render-blocking-insight` (−3 050 ms, el mayor ahorro en esta red).
  - `font-display-insight` (−300 ms).
  - `unused-javascript` (−120 895 B, sin ahorro de tiempo).
  - Las mismas cuatro sin ahorro medido que en `default`.
- **Oportunidades mejoradas:** `image-delivery-insight` (−81 200 ms, −7 607 813 B). Aún marca 300 ms y 546 774 B.
- **Sin cambio:** `bootup-time` y `mainthread-work-breakdown` (−50 ms cada una, por debajo de su `threshold` de 100 ms), y `network-dependency-tree-insight`.

#### 4g

| Métrica | Antes    | Después | Δ                   | Cambio    | Rating      |
| ------- | -------- | ------- | ------------------- | --------- | ----------- |
| LCP     | 7 163 ms | 963 ms  | −6 200 ms (−86,6 %) | improved  | poor → good |
| FCP     | 1 096 ms | 860 ms  | −236 ms (−21,5 %)   | improved  | good → good |
| TBT     | 1 304 ms | 9 ms    | −1 295 ms (−99,3 %) | improved  | poor → good |
| SI      | 1 096 ms | 860 ms  | −236 ms (−21,5 %)   | improved  | good → good |
| CLS     | 0,291    | 0       | −0,291              | improved  | poor → good |
| TTFB    | 422 ms   | 421 ms  | −1 ms               | unchanged | good → good |

- **Oportunidades resueltas:**
  - `render-blocking-insight` (−600 ms).
  - `font-display-insight` (−300 ms).
  - `unused-javascript` (−160 ms, −120 895 B).
  - Las mismas cuatro sin ahorro medido que en `default`.
- **Oportunidades mejoradas:**
  - `image-delivery-insight` (−4 950 ms, −7 607 813 B ≈ 7,26 MiB). Aún marca 50 ms y 546 774 B.
  - `bootup-time` (−1 250 ms).
- **Sin cambio:** `network-dependency-tree-insight`.
- **Nueva:** `mainthread-work-breakdown`, con ahorro 0.

### Recursos y elemento LCP

Los `resources` son idénticos en las tres redes, así que se midió la misma versión del sitio en todas.

- **Total:** 8 699 207 B → 906 437 B (−7 792 770 B), de 8,30 MiB a 0,86 MiB.
- **Imágenes:** 8 492 779 B → 867 692 B.
- **Scripts:** 169 118 B → 1 507 B.
- **Hoja de estilos:** 955 B → 0.
- **Documento:** 1 455 B → 2 338 B.
- **Fuentes:** 34 900 B, sin cambio.
- **Elemento LCP:** `lcpElement.changed` es `false` en las tres redes. Es el mismo elemento (`section.hero > img.hero-img`), así que la caída del LCP es comparable con lo que se arregló.

### Causas probables (hipótesis)

**Git no explica la diferencia.** Los seis reportes tienen el mismo commit `b10171f` con `dirty: false`, así que no hay diferencia de commits que revisar. Y sin embargo el contenido servido cambió mucho, lo que indica que el sitio medido cambió entre las auditorías sin un commit entre medias. No señalo ningún commit culpable.

Lo que sí se ve en los propios reportes (`items[]` de las oportunidades) es _medición_:

- **Scripts.** En los "antes", `vendor/three.min.js` (168 137 B) aparece como bloqueante de render y con 120 895 B sin usar. En los "después" desaparece de ambas oportunidades. Es coherente con la caída de scripts (−167 611 B).
- **Imágenes.** Los "antes" sirven `img/cafe-N.jpg` de unos 910 000 B cada una (ejemplo: `cafe-2.jpg`, 919 938 B). Los "después" sirven `img/cafe-N-960.jpg` de unos 133 000 B (ejemplo: `cafe-2-960.jpg`, 134 069 B).

Las explicaciones siguientes son _hipótesis_:

- Se quitó `three.min.js`, o se dejó de cargar en la ruta crítica, lo que explicaría el bloqueo de render resuelto y el TBT.
- Se añadieron variantes de imagen más pequeñas (por ejemplo con `srcset`), lo que explicaría el LCP y los bytes.
- El CSS se incrustó en el HTML. Cuadra con que la hoja de estilos pase de 955 B a 0 mientras el documento crece 883 B.

Para confirmar cualquiera de ellas, hay que revisar qué directorio o versión del sitio se sirvió en cada medida. Si ese cambio está en el código, `git diff` sobre esos ficheros lo mostrará.

### Siguiente paso

¿Me confirmas que la versión "después" es la que esperabas (sin `three.min.js` y con imágenes reducidas)? Si quieres cerrar el hueco de la red `3g`, dime y lo investigo. En esa red, el LCP de 3 904 ms y el TTFB de 1 202 ms son lo que queda por encima de `good`.
