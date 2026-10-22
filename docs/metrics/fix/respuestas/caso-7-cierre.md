## Veredicto: mejora medida

TBT `improved` y ninguna métrica `regressed` (comparación `2026-10-22T07-39-28Z-mobile` → `2026-10-22T07-56-52Z-mobile`, veredicto global `improved`). Antes: `2026-10-22T07-39-28Z-mobile`. Después: `2026-10-22T07-56-52Z-mobile`. Mismo perfil en ambos lados (mobile, red default, 3 ejecuciones), misma URL `http://127.0.0.1:4173/` servida con el mismo comando. `warnings` de la comparación vacío.

## Qué se cambió

Sin commit; los cambios están en el árbol de trabajo (`git status --short`: `M js/app.js` y `?? js/search-index.worker.js`).

- `js/app.js`: se eliminó `buildSearchIndex()` y su arranque con `setTimeout`. Ahora, tras `DOMContentLoaded` y `requestAnimationFrame`, crea un `Worker('js/search-index.worker.js')` que al terminar asigna `window.searchIndex` y se cierra.
- `js/search-index.worker.js` (nuevo, 15 líneas, fuente: código): el mismo bucle de 150 000 entradas y el mismo `sort` con `localeCompare(..., 'es')`, movidos tal cual, y `self.postMessage(entries)`.

## Antes → después (cifras de `wperf compare`)

Mejora

| Métrica | Antes | Después | Delta | Cambio | Rating |
| --- | --- | --- | --- | --- | --- |
| TBT | 417 ms | 39 ms | -378 ms (-90,6 %) | improved | needs-improvement → good |
| Puntuación | 47 | 57 | +10 | improved | |

Ruido (`unchanged`)

| Métrica | Antes | Después | Delta |
| --- | --- | --- | --- |
| LCP | 40729 ms | 40728 ms | -1 ms |
| FCP | 2495 ms | 2492 ms | -3 ms |
| Speed Index | 2495 ms | 2492 ms | -3 ms |
| CLS | 0,291 | 0,291 | 0 |
| TTFB | 752 ms | 752 ms | 0 ms |

Empeora: ninguna.

Oportunidad objetivo

| Oportunidad | Status | deltaMs | deltaBytes |
| --- | --- | --- | --- |
| `bootup-time` | resolved | -400 ms | 0 |

El resto de oportunidades quedan en `same`. El elemento LCP no cambió (`lcpElement.changed: false`). El peso total de la página varía en 64 bytes, que corresponden al script nuevo.

Rangos de TBT (fuente: reportes): antes 309–610 ms, después 38–39 ms. No se solapan, así que la mejora no se explica por la dispersión. No hizo falta repetir la medición.

Diagnósticos del reporte "después" (fuente: reporte `2026-10-22T07-56-52Z-mobile`, no son del `compare`): `mainthread-work-breakdown` pasa de 1.9 s a 0.8 s, y `bootup-time` aparece ahora como diagnóstico informativo de 0.4 s. `long-tasks` sigue marcando "2 long tasks found".

## Integridad de la página

`page-check diff` antes/después: "La página sigue íntegra."
- Sin cambios en texto ni imágenes (7 cargan).
- Mismo estado del JS: `window.searchIndex` tiene 150000 entradas en ambos lados.
- Sin errores nuevos. Los 1 error de consola y 1 petición fallida son los mismos de antes (404 de `/favicon.ico`, fuente: snapshot).

Instantáneas y capturas:
- `/private/tmp/claude-501/-Users-rubensanz-projects-web-performance/224b6335-cab2-49ca-9ac5-39a468a6db77/scratchpad/fix-eval/responses/caso-7-antes.json`
- `/private/tmp/claude-501/-Users-rubensanz-projects-web-performance/224b6335-cab2-49ca-9ac5-39a468a6db77/scratchpad/fix-eval/responses/caso-7-antes.png`
- `/private/tmp/claude-501/-Users-rubensanz-projects-web-performance/224b6335-cab2-49ca-9ac5-39a468a6db77/scratchpad/fix-eval/responses/caso-7-despues.json`
- `/private/tmp/claude-501/-Users-rubensanz-projects-web-performance/224b6335-cab2-49ca-9ac5-39a468a6db77/scratchpad/fix-eval/responses/caso-7-despues.png`

Falta por mirar a mano: las dos capturas, para descartar cambios de layout que el diff de texto no ve. El arreglo no toca HTML ni CSS. El proyecto no tiene `package.json`, build ni tests, así que no hubo nada más que ejecutar. `window.searchIndex` ahora se asigna de forma asíncrona (la instantánea la ve completa al terminar); nada del repo lo lee hoy.

El servidor del puerto 4173 está cerrado. Comparación completa en `.../responses/caso-7-comparacion.json`.

## Qué queda

Causas vistas y no tocadas (siguen `same` en la comparación):
- Imágenes pesadas: `image-delivery-insight` (savingsMs 32900, savingsBytes 8154587). El LCP, que es la imagen `hero.jpg`, sigue en 40728 ms, `poor`.
- Imágenes sin `width`/`height` (`unsized-images`), con CLS 0,291 en `poor`.
- Recursos que bloquean el render (`render-blocking-insight`, savingsMs 1550): `three.min.js`, `styles.css` y `app.js` en `<head>`.
- JavaScript sin usar (`unused-javascript`, savingsBytes 120895): `three.min.js`, que `app.js` ya declara que nadie ejecuta.
- `font-display` (`font-display-insight`, savingsMs 300).
- `long-tasks` sigue marcando "2 long tasks found". Hipótesis: no vienen de `buildSearchIndex`, sino de otro trabajo de arranque (por ejemplo el análisis de `three.min.js`); este informe no lo demuestra.

¿Abordas otra causa? Recuerda que los cambios no están commiteados.
