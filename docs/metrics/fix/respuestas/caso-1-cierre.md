## Cierre perf-fix: imagen hero (`image-delivery-insight` + `lcp-discovery-insight`)

**1. Veredicto: mejora medida.**
- Comparación `2026-10-22T07-39-28Z-mobile` → `2026-10-22T07-42-48Z-mobile`. El `verdict` del CLI es `improved`.
- Antes: `2026-10-22T07-39-28Z-mobile` (etiqueta `base-fix-eval`, commit `abbfa96`, `dirty: false`).
- Después: `2026-10-22T07-42-48Z-mobile` (etiqueta `despues-hero`, `abbfa96` con `dirty: true` por mis cambios).
- Mismo perfil (mobile, red default, 3 ejecuciones), misma URL `http://127.0.0.1:4173/` y mismo comando de servidor. `warnings` vacío.
- Ninguna métrica `regressed`.
- El LCP mejora, pero sigue en `poor` (40729 → 24381 ms). La causa del LCP restante no está resuelta.

**2. Qué se cambió** (aplicado tal como aprobaste; sin commit)
- `index.html`: el `<img class="hero-img">` pasa a llevar `src="img/hero-960.jpg"`, `srcset` (480w/960w/1600w), `sizes="100vw"` y `fetchpriority="high"`.
- Ficheros nuevos, generados con `sips --resampleWidth <w> -s format jpeg -s formatOptions 70 img/hero.jpg --out img/hero-<w>.jpg`:
  - `img/hero-480.jpg`: 480×300, 12618 B (fuente: fichero).
  - `img/hero-960.jpg`: 960×600, 65506 B (fuente: fichero).
  - `img/hero-1600.jpg`: 1600×1000, 282430 B (fuente: fichero).
- El original `img/hero.jpg` (3003499 B, 3200×2000) se conserva.
- `git status --short`: ` M index.html` y los tres `img/hero-*.jpg` sin seguimiento. El repo no tiene build, lint ni tests, así que no había nada que ejecutar.
- Nada commiteado ni pusheado.

**3. Antes → después** (cifras de `wperf compare`)

| Métrica | Antes | Después | Cambio | Clasificación |
|---|---|---|---|---|
| LCP | 40729 ms (poor) | 24381 ms (poor) | -16348 ms (-40,1 %) | **mejora** (`improved`) |
| FCP | 2495 ms | 2491 ms | -4 ms | ruido (`unchanged`) |
| TBT | 417 ms | 282 ms | -135 ms | ruido (`unchanged`) |
| CLS | 0.291 (poor) | 0.291 (poor) | 0 | ruido (`unchanged`) |
| SI | 2495 ms | 2491 ms | -4 ms | ruido (`unchanged`) |
| TTFB | 752 ms | 752 ms | 0 | ruido (`unchanged`) |
| Score | 47 | 51 | +4 | ruido (`unchanged`) |

- El TBT 417 → 282 ms es `unchanged` y no lo vendo como mejora: los rangos min–max se solapan (antes 309–610; después 153–455).
- `lcpElement.changed` es `false`: el elemento LCP sigue siendo `img.hero-img`. Ahora sirve `hero-960.jpg`, así que el salto sí se puede atribuir al arreglo.

| Oportunidad | `status` | savingsMs antes → después | `deltaMs` | savingsBytes antes → después | `deltaBytes` |
|---|---|---|---|---|---|
| `image-delivery-insight` | `better` | 32900 → 18050 | -14850 | 8154587 → 5233794 | -2920793 (-2,79 MiB, fuente: cálculo) |
| `lcp-discovery-insight` | `resolved` | 0 → ya no aparece | 0 | 0 | 0 |

- `image-delivery-insight` solo queda `better` y no `resolved`: persisten las 6 imágenes del catálogo, con 862539–872837 B de `wastedBytes` cada una. El hero baja de 2949349 B desperdiciados a 28556 B (`hero-960.jpg`, 65506 B).
- `lcp-discovery-insight` pasa de `priorityHinted: false` a `true` en `lcp.discovery`. Su ahorro ya era 0, así que "resolved" aquí es solo que el aviso desaparece.
- Desglose del LCP (carga real, no suma el LCP simulado):

| Fase | Antes | Después |
|---|---|---|
| ttfb | 4 ms | 2 ms |
| loadDelay | 12 ms | 9 ms |
| loadDuration | 458 ms | 307 ms |
| renderDelay | 75 ms | 112 ms |

- Bytes totales transferidos: 8699348 → 5761423 (-2937925; -2,80 MiB, fuente: cálculo). Las imágenes bajan de 8492779 a 5554784 B.

**4. Integridad de la página**
- `page-check diff`: "La página sigue íntegra." Mismas 7 imágenes, mismo texto, índice de búsqueda 150000.
- Antes y después tienen 1 error de consola y 1 petición fallida: el mismo 404 ("Failed to load resource ... 404"). No es del arreglo.
- Capturas antes y después, comparadas a simple vista: idénticas (misma maquetación; en el hero no veo diferencia de calidad con JPEG al 70 %). Falta que revises tú la calidad del hero en pantallas anchas o de alta densidad, donde se elegirá 960 o 1600 px.
- Instantáneas y capturas en `/private/tmp/claude-501/-Users-rubensanz-projects-web-performance/224b6335-cab2-49ca-9ac5-39a468a6db77/scratchpad/fix-eval/case-1/.perf/page-check/`:
  - `antes.json` y `antes.png`
  - `despues.json` y `despues.png`
- Otros artefactos en `.perf/` (ignorado por git): `.perf/despues-hero.json`, `.perf/comparacion.json`, `.perf/audit.err` y `.perf/serve.pid`.
- Servidor cerrado: tras el cierre, `curl` al puerto 4173 devuelve `000`.

**5. Qué queda** (causas vistas y no tocadas; los cambios no están commiteados)
- Las 6 imágenes del catálogo siguen sin optimizar, con 862539–872837 B de `wastedBytes` cada una.
- `render-blocking-insight`: 1550 ms, sin cambio.
- `unused-javascript` (`vendor/three.min.js`): 750 ms, sin cambio en bytes.
- `font-display-insight`: 300 ms.
- `bootup-time`: tarea larga del índice de búsqueda.
- CLS 0.291 (poor): hay imágenes sin `width`/`height` (`unsized-images`, `cls-culprits-insight`). El hero tampoco lo tiene.
- El LCP sigue en `poor` con 24381 ms. Lo más probable (hipótesis, no medido) es que el render-blocking y el JS síncrono en `<head>` retrasen el primer pintado.

¿Abordo otra causa? La más rentable para el LCP según el reporte es `render-blocking-insight`, o las 6 imágenes del catálogo, que sería una ronda aparte con su propia re-auditoría.
