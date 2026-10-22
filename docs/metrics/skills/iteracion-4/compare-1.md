## Veredicto del CLI: `improved` en la puntuación, pero ninguna métrica cambió. Mi lectura es que no hay cambio medible

| Reporte | id                            | Etiqueta | Fecha                | Git                |
| ------- | ----------------------------- | -------- | -------------------- | ------------------ |
| Antes   | `2026-10-22T19-09-11Z-mobile` | antes-1  | 2026-10-22T19:09:11Z | `b10171f` (limpio) |
| Después | `2026-10-22T19-09-38Z-mobile` | antes-2  | 2026-10-22T19:09:38Z | `b10171f` (limpio) |

Puntuación: **41 → 47** (+6). El CLI la marca `improved` porque el umbral de la puntuación es 5 y el delta lo supera por 1.

**Fiabilidad de la comparación:**

- `warnings` está vacío.
- Misma URL (`http://127.0.0.1:4173/`), mismo dispositivo (mobile), misma red (`default`) y mismo commit, sin cambios sin commitear.
- Cada reporte tiene 3 ejecuciones. Los rangos min–max dan una confianza limitada.
- Es el caso que pedías: dos medidas seguidas sin tocar nada. Por eso cualquier diferencia debería ser ruido.

**Conclusión corta:** el único indicador que el CLI marca como mejora es la puntuación (+6, con umbral 5). Las 6 métricas son `unchanged`, y el contenido servido es idéntico byte a byte. No hay mejora real que atribuir a nada. Tomaría ese +6 como variación entre ejecuciones (hipótesis, ver más abajo).

### Métricas

Ninguna está `improved` ni `regressed`. Las seis son ruido según el CLI.

| Métrica | Antes     | Después   | Δ                 | Cambio    | Rating                                | Por qué es ruido                                                                                                             |
| ------- | --------- | --------- | ----------------- | --------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| LCP     | 40 730 ms | 40 954 ms | +224 ms           | unchanged | poor → poor                           | Δ por debajo del umbral (4 073 ms)                                                                                           |
| FCP     | 2 498 ms  | 2 498 ms  | 0 ms              | unchanged | needs-improvement → needs-improvement | Δ por debajo del umbral (249,8 ms)                                                                                           |
| TBT     | 608 ms    | 1 133 ms  | +525 ms (+86,3 %) | unchanged | poor → poor                           | Supera el umbral (304 ms), pero los rangos se solapan (antes 574–661 ms, después 392–1 873 ms)                               |
| CLS     | 0,291     | 0,291     | 0                 | unchanged | poor → poor                           | Δ por debajo del umbral (0,02); el rango "después" es 0–0,291, así que una de las 3 ejecuciones no repitió el desplazamiento |
| SI      | 2 498 ms  | 2 498 ms  | 0 ms              | unchanged | good → good                           | Δ por debajo del umbral (249,8 ms)                                                                                           |
| TTFB    | 753 ms    | 752 ms    | −1 ms             | unchanged | good → good                           | Δ por debajo del umbral (150,6 ms)                                                                                           |

Ojo con el TBT: +525 ms parece mucho (+86,3 %). No es una regresión según el CLI, porque su rango "después" (392–1 873 ms) engloba al "antes" (574–661 ms). Es la métrica más inestable de esta pareja.

### Oportunidades

- **Resuelta (según el CLI):** `mainthread-work-breakdown` (−600 ms). No es un arreglo real. Dependía de TBT, que no cambió, y el sitio es idéntico. Lo más probable es que su ahorro cayera por debajo del mínimo de reporte en la segunda medida (hipótesis).
- **Sin cambio (`same`):**
  - `image-delivery-insight`: −900 ms y −226 794 B, con umbral de 16 900 ms y 1 676 276 B. El número se mueve, pero está muy por debajo del umbral.
  - `bootup-time`: −250 ms con umbral 300 ms. Su impacto pasa de `high` a `medium` por el mismo ruido.
  - `render-blocking-insight`, `unused-javascript`, `font-display-insight`, `lcp-discovery-insight`, `network-dependency-tree-insight`, `cls-culprits-insight`, `unsized-images`, `total-byte-weight`: delta 0.
- No hay oportunidades `new` ni `worse`.

Lectura por causa raíz: los problemas siguen todos ahí (imágenes pesadas, JS sin usar, recursos que bloquean el render, fuentes, CLS). Ninguno apareció ni desapareció.

### Elemento LCP

`lcpElement.changed` es `false`. En ambos reportes el elemento LCP es `body > main > section.hero > img.hero-img`.

### Recursos

Idénticos en los dos reportes (delta 0 en todos los tipos):

- Total: 8 699 207 B (8,30 MiB).
- Imágenes: 8 492 779 B.
- Scripts: 169 118 B.
- Fuentes: 34 900 B.
- Documento: 1 455 B.
- CSS: 955 B.

Esto confirma que el sitio no cambió entre las dos medidas.

### Causas probables (hipótesis)

- **Git no ayuda:** ambos reportes están en el mismo commit `b10171f`, sin cambios sin commitear. No hay ningún commit al que atribuir la diferencia, y no lo invento.
- **Hipótesis (varianza de ejecución en Lighthouse):** la diferencia de +6 en la puntuación viene del ruido entre ejecuciones, sobre todo de TBT y CLS. Lo apoya que el rango de TBT "después" es muy ancho (392–1 873 ms) y que el de CLS "después" llega a 0 (0–0,291), es decir, una de las 3 ejecuciones no registró el desplazamiento. Ese solapamiento de rangos es justo lo que el CLI usa para descartar un cambio como ruido.
- **Evidencia medida que lo respalda:** los `items[]` de `bootup-time` solo varían ligeramente (`/js/app.js`: 1 620 ms → 1 398 ms de CPU; `three.min.js`: 101 → 88 ms) (fuente: fichero), con las mismas URLs en ambos lados. No aparece ni desaparece ningún recurso.
- **Cómo confirmarlo:** repetir la auditoría varias veces sobre esta misma versión del sitio. Si el score oscila alrededor de 41–47 sin tendencia, es ruido. Con 3 ejecuciones por lado, un salto de +6 puntos entre medidas idénticas es un aviso: la puntuación de esta página es poco estable.

### Siguiente paso

¿Confirmas que no tocaste nada entre `antes-1` y `antes-2`? Si es así, no hay regresión ni mejora que investigar, y no hace falta `perf-fix`. Esta pareja sirve como línea base de ruido: antes de dar por buena una mejora futura, exige que supere ese margen (para la puntuación, algo más que unos +6 puntos; para el TBT, rangos que no se solapen). Para otro "antes", `npx wperf history http://127.0.0.1:4173/` muestra la serie completa.
