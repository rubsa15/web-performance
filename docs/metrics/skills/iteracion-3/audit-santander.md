# Auditoría de rendimiento: bancosantander.es/particulares (mobile)

## Resumen

URL `https://www.bancosantander.es/particulares/` · mobile · Lighthouse 13.5.0 · 3 ejecuciones por perfil · sin `warnings`. Reportes (todos del 2026-10-21):

- `default` (referencia): `2026-10-21T21-30-49Z-mobile`
- `3g`: `2026-10-21T21-31-42Z-mobile-3g`
- `4g`: `2026-10-21T21-32-35Z-mobile-4g`

| Métrica | `default` (referencia)           | `3g`                             | `4g`                          |
| ------- | -------------------------------- | -------------------------------- | ----------------------------- |
| Score   | 33                               | 26                               | 53                            |
| LCP     | 12 511 ms · poor (12 314–13 875) | 28 258 ms · poor (28 144–31 010) | 4 544 ms · poor (4 519–5 192) |
| FCP     | 2 747 ms · needs-improvement     | 5 896 ms · poor                  | 842 ms · good                 |
| TBT     | 4 953 ms · poor (4 608–4 965)    | 4 826 ms · poor (4 776–4 830)    | 5 142 ms · poor (5 117–5 230) |
| CLS     | 0,028 · good                     | 0,028 · good                     | 0,028 · good                  |
| SI      | 8 127 ms · poor                  | 13 184 ms · poor                 | 3 753 ms · needs-improvement  |
| TTFB    | 469 ms · good                    | 919 ms · needs-improvement       | 139 ms · good                 |

La página transfiere 9,88 MiB (`resources.totalBytes` = 10 359 158 B en `default`), de los que **7,92 MiB son `media`** (`resources.byType.media` = 8 300 299 B, el 80 % del total, fuente: cálculo 8 300 299 / 10 359 158). Scripts: 907 KiB; imágenes: 494 KiB; fuentes: 220 KiB. Diagnóstico general: LCP y TBT son `poor` en los tres perfiles, así que ni siquiera con la red rápida (`4g`) la página llega a `good`; la red agrava el LCP (de 4 544 a 28 258 ms) pero no es la causa única.

Fiabilidad: 3 ejecuciones por perfil, sin avisos, dispersión baja (ninguna métrica supera 1,5 veces entre `min` y `max`). El TBT apenas se mueve entre redes (4 826–5 142 ms) y los rangos de `default` y `3g` se solapan: no se puede decir que uno sea peor. El score (33 / 26 / 53) no ordena las redes por sí solo; ordeno por métricas.

## Tabla priorizada

Todas las filas 1–3 apuntan a métricas `poor` en el perfil de referencia (TBT, LCP) o a FCP, `needs-improvement` en `default` y `poor` en `3g`. Los ahorros se solapan; no se suman.

| #   | Problema (causa raíz)                                                | Evidencia medida                                                                                                                                                                                                    | Ante la red (ahorro `default` / `3g` / `4g`)                                       | Métricas               | Esfuerzo (hipótesis) |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------- | -------------------- |
| 1   | Hilo principal saturado por JavaScript                               | `mainthread-work-breakdown`: 4 950 / 4 850 / 5 150 ms; `bootup-time`: 4 550 / 4 600 / 4 600 ms; 20 tareas largas (`long-tasks`); `framework-*.js` 5 144 / 5 174 / 5 144 ms de CPU                                   | **Independiente** (cocientes máx/mín 1,06 y 1,01; TBT `poor` en los tres)          | TBT                    | L                    |
| 2   | Dos vídeos de ~7,92 MiB descargados al cargar _(hallazgo indirecto)_ | `resources.byType.media` = 8 300 299 B; dos recursos de 4 813 054 B (4,59 MiB) y 3 487 245 B (3,33 MiB) (`total-byte-weight`, `cache-insight`) que suman exactamente esa cifra (fuente: cálculo). Sin ahorro medido | **Presente en los tres** (mismos bytes). El LCP va de 4 544 a 28 258 ms con la red | LCP, FCP _(hipótesis)_ | S–M                  |
| 3   | Terceros que bloquean o pesan (Dynatrace, OneTrust, Tealium, Adobe)  | `render-blocking-insight`: 500 / 1 250 / 100 ms (Dynatrace, `wastedMs` 1 364 / 3 014 / 332 en sus items); CPU de Dynatrace 1 006 ms; `unused-javascript` de OneTrust y Dynatrace 103 971 B                          | **Sensible** (cociente 12,5 en `render-blocking-insight`)                          | FCP, LCP               | S–M                  |
| 4   | JavaScript propio sin usar o heredado                                | `unused-javascript`: 900 / 1 800 / 100 ms con 247 408 B (242 KiB) casi iguales en los tres; `_app-*.js` 119 398 B sin usar de 437 364; `legacy-javascript-insight`: 100 / 250 / 50 ms                               | **Sensible**: mismos bytes, el tiempo lo decide la red                             | FCP, LCP               | M–L                  |
| 5   | CSS sin usar                                                         | `unused-css-rules`: 33 815 B (33 KiB, OneTrust y Dynatrace); `unminified-css`: 2 908 B. Sin ahorro en ms                                                                                                            | **Independiente** en bytes                                                         | FCP, LCP               | S                    |

Aparte (visitas repetidas): `cache-insight` 550 / 1 450 / 100 ms y 8 242 386 B (7,86 MiB), dominado por los dos vídeos (4 411 966 + 3 196 641 = 7 608 607 B de ahorro posible, fuente: cálculo).

## Detalle

### 1. Hilo principal saturado por JavaScript: _medición_ + _hipótesis_

**Medido:** TBT `poor` en los tres perfiles (4 953, 4 826 y 5 142 ms), con 20 tareas largas en cada uno. Mayores CPU en `default` (`bootup-time`): `/_next/static/chunks/framework-*.js` 5 144 ms, `pages/_app-*.js` 1 627 ms, el propio documento 1 222 ms, Dynatrace 1 006 ms. `cpuMs` no es TBT: no son comparables.
**Hipótesis:** es una app Next.js (rutas `/_next/`) con hidratación completa de una página con mucha carga de scripts de analítica y consentimiento. La red no lo explica ni lo arregla (TBT casi igual en las tres).
**Cómo comprobarlo:** Performance en DevTools para ver qué tarea larga domina; revisar qué se hidrata fuera del pliegue.
**Esfuerzo L (hipótesis).**

### 2. Vídeos pesados descargados al cargar _(indirecto)_: _medición_ + _hipótesis_

**Medido:** `resources.byType.media` = 8 300 299 B (7,92 MiB), el 80 % de la página. Los dos recursos grandes de `assets.santandermedia.com/.../renditions/original/...` suman 4 813 054 + 3 487 245 = 8 300 299 B (fuente: cálculo): coinciden exactamente con `media`.
**Verificado en el HTML público (fuente: curl, un solo GET con UA móvil):** hay dos etiquetas `<video ... autoPlay muted loop playsInline src=".../renditions/original/...">` con esos mismos `src`, y ninguna lleva `preload` ni `poster`. Son datos reales del HTML; que el reporte los atribuya al LCP es _hipótesis_: `lcp-discovery-insight` no trae datos, así que el elemento LCP no está identificado.
**Hipótesis:** los vídeos compiten por ancho de banda con el resto de recursos y retrasan el LCP y el FCP en redes lentas (LCP 28 258 ms en `3g`). Pero con `4g` el LCP sigue `poor` (4 544 ms) con FCP `good`, por lo que el hilo principal (fila 1) también contribuye.
**Esfuerzo S–M:** `preload="none"` + `poster`, no cargarlos en móvil, o servir una versión comprimida.

### 3. Terceros: _medición_ + _hipótesis_

**Medido:** el script de Dynatrace aparece como bloqueante en `render-blocking-insight` (`wastedMs` 1 364 / 3 014 / 332 ms en `default` / `3g` / `4g`; el ahorro de la oportunidad es 500 / 1 250 / 100 ms: es la cifra que cito, la otra es la de sus items). Sobre CPU, suma mínima de terceros en `default` (`bootup-time`): 1 006 + 98 + 92 + 91 = 1 287 ms (Dynatrace, Tealium, OneTrust, Adobe Alloy; fuente: cálculo, los `items[]` son parciales). `unused-javascript`: `otBannerSdk.js` 75 050 B y Dynatrace 28 921 B sin usar, 103 971 B entre ambos (el 42 % de los 247 408 B del total, fuente: cálculo).
**Hipótesis:** cargar Dynatrace de forma síncrona en `<head>` no es necesario. Comprobar el HTML (`<script src=...dynatrace...>` sin `async`/`defer`).
**Esfuerzo S–M:** `async`/`defer` es S; reducir tags es decisión de negocio.

### 4. JavaScript propio sin usar: _medición_

**Medido:** `_app-*.js` pesa 437 364 B y 119 398 B (117 KiB) no se usan; el chunk `709-*.js` 24 039 B de 47 927. En `legacy-javascript-insight`, `main-*.js` 12 259 B. Los bytes de `unused-javascript` son iguales en los tres perfiles (247 408 / 247 399 / 247 394 B), pero el ahorro en ms va de 900 a 1 800 y a 100: la causa son los bytes, la red decide cuánto duelen.
**Esfuerzo M–L (hipótesis):** code-splitting.

### 5. CSS sin usar: _medición_

**Medido:** `unused-css-rules` 33 815 B repartidos entre CSS de OneTrust (19 428 B) y de Dynatrace (14 387 B), ambos de terceros; `unminified-css` 2 908 B. Sin ahorro en ms.

## Qué no está medido

- Elemento LCP sin identificar (`lcp-discovery-insight` vacío en los tres).
- `unsized-images`: 4 imágenes (tres con URL vacía) pero CLS 0,028 `good` en los tres perfiles; sin ahorro. No priorizado.
- `bf-cache`, `forced-reflow-insight`, `non-composited-animations` (1 / 3 elementos animados en `default` / `3g`), `user-timings`, `network-dependency-tree-insight`: sin ahorro medido.
- `server-response-time` dice "Root document took 30 ms", pero `metrics.ttfb` es 469 / 919 / 139 ms. Cito la métrica.
- `cache-insight` y `total-byte-weight` miden por su cuenta (7,86 MiB y 10 359 158 B de `resources.totalBytes`): cada cifra con su id.
- Tres redes simuladas no son todas las redes.

## Siguiente paso

Recomiendo empezar por las filas 1 y 2: son las dos que atacan métricas `poor` en los tres perfiles; la 2 es la más barata y verificable (vídeos sin `poster` ni `preload`), la 1 es el cambio grande. ¿Cuáles quieres abordar? Con código propio, `perf-fix`, y `perf-compare` para medir después.
