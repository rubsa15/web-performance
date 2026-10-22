## Cierre: `font-display: swap` en las fuentes web

**Veredicto: corrección sin efecto medible.** La oportunidad `font-display-insight` pasa a `resolved`, pero ninguna métrica cambia de forma medible (veredicto global de `compare`: `unchanged`). Mantengo el cambio porque es correcto por sí mismo, pero no hay mejora demostrada.

- Antes: `2026-10-22T07-39-28Z-mobile` (etiqueta `base-fix-eval`, commit `abbfa96`, `dirty: false`).
- Después: `2026-10-22T07-51-39Z-mobile` (etiqueta `despues-font-display`, commit `abbfa96`, `dirty: true` por mi cambio).
- Comparación: `wperf compare 2026-10-22T07-39-28Z-mobile 2026-10-22T07-51-39Z-mobile`, guardada en `.perf/comparacion.json` (dentro de `case-5`, ignorado por git). No tiene un id propio en el CLI; se identifica por la pareja antes/después.
- Mismo perfil (mobile, red `default`, 3 ejecuciones), misma URL `http://127.0.0.1:4173/`, mismo comando de servidor y puerto. `warnings` está vacío.

### Qué se cambió
`css/styles.css`: `font-display: swap;` añadido a los dos `@font-face` (Inter 400 e Inter 700), +2 líneas (fuente: `git diff`). Es el único fichero tocado. No hay commit ni push. El cambio queda en el árbol de trabajo (`git status --short`: ` M css/styles.css`).

### Antes → después

Métricas (cifras y `change` copiados de `compare`):

| Métrica | Antes | Después | `change` | Clasificación |
| --- | --- | --- | --- | --- |
| Score | 47 | 50 | `unchanged` | ruido |
| LCP | 40729 ms (`poor`) | 40729 ms (`poor`) | `unchanged` | ruido |
| FCP | 2495 ms (`needs-improvement`) | 2490 ms (`needs-improvement`) | `unchanged` | ruido |
| TBT | 417 ms (`needs-improvement`) | 299 ms (`needs-improvement`) | `unchanged` | ruido |
| CLS | 0,291 (`poor`) | 0,291 (`poor`) | `unchanged` | ruido |
| SI | 2495 ms (`good`) | 2490 ms (`good`) | `unchanged` | ruido |
| TTFB | 752 ms (`good`) | 752 ms (`good`) | `unchanged` | ruido |

- Mejoras: ninguna. Empeoramientos: ninguno.
- Los números de FCP (-5 ms) y TBT (-118 ms) bajan, pero el CLI los marca `unchanged`, así que no los cuento como mejora. El TBT ya variaba entre ejecuciones del reporte base (min 309 ms, max 610 ms), y ese rango incluye el valor posterior.
- `lcpElement.changed`: `false`. El elemento LCP sigue siendo `body > main > section.hero > img.hero-img`.

Oportunidad objetivo:

| Oportunidad | `status` | Antes (`savingsMs`) | `deltaMs` | `deltaBytes` |
| --- | --- | --- | --- | --- |
| `font-display-insight` | `resolved` | 300 ms | -300 ms | 0 |

Recursos: la hoja de estilos pasa de 955 a 961 bytes (+6, fuente: `compare`). El resto de recursos no cambia, incluidas las fuentes (34900 bytes).

Posible motivo de que no haya efecto medible (hipótesis, no medición): en este perfil el FCP no depende del bloqueo por fuentes, o el efecto queda dentro del ruido. Esto no cambia el hecho de que el defecto ya no aparece en el reporte.

### Integridad de la página
- `page-check diff antes.json despues.json`: "La página sigue íntegra". 7 imágenes cargadas, índice de búsqueda 150000, igual que antes.
- Había un error de consola y una petición fallida antes de mi cambio y siguen igual: `404 http://127.0.0.1:4173/favicon.ico`. No es del arreglo.
- Las dos `.woff2` no aparecen entre las peticiones fallidas.
- Captura revisada (`despues.png`): la tipografía Inter se ve cargada y el layout es coherente. No tengo la captura del reporte base con la que comparar visualmente el CLS, así que el salto de tipografía por el `swap` queda por mirar a mano.
- Instantáneas y capturas, todas en `/private/tmp/claude-501/-Users-rubensanz-projects-web-performance/224b6335-cab2-49ca-9ac5-39a468a6db77/scratchpad/fix-eval/case-5/.perf/page-check/`:
  - `antes.json` y `antes.png`
  - `despues.json` y `despues.png`
- Servidor cerrado al terminar.

### Qué queda
Causas vistas y no tocadas (cifras del reporte base, `savingsMs`):
- `image-delivery-insight`: 32900 ms, 8154587 bytes (fuente: `compare`). Es la causa más gorda y la que explica el LCP `poor`.
- `render-blocking-insight`: 1550 ms.
- `unused-javascript`: 1050 ms, 120895 bytes.
- `bootup-time`: 400 ms antes, 300 ms después, `status: same`.
- Un `<link rel="preload">` para las fuentes (descartado en esta ronda por la regla de una causa raíz).
- Está el `favicon.ico` que da 404.

Recuerda que los cambios no están commiteados. ¿Abordo otra causa, por ejemplo las imágenes?
