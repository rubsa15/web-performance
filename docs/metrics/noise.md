# Experimento de ruido

Calibración de los umbrales de `wperf compare`. Se mide cuánto varía `wperf audit` al repetirlo sobre la **misma** página sin cambiarla: cualquier diferencia entre dos de esas auditorías es ruido, y `compare` no debería marcarla como cambio.

## Método

- Páginas: `demo/site` (con los 7 problemas) y `demo/site-fixed`, servidas con `npm run demo` / `npm run demo:fixed` (latencia de 300 ms en imágenes y fuentes).
- 10 auditorías seguidas de cada una, con los valores por defecto del CLI: mobile, 3 ejecuciones por auditoría, mediana (Lighthouse 13.5.0, Chrome 155, `throttling: simulate`, 2026-10-21, macOS, máquina sin otra carga pesada).
- Cada auditoría es un `Report` completo, guardado en `docs/metrics/noise/<página>/NN.json`.
- Con 10 auditorías hay 45 pares por página. Cada par se pasa por `compareReports`: todo lo que no sea `unchanged` es un falso positivo.
- Reproducir (con las dos demos en marcha en otro terminal): `npm run build`, luego `node dist/experiments/noise.js run http://127.0.0.1:4173/ docs/metrics/noise/demo-rota` (y `:4174` → `demo-arreglada`), y `node dist/experiments/noise.js analyze docs/metrics/noise/demo-rota docs/metrics/noise/demo-arreglada` para las tablas de abajo.

## Hallazgos

1. **Con la página arreglada el ruido es casi nulo.** Con `throttling: simulate` las métricas de red y de pintado salen casi idénticas: el LCP varía 1 ms, el FCP 6 ms y el TBT 11 ms entre las 10 medianas. Con los umbrales iniciales hay 0 falsos positivos de 45.
2. **Con la página rota, el TBT es la métrica ruidosa.** Las medianas van de 439 a 1105 ms y una ejecución suelta llegó a 2173 ms. El ruido es de cola larga (la mayoría de auditorías dan 440–620 ms y tres dan 900–1100 ms), así que el rango min–max de solo 3 ejecuciones no lo captura bien: con los umbrales iniciales, 18 de 45 pares se marcaban como cambio de TBT y 12 de 45 como cambio de puntuación.
3. **El criterio de rangos sí funciona donde el ruido es discreto.** El CLS de la rota es 0,291 en 9 auditorías y 0 en una (la carga de imágenes se adelantó al primer pintado en 2 de sus 3 ejecuciones): la mediana salta 0,291 puntos, unas 14 veces el umbral, pero ese reporte tiene rango 0–0,291 y la regla de rangos solapados lo deja en `unchanged` (0 de 45 pares marcados).
4. **El LCP de la demo rota (≈ 40 s) es un artefacto de la demo**, no de la herramienta: la imagen de 2,9 MiB sobre el 4G simulado. Su variación (hasta 2,8 s) es menor que el 10 % relativo y tampoco se marca.
5. **La lista de oportunidades basadas en CPU no es estable.** `mainthread-work-breakdown` aparece en 5 de 10 auditorías de la rota, `cls-culprits-insight` en 9 de 10 y el ahorro de `bootup-time` va de 400 a 1150 ms. Que una de ellas sea `new` o `resolved` entre dos reportes, por sí solo, no es evidencia de cambio. Las oportunidades de red (imágenes, bloqueo de render, fuentes, JS sin usar) son idénticas en las 10 auditorías.

## Búsqueda de umbrales

Con los 90 pares de arriba (45 por página) y los 100 cruces rota → arreglada (mejora real que `compare` debe detectar), se probaron variantes de los umbrales con el propio `compareReports`:

| Umbral TBT (abs, rel) | Falsos positivos / 90 | Detecta la mejora real rota → arreglada |
| --------------------- | --------------------: | --------------------------------------: |
| 50 ms, 15 % (inicial) |                    18 |                                 100/100 |
| 100 ms, 15 %          |                    16 |                                 100/100 |
| 50 ms, 30 %           |                    10 |                                 100/100 |
| **50 ms, 50 %**       |                 **6** |                             **100/100** |
| 300 ms, 50 %          |                     6 |                                 100/100 |
| 500 ms, cualquier rel |                     4 |                                  75/100 |

| Umbral de puntuación | Falsos positivos / 90 | Detecta la mejora real |
| -------------------- | --------------------: | ---------------------: |
| 3 puntos (inicial)   |                    12 |                100/100 |
| **5 puntos**         |                 **4** |            **100/100** |
| 7 puntos             |                     0 |                100/100 |

Ahorro en ms de una oportunidad (`bootup-time`, la única inestable): 50 ms/20 % → 16 de 45 pares con estado distinto de `same`; **100 ms/50 % → 8 de 45**; 800 ms → 0 de 45, pero con ese umbral se ocultaría cualquier cambio menor.

## Decisión

Cambios respecto a los umbrales iniciales (`DEFAULT_THRESHOLDS` en `src/rules.ts`):

| Parámetro                     | Inicial           | Calibrado         | Motivo                                                                                                                                                            |
| ----------------------------- | ----------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TBT                           | 50 ms o 15 %      | **50 ms o 50 %**  | El 15 % marcaba como cambio el 40 % de los pares de la rota. Se mantiene el mínimo de 50 ms para no perder sensibilidad con TBT bajos (la arreglada tiene 15 ms). |
| Puntuación                    | 3 puntos          | **5 puntos**      | La puntuación arrastra el ruido del TBT (30 % del peso).                                                                                                          |
| Ahorro de oportunidad (ms)    | —                 | **100 ms o 50 %** | No estaba definido.                                                                                                                                               |
| Ahorro de oportunidad (bytes) | —                 | 10 KiB o 20 %     | No estaba definido; el ahorro en bytes fue idéntico en las 10 auditorías, así que no está calibrado con ruido real.                                               |
| TTFB                          | —                 | 100 ms o 20 %     | No estaba definido; en localhost no hay ruido que medir (1 ms), valor provisional.                                                                                |
| LCP, FCP, SI, CLS             | 150 ms/10 %, 0,02 | sin cambios       | 0 falsos positivos.                                                                                                                                               |

Falsos positivos tras calibrar, sobre los 90 pares: TBT 6, puntuación 4, LCP/FCP/SI/CLS/TTFB 0. **El veredicto global sigue siendo distinto de `unchanged` en 9 de 45 pares de la rota (20 %)** y en 0 de 45 de la arreglada.

## Límites

- **El TBT de 3 ejecuciones no es fiable en páginas con mucho trabajo en el hilo principal.** Ningún umbral lo arregla sin perder sensibilidad (con 500 ms se deja de detectar el 25 % de la mejora real). La mitigación es de medición, no de umbral: más ejecuciones (`--runs 5` o más) para que la mediana absorba las colas. No se ha medido cuánto ayuda; queda como hipótesis.
- **Una sola máquina, localhost.** No hay variabilidad de red ni de servidor (TTFB estable en 752 ms). En webs públicas el ruido será mayor; antes de fiarse de `compare` allí, repetir este experimento sobre esa URL (`node dist/experiments/noise.js run <url> <carpeta>`).
- Las oportunidades salen de una sola ejecución (la representativa), no de la mediana, por eso su ahorro es más ruidoso que las métricas.

## Datos

### demo-rota

10 auditorías de 3 ejecuciones. Puntuación: mediana 43.5, rango 41–48.

| Métrica | Mediana de medianas | Rango entre medianas | Desv. típica | Rango min–max dentro de una auditoría (media) | Umbral (sobre la mediana) | Pares marcados |
| ------- | ------------------: | -------------------: | -----------: | --------------------------------------------: | ------------------------: | -------------: |
| lcp     |               40728 |                 2777 |     1340.752 |                                         863.7 |                    4072.8 |           0/45 |
| fcp     |                2496 |                    9 |        2.497 |                                          64.5 |                     249.6 |           0/45 |
| tbt     |                 591 |                  666 |      230.754 |                                         404.7 |                     295.5 |           6/45 |
| cls     |               0.291 |                0.291 |        0.123 |                                         0.088 |                      0.02 |           0/45 |
| si      |                2496 |                    9 |        2.497 |                                         334.4 |                     249.6 |           0/45 |
| ttfb    |               751.5 |                    1 |        0.527 |                                           0.8 |                     150.3 |           0/45 |

Puntuación marcada en 4/45 pares; veredicto distinto de `unchanged` en 9/45.

| Oportunidad                     | Presente en | Ahorro ms (min–max) | Ahorro KiB (min–max) | Pares con estado ≠ same |
| ------------------------------- | ----------: | ------------------: | -------------------: | ----------------------: |
| bootup-time                     |       10/10 |            400–1150 |                  0–0 |                    8/45 |
| cls-culprits-insight            |        9/10 |                 0–0 |                  0–0 |                    9/45 |
| font-display-insight            |       10/10 |             300–300 |                  0–0 |                    0/45 |
| image-delivery-insight          |       10/10 |         32900–32900 |            7963–7963 |                    0/45 |
| lcp-discovery-insight           |       10/10 |                 0–0 |                  0–0 |                    0/45 |
| mainthread-work-breakdown       |        5/10 |              0–1150 |                  0–0 |                   38/45 |
| network-dependency-tree-insight |       10/10 |                 0–0 |                  0–0 |                    0/45 |
| render-blocking-insight         |       10/10 |           1550–1550 |                  0–0 |                    0/45 |
| total-byte-weight               |       10/10 |                 0–0 |                  0–0 |                    0/45 |
| unsized-images                  |       10/10 |                 0–0 |                  0–0 |                    0/45 |
| unused-javascript               |       10/10 |           1050–1050 |              118–118 |                    0/45 |

### demo-arreglada

10 auditorías de 3 ejecuciones. Puntuación: mediana 99, rango 99–99.

| Métrica | Mediana de medianas | Rango entre medianas | Desv. típica | Rango min–max dentro de una auditoría (media) | Umbral (sobre la mediana) | Pares marcados |
| ------- | ------------------: | -------------------: | -----------: | --------------------------------------------: | ------------------------: | -------------: |
| lcp     |                2103 |                    1 |        0.316 |                                           1.2 |                     210.3 |           0/45 |
| fcp     |              1410.5 |                    6 |        2.234 |                                           9.5 |                       150 |           0/45 |
| tbt     |                15.5 |                   11 |        3.866 |                                          14.8 |                        50 |           0/45 |
| cls     |                   0 |                    0 |            0 |                                             0 |                      0.02 |           0/45 |
| si      |              1410.5 |                    6 |        2.234 |                                           9.5 |                       150 |           0/45 |
| ttfb    |                 752 |                    1 |        0.316 |                                             1 |                     150.4 |           0/45 |

Puntuación marcada en 0/45 pares; veredicto distinto de `unchanged` en 0/45.

| Oportunidad                     | Presente en | Ahorro ms (min–max) | Ahorro KiB (min–max) | Pares con estado ≠ same |
| ------------------------------- | ----------: | ------------------: | -------------------: | ----------------------: |
| bootup-time                     |       10/10 |                 0–0 |                  0–0 |                    0/45 |
| image-delivery-insight          |       10/10 |             150–150 |              534–534 |                    0/45 |
| mainthread-work-breakdown       |       10/10 |                 0–0 |                  0–0 |                    0/45 |
| network-dependency-tree-insight |       10/10 |                 0–0 |                  0–0 |                    0/45 |
