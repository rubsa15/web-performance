## Evolución de `http://127.0.0.1:4173/` (mobile, red `default`)

**Resumen.** Hay 4 reportes de este perfil (`mobile` + `default`, 3 ejecuciones cada uno), del `2026-10-22T19-09-11Z-mobile` al `2026-10-22T19-11-22Z-mobile`. Ocurrió un cambio real y grande: entre `19-09-38Z` y `19-10-57Z` el score pasa de 47 a 99 y el LCP de 40 954 ms a 2 104 ms. Antes de ese cambio el rendimiento era malo y estable (con un ruido grande en el TBT y el CLS). Después es bueno y estable. Los 4 reportes tienen el mismo commit (`b10171f`, `dirty: false`) y `warnings` vacío. **Git no explica el cambio**: el sitio que se auditó fue otro entre medidas (ver hipótesis).

### Serie (`wperf history`, un perfil)

| Reporte (etiqueta)        | Score | LCP       | TBT      | CLS   | Frente al anterior (`vsPrevious`)                                         |
| ------------------------- | ----- | --------- | -------- | ----- | ------------------------------------------------------------------------- |
| `19-09-11Z` (`antes-1`)   | 41    | 40 730 ms | 608 ms   | 0,291 | primero de la serie                                                       |
| `19-09-38Z` (`antes-2`)   | 47    | 40 954 ms | 1 133 ms | 0,291 | score `improved` (+6); todas las métricas `unchanged`                     |
| `19-10-57Z` (`despues-1`) | 99    | 2 104 ms  | 19 ms    | 0     | **`improved`**: score +52; LCP, FCP, TBT y SI `improved`; CLS `unchanged` |
| `19-11-22Z` (`despues-2`) | 99    | 2 104 ms  | 13 ms    | 0     | `unchanged`                                                               |

Los saltos son las entradas con algo distinto de `unchanged` en `vsPrevious`. Hay dos: `19-09-38Z` (solo el score) y `19-10-57Z` (el real). `19-11-22Z` es ruido.

### Salto 1: `19-09-11Z` → `19-09-38Z` (casi seguro ruido)

`wperf compare` da `improved`, pero solo por el score: 41 → 47 (+6, `threshold` 5). Ninguna métrica se mueve según el CLI.

| Métrica | Antes     | Después   | Δ       | `threshold` | Resultado                                                                                        |
| ------- | --------- | --------- | ------- | ----------- | ------------------------------------------------------------------------------------------------ |
| LCP     | 40 730 ms | 40 954 ms | +224 ms | 4 073 ms    | `unchanged` (delta bajo el umbral; `rangeAfter` 40 728–43 504 ms)                                |
| FCP     | 2 498 ms  | 2 498 ms  | 0 ms    | 249,8 ms    | `unchanged`                                                                                      |
| TBT     | 608 ms    | 1 133 ms  | +525 ms | 304 ms      | `unchanged`: supera el umbral, pero `rangesOverlap` es `true` (574–661 ms frente a 392–1 873 ms) |
| CLS     | 0,291     | 0,291     | 0       | 0,02        | `unchanged` (`rangeAfter` 0–0,291: alguna ejecución no repitió el problema)                      |
| SI      | 2 498 ms  | 2 498 ms  | 0 ms    | 249,8 ms    | `unchanged`                                                                                      |
| TTFB    | 753 ms    | 752 ms    | −1 ms   | 150,6 ms    | `unchanged`                                                                                      |

- La página es la misma. Los `resources` no cambian: total 8 699 207 B en ambos, 0 de delta en todos los tipos.
- El elemento LCP es el mismo (`lcpElement.changed` = `false`: `body > main > section.hero > img.hero-img`).
- Oportunidades: `mainthread-work-breakdown` pasa a `resolved` (−600 ms de ahorro estimado). El resto son `same`, incluida `bootup-time` (−250 ms, `threshold` 300 ms).
- Conclusión: el CLI marca el score como `improved`, pero ninguna métrica ni recurso cambió. Lo leo como variación entre ejecuciones (con 3 ejecuciones por lado, la confianza es limitada). No lo cuento como una mejora de la página.

### Salto 2: `19-09-38Z` → `19-10-57Z` (el cambio real)

`wperf compare` da **`improved`**: score 47 → 99 (+52, `threshold` 5).

| Métrica | Antes     | Después  | Δ          | `deltaPct` | Rating                   | `threshold` | Resultado       |
| ------- | --------- | -------- | ---------- | ---------- | ------------------------ | ----------- | --------------- |
| LCP     | 40 954 ms | 2 104 ms | −38 850 ms | −94,9 %    | poor → good              | 4 095,4 ms  | `improved`      |
| FCP     | 2 498 ms  | 1 412 ms | −1 086 ms  | −43,5 %    | needs-improvement → good | 249,8 ms    | `improved`      |
| TBT     | 1 133 ms  | 19 ms    | −1 114 ms  | −98,3 %    | poor → good              | 566,5 ms    | `improved`      |
| SI      | 2 498 ms  | 1 412 ms | −1 086 ms  | −43,5 %    | good → good              | 249,8 ms    | `improved`      |
| CLS     | 0,291     | 0        | −0,291     | −100 %     | poor → good              | 0,02        | **`unchanged`** |
| TTFB    | 752 ms    | 752 ms   | 0 ms       | 0 %        | good → good              | 150,4 ms    | `unchanged`     |

- **Mejoras (`improved`):** LCP, FCP, TBT y SI. Sus rangos min–max no se solapan (LCP: 40 728–43 504 ms antes, 2 103–2 105 ms después).
- **Ruido (`unchanged`) en el CLS, aunque pase de 0,291 a 0:** el delta supera el `threshold` (0,02), pero `rangesOverlap` es `true`. El "antes" tenía `rangeBefore` 0–0,291, es decir, una de las tres ejecuciones de `19-09-38Z` ya midió 0. El CLS sí se ve resuelto al comparar los extremos (ver abajo). Aquí respeto la clasificación del CLI.
- **Ruido (`unchanged`) en el TTFB:** 752 ms antes y después.
- **Elemento LCP:** `lcpElement.changed` es `false`, el mismo `img.hero-img`. El salto de la métrica sí es comparable. Pero el elemento cargó otra imagen: `img/hero.jpg` (3 003 499 B) antes y `img/hero-960.jpg` (65 506 B) después (fuente: fichero, `lcp.element.url` de cada reporte).

**Oportunidades:**

| Estado     | Oportunidades                                | Cifras                                                                  |
| ---------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| `resolved` | `render-blocking-insight`                    | −1 550 ms                                                               |
| `resolved` | `unused-javascript`                          | −1 050 ms, −120 895 B                                                   |
| `resolved` | `font-display-insight`                       | −300 ms                                                                 |
| `resolved` | `cls-culprits-insight`, `unsized-images`     | sin cifra de ahorro (ahorro 0)                                          |
| `resolved` | `lcp-discovery-insight`, `total-byte-weight` | sin cifra de ahorro (ahorro 0)                                          |
| `better`   | `image-delivery-insight`                     | 32 900 ms → 150 ms (−32 750 ms); 8 154 587 B → 546 774 B (−7 607 813 B) |
| `better`   | `bootup-time`                                | −350 ms                                                                 |
| `new`      | `mainthread-work-breakdown`                  | ahorro 0                                                                |
| `same`     | `network-dependency-tree-insight`            | sin cambio                                                              |

En causas raíz, `cls-culprits-insight` y `unsized-images` resueltas apuntan a que el problema de CLS desapareció. Las imágenes sin optimizar eran la causa dominante del LCP. Quitar el script y la hoja de estilos bloqueantes explica el FCP y el SI.

**Recursos (bytes exactos del JSON):**

| Tipo       | Antes     | Después | Δ          |
| ---------- | --------- | ------- | ---------- |
| total      | 8 699 207 | 906 437 | −7 792 770 |
| image      | 8 492 779 | 867 692 | −7 625 087 |
| script     | 169 118   | 1 507   | −167 611   |
| stylesheet | 955       | 0       | −955       |
| document   | 1 455     | 2 338   | +883       |
| font       | 34 900    | 34 900  | 0          |

En prosa: el peso total baja de 8,30 MiB a 885 KiB, y las imágenes de 8,10 MiB a 847 KiB.

**Evidencia en los `items[]` de los reportes** (medición, fuente: fichero):

- Antes, `render-blocking-insight` listaba `/vendor/three.min.js` (168 137 B), `/js/app.js` y `/css/styles.css`. Después ya no hay ninguna oportunidad de este tipo, y `/vendor/three.min.js` no aparece en `unused-javascript`, que también se resuelve.
- Antes, las imágenes eran `/img/hero.jpg` (3 003 499 B) y `/img/cafe-N.jpg` (de 909 640 a 919 938 B cada una). Después son `/img/hero-960.jpg` (65 506 B) y `/img/cafe-N-960.jpg` (de 132 684 a 134 358 B cada una).
- El LCP después trae `srcset`, `width`/`height` y `fetchpriority="high"` (snippet del reporte). El desglose del LCP baja: `loadDuration` 440 → 314 ms y `renderDelay` 100 → 25 ms. Es el desglose de la carga real, no suma el LCP simulado.
- **Dato que parece contradictorio, sin reclasificar:** `bootup-time` es `better`, pero el `cpuMs` de `/js/app.js` pasa de 1 398 a 2 298 ms entre los dos reportes. La `representativeRun` también difiere (3 frente a 1), así que los `items[]` salen de ejecuciones distintas. Lo presento como dato medido; es una hipótesis que el trabajo de `app.js` cambiara de forma o de distribución entre ejecuciones.

### ¿Deriva lenta? (comparación de extremos y del tramo final)

| Comparación                               | Veredicto   | Score         | Notas                                                                                                                                                          |
| ----------------------------------------- | ----------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extremos (`19-09-11Z` → `19-11-22Z`)      | `improved`  | 41 → 99 (+58) | LCP 40 730 → 2 104 ms, FCP 2 498 → 1 410 ms, TBT 608 → 13 ms, CLS 0,291 → 0 (aquí sí `improved`, sin solape de rangos), SI 2 498 → 1 410 ms. TTFB `unchanged`. |
| Tras el salto (`19-10-57Z` → `19-11-22Z`) | `unchanged` | 99 → 99       | Todas las métricas `unchanged`.                                                                                                                                |

Los extremos mejoran de forma consistente con el salto 2. Desde ese salto, todo es `unchanged`, así que la página no ha seguido cambiando. No hay deriva lenta.

### ¿Cuándo cambió y a qué se debe?

- **Cuándo.** Entre los reportes `2026-10-22T19-09-38Z-mobile` y `2026-10-22T19-10-57Z-mobile`, con 1 min 19 s entre ambos (fuente: cálculo). Antes, el rendimiento era malo y estable; después, bueno y estable. El único "salto" anterior (`19-09-38Z`, solo score) es variación entre ejecuciones.
- **Qué cambió (medido).** Imágenes hasta 7,6 MB más ligeras y servidas con `srcset`/tamaño explícito; desaparece el script (`three.min.js`) y la hoja de estilos bloqueantes; desaparece el CLS y bajan el LCP y el TBT.
- **A qué se debe: git no lo explica.** Ambos reportes tienen el commit `b10171f` y `dirty: false`; `git log b10171f..b10171f` está vacío. El commit existe en el repo (`chore(demo): quitar de app.js las pistas sobre los problemas intencionados`) y `git status` solo muestra `.perf/` sin seguir. No hay ningún commit candidato entre las dos medidas.
- **Hipótesis (no confirmadas).**
  1. Lo más probable es que lo servido en `127.0.0.1:4173` fuera otra versión del sitio entre medidas: hubo una versión con imágenes grandes, script y CSS bloqueantes, y después una versión con imágenes redimensionadas, `srcset` y sin esos recursos. Apoyan esto que el commit sea idéntico con árbol limpio y que los `items[]` muestren ficheros distintos (`hero-960.jpg`, `cafe-N-960.jpg`). Contra esto no hay nada medido.
  2. Alternativamente, se sirvió una copia o directorio distinto en el mismo puerto.

  Ninguna de las dos aparece en git: el contenido servido no estaba en el árbol de ese commit.

- **Cómo confirmarlo.** Preguntar qué se sirvió en el puerto 4173 en cada momento, o volver a servir cada versión y auditarla con `wperf audit`. No he lanzado auditorías nuevas ni leído el código de la web.

### Fiabilidad

- Cada reporte tiene 3 ejecuciones, así que los rangos dan una confianza limitada.
- `warnings` está vacío en todas las comparaciones, pero eso solo cubre lo formal. El tamaño de los cambios con el mismo commit es justo la señal que obliga a sospechar de un cambio de contenido.
- Todos son `mobile` y `default`, con Lighthouse 13.5.0, Chrome 155 y `throttling: simulate` (fuente: fichero). Los reportes `3g` y `4g` guardados no se han usado, porque no se comparan entre perfiles.

### Cierre

- **Base de referencia.** Si el cambio fue intencionado, cualquier reporte posterior al salto (`19-10-57Z` o `19-11-22Z`) es una referencia sensata para futuras comparaciones. Los dos reportes `antes-*` miden una base degradada. Comparar contra ellos exagera cualquier mejora.
- **`perf-fix`.** No hay regresión real que arreglar en el código, así que no lo ofrezco.
- **Pregunta.** ¿Confirmas que el sitio servido cambió entre `19-09-38Z` y `19-10-57Z` (por ejemplo, que se aplicaron las optimizaciones de imágenes, el script y el CSS), o quieres que investigue otra causa?
