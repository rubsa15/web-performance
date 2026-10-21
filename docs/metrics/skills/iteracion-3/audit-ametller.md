# Auditoría de rendimiento: ametllerorigen.com/es/online (mobile)

## Resumen

URL `https://www.ametllerorigen.com/es/online` · mobile · Lighthouse 13.5.0 · 3 ejecuciones por perfil · sin `warnings` en ninguno de los tres reportes. Reportes (todos del 2026-10-21):

- `default` (referencia): `2026-10-21T21-28-15Z-mobile`
- `3g`: `2026-10-21T21-29-06Z-mobile-3g`
- `4g`: `2026-10-21T21-29-53Z-mobile-4g`

| Métrica | `default` (referencia)                     | `3g`                          | `4g`                          |
| ------- | ------------------------------------------ | ----------------------------- | ----------------------------- |
| Score   | 67                                         | 39                            | 71                            |
| LCP     | 2 590 ms · needs-improvement (2 425–3 530) | 6 028 ms · poor (5 723–8 232) | 547 ms · good (546–726)       |
| FCP     | 1 230 ms · good                            | 2 609 ms · needs-improvement  | 464 ms · good                 |
| TBT     | 2 322 ms · poor (2 136–2 785)              | 2 045 ms · poor (1 405–2 638) | 2 850 ms · poor (2 548–3 342) |
| CLS     | 0 · good                                   | 0 · good (0–0,011)            | 0 · good                      |
| SI      | 3 931 ms · needs-improvement               | 6 403 ms · poor               | 1 798 ms · good               |
| TTFB    | 624 ms · good                              | 1 223 ms · needs-improvement  | 186 ms · good                 |

La página transfiere 1,43 MiB (`resources.totalBytes` = 1 496 550 B en `default`): imágenes 640 KiB, scripts 564 KiB, fuentes 130 KiB, documento 70 KiB; sin vídeo. Es una página ligera, y los bytes no son el problema. El LCP depende mucho de la red (de `good` en `4g` a `poor` en `3g`), pero el TBT es `poor` en los tres perfiles: hay un problema de hilo principal que la red no explica ni arregla.

Fiabilidad: 3 ejecuciones por perfil, sin avisos. Dispersión: ninguna métrica supera el doble entre `min` y `max` (el mayor cociente es el TBT en `3g`, 1 405–2 638 ms, 1,88 veces). CLS en `3g` va de 0 a 0,011: formalmente "inestable" por la regla `min` 0 / `max` > 0, pero ambos valores son `good` y no cambia nada. Los rangos del TBT de los tres perfiles se solapan entre sí, así que no se puede decir que ninguna red sea peor para el TBT.

El score ordena aquí las redes como cabría esperar (71 / 67 / 39), pero la skill avisa de que no es una comparación fiable en general; ordeno por métricas.

## Tabla priorizada

Orden: (1) causa de la única métrica `poor` en el perfil de referencia (TBT); (2) causas de LCP, que es `poor` solo en `3g` (más `needs-improvement` en `default`); (3) el resto. Los ahorros se solapan; no se suman.

| #   | Problema (causa raíz)                              | Evidencia medida                                                                                                                                                                           | Ante la red (ahorro `default` / `3g` / `4g`)                                                                               | Métricas | Esfuerzo (hipótesis) |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------- |
| 1   | Hilo principal saturado por JavaScript             | `bootup-time`: 2 800 / 3 650 / 3 300 ms; `mainthread-work-breakdown`: 2 300 / 2 650 / 3 350 ms; `long-tasks`: 20 tareas largas en los tres; `framework.js` 5 118 / 6 582 / 5 704 ms de CPU | **Independiente** (cocientes máx/mín 1,30 y 1,46; TBT `poor` en los tres)                                                  | TBT      | L                    |
| 2   | Imágenes de banner más pesadas de lo necesario     | `image-delivery-insight`: 300 / 600 / 100 ms; 115 135 / 115 135 / 255 108 B de ahorro (112 / 112 / 249 KiB); 3 / 3 / 6 imágenes                                                            | **Sensible** (cociente 6; `impact` medium / high / medium); LCP `needs-improvement` / `poor` / `good`                      | LCP      | S–M                  |
| 3   | JavaScript sin usar o heredado (propio y terceros) | `unused-javascript`: 0 ms en los tres; 199 870 / 810 107 / 173 798 B (195 / 791 / 170 KiB); `legacy-javascript-insight`: 0 ms, 23 790 / 23 792 / 23 909 B                                  | **Sensible en bytes, sin ahorro en ms en ninguno**; los 10 scripts de `3g` incluyen terceros que no salen en los otros dos | FCP, LCP | M–L                  |
| 4   | CSS sin usar del banner de consentimiento          | `unused-css-rules`: 0 ms; 16 558 / 14 066 / 14 066 B (16 / 14 / 14 KiB)                                                                                                                    | **Independiente** en bytes, sin ahorro medido                                                                              | FCP, LCP | S                    |

Aparte (no es primera carga): `cache-insight`, 8 451 / 8 456 / 8 478 B, sin ahorro en ms. Mide visitas repetidas.

## Detalle

### 1. Hilo principal saturado por JavaScript: _medición_ + _hipótesis_

**Medido:** TBT `poor` en los tres perfiles (2 322, 2 045 y 2 850 ms). `bootup-time` y `mainthread-work-breakdown` apuntan a TBT en los tres y `long-tasks` cuenta 20 tareas largas en cada uno. Mayores consumidores de CPU en `default` (`bootup-time`): `/mobify/bundle/668/framework.js` 5 118 ms, `vendor.js` 923 ms, el propio documento `/es/online` 800 ms, `main.js` 210 ms y `cdn-cgi/.../rocket-loader.min.js` 137 ms. Los valores de `cpuMs` son CPU total, no TBT: no son comparables entre sí.
**Hipótesis:** los nombres `/mobify/bundle/` apuntan a una tienda React con hidratación en cliente (aspecto de Salesforce PWA Kit); `framework.js` concentra la CPU, probablemente por hidratar toda la página. Además, el HTML público (fuente: curl) trae todos los `<script async data-chunk=...>` con `type="c252d4a9...-text/javascript"` y carga `rocket-loader.min.js`: indica que Cloudflare Rocket Loader está reescribiendo y reordenando la ejecución de los scripts. Puede estar añadiendo trabajo o retrasando la ejecución; no está medido su efecto.
**Cómo comprobarlo:** en DevTools > Performance, ver qué tarea larga domina al cargar; probar la página con Rocket Loader desactivado y comparar con `perf-compare`; revisar si la hidratación puede ser parcial o diferida para lo que está bajo el pliegue.
**Esfuerzo L (hipótesis):** requiere tocar la estrategia de hidratación y el bundle; desactivar Rocket Loader sería S.

### 2. Imágenes de banner: _medición_ + _hipótesis_

**Medido:** `image-delivery-insight` marca, en `default`, tres banners (por ejemplo `B_MB_EGEN_MBL_ES_tardor.jpg`: 52 257 B de ahorro sobre 88 152 B); en `4g` marca seis imágenes y 255 108 B. Es el único hallazgo que se mueve con el rating del LCP: 2 590 ms (`needs-improvement`) en `default`, 6 028 ms (`poor`) en `3g`, 547 ms (`good`) en `4g`. Los bytes son iguales en `default` y `3g` y el tiempo se duplica, así que en esas dos la red decide cuánto duele. En `4g` los bytes difieren (más imágenes detectadas): no es comparable directamente.
**Hipótesis:** las URLs ya piden `fmt=webp` y `sw=800`, pero con `q=90` (fuente: URL de los items); bajar la calidad o ajustar `sw` reduciría peso. El reporte no identifica el elemento LCP (`lcp-discovery-insight` no aparece): no se puede afirmar que el LCP sea uno de estos banners.
**Esfuerzo S–M (hipótesis):** son parámetros de URL del servicio de imágenes; M si hay que revisar plantillas.

### 3. JavaScript sin usar o heredado: _medición_ + _hipótesis_

**Medido:** `unused-javascript` en `default`: `vendor.js` 130 687 B sin usar de 201 747 (128 KiB), `ui.js` 24 220 B, `main.js` 22 959 B, `sdk.js` 22 004 B. `legacy-javascript-insight`: `vendor.js` 13 434 B y `beacon.min.js` de Cloudflare 10 356 B. Ningún perfil asigna ahorro en ms. En `3g` la lista llega a 810 107 B porque incluye ocho scripts de terceros: seis de Google Tag Manager/gtag (487 940 B sin usar, fuente: cálculo sobre `wastedBytes` de los items) y dos de `privacy-center.org` (el SDK de consentimiento). Esos terceros no aparecen en los items de `default` ni de `4g`: se ven solo en un perfil.
**Un dato a revisar:** uno de los scripts de gtag es `id=G-XXXXXXX-FAKE`. Es una _hipótesis_ (un identificador de prueba cargado en producción), visible solo en `3g`; comprobar en el contenedor de GTM.
**Cautela:** los `totalBytes` de esos seis scripts de GTM suman más que `resources.byType.script` (577 294 B en `3g`) (fuente: cálculo), así que no uso esa cifra para dimensionar los terceros. Es un mínimo parcial y no sé de qué ejecución sale.
**Esfuerzo M–L (hipótesis):** code-splitting de `vendor.js` es L; revisar los tags es S.

### 4. CSS sin usar del banner de consentimiento: _medición_

**Medido:** `unused-css-rules` señala un único recurso, CSS de `#didomi-host` (Didomi, el banner de cookies): 16 558 B en `default`. Sin ahorro en ms. Es un tercero; solo se resolvería con su configuración.

## Qué no está medido

- El elemento LCP no está identificado (`lcp-discovery-insight` no trae datos), así que no puedo decir qué imagen o texto es.
- `forced-reflow-insight` aparece solo en `3g`, sin ahorro (cuenta como "solo visible en un perfil"). `network-dependency-tree-insight` sin ahorro en ninguno.
- `server-response-time` dice "Root document took 110 ms" (`default`), 90 ms (`3g`) y 140 ms (`4g`), pero `metrics.ttfb` es 624, 1 223 y 186 ms: es una contradicción entre diagnóstico y métrica. Cito la métrica y no priorizo el servidor, aunque el TTFB de `3g` (`needs-improvement`) lo pide a ese perfil.
- Los terceros no tienen oportunidad propia: en `default` los únicos visibles son Cloudflare (Rocket Loader 137 ms de CPU, beacon con 10 356 B de código heredado). El peso real de GTM y consentimiento solo se ve en `3g`.
- Tres redes simuladas no son todas las redes: estas cifras hablan de estos perfiles, no de usuarios reales.

## Siguiente paso

Recomiendo empezar por el 1 (el único `poor` en los tres perfiles) y, como acción rápida y comprobable, probar desactivar Rocket Loader y revisar la etiqueta `G-XXXXXXX-FAKE`. Después el 2 para el LCP en redes lentas. ¿Cuáles quieres abordar? No hay código fuente aquí; `perf-fix` aplica cambios en un repo propio y `perf-compare` mediría el efecto después.
