# Auditoría de rendimiento: https://www.ametllerorigen.com/es/online

## 1. Resumen

- **Dispositivo:** mobile. Redes: `default`, `3g` y `4g`, **3 ejecuciones** por perfil (9 cargas en serie). Lighthouse 13.5.0, Chrome 155, throttling `simulate`. Sin `warnings` en ningún perfil.
- **Reportes** (`.perf/reports/www.ametllerorigen.com/`): `2026-10-22T19-20-09Z-mobile.json` (default), `2026-10-22T19-20-55Z-mobile-3g.json` y `2026-10-22T19-21-38Z-mobile-4g.json`.
- **Preguntas que habría hecho** (sin herramienta de preguntas, asumo las respuestas indicadas): (1) ¿Qué dispositivos? Asumo `mobile`. (2) ¿Qué redes? Asumo `default`, `3g` y `4g`. (3) ¿Cuántas ejecuciones? Asumo 3 (9 cargas en serie).

Valor mediano (rango `min`–`max` entre paréntesis) y `rating`:

| Métrica     | `default` (referencia)                    | `3g`                                      | `4g`                             |
| ----------- | ----------------------------------------- | ----------------------------------------- | -------------------------------- |
| score       | 67                                        | 41                                        | 71                               |
| LCP         | 2 597 ms (2 427–3 062), needs-improvement | 6 031 ms (6 031–8 970), **poor**          | 588 ms (551–678), good           |
| FCP         | 1 235 ms (1 211–1 534), good              | 3 031 ms (3 031–4 269), **poor**          | 470 ms (456–528), good           |
| TBT         | 2 604 ms (2 345–3 112), **poor**          | 1 752 ms (1 597–2 529), **poor**          | 2 681 ms (2 563–3 601), **poor** |
| CLS         | 0, good                                   | 0, good                                   | 0, good                          |
| Speed Index | 3 908 ms (3 737–4 005), needs-improvement | 6 066 ms (5 515–6 338), **poor**          | 1 840 ms (1 831–1 892), good     |
| TTFB        | 626 ms (614–626), good                    | 1 231 ms (1 220–1 231), needs-improvement | 188 ms (181–189), good           |

**Diagnóstico general.** La web tiene dos problemas de naturaleza distinta:

- **Tiempo de hilo principal (TBT):** es `poor` en los tres perfiles, así que la red ni lo explica ni lo arregla.
- **Métricas de carga (LCP, FCP, SI):** dependen mucho de la red. El LCP pasa de 588 ms en `4g` a 6 031 ms en `3g`.

Con la red que puntúa Lighthouse (`default`) el cuello de botella es el TBT. El CLS está a 0 y el TTFB es bueno salvo en `3g`.

**Fiabilidad.** Según el umbral de ruido de `wperf compare`, estas medianas son válidas pero poco fiables (rango `max − min` mayor que el umbral; cálculo mío):

- `default`: LCP (rango 635 ms > umbral 260 ms) y FCP (323 ms > 150 ms).
- `3g`: LCP (2 939 ms > 603 ms), FCP (1 238 ms > 303 ms), SI (823 ms > 607 ms) y TBT (932 ms > 876 ms, por poco). En `3g` la mediana de LCP y de FCP coincide con el mínimo.
- `4g` y el TBT de `default` son estables.

El `score` no ordena las redes: `4g` saca 71 y `default` 67 con un LCP muy distinto, porque pesa distinto cada métrica. Son tres perfiles simulados, no usuarios reales.

## 2. Tabla priorizada

| #   | Problema (causa raíz)                                                                                                                                                | Evidencia medida                                                                                                                                                                                                                                                                                                                                                                                                                                     | Comportamiento ante la red                                                                                                                                                                                     | Métricas afectadas                                                                  | Esfuerzo (hipótesis)                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | **JavaScript del bundle ocupa el hilo principal** (`bootup-time`, `mainthread-work-breakdown`, diagnóstico `long-tasks`: "20 long tasks found" en los tres perfiles) | `framework.js` consume 5 358 ms de CPU en `default` (5 237 en `3g`, 4 850 en `4g`). Después vienen `vendor.js` con 944 ms, el propio documento `/es/online` con 771 ms y `main.js` con 209 ms. Ahorro `bootup-time`: 2 950 / 2 850 / 2 550 ms (`default`/`3g`/`4g`); `mainthread-work-breakdown`: 2 600 / 1 750 / 2 550 ms                                                                                                                           | **Independiente de la red.** TBT `poor` en los tres. Cocientes de ahorro máx/mín: 1,16 (`bootup-time`) y 1,49 (`mainthread-work-breakdown`), ambos ≤ 1,5 (fuente: cálculo)                                     | TBT (`poor` ×3)                                                                     | **L** (trocear el trabajo de arranque, diferir o reducir lo que se ejecuta/hidrata al cargar) |
| 2   | **Imágenes de banners/carrusel más pesadas de lo necesario** (`image-delivery-insight`)                                                                              | 4 imágenes, 109 138 B (107 KiB) de ahorro en los tres perfiles. La mayor: `…/mainbanner/EGEN/B_MB_EGEN_MBL_ES_tardor.jpg?sw=800&fmt=webp&q=90`, 88 152 B totales y 52 257 B ahorrables. Siguen `…Promo%20Bomba/ECOMM_MBPM_BrousRefrigerats_AO_2026_Mobile_ES.jpg` (68 506 B, 38 213 B ahorrables), `…B_MB_BANGER_MBL_ES2.jpg` (43 490 B, 13 392 B) y `…banner carrusel/B_Carrusel_formatges_ES.jpg` (25 564 B, 5 276 B). Ahorro en ms: 300 / 600 / 0 | **Sensible a la red.** Mismos 4 items y mismos bytes en los tres perfiles, pero distinto tiempo (300 / 600 / 0 ms): la causa son los bytes y la red decide cuánto duelen. `impact`: medium / **high** / medium | LCP (`default` y `3g`); FCP y LCP en `4g`. LCP: needs-improvement / **poor** / good | **M** (regenerar variantes con menos calidad o menos resolución; hoy `q=90`)                  |
| 3   | **JavaScript sin usar y código legacy** (`unused-javascript`, `legacy-javascript-insight`)                                                                           | `unused-javascript`: 201 032 B (196 KiB) en `default` (202 363 en `3g`, 202 369 en `4g`; ≈198 KiB). `vendor.js` pone 132 067 B de 205 855 totales, `ui.js` 23 953, `main.js` 23 009 y `sdk.js` 22 003. `legacy-javascript-insight`: 24 038 B (23 KiB), con `vendor.js` 13 682 B y el beacon de Cloudflare 10 356 B. **Sin ahorro medido** (0 ms en los tres)                                                                                         | **Independiente** (0 ms ×3, bytes casi idénticos). `impact`: medium / medium / medium (legacy: low ×3)                                                                                                         | FCP y LCP. Poor solo en `3g`: FCP 3 031 ms, LCP 6 031 ms                            | **M–L** (code-splitting, actualizar target de transpilación)                                  |
| 4   | **Terceros y CSS no usado** (`unused-css-rules`, `cache-insight` de scripts de terceros)                                                                             | CSS de Didomi (`#didomi-host …`), 16 558 B (16 KiB) sin usar. Cloudflare: `beacon.min.js` (10 356 B de legacy, ver fila 3) y `rocket-loader.min.js` (138 ms de CPU en `bootup-time`). **Sin ahorro medido**                                                                                                                                                                                                                                          | **Independiente** (16 558 B en los tres, 0 ms ×3)                                                                                                                                                              | FCP y LCP (`low`)                                                                   | **S–M** (confirmar con el responsable del CMP y de Cloudflare si se pueden diferir)           |

Las filas 1 y 3 comparten `vendor.js` (aparece en `bootup-time` y en `unused-javascript`): se solapan y no se suman. El orden es:

- La fila 1 es el único nivel 1 (TBT `poor` en `default`).
- Las filas 2 a 4 son nivel 2 (LCP, FCP y SI `poor` solo en `3g`).
- En ese nivel va primero la que tiene mayor ahorro (la 2, con 600 ms) y segunda la fila 3, que no tiene ahorro medido.

## 3. Detalle por problema

**1. Hilo principal (TBT).**

- _Qué pasa:_ en el móvil simulado la página queda bloqueada por tareas largas de JavaScript (20 en cada perfil). El TBT sale en 2 604 ms (`default`), 1 752 ms (`3g`) y 2 681 ms (`4g`), los tres `poor`.
- _Evidencia:_ el script que más CPU gasta es `/mobify/bundle/670/framework.js`, con 5 358 / 5 237 / 4 850 ms. `cpuMs` es CPU total y no equivale al TBT, así que no los restes.
- _Matiz entre redes:_ el TBT de `3g` es menor, pero su rango (1 597–2 529) se solapa con el de `default` (2 345–3 112), por lo que no afirmo que una red sea peor. Un TBT algo menor en `3g` no absuelve al problema: la tarea larga existe en los tres.
- _Hipótesis:_ los nombres (`mobify`, clases `chakra-*`, `demandware`) sugieren una tienda en Salesforce Commerce Cloud con el front PWA Kit (React). `framework.js` sería el arranque y la hidratación de React. No he visto el código fuente.
- _Cómo comprobarla:_ en DevTools, pestaña Performance con CPU throttling 4×, mira qué tareas largas hay en la carga y si vienen de `framework.js`. Con React Profiler se ve qué se hidrata.

**2. Imágenes de banners/carrusel.**

- _Qué pasa:_ el elemento LCP es una imagen "Banner image" (`div.css-10klw3m > a.chakra-link > picture > img.chakra-image`) con `fetchpriority="high"`, `loading="eager"` y `srcset`/`sizes`, y es el mismo elemento en los tres perfiles. Su `src` viene truncado en el reporte, así que no puedo asegurar cuál de las 4 imágenes es.
- _Evidencia:_ el ahorro de 109 138 B es idéntico en los tres perfiles. Los items 1 a 3 comparten el selector del LCP, lo que apunta a que son slides del mismo carrusel. Ya se sirven en WebP, pero con `q=90`, y `image-delivery-insight` considera que sobran 52 257 B solo en la mayor.
- _Matiz:_ `lcp.discovery` dice que el LCP se descubre pronto y tiene prioridad (`priorityHinted`, `requestDiscoverable` y `eagerlyLoaded` en `true`), así que no es un problema de descubrimiento. El desglose se mide en la carga real, no suma el LCP simulado, y solo sirve por proporción. En `default` suma 283 ms: TTFB 139 ms (49 %), retraso de carga 30 ms (11 %), carga 37 ms (13 %) y retraso de render 77 ms (27 %). Por eso el peso de la imagen influye en el LCP simulado de redes lentas, no en la carga real que midió Chrome.
- _Hipótesis:_ rebajar `q=90` y servir un `sw` más ajustado al ancho real de pantalla ahorraría esos bytes.
- _Cómo comprobarla:_ en la pestaña Network de DevTools (móvil) mira el tamaño transferido y las dimensiones reales de cada banner frente a su tamaño pintado.

**3. JS sin usar y legacy.**

- _Evidencia:_ ver tabla. `vendor.js` tiene 132 067 B ahorrables de 205 855.
- _Hipótesis:_ el bundle incluye código de páginas o funciones que la home no usa, y está transpilado para navegadores antiguos (24 038 B de `legacy-javascript-insight`).
- _Cómo comprobarla:_ en DevTools, pestaña Coverage, para ver qué porcentaje de `vendor.js` se ejecuta en la home. Si se puede tocar el build, mira el `browserslist`.

**4. Terceros y CSS.**

- _Evidencia:_ el CSS de Didomi (consentimiento) pesa 16 558 B y no se usa. El beacon de Cloudflare tiene 10 356 B de código legacy. `rocket-loader.min.js` gasta 138 ms de CPU.
- _Hipótesis:_ son pequeños frente a la fila 1. Los scripts de la página llevan `type="…-text/javascript"` en el HTML (fuente: curl), señal de que Cloudflare Rocket Loader está reescribiéndolos. Puede retrasar la ejecución, pero no lo he medido.
- _Cómo comprobarla:_ desactiva Rocket Loader o prueba con una regla de página en Cloudflare, y repite la auditoría.

## 4. Qué no está medido

- **Visitas repetidas (`cache-insight`).** Son 4 recursos con 8 513 B de ahorro en `default`: beacon de Cloudflare, `rocket-loader.min.js`, `email-decode.min.js` y una imagen de producto. Mide visitas repetidas, no la primera carga, y no lo uso para ordenar.
- **Imágenes sin `loading="lazy"` (hallazgo indirecto).** `resources.byType.image` suma 635 656 B (621 KiB) en `default`, que es el 43,0 % de los 1 478 247 B totales (1,41 MiB) (fuente: cálculo, 635 656 / 1 478 247). Una descarga del HTML (fuente: curl, una petición) cuenta 31 `<img>`, de las cuales 13 tienen `loading="lazy"` y 17 `loading="eager"`. No sé cuáles de las `eager` están en pantalla al cargar. _Hipótesis:_ parte de esas 17 podrían ser lazy. Compruébalo en DevTools con la vista móvil.
- **Scripts.** 580 477 B (567 KiB) de `script` y 133 368 B (130 KiB) de fuentes en `default`. Lighthouse no marca oportunidad de fuentes.
- **TTFB.** 626 ms en `default`, 1 231 ms en `3g` (needs-improvement) y 188 ms en `4g`. El diagnóstico `server-response-time` dice que el documento tarda 140–160 ms: no coincide con `metrics.ttfb`, así que cito la métrica. Cambia con la red, y desde aquí no veo qué parte es servidor.
- **Sin ahorro y sin items:** `network-dependency-tree-insight` (LCP, 0 ms) y `forced-reflow-insight` (0 ms). No he podido priorizarlos.
- **CLS** a 0 en los tres perfiles. No hay problema.
- `git` describe el repo de `wperf`, no el sitio auditado, y lo ignoro.

## 5. Siguiente paso

Mi propuesta es empezar por la **fila 1** (TBT, el único `poor` con la red de referencia) y seguir con la **fila 2** (imágenes, la que más pesa en `3g`). ¿Cuáles quieres abordar? No tengo el código de la tienda, así que para aplicar cambios (`perf-fix`) necesitaría el repo del front. Después se puede volver a auditar y comparar con `perf-compare`.
