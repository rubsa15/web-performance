# Auditoría de rendimiento: Banco Santander, particulares (mobile)

## Resumen

URL `https://www.bancosantander.es/particulares/` · mobile · 3 ejecuciones por perfil · Lighthouse 13.5.0 · Chrome 155 · sin `warnings` en ningún reporte.
Reportes: `2026-10-21T21-14-21Z-mobile` (`default`, referencia), `2026-10-21T21-15-13Z-mobile-3g`, `2026-10-21T21-16-05Z-mobile-4g`.
Nota: `git.dirty` es `true` en los tres (estado del repo de wperf, no de la web auditada).

| Métrica | `default` (referencia)       | `3g`                       | `4g`                         |
| ------- | ---------------------------- | -------------------------- | ---------------------------- |
| Score   | 33                           | 26                         | 52                           |
| LCP     | 12 210 ms · poor             | 28 691 ms · poor           | 4 534 ms · poor              |
| FCP     | 2 745 ms · needs-improvement | 5 599 ms · poor            | 770 ms · good                |
| TBT     | 4 936 ms · poor              | 4 850 ms · poor            | 5 132 ms · poor              |
| CLS     | 0,028 · good                 | 0,028 · good               | 0,028 · good                 |
| SI      | 8 330 ms · poor              | 13 158 ms · poor           | 3 891 ms · needs-improvement |
| TTFB    | 466 ms · good                | 916 ms · needs-improvement | 136 ms · good                |

Rangos `min`–`max`: LCP `default` 12 183–13 670 ms, `3g` 27 851–30 864 ms, `4g` 4 519–5 037 ms (sin solapes, los tres perfiles son distintos). TBT `default` 4 925–5 027, `3g` 4 790–4 919, `4g` 5 124–5 138 ms: `default` y `3g` casi se tocan y `4g` queda por encima de los dos, pero la diferencia es pequeña (menos de 300 ms) frente al nivel absoluto. En ninguna métrica `max` supera el doble de `min`.

La página transfiere 9,85 MiB (`resources.totalBytes` = 10 327 709 B, `default`), de los que 7,92 MiB son `media` (8 300 433 B), el 80,4 % del total (fuente: cálculo, 8 300 433 / 10 327 709). Scripts: 908 KiB; imágenes: 494 KiB. LCP y TBT son `poor` en las tres redes; el CLS es bueno. La web depende mucho de la red para LCP, FCP y SI, pero casi nada para el TBT, que es un problema de CPU constante (~5 s).

## Tabla priorizada

| #   | Problema (causa raíz)                                                          | Evidencia medida (ahorro `default` / `3g` / `4g`)                                                                                                                                                      | Ante la red                                                                                     | Métricas            | Esfuerzo (hipótesis) |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------- | -------------------- |
| 1   | Hilo principal saturado por JS (Next.js `framework`, `_app`)                   | `mainthread-work-breakdown`: 4 950 / 4 850 / 5 150 ms; `bootup-time`: 4 650 / 4 600 / 4 600 ms; `framework-6d5b2f87b9dff77b.js` 5 266 / 5 208 / 5 154 ms de CPU                                        | **Independiente de la red** (TBT 4 936 / 4 850 / 5 132 ms, todos `poor`)                        | TBT                 | L                    |
| 2   | Dos vídeos de fondo pesados _(hallazgo indirecto, verificado con `curl`)_      | `resources.byType.media` = 8 300 433 B (7,92 MiB): vídeo 1 de 4 813 043 B, vídeo 2 de 3 487 390 B (`total-byte-weight`, `cache-insight`). LCP 12 210 / 28 691 / 4 534 ms                               | **Sensible** (mismos bytes en los tres perfiles, el LCP cambia con la red; relación sin probar) | LCP, SI (hipótesis) | S–M                  |
| 3   | Scripts de terceros que bloquean y pesan (Dynatrace, OneTrust, Tealium, Adobe) | `render-blocking-insight`: 650 / 1 250 / 100 ms; script de Dynatrace 1 512 / 3 015 / 297 ms; `unused-javascript`: OneTrust 75 041 B y Dynatrace 29 036 B sin usar                                      | **Sensible**: mismos bytes, el tiempo decide la red; en `4g` baja a `impact: low`               | FCP, LCP            | S–M                  |
| 4   | JS propio sin usar y heredado                                                  | `unused-javascript`: 750 / 1 800 / 150 ms; 247 945 / 247 830 / 247 825 B en total; `_app-cdd1e1b62aa221df.js` 119 454 B sin usar de 437 569 B; `legacy-javascript-insight`: 100 / 300 / 0 ms, 25 411 B | **Sensible en ms**, bytes constantes                                                            | FCP, LCP            | M                    |

Aparte (visitas repetidas, no primera carga): `cache-insight` 600 / 1 750 / 100 ms y 8 242 378 / 8 242 266 / 8 242 377 B. Casi todo son los dos vídeos (fuente: cálculo, 4 411 956 + 3 196 774 = 7 608 730 B sin caché de `wastedBytes` en `default`).

Prioridad: 1 y 2 van primero porque TBT y LCP son `poor` en los tres perfiles. 3 y 4 afectan a FCP, `needs-improvement` en `default` y `poor` en `3g`. Los ahorros se solapan; no se suman.

## Detalle

### 1. Hilo principal saturado por JS: _medición_ + _hipótesis_

**Medido:** TBT 4 936 ms (`default`), 4 850 ms (`3g`), 5 132 ms (`4g`), `poor` en los tres; el diagnóstico `long-tasks` indica 20 tareas largas. `bootup-time` en `default`: `framework-6d5b2f87b9dff77b.js` 5 266 ms de CPU, `pages/_app-...js` 1 647 ms, el documento `/particulares/` 1 360 ms, `Unattributable` 1 017 ms, Dynatrace 984 ms. Por origen (fuente: cálculo, suma de los `cpuMs` de los 10 items): 8 509 ms del origen propio, 1 017 ms sin atribuir y 1 256 ms de terceros (Dynatrace 984, Adobe 95, Tealium 90, OneTrust 87). Nota: `cpuMs` es CPU total, no TBT.
**Entre redes:** el TBT es casi igual en los tres perfiles, así que aquí la métrica sí ve la tarea larga en todos los casos; el problema está presente aunque el FCP varíe de 770 a 5 599 ms.
**Hipótesis:** hidratación de Next.js (`_next/static/chunks/framework-...`) más scripts de terceros, sobre un hilo con la ralentización de CPU del móvil simulado.
**Comprobación:** perfil de Performance en DevTools con CPU 4×; revisar qué componentes se hidratan al cargar.
**Esfuerzo L.**

### 2. Dos vídeos de fondo pesados: hallazgo indirecto, _medición_ + _hipótesis_

**Medido:** el `Report` no tiene oportunidad propia para el vídeo. `resources.byType.media` = 8 300 433 B (`default`; 8 300 308 en `3g`, 8 300 412 en `4g`). Los dos recursos mayores de `total-byte-weight` son `assets.santandermedia.com/.../f87a3932-.../renditions/original/as/UUID` (4 813 043 B, 4,59 MiB) y `.../fb084690-.../renditions/original/as/UUID` (3 487 390 B, 3,33 MiB); su suma coincide con el `media` (fuente: cálculo, 4 813 043 + 3 487 390 = 8 300 433).
**Verificado en el HTML público** (un `curl`, 101 704 B descargados): hay 2 etiquetas `<video data-testid="video" autoPlay="" muted="" loop="" playsInline="" src="...f87a3932..."/"...fb084690...">`, sin atributos `preload` ni `poster` (fuente: curl, `grep -c`). Son fondos de módulo "video-background" (JSON incluye `"backgroundVideo"`, `"loopVideo":true`). Eso confirma que se piden al cargar la página; si ambos son visibles en móvil o están fuera del primer pliegue no lo sé (el HTML servido incluye ambas etiquetas).
**Hipótesis:** estos 7,92 MiB compiten por ancho de banda con el resto de la carga y explican gran parte del LCP y del SI en `default` y `3g` (LCP 28 691 ms en `3g`). El elemento LCP no está identificado: `lcp-discovery-insight` viene vacío. Es una correlación (mismos bytes, LCP distinto por red), no una atribución medida.
**Comprobación:** pestaña Network de DevTools con red 3G para ver si el vídeo corre en paralelo al LCP; probar `preload="none"` + `poster`, o no cargarlos en móvil.
**Esfuerzo S–M.**

### 3. Terceros que bloquean y pesan: _medición_

`render-blocking-insight`: el script de Dynatrace (`js-cdn.dynatrace.com/jstag/.../..._complete.js`, 87 972 B) bloquea 1 512 ms en `default`, 3 015 ms en `3g`, 297 ms en `4g`; la hoja `684c2731583a8976.css` 166 / 316 / 56 ms. `unused-javascript` en `default`: OneTrust `otBannerSdk.js` 75 041 B de 138 607 B sin usar, Dynatrace 29 036 B. Suma de bytes de terceros en el top 10 de `total-byte-weight`: OneTrust 138 663 B + Dynatrace 87 972 B (fuente: cálculo).
**Hipótesis:** el script de monitorización se carga síncrono en `<head>`; pasarlo a `async`/`defer` sería suficiente.
**Esfuerzo S–M** (depende de quién gestiona la etiqueta).

### 4. JS propio sin usar y heredado: _medición_

`_app-...js` pesa 437 569 B y 119 454 B no se ejecutan; `709-...js` 24 414 B. `legacy-javascript-insight`: 25 411 B (`main-1044bcc1e3083a37.js` 12 062 B). Sin ahorro en ms en `4g` para legacy. **Hipótesis:** falta de code-splitting. **Esfuerzo M.**

## Qué no está medido

- El vídeo es hallazgo indirecto; la verificación sale de un `curl` al HTML, no del reporte.
- El elemento LCP no está identificado (`lcp-discovery-insight` y `network-dependency-tree-insight` vacíos).
- `cache-insight` (visitas repetidas) tiene `impact: high` y ahorro en ms, pero no explica métricas de primera carga.
- `unsized-images` (4 items, tres con URL vacía; CLS 0,028 `good`), `unused-css-rules` (33 815 B, OneTrust y Dynatrace), `unminified-css` (2 908 B), `bf-cache`, `forced-reflow-insight`, `non-composited-animations`: sin ahorro medido o con métricas ya `good`; no priorizados.
- `server-response-time` dice "Root document took 30 ms" mientras que `ttfb` es 466 ms: cito `metrics.ttfb`.
- Tres redes simuladas no son todas las redes: este informe habla de estos perfiles, no de los usuarios reales.

## Siguiente paso

Recomiendo empezar por 2 (cambio S–M, sobre 7,92 MiB y un LCP `poor` en los tres perfiles) y 3, y evaluar la 1, que es la de mayor impacto en TBT pero la más costosa. ¿Cuáles quieres abordar? Para aplicarlos, `perf-fix`; para medir el efecto después, `perf-compare`.
