# Auditoría de rendimiento: bancosantander.es/particulares/ (mobile)

## Resumen

Auditoría `2026-10-21T20-48-46Z-mobile` · `https://www.bancosantander.es/particulares/` · mobile · 3 ejecuciones (representativa: la 2) · Lighthouse 13.5.0 · `score` **33**.

| Métrica | Valor     | Rango min–max (3 runs) | Rating            |
| ------- | --------- | ---------------------- | ----------------- |
| LCP     | 12 433 ms | 12 040 – 15 844 ms     | **poor**          |
| FCP     | 2 601 ms  | 2 598 – 2 959 ms       | needs-improvement |
| TBT     | 4 858 ms  | 4 783 – 5 337 ms       | **poor**          |
| CLS     | 0,028     | 0,028 – 0,028          | good              |
| SI      | 8 266 ms  | 8 030 – 9 680 ms       | **poor**          |
| TTFB    | 466 ms    | 450 – 467 ms           | good              |

La página transfiere 9,85 MiB (`resources.totalBytes` = 10 328 167 B), de los que 7,92 MiB (8 300 229 B) son `media`. LCP, TBT y SI están en `poor`; el servidor responde bien (TTFB 466 ms; diagnóstico: documento raíz en 20 ms), así que el problema está en lo que se envía y en el JavaScript que se ejecuta. `warnings` vacío; 3 ejecuciones con rangos estrechos salvo el pico de LCP (15 844 ms) en una de ellas.

## Prioridades

| #   | Problema (causa raíz)                                          | Evidencia medida                                                                                                                                                        | Métricas | Esfuerzo (hipótesis) |
| --- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------- |
| 1   | Hilo principal saturado por JS (framework + `_app` + terceros) | `bootup-time`: 4 550 ms; `mainthread-work-breakdown`: 4 850 ms; `framework-*.js` 5 098 ms de CPU, `_app-*.js` 1 622 ms, Dynatrace 1 007 ms; TBT 4 858 ms (poor)         | TBT      | L                    |
| 2   | Dos vídeos de portada de 7,92 MiB _(causa deducida)_           | `total-byte-weight`: 4 813 011 B (4,59 MiB) y 3 487 218 B (3,33 MiB); `resources.byType.media` = 8 300 229 B (7,92 MiB); LCP 12 433 ms (poor). Sin oportunidad de vídeo | LCP, SI  | M                    |
| 3   | Script de Dynatrace que bloquea el render y JS sin usar        | `render-blocking-insight`: 500 ms (Dynatrace 1 367 ms, CSS 167 ms); `unused-javascript`: 750 ms y 242 KiB (247 376 B); `legacy-javascript-insight`: 150 ms, 25 KiB      | FCP, LCP | S–M                  |
| 4   | Caché de recursos estáticos                                    | `cache-insight`: 700 ms y 7,86 MiB (8 242 109 B) de ahorro, 7,26 MiB de ellos en los dos vídeos                                                                         | FCP, LCP | S–M                  |
| 5   | Imágenes sin `width`/`height`                                  | `unsized-images`: 4 elementos (3 sin URL, 1 `.webp`); CLS 0,028 (good). Sin ahorro medido                                                                               | CLS      | S                    |
| 6   | CSS sin usar de terceros                                       | `unused-css-rules`: 33 KiB (33 815 B); `unminified-css`: 2,8 KiB (2 908 B). Sin ahorro en ms                                                                            | FCP, LCP | S                    |

Los ahorros se solapan; no se suman. Observa que `cache-insight` y `render-blocking-insight` comparten ahorro con el LCP.

## Detalle

### 1. Hilo principal saturado por JavaScript: _medición_ + _hipótesis_

**Medido:** `mainthread-work-breakdown` (4 850 ms) y `bootup-time` (4 550 ms), ambos impacto high sobre TBT; es el mismo problema. CPU por script (`bootup-time`): `_next/static/chunks/framework-*.js` 5 098 ms, `pages/_app-*.js` 1 622 ms, el documento 1 242 ms, "Unattributable" 1 074 ms, `js-cdn.dynatrace.com/...complete.js` 1 007 ms, `main-*.js` 119 ms, Adobe `alloy.min.js` 99 ms, Tealium `utag.js` 96 ms, OneTrust `otBannerSdk.js` 90 ms. 20 tareas largas (`long-tasks`). TBT = 4 858 ms.
**Hipótesis:** aplicación Next.js (rutas `_next/static`) con hidratación pesada: `_app` pesa 437 876 B (428 KiB) y 119 365 B (117 KiB) están sin usar. Además hay al menos cuatro herramientas de terceros (Dynatrace, Adobe, Tealium, OneTrust) que suman ~1,3 s de CPU entre las que sí atribuye `bootup-time`.
**Cómo comprobarlo:** perfil en DevTools con CPU throttling; probar a cargar los tags de terceros tras la interacción o con retraso.
**Esfuerzo L.**

### 2. Vídeos de portada: _medición_ + _hipótesis verificada parcialmente en el HTML_

**Medido:** los dos recursos más pesados de la página son `assets.santandermedia.com/.../renditions/original/as/UUID` con 4 813 011 B (4,59 MiB) y 3 487 218 B (3,33 MiB). Su suma coincide exactamente con `resources.byType.media` (8 300 229 B, 7,92 MiB), es decir, el 80 % de los 10 328 167 B totales. LCP 12 433 ms (poor), SI 8 266 ms (poor). Lighthouse no emite una oportunidad específica para ellos; solo aparecen en `total-byte-weight` y `cache-insight`.
**Hipótesis (comprobada solo en el HTML público con curl):** son dos `<video autoPlay muted loop playsInline src="...">` que apuntan a esas mismas URLs ("renditions/original"), sin `preload` ni `poster` visibles en esa etiqueta. Que ellos sean la causa del LCP de 12 s es una hipótesis: Lighthouse no dice qué elemento es el LCP en este reporte (`lcp-discovery-insight` sale sin datos).
**Cómo comprobarlo:** ver en DevTools qué elemento es el LCP; probar con una rendición móvil comprimida, `preload="none"` + `poster`, o no autoplay en móvil.
**Esfuerzo M:** hay que generar versiones ligeras y cambiar el componente de vídeo.

### 3. Render-blocking y JS sin usar: _medición_ + _hipótesis_

**Medido:** `render-blocking-insight` 500 ms: `dynatrace ..._complete.js` 1 367 ms de espera (87 971 B, 86 KiB) y `_next/static/css/684c2731583a8976.css` 167 ms. `unused-javascript` 750 ms y 247 376 B (242 KiB): `_app` 119 365 B de 437 243 B, `otBannerSdk.js` 75 036 B de 138 598 B, Dynatrace 28 921 B de 87 465 B, chunk `709-*.js` 24 054 B de 47 957 B. `legacy-javascript-insight`: 150 ms, 25 437 B.
**Hipótesis verificada en el HTML público:** el `<script src=".../dynatrace.com/...complete.js" data-next-head>` está en el `<head>` sin `async` ni `defer`, lo que cuadra con que bloquee el render.
**Esfuerzo S** para el script de Dynatrace (`async`/`defer`); M para el resto.

### 4. Caché: _medición_

**Medido:** `cache-insight` 700 ms y 8 242 109 B (7,86 MiB) de ahorro, de los que 4 411 927 B + 3 196 617 B (7,26 MiB) son los dos vídeos. Hay también imágenes `.webp` (hasta 77 874 B), Dynatrace (70 377 B) y OneTrust (55 471 B) con caché ineficiente. Esta auditoría afecta sobre todo a visitas repetidas, no a la primera carga.
**Esfuerzo S–M** (cabeceras `Cache-Control` en el CDN `assets.santandermedia.com`; los de terceros no son controlables).

### 5–6. CLS menor y CSS de terceros: _medición_

`unsized-images` lista 4 elementos; 3 vienen con URL vacía (posiblemente fondos o imágenes inyectadas) y 1 es un `.webp`. CLS = 0,028 (good), así que no hay urgencia. `unused-css-rules`: 19 428 B de OneTrust y 14 387 B de un bloque `.dyTYID` (Dynatrace); `unminified-css` 2 908 B.

## Qué no está medido

- Los vídeos no tienen oportunidad propia: se deducen de `total-byte-weight`, `cache-insight` y `byType.media`.
- Elemento LCP: no identificado en el JSON (`lcp-discovery-insight` y `network-dependency-tree-insight` vacíos).
- `bf-cache` (la página impide la restauración back/forward) y `forced-reflow-insight` salen sin ahorro ni items.
- `unsized-images` trae 3 items con URL vacía: no se puede saber qué elementos son.
- `non-composited-animations`: 1 elemento animado (diagnóstico, sin ahorro).

## Siguiente paso

¿Qué quieres abordar? Recomiendo empezar por 2 (vídeos; ataca LCP y SI en `poor`), 3 (Dynatrace con `defer`, cambio S) y 1 (TBT en `poor`, el más caro). Para aplicar cambios, `perf-fix`; para medir el efecto, `perf-compare`.
