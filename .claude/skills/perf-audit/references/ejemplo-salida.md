# Ejemplo de salida de `perf-audit`

Cifras reales del reporte `2026-10-21T19-42-38Z-mobile` (demo rota, `http://127.0.0.1:4173/`, Lighthouse 13.5.0, 3 ejecuciones). Conversiones: KiB = bytes / 1024, MiB = bytes / 1024². Úsalo como modelo de **forma y tono**: el orden, los ratings y los problemas de otra web serán distintos (en otra ejecución de esta misma demo el TBT salió `needs-improvement`), y manda siempre el JSON que tienes delante. Esta web tiene código propio y por eso las comprobaciones apuntan a ficheros; en una web ajena, la comprobación es el HTML público o DevTools.

---

## Resumen

Auditoría `2026-10-21T19-42-38Z-mobile` · `http://127.0.0.1:4173/` · mobile · 3 ejecuciones · `score` **41**.

| Métrica | Valor     | Rating               |
| ------- | --------- | -------------------- |
| LCP     | 40 728 ms | poor                 |
| FCP     | 2 495 ms  | needs-improvement    |
| TBT     | 641 ms    | poor                 |
| CLS     | 0,291     | poor                 |
| SI      | 2 495 ms  | good                 |
| TTFB    | 752 ms    | good                 |

La página transfiere 8,30 MiB (`resources.totalBytes`), de los que 8,10 MiB son imágenes. LCP, TBT y CLS están en `poor`; el servidor responde bien, así que el problema está en lo que se envía y en cómo se carga.

## Prioridades

| #   | Problema (causa raíz)                         | Evidencia medida                                                                                 | Métricas      | Esfuerzo (hipótesis) |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------- | -------------------- |
| 1   | Imágenes sin optimizar (hero y galería)       | `image-delivery-insight`: 32 900 ms y 7,78 MiB de ahorro; `hero.jpg` solo, 2,81 MiB              | LCP           | M                    |
| 2   | Imágenes sin `width`/`height`                 | `unsized-images`: 7 imágenes; `cls-culprits-insight`; CLS 0,291 (poor). Sin ahorro medido        | CLS           | S                    |
| 3   | CSS y JS que bloquean el render               | `render-blocking-insight`: 1 550 ms; `three.min.js` 1 502 ms, `app.js` 602 ms, `styles.css` 452 ms | FCP, LCP   | S                    |
| 4   | Librería JS sin usar                          | `unused-javascript`: 1 050 ms y 118 KiB sin usar en `three.min.js`                               | FCP, LCP      | S                    |
| 5   | Tarea larga en el hilo principal              | `bootup-time` / `mainthread-work-breakdown`: 650 ms; `app.js` 1 650 ms de CPU; TBT 641 ms (poor) | TBT           | M                    |
| 6   | Fuentes sin `font-display`                    | `font-display-insight`: 300 ms; `inter-latin-400.woff2` e `inter-latin-700.woff2`                | FCP           | S                    |
| 7   | Galería bajo el pliegue sin `loading="lazy"` *(indirecto)* | `resources.byType.image` = 8,10 MiB; 6 imágenes `cafe-*.jpg` de ~0,87 MiB cada una | LCP (carga) | S           |

Los ahorros se solapan; no se suman. El orden sube la fila 2 sobre otras con más ahorro porque su métrica (CLS) está en `poor` aunque Lighthouse no le asigne ahorro.

## Detalle

### 1. Imágenes sin optimizar — *medición* + *hipótesis*

**Medido:** `image-delivery-insight` marca 7 imágenes con ahorro posible. `hero.jpg` pesa 2,86 MiB (`totalBytes` 3 003 499 B) y se podrían ahorrar 2,81 MiB; cada `cafe-*.jpg` ahorraría entre 0,82 y 0,83 MiB. El ahorro estimado en tiempo es 32 900 ms sobre LCP.
**Hipótesis:** la imagen se sirve a su resolución original sin variantes responsive. Comprobar en `index.html` si el `<img>` tiene `srcset`/`sizes` y qué dimensiones tiene el fichero frente a las que se muestra.
**Esfuerzo M:** hay que generar variantes de varios anchos y reescribir las etiquetas.

### 2. Imágenes sin `width`/`height` — *medición*

**Medido:** `unsized-images` lista 7 imágenes (`hero.jpg` y `cafe-1.jpg` … `cafe-6.jpg`); `cls-culprits-insight` señala el desplazamiento. CLS = 0,291, `poor`. Ninguna de las dos auditorías trae ahorro medido: su efecto está en la métrica, no en el tiempo.
**Hipótesis:** al cargar tarde las imágenes, el navegador no tiene espacio reservado y empuja el contenido.

(…una sección por problema, con el mismo formato…)

## Qué no está medido

- El problema 7 (galería sin `loading="lazy"`) no tiene oportunidad propia en Lighthouse 13: se deduce de `resources.byType.image` y debe confirmarse leyendo `index.html`.
- No hay ahorro asociado a `unsized-images` ni a `cls-culprits-insight`.

## Siguiente paso

¿Cuáles de estos 7 quieres abordar? Recomiendo empezar por 1–3, que atacan las tres métricas en `poor`. Para aplicarlos, `perf-fix`; para medir el efecto después, `perf-compare`.
