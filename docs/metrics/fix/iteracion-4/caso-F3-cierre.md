## Veredicto: mejora medida

CLS `improved` y ninguna métrica `regressed`. Comparación `2026-10-22T19-13-10Z-mobile` → `2026-10-22T19-43-38Z-mobile`, veredicto global `improved`. Mismo perfil en ambos lados (mobile, red `default`, 3 ejecuciones), misma URL (`http://127.0.0.1:4173/`) servida con el mismo comando y el mismo puerto. `warnings` vacío. Ids: antes `2026-10-22T19-13-10Z-mobile` (etiqueta `base`), después `2026-10-22T19-43-38Z-mobile` (etiqueta `despues-imagenes-sin-dimensiones`).

## Qué se cambió

Sin commit; el cambio está en el árbol de trabajo (`git status --short`: ` M index.html`, 7 inserciones y 7 borrados).

- `index.html`: se añadieron `width`/`height` con las dimensiones intrínsecas a las 7 `<img>` (fuente: fichero, leídas con `sips`):
  - `img/hero.jpg`: `width="3200" height="2000"`.
  - `img/cafe-1.jpg` a `img/cafe-6.jpg`: `width="1600" height="1067"`.
- No se tocó el CSS ni ninguna otra imagen. Cada `<img>` quedó en una sola línea (no reflujé el hero a varias líneas como sugería el diff de la propuesta; el contenido es el mismo).

## Antes → después (cifras de `wperf compare`)

**Mejora**

| Métrica | Antes          | Después    | Delta           | `change`   |
| ------- | -------------- | ---------- | --------------- | ---------- |
| CLS     | 0,291 (`poor`) | 0 (`good`) | -0,291 (-100 %) | `improved` |
| Score   | 41             | 56         | +15             | `improved` |

**Ruido (`unchanged`)**

| Métrica | Antes             | Después                      | Delta           |
| ------- | ----------------- | ---------------------------- | --------------- |
| LCP     | 40729 ms (`poor`) | 40729 ms (`poor`)            | 0 ms            |
| FCP     | 2496 ms           | 2496 ms                      | 0 ms            |
| TBT     | 624 ms (`poor`)   | 590 ms (`needs-improvement`) | -34 ms (-5,4 %) |
| SI      | 2496 ms           | 2496 ms                      | 0 ms            |
| TTFB    | 752 ms            | 752 ms                       | 0 ms            |

El TBT cambia de rating, pero el CLI lo deja en `unchanged` (rangos 446-742 ms antes y 431-662 ms después, solapados; `delta` -34 ms frente a un `threshold` de 312 ms). Es ruido, no una mejora que pueda atribuirse a este arreglo.

**Empeora:** ninguna.

| Oportunidad            | `status`   | `deltaMs` | `deltaBytes` |
| ---------------------- | ---------- | --------- | ------------ |
| `unsized-images`       | `resolved` | 0         | 0            |
| `cls-culprits-insight` | `resolved` | 0         | 0            |

El resto de oportunidades siguen `same` (`image-delivery-insight`, `render-blocking-insight`, `unused-javascript`, `bootup-time`, `mainthread-work-breakdown`, `font-display-insight`, `lcp-discovery-insight`, `network-dependency-tree-insight`, `total-byte-weight`).

Los rangos min-max del CLS no se solapan (0,291 antes, 0 después; `rangesOverlap: false`), así que la mejora no se explica por la dispersión y no hizo falta repetir la medición. `lcpElement.changed` es `false` (sigue siendo `body > main > section.hero > img.hero-img`). Los bytes de imagen no cambian (`resources.byType.image` 8492779 B antes y después); el documento crece 32 B (1455 a 1487, por los atributos añadidos). Como el LCP, los bytes de imagen y las demás oportunidades no se mueven, el efecto se limita al CLS, que es justo lo que se esperaba (hipótesis cumplida).

## Integridad de la página

- `wperf check diff` (instantánea previa `.perf/check/antes.json`, posterior `.perf/check/despues.json`): "La página sigue íntegra" (código de salida 0). Mismo texto, las 7 imágenes cargan, `window.searchIndex` con 150000 entradas en ambos lados. Mismo error de consola y misma petición fallida que antes: el 404 de `favicon.ico` (fuente: page-check).
- El proyecto no tiene `package.json`, build, lint ni tests, así que no había nada más que ejecutar.
- Capturas (`.perf/check/antes.png` y `.perf/check/despues.png`): las miré y son visualmente idénticas, con las proporciones de las imágenes intactas. Conviene que las mires tú también.

## Qué queda

Causas que vi y no toqué (todas siguen `same`):

- Imágenes pesadas (`image-delivery-insight`): el LCP sigue en `poor` (40729 ms).
- Tarea larga de `js/app.js` / `buildSearchIndex` (`bootup-time`, `mainthread-work-breakdown`): TBT todavía `poor`/`needs-improvement` según la ejecución, y por eso va primero en el orden recomendado si luego quieres tocar `defer`.
- Recursos que bloquean el render y `three.min.js` sin usar (`render-blocking-insight`, `unused-javascript`).
- `font-display` (`font-display-insight`).

Los cambios no están commiteados (solo ` M index.html`). ¿Abordo otra causa?
