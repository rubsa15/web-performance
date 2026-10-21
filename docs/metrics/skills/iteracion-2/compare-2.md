# Comparación: demo v0, 19:41:55Z vs 19:42:38Z (misma URL)

> Comando: `npx wperf compare .perf/reports/127.0.0.1-4173/2026-10-21T19-41-55Z-mobile.json .perf/reports/127.0.0.1-4173/2026-10-21T19-42-38Z-mobile.json --format json` (código de salida 0). Cifras del JSON de `wperf compare`, salvo las marcadas `(fuente: ...)`.

## Aviso de fiabilidad (leer primero)

- `warnings` del CLI vacío: misma URL (http://127.0.0.1:4173/), device `mobile`, red `default`, 3 ejecuciones por lado, misma etiqueta `demo v0` en ambos. Por eso se identifican por `id`.
- **Mismo commit `3bbc3a2` con `dirty: true` en ambos.** Git no puede explicar la diferencia: ningún commit separa ambas auditorías, y el árbol de trabajo "sucio" cambió entre medidas.
- **Que `warnings` esté vacío no garantiza que se haya medido el mismo contenido, y aquí hay evidencia de que no.** Los recursos cambian a nivel de fichero entre ambas mediciones (ver "Recursos" y "Causas"). Es una "regresión" provocada por un cambio en el sitio entre medidas, no por un commit.
- Confianza limitada: solo 3 ejecuciones por lado.

## 1. Veredicto

|         | Antes                                    | Después                                  |
| ------- | ---------------------------------------- | ---------------------------------------- |
| Reporte | `2026-10-21T19-41-55Z-mobile`, 19:41:55Z | `2026-10-21T19-42-38Z-mobile`, 19:42:38Z |
| Score   | 57                                       | 41                                       |

**Veredicto del CLI: `regressed`.** Score 57 → 41 (delta -16, `change`: `regressed`). Separadas por unos 43 segundos (fuente: cálculo a partir de los `createdAt`).

## 2. Métricas

### Regresiones (`regressed`)

| Métrica | Antes    | Después  | Delta   | %        | Rating                                |
| ------- | -------- | -------- | ------- | -------- | ------------------------------------- |
| FCP     | 1 804 ms | 2 495 ms | +691 ms | +38,3 %  | needs-improvement → needs-improvement |
| TBT     | 171 ms   | 641 ms   | +470 ms | +274,9 % | good → poor                           |
| SI      | 1 804 ms | 2 495 ms | +691 ms | +38,3 %  | good → good                           |

### Mejoras (`improved`)

Ninguna.

### Sin cambio / ruido (`unchanged`)

| Métrica | Antes     | Después   | Delta            | Rating      |
| ------- | --------- | --------- | ---------------- | ----------- |
| LCP     | 39 754 ms | 40 728 ms | +974 ms (+2,5 %) | poor → poor |
| CLS     | 0,291     | 0,291     | 0                | poor → poor |
| TTFB    | 752 ms    | 752 ms    | 0                | good → good |

El LCP sube 974 ms pero el CLI lo marca `unchanged`, así que no es una regresión: en este umbral la métrica solo cambia si supera el mayor entre 150 ms y el 10 % del valor base (SPEC §6), que aquí sería unos 3 975 ms (fuente: cálculo). Lleva en torno a 40 s en ambos casos (rating `poor`), dominado por las imágenes (ver oportunidades).

Rangos min-max de los reportes (fuente: fichero), que respaldan las regresiones:

| Métrica  | Antes (min-max)    | Después (min-max)  |
| -------- | ------------------ | ------------------ |
| FCP / SI | 1 804 - 1 806 ms   | 2 494 - 2 496 ms   |
| TBT      | 162 - 187 ms       | 470 - 647 ms       |
| LCP      | 39 754 - 39 756 ms | 40 728 - 40 728 ms |

FCP y TBT no se solapan; el LCP tampoco, pero queda por debajo del umbral, por lo que el CLI lo deja como ruido. SI y FCP tienen valores idénticos; no son dos regresiones independientes. Con 3 ejecuciones la confianza es limitada.

## 3. Oportunidades

**Nuevas (`new`)**

| Oportunidad                 | Ahorro                        |
| --------------------------- | ----------------------------- |
| `unused-javascript`         | 1 050 ms, 118 KiB (120 895 B) |
| `bootup-time`               | 650 ms                        |
| `mainthread-work-breakdown` | 650 ms                        |

**Peores (`worse`)**

| Oportunidad               | Antes  | Después  | Delta   |
| ------------------------- | ------ | -------- | ------- |
| `render-blocking-insight` | 850 ms | 1 550 ms | +700 ms |

**Iguales (`same`)**: `image-delivery-insight` (32 700 → 32 900 ms, +200 ms, 7,78 MiB en ambos: bajo el umbral, no cuenta), `font-display-insight` (300 ms), `cls-culprits-insight`, `lcp-discovery-insight`, `network-dependency-tree-insight`, `total-byte-weight`, `unsized-images`.

Lectura por causa raíz:

- **JS sin usar / bloqueante**: `unused-javascript` aparece, y `render-blocking-insight` empeora.
- **Hilo principal (TBT)**: `bootup-time` y `mainthread-work-breakdown` aparecen con el mismo ahorro de 650 ms; es un único problema, no dos. Encaja con TBT 171 → 641 ms.
- **Imágenes y CLS**: sin cambios (`same`). Es coherente con CLS y LCP `unchanged`.

## 4. Recursos

| Tipo                           | Antes                  | Después                | Delta                 |
| ------------------------------ | ---------------------- | ---------------------- | --------------------- |
| Total                          | 8,16 MiB (8 557 460 B) | 8,30 MiB (8 699 348 B) | +139 KiB (+141 888 B) |
| Scripts                        | 27 KiB (27 370 B)      | 165 KiB (169 259 B)    | +139 KiB (+141 889 B) |
| Imágenes, fuentes, stylesheets | sin cambio             | sin cambio             | 0                     |
| Documento                      | 1 KiB                  | 1 KiB                  | -1 B                  |

Todo el aumento de peso son scripts (+141 889 B), que explica casi por sí solo el cambio de peso total (+141 888 B).

## 5. Causas probables

**Git no ayuda** (mismo commit, `dirty: true` en ambos). Y `git diff` del árbol actual no sirve: refleja el estado de ahora, no el de cada auditoría. La evidencia más sólida está en los `items[]` de los propios reportes (fuente: fichero), que es **medición**:

| Oportunidad               | Antes (19-41-55Z)                                                                                                      | Después (19-42-38Z)                                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `render-blocking-insight` | `/vendor/lodash.min.js` (903 ms, 26 319 B = 26 KiB); `/js/app.js` (603 ms, 1 051 B); `/css/styles.css` (453 ms, 955 B) | `/vendor/three.min.js` (1 502 ms, 168 137 B = 164 KiB); `/js/app.js` (602 ms, 1 122 B); `/css/styles.css` (452 ms, 955 B) |
| `unused-javascript`       | no aparece                                                                                                             | `/vendor/three.min.js`: 120 895 B sin usar de 167 861 B                                                                   |
| `total-byte-weight`       | incluye `/vendor/lodash.min.js` 26 319 B                                                                               | incluye `/vendor/three.min.js` 168 137 B                                                                                  |
| `bootup-time`             | no es oportunidad (diagnóstico "0.5 s")                                                                                | oportunidad de 650 ms; `app.js` 1 650 ms de CPU, `three.min.js` 91 ms                                                     |

Además `app.js` pasó de 1 051 a 1 122 B (+71 B, fuente: cálculo), así que también cambió.

**Hipótesis** (la explicación, no la medición):

1. **Se sustituyó `lodash.min.js` (26 KiB) por `three.min.js` (164 KiB) en `<head>`, de forma síncrona.** Lo apoya: es el recurso que cambia en `render-blocking-insight` y en `total-byte-weight`, el peso de scripts sube +141 889 B, y `three.min.js` aparece como JS sin usar. Eso explicaría FCP/SI +691 ms (más bloqueo de render, `render-blocking-insight` +700 ms) y parte del TBT (parse y ejecución de un script grande).
2. **Cambio en `app.js`** (1 051 → 1 122 B), posible contribuyente al TBT (`app.js` 1 650 ms de CPU en el "después"). No hay `items[]` de `bootup-time` del "antes" para comparar, así que no puedo afirmar cuánto aporta cada script al salto de TBT.

No hay commit al que culpar: el sitio cambió entre auditorías sin commit. En ningún reporte hay datos de qué se modificó en `index.html`.

Cómo confirmarlo: restaurar `lodash.min.js` en lugar de `three.min.js` (o quitar `three.min.js`) y re-auditar con `wperf audit` + `wperf compare`; probar `app.js` anterior de forma aislada si existe copia.

## Cierre

- **Cambio de línea base, no regresión de código del repo**: el sitio cambió entre medidas sin commit. No hay nada que arreglar con `perf-fix` a partir de esta comparación, y no ofrezco `perf-fix`.
- **Referencia sensata**: `wperf history http://127.0.0.1:4173/` muestra la serie (fuente: salida de `wperf history`):

  | Reporte     | Score | LCP       | TBT    | Commit   |
  | ----------- | ----- | --------- | ------ | -------- |
  | `19-40-34Z` | 74    | 47 029 ms | 29 ms  | 3bbc3a2* |
  | `19-41-55Z` | 57    | 39 754 ms | 171 ms | 3bbc3a2* |
  | `19-42-38Z` | 41    | 40 728 ms | 641 ms | 3bbc3a2* |

  En `19-40-34Z` el script era `/vendor/lodash.js`, otra versión (fuente: fichero). Los tres reportes llevan la misma etiqueta `demo v0`, pero **son tres versiones distintas del sitio**. Cualquier comparación contra `19-42-38Z` (por ejemplo la de demo corregida frente a ese reporte) mide frente a una base ya degradada: la mejora de score 41 → 99 incluye lo recuperado de esa degradación, no solo los arreglos de la demo.

- ¿Confirmas que se cambió la librería JS entre medidas, o quieres que investigue otra causa?
