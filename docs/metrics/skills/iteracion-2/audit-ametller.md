# Auditoría de rendimiento: Ametller Origen (mobile)

## Resumen

URL `https://www.ametllerorigen.com/es/online` · mobile · 3 ejecuciones por perfil · Lighthouse 13.5.0 · Chrome 155 · sin `warnings` en ningún reporte.
Reportes: `2026-10-21T21-11-58Z-mobile` (`default`, referencia), `2026-10-21T21-12-44Z-mobile-3g`, `2026-10-21T21-13-29Z-mobile-4g`.
Nota: `git.dirty` es `true` en los tres (es el estado del repo de wperf, no de la web auditada).

| Métrica | `default` (referencia)       | `3g`                         | `4g`            |
| ------- | ---------------------------- | ---------------------------- | --------------- |
| Score   | 67                           | 44                           | 71              |
| LCP     | 2 591 ms · needs-improvement | 5 725 ms · poor              | 579 ms · good   |
| FCP     | 1 226 ms · good              | 2 578 ms · needs-improvement | 460 ms · good   |
| TBT     | 2 145 ms · poor              | 1 498 ms · poor              | 2 691 ms · poor |
| CLS     | 0 · good                     | 0 · good                     | 0 · good        |
| SI      | 4 136 ms · needs-improvement | 5 899 ms · poor              | 1 793 ms · good |
| TTFB    | 624 ms · good                | 1 225 ms · needs-improvement | 184 ms · good   |

Rangos `min`–`max` (ms): TBT `default` 2 125–3 181, `3g` 1 374–2 218, `4g` 2 449–3 195. `default` solapa con `3g` y con `4g`, así que no afirmo que ninguno sea peor que `default`; `3g` (máx. 2 218) y `4g` (mín. 2 449) sí no se solapan. En ninguna métrica de ningún perfil `max` supera el doble de `min`, así que no hay avisos de inestabilidad.

La página transfiere 1,43 MiB (`resources.totalBytes` = 1 495 712 B, `default`): imágenes 641 KiB, scripts 564 KiB, fuentes 130 KiB, sin vídeo ni CSS externo (`byType`). No hay problema de peso: el problema dominante es CPU. El TBT está en `poor` en las tres redes, mientras que LCP y FCP dependen mucho de la red (LCP pasa de `good` en `4g` a `poor` en `3g`).

El score no ordena las redes de forma intuitiva (67 / 44 / 71): con `4g` el LCP es excelente (579 ms) pero el TBT es el peor de los tres (2 691 ms).

## Tabla priorizada

| #   | Problema (causa raíz)                                  | Evidencia medida (ahorro `default` / `3g` / `4g`)                                                                                                                                  | Ante la red                                                                                                                        | Métricas | Esfuerzo (hipótesis) |
| --- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------- |
| 1   | Hilo principal saturado por JS (bundle `framework.js`) | `bootup-time`: 2 650 / 2 800 / 3 200 ms; `mainthread-work-breakdown`: 2 150 / 1 500 / 3 200 ms; `framework.js` 4 955 / 5 051 / 5 413 ms de CPU; `forced-reflow-insight` sin ahorro | **Presente en los tres** (TBT `poor` en los tres). El ahorro y el TBT se mueven con la red aunque la CPU es parecida (ver detalle) | TBT      | L                    |
| 2   | Imágenes de banner sobredimensionadas                  | `image-delivery-insight`: 300 / 600 / 50 ms y 115 135 B (112 KiB) en los tres; 3 imágenes de `mainbanner` (52 257 B la primera)                                                    | **Sensible**: mismos bytes, el tiempo lo decide la red                                                                             | LCP      | M                    |
| 3   | JS sin usar y heredado                                 | `unused-javascript`: 0 ms, 199 878 / 199 887 / 173 793 B (195 / 195 / 170 KiB); `vendor.js` 130 693 B sin usar de 201 756 B; `legacy-javascript-insight`: 23 783 B                 | **Independiente en bytes**; sin ahorro en ms en ningún perfil                                                                      | FCP, LCP | M                    |
| 4   | Terceros menores (consentimiento Didomi, Cloudflare)   | `unused-css-rules`: 16 558 B (CSS de `#didomi-host`); `legacy-javascript-insight`: `beacon.min.js` de Cloudflare Insights 10 356 B; `rocket-loader.min.js` 112 ms de CPU           | Independiente (bytes iguales)                                                                                                      | FCP, LCP | S                    |

Aparte, sin entrar en la prioridad (visitas repetidas): `cache-insight`, 8 470 / 8 457 / 8 516 B, 0 ms de ahorro.

Prioridad: la fila 1 va primero porque el TBT es el único `poor` en el perfil de referencia. La 2 sube por encima de la 3 porque el LCP es `poor` en `3g` y su `impact` es `medium` / `high` / `medium`, frente a `medium` y 0 ms del JS sin usar. Los ahorros se solapan; no se suman.

## Detalle

### 1. Hilo principal saturado por JS: _medición_ + _hipótesis_

**Medido:** TBT 2 145 ms `poor` (`default`), 1 498 ms (`3g`), 2 691 ms (`4g`). `bootup-time` atribuye CPU a `/mobify/bundle/668/framework.js` (4 955 ms en `default`), `vendor.js` (943 ms), el propio documento `/es/online` (799 ms), `Unattributable` (613 ms) y `main.js` (216 ms). Suma de CPU por origen en `default`: 7 025 ms del origen propio y 613 ms sin atribuir (fuente: cálculo, 4 955 + 943 + 799 + 216 + 112 = 7 025 y 613). El diagnóstico `long-tasks` indica 20 tareas largas. Nota: `cpuMs` es CPU total, no TBT.
**Entre redes:** el TBT cambia de 1 498 a 2 691 ms con CPU casi igual (`framework.js` 5 051 y 5 413 ms). Hipótesis: con red lenta el FCP se retrasa (2 578 ms en `3g` frente a 460 ms en `4g`) y parte de la tarea larga cae fuera de la ventana FCP–TTI. El problema de CPU existe igual en los tres perfiles.
**Hipótesis:** la ruta `/mobify/bundle/...` sugiere una tienda PWA headless (Salesforce PWA Kit); el coste de hidratación de React estaría detrás de `framework.js`. No lo he verificado.
**Comprobación:** perfil de Performance en DevTools con throttling de CPU 4× para ver qué tarea larga ocupa `framework.js`; revisar si la hidratación se puede diferir o trocear.
**Esfuerzo L:** requiere tocar la arquitectura de render del front.

### 2. Imágenes de banner sobredimensionadas: _medición_ + _hipótesis_

**Medido:** `image-delivery-insight` marca 3 imágenes del carrusel de portada (`homepage/mainbanner/...?sw=800&fmt=webp&q=90`) con 115 135 B de ahorro posible (112 KiB). El ahorro en tiempo es 300 ms (`default`, impact `medium`), 600 ms (`3g`, `high`) y 50 ms (`4g`). LCP: 2 591 / 5 725 / 579 ms.
**Hipótesis:** `q=90` y `sw=800` son parámetros del CDN de imágenes (Demandware) y bajarlos reduciría peso. El elemento LCP no está identificado: `lcp-discovery-insight` no aparece en el reporte y `network-dependency-tree-insight` viene vacío, así que no puedo afirmar que sea uno de estos banners.
**Comprobación:** inspeccionar en DevTools qué elemento marca el LCP y probar `q=75`.
**Esfuerzo M:** cambio de parámetros en la plantilla, sin regenerar assets.

### 3. JS sin usar y heredado: _medición_ + _hipótesis_

**Medido:** `unused-javascript` suma 199 878 B sin usar en `default`: `vendor.js` 130 693 B (de 201 756), `ui.js` 24 220 B, `main.js` 22 961 B, `sdk.js` 22 004 B. `legacy-javascript-insight`: 23 783 B (`vendor.js` 13 427 B). Ambos con 0 ms de ahorro y `affectedMetrics` FCP y LCP; en `4g` `sdk.js` desaparece y el total baja a 173 793 B.
**Hipótesis:** `vendor.js` contiene librerías cargadas para toda la tienda aunque la portada no las use. Comprobar con el informe de cobertura de DevTools.
**Esfuerzo M:** code-splitting por ruta.

### 4. Terceros menores: _medición_

Origen Didomi (consentimiento): `unused-css-rules` 16 558 B. Cloudflare: `beacon.min.js` (10 356 B heredados, 4 140 B en `cache-insight`) y `rocket-loader.min.js` (112 ms de CPU). El peso es pequeño; es la fila de menor retorno. Esfuerzo S si se puede quitar el beacon.

## Qué no está medido

- El elemento LCP no está identificado.
- `cache-insight` (8 470 B) mide visitas repetidas, no la primera carga.
- `unused-javascript`, `legacy-javascript-insight` y `unused-css-rules` no traen ahorro en ms.
- `server-response-time` aparece como diagnóstico ("Root document took 140 ms"); para el servidor cito el `ttfb` de las métricas (624 ms `default`, 1 225 ms `3g`, 184 ms `4g`).
- Para el peso total uso `resources.totalBytes` (1 495 712 B = 1,43 MiB). El diagnóstico `total-byte-weight` dice "Total size was 1,524 KiB", una cifra distinta (mide por su cuenta).
- CLS es 0 en los tres perfiles; sin problemas de estabilidad visual.
- No he comprobado el HTML con `curl`: los datos (sin `media`, imágenes 641 KiB) no sugieren ningún hallazgo indirecto que merezca la verificación.
- Tres redes simuladas no son todas las redes: este informe habla de estos perfiles, no de los usuarios reales.

## Siguiente paso

Recomiendo empezar por la 1 (el único TBT `poor` en la referencia) y la 2 (el LCP se vuelve `poor` en `3g`). ¿Cuáles quieres abordar? Sin código fuente de la web, la comprobación de cada hipótesis es por DevTools; para aplicar cambios y volver a medir, `perf-fix` y `perf-compare`.
