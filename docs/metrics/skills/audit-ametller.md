# Auditoría de rendimiento: ametllerorigen.com/es/online (mobile)

## Resumen

Auditoría `2026-10-21T20-47-35Z-mobile` · `https://www.ametllerorigen.com/es/online` · mobile · 3 ejecuciones (representativa: la 3) · Lighthouse 13.5.0 · `score` **67**.

| Métrica | Valor    | Rango min–max (3 runs) | Rating            |
| ------- | -------- | ---------------------- | ----------------- |
| LCP     | 2 434 ms | 2 429 – 7 230 ms       | good              |
| FCP     | 1 255 ms | 1 240 – 3 190 ms       | good              |
| TBT     | 2 405 ms | 2 231 – 2 551 ms       | **poor**          |
| CLS     | 0        | 0 – 0                  | good              |
| SI      | 4 051 ms | 3 851 – 5 417 ms       | needs-improvement |
| TTFB    | 629 ms   | 621 – 633 ms           | good              |

La página transfiere 1,43 MiB (`resources.totalBytes` = 1 495 553 B): 640 KiB de imágenes, 564 KiB de scripts, 130 KiB de fuentes. Solo el TBT está en `poor`; el problema de esta web es el JavaScript que ocupa el hilo principal, no el peso ni el servidor.

**Fiabilidad:** `warnings` está vacío, pero el LCP y el FCP varían mucho entre ejecuciones (LCP de 2 429 a 7 230 ms; FCP de 1 240 a 3 190 ms). La mediana (2 434 ms) es `good`, pero una de las ejecuciones fue claramente peor; conviene repetir antes de concluir que el LCP está sano.

## Prioridades

| #   | Problema (causa raíz)                                | Evidencia medida                                                                                                                                            | Métricas | Esfuerzo (hipótesis) |
| --- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------- |
| 1   | Hilo principal saturado por JS (bundle de framework) | `bootup-time`: 2 900 ms; `mainthread-work-breakdown`: 2 400 ms; `framework.js` 5 219 ms de CPU, `vendor.js` 1 095 ms; TBT 2 405 ms (poor); 20 tareas largas | TBT      | L                    |
| 2   | JavaScript sin usar / heredado                       | `unused-javascript`: 195 KiB (199 876 B), `vendor.js` 128 KiB de 197 KiB; `legacy-javascript-insight`: 23 KiB. Sin ahorro en ms medido                      | FCP, LCP | M                    |
| 3   | Banners de portada pesados                           | `image-delivery-insight`: 300 ms y 112 KiB (115 135 B) de ahorro en 3 imágenes                                                                              | LCP      | S                    |
| 4   | Terceros y CSS/caché menores                         | `unused-css-rules`: 16 KiB (CSS del banner de cookies); `cache-insight`: 8 KiB. Sin ahorro en ms medido                                                     | FCP, LCP | S                    |

Los ahorros se solapan; no se suman. La fila 1 va primera porque es la única métrica en `poor` y además tiene los ahorros en ms más altos.

## Detalle

### 1. Hilo principal saturado por JavaScript: _medición_ + _hipótesis_

**Medido:** `bootup-time` (ahorro 2 900 ms, impacto high) y `mainthread-work-breakdown` (2 400 ms, high) apuntan a TBT; son el mismo problema, no dos. Por script, el reparto de CPU es: `/mobify/bundle/668/framework.js` 5 219 ms, `vendor.js` 1 095 ms, el propio documento HTML 927 ms, "Unattributable" 710 ms, `main.js` 244 ms, `rocket-loader.min.js` (Cloudflare) 156 ms, `ui.js` 66 ms. El diagnóstico `long-tasks` cuenta 20 tareas largas. TBT = 2 405 ms (poor; rango 2 231–2 551 ms entre ejecuciones, es la métrica más estable).
**Hipótesis:** es una aplicación React con hidratación en cliente (los paquetes se sirven desde `/mobify/bundle/...`, lo que sugiere el stack PWA Kit de Salesforce) y la hidratación de la home ejecuta mucho código seguido. En el HTML público todos los chunks van con `async` y el HTML pesa 382 423 B, algo que puede contribuir al coste del documento (927 ms de CPU). Nota: el `cpuMs` de `framework.js` (5 219 ms) es mayor que el TBT (2 405 ms); no son la misma magnitud (hipótesis: `cpuMs` es CPU total del script, el TBT solo cuenta el tiempo de tareas largas que bloquea), así que no los compares.
**Cómo comprobarlo:** perfil de rendimiento en Chrome DevTools con CPU throttling x4 y ver qué funciones dominan la hidratación; probar a diferir módulos no críticos de la home (carruseles, widgets) con carga bajo demanda.
**Esfuerzo L:** requiere trabajo en la arquitectura de carga/hidratación, no es un cambio de atributo.

### 2. JavaScript sin usar / heredado: _medición_ + _hipótesis_

**Medido:** `unused-javascript`: 199 876 B (195 KiB) sin usar; `vendor.js` 130 693 B (128 KiB) de 201 756 B (197 KiB), `ui.js` 24 220 B (24 KiB) de 68 019 B, `main.js` 22 959 B (22 KiB) de 110 927 B, `sdk.js` 22 004 B (21 KiB) de 46 523 B. `legacy-javascript-insight`: 23 781 B (23 KiB), 13 425 B en `vendor.js` y 10 356 B en el beacon de Cloudflare Insights. Ninguno trae ahorro en ms.
**Hipótesis:** el código de páginas distintas a la home viaja en los paquetes comunes; el `vendor.js` incluye dependencias que podrían cargarse por ruta.
**Esfuerzo M:** code-splitting y revisión de la configuración de transpilación.

### 3. Banners de portada: _medición_ + _hipótesis_

**Medido:** `image-delivery-insight` (impacto medium): 300 ms y 115 135 B (112 KiB). Tres imágenes del carrusel principal, ya en WebP: `B_MB_EGEN_MBL_ES_tardor.jpg?sw=800&fmt=webp&q=90` (86 KiB, ahorro 51 KiB), `..._PromoFormatges_Tardor_2026_Mobile_ES_formatges_online.jpg?sw=1000&...&q=90` (83 KiB, ahorro 48 KiB) y `B_MB_BANGER_MBL_ES2.jpg?sw=800&...&q=90` (42 KiB, ahorro 13 KiB).
**Hipótesis:** la calidad `q=90` y el ancho `sw=800/1000` son más altos de lo necesario para el viewport móvil; bajar calidad o ancho reduciría los bytes.
**Esfuerzo S:** son parámetros de URL del servicio de imágenes.

### 4. Terceros y CSS/caché menores: _medición_

**Medido:** `unused-css-rules`: 16 558 B (16 KiB), todo de un único bloque `#didomi-host .didomi-components-button...` (banner de consentimiento). `cache-insight`: 8 464 B (8 KiB), el mayor el beacon de Cloudflare Insights (4 140 B). Sin ahorro en ms.
**Esfuerzo S:** configuración del CMP y de las cabeceras de caché de terceros (esto último fuera del control de la web).

## Qué no está medido

- SI (4 051 ms, needs-improvement) no tiene oportunidad propia; está ligado al TBT y a la hidratación.
- `resources.byType.stylesheet` es 0 B pese a existir `unused-css-rules`: el CSS parece ir incrustado/inyectado por JS; no hay una cifra de CSS separada.
- Hallazgo indirecto (imágenes): `resources.byType.image` = 655 589 B (640 KiB). En el HTML público los primeros `<img>` del slider de categorías llevan `loading="eager"`. Es una pista, no una medición: no sé cuáles están bajo el pliegue. Hipótesis a verificar.
- `forced-reflow-insight` y `network-dependency-tree-insight` aparecen sin ahorro ni items.
- Discrepancia: el diagnóstico `total-byte-weight` dice "Total size was 1,523 KiB", pero `resources.totalBytes` equivale a 1 460 KiB (1,43 MiB). He usado `resources.totalBytes`; la diferencia podría deberse a que el diagnóstico viene de otra ejecución (hipótesis).

## Siguiente paso

¿Qué quieres abordar? Recomiendo empezar por la fila 1 (única métrica en `poor`) aunque sea la de más esfuerzo, y la fila 3 como victoria rápida (S). Antes, repetir la medición una vez más por la varianza del LCP. Para aplicar cambios está `perf-fix`; para medir el efecto, `perf-compare`.
