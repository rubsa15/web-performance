## Veredicto

**Mejora medida.** El CLS pasa de `poor` a `good` y no hay ninguna métrica `regressed`. Comparación `wperf compare 2026-10-22T07-39-28Z-mobile 2026-10-22T07-45-22Z-mobile` (veredicto global del CLI: `improved`). Antes: `2026-10-22T07-39-28Z-mobile`. Después: `2026-10-22T07-45-22Z-mobile`. Las dos mediciones son mobile, red `default`, 3 ejecuciones, URL `http://127.0.0.1:4173/` (mismo puerto y mismo comando de servidor). `warnings` de la comparación: vacío.

## Qué se cambió

`index.html`: se añadieron `width` y `height` a las 7 etiquetas `<img>`. Son 7 líneas modificadas (fuente: `git diff`). El hero lleva `width="3200" height="2000"` y `cafe-1` a `cafe-6` llevan `width="1600" height="1067"` (fuente: `file` sobre los JPEG). No se tocó CSS ni ningún otro fichero. `git status --short` muestra solo ` M index.html`. No hay commit ni push.

## Antes → después

Métricas (copiadas de `compare`):

| Métrica | Antes | Después | `change` del CLI | Clasificación |
| --- | --- | --- | --- | --- |
| CLS | 0,291 (`poor`) | 0 (`good`) | `improved` | Mejora |
| Score | 47 | 65 (delta 18) | `improved` | Mejora |
| LCP | 40729 ms | 40728 ms | `unchanged` | Ruido |
| FCP | 2495 ms | 2492 ms | `unchanged` | Ruido |
| TBT | 417 ms | 298 ms | `unchanged` | Ruido |
| SI | 2495 ms | 2492 ms | `unchanged` | Ruido |
| TTFB | 752 ms | 752 ms | `unchanged` | Ruido |

- El TBT bajó en el número (-119 ms), pero el CLI lo marca `unchanged`: los rangos min–max de las ejecuciones se solapan (309–610 ms antes, 232–442 ms después). No lo cuento como mejora.
- El elemento LCP no cambió (`lcpElement.changed: false`, sigue siendo `body > main > section.hero > img.hero-img`).

Oportunidades:

| Oportunidad | `status` | `deltaMs` | `deltaBytes` |
| --- | --- | --- | --- |
| `unsized-images` | `resolved` | 0 | 0 |
| `cls-culprits-insight` | `resolved` | 0 | 0 |

## Integridad de la página

- `page-check diff antes.json despues.json`: "La página sigue íntegra". Mismas 7 imágenes cargadas, mismo texto.
- Hay 1 error de consola y 1 petición fallida (`404 http://127.0.0.1:4173/favicon.ico`). Estaban igual antes del cambio, así que no son nuevos.
- Capturas: las vi las dos y son visualmente idénticas, con proporciones intactas en el hero y en las 6 tarjetas, sin deformaciones. Conviene que las revises tú también.
- El repo no tiene `package.json`, así que no hay build, lint ni tests que ejecutar.

Ficheros de `page-check` (en `.perf/`, ignorado por git):
- `/private/tmp/claude-501/-Users-rubensanz-projects-web-performance/224b6335-cab2-49ca-9ac5-39a468a6db77/scratchpad/fix-eval/case-2/.perf/page-check/antes.json`
- `/private/tmp/claude-501/-Users-rubensanz-projects-web-performance/224b6335-cab2-49ca-9ac5-39a468a6db77/scratchpad/fix-eval/case-2/.perf/page-check/antes.png`
- `/private/tmp/claude-501/-Users-rubensanz-projects-web-performance/224b6335-cab2-49ca-9ac5-39a468a6db77/scratchpad/fix-eval/case-2/.perf/page-check/despues.json`
- `/private/tmp/claude-501/-Users-rubensanz-projects-web-performance/224b6335-cab2-49ca-9ac5-39a468a6db77/scratchpad/fix-eval/case-2/.perf/page-check/despues.png`

Reporte "después" en `.perf/reports/127.0.0.1-4173/2026-10-22T07-45-22Z-mobile.json`, comparación en `.perf/comparacion.json`. El servidor de la web está cerrado.

## Qué queda

Lo que vi en el reporte y no toqué (siguen `same` en la comparación):
- `image-delivery-insight`: `savingsMs` 32900 y `savingsBytes` 8154587, impacto alto. El LCP sigue en `poor` (40728 ms), y esta es la causa más probable (hipótesis).
- `bootup-time` (TBT).
- `font-display-insight`.
- `render-blocking-insight`.
- `unused-javascript`.

Los cambios no están commiteados; están en el árbol de trabajo para que los revises. ¿Abordo otra causa, por ejemplo la imagen del hero pesada que afecta al LCP?
