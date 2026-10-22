## Cierre perf-fix: carga diferida de la galería (`#cafes`)

**Veredicto: mejora medida en LCP, sin regresiones y con la página íntegra.** Comparación `2026-10-22T07-39-28Z-mobile` (antes) → `2026-10-22T07-53-46Z-mobile` (después), veredicto del CLI `improved`. Perfil mobile, red `default`, 3 ejecuciones en ambos lados. Misma URL (`http://127.0.0.1:4173/`), mismo servidor y mismo puerto. `warnings` está vacío. Sin commit ni push.

Lo medido apoya el LCP, pero **no** una reducción de bytes (ver el aviso en "Antes → después").

### Qué se cambió

- Un solo fichero, `index.html`: 6 líneas (fuente: `git diff --stat`). Las seis `<img>` de `section#cafes > div.grid > figure` (`img/cafe-1.jpg` a `img/cafe-6.jpg`) llevan ahora `loading="lazy" decoding="async"`.
- Aplicado el diff reducido que aprobaste, **sin** `width`/`height` (el CLS queda para otra ronda).
- `hero.jpg` (el elemento LCP) sigue cargando de forma inmediata.
- No se crearon ficheros en el repo. `git status --short` muestra solo ` M index.html`.

### Antes → después

Cifras copiadas de `comparacion.json`. `rating` entre paréntesis.

**Mejora**

| Métrica | Antes | Después | Cambio |
|---|---|---|---|
| LCP | 40729 ms (`poor`) | 27379 ms (`poor`) | -13350 ms, -32,8 % (`improved`) |

El rango min–max de LCP no se solapa: 40727–40730 ms antes y 27378–27530 ms después. El LCP sigue en `poor`.

**Ruido (`unchanged`)**

| Métrica | Antes | Después |
|---|---|---|
| Score | 47 | 51 (delta +4, `unchanged`) |
| FCP | 2495 ms | 2491 ms |
| TBT | 417 ms | 424 ms |
| CLS | 0,291 (`poor`) | 0,291 (`poor`) |
| SI | 2495 ms | 2491 ms |
| TTFB | 752 ms | 752 ms |

**Empeora (`regressed`):** ninguna métrica.

**Sobre el CLS.** Al diferir imágenes sin dimensiones temías un empeoramiento, y no se ha producido: `unchanged`, 0,291 en ambos. El CLS sigue `poor` por otra causa raíz.

**Oportunidades**

| Oportunidad | Estado | Antes → después |
|---|---|---|
| `image-delivery-insight` | `better` | ahorro 32900 ms → 14450 ms (`deltaMs` -18450), ahorro de bytes 8154587 B sin cambio (`deltaBytes` 0) |
| `cls-culprits-insight` | `resolved` | ahorro 0 ms en ambos; con CLS `unchanged`, no lo vendo como mejora |
| `mainthread-work-breakdown` | `new` | 950 ms (afecta a TBT) |
| `bootup-time` | `worse` | 400 ms → 950 ms (`deltaMs` 550) |

`mainthread-work-breakdown` y `bootup-time` apuntan a TBT, que es `unchanged`. El TBT es ruidoso en este sitio: rango 309–610 ms antes y 258–931 ms después. No es regresión medible. Hipótesis: es variación de la tarea larga de `js/app.js`, no del cambio.

**Aviso: los bytes no bajaron en la medición.**

- `resources.byType.image` es 8492779 B (8,10 MiB, fuente: cálculo) antes y después (delta 0).
- Los bytes totales pasan de 8699348 B a 8699369 B (+21 B, solo el documento, por los atributos añadidos).
- Hipótesis: la auditoría de Lighthouse acaba descargando las seis imágenes igualmente, por lo que `lazy` no reduce los bytes que ve esta medición.
- Hipótesis: la bajada de LCP es un efecto del modelo de simulación (`throttling: simulate`) y no una menor descarga.
- El desglose real del LCP no mejora. `loadDuration` pasa de 458 a 582 ms y `renderDelay` de 75 a 142 ms (`lcp.breakdown` del reporte). Es de la carga real y no suma el LCP simulado.
- `lcpElement.changed` es `false`: el elemento LCP sigue siendo `body > main > section.hero > img.hero-img`, así que el salto no se debe a un cambio de elemento.
- Conclusión: la mejora de LCP está medida, pero el mecanismo no está demostrado. En un navegador real con red lenta el efecto sobre los bytes iniciales sería distinto, y eso no lo he medido.

### Integridad de la página

- `page-check diff antes.json despues.json` → "La página sigue íntegra" (código 0).
- Ambas instantáneas dan 7 imágenes cargadas, 1 error de consola y 1 petición fallida. Son los mismos antes y después: el 404 de `/favicon.ico`, que ya existía.
- El índice de búsqueda tiene 150000 entradas en ambas.
- Las dos capturas (412×3365) las he mirado y son visualmente idénticas: seis figuras con sus proporciones y la galería completa tras el scroll.
- Instantáneas y capturas:
  - `/private/tmp/claude-501/-Users-rubensanz-projects-web-performance/224b6335-cab2-49ca-9ac5-39a468a6db77/scratchpad/fix-eval/responses/caso-6-pagecheck/antes.json`
  - `/private/tmp/claude-501/-Users-rubensanz-projects-web-performance/224b6335-cab2-49ca-9ac5-39a468a6db77/scratchpad/fix-eval/responses/caso-6-pagecheck/antes.png`
  - `/private/tmp/claude-501/-Users-rubensanz-projects-web-performance/224b6335-cab2-49ca-9ac5-39a468a6db77/scratchpad/fix-eval/responses/caso-6-pagecheck/despues.json`
  - `/private/tmp/claude-501/-Users-rubensanz-projects-web-performance/224b6335-cab2-49ca-9ac5-39a468a6db77/scratchpad/fix-eval/responses/caso-6-pagecheck/despues.png`
  - También en esa carpeta: `comparacion.json`, `despues-reporte.json` y los registros de servidor y CLI.
- El repo no tiene `package.json`, así que no hay build, lint ni tests que ejecutar.
- Falta por mirar a mano: el desplazamiento real de la página en un móvil, porque las capturas no muestran saltos de layout mientras se hace scroll.

### Qué queda

Causas vistas y no tocadas, cada una para su propia ronda:

- **CLS 0,291 (`poor`):** las imágenes sin `width`/`height` (`unsized-images`), el hero incluido. Es la ronda natural siguiente y haría seguro el `lazy`.
- **Imágenes sobredimensionadas** (`image-delivery-insight`): `hero.jpg` y las 6 de la galería, todas con ~0,86–2,95 MB de desperdicio (`wastedBytes`). Ahí está el peso de verdad (8,10 MiB de imagen).
- **`three.min.js`** sin usar y los scripts bloqueantes en `<head>` (`render-blocking-insight`).
- **Tarea larga** `buildSearchIndex` en `js/app.js` (TBT).
- **`@font-face` sin `font-display`.**

El servidor del puerto 4173 está cerrado. Los cambios no están commiteados: `index.html` queda modificado en el árbol de trabajo. Se revierte con `git checkout -- index.html`.

¿Abordo otra causa, por ejemplo el CLS?
