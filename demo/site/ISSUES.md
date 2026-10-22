# Problemas catalogados de la demo

Ground truth para evaluar `wperf` y las skills. Cada problema está puesto a propósito en
`demo/site/`; `demo/site-fixed/` es la misma página con todos corregidos.

Los ids de auditoría son los de Lighthouse 13.5.0 (`*-insight`), tal y como salen en el campo
`opportunities[].id` del `Report`. Las cifras son de la medición de referencia (mobile, 3 ejecuciones,
`npm run demo`, latencia de 300 ms en imágenes y fuentes) y sirven de orden de magnitud: el
CLI es la fuente de verdad, no este fichero.

| #   | Problema                                      | Dónde                                                                         | Detección en el `Report`                                                                                                                                                       | Arreglo en `site-fixed/`                                              |
| --- | --------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| 1   | Imagen hero enorme, sin comprimir ni `srcset` | `index.html` (`img/hero.jpg`, 3200×2000, ~2,9 MiB)                            | Directa: `image-delivery-insight` (hero con ~2,9 MiB de ahorro) y `lcp-discovery-insight`; LCP en `poor`                                                                       | JPEG a 480/960/1600 px con `srcset`, `sizes` y `fetchpriority="high"` |
| 2   | Imágenes sin `width`/`height` (CLS)           | `<img>` del hero y de la galería                                              | Directa: `unsized-images` (7 imágenes) y `cls-culprits-insight`; CLS ≈ 0,29 (`poor`)                                                                                           | `width`/`height` en todas las imágenes                                |
| 3   | CSS y JS bloqueantes en `<head>`              | `<link css/styles.css>`, `<script vendor/three.min.js>`, `<script js/app.js>` | Directa: `render-blocking-insight` (los tres recursos; el mayor, `three.min.js`)                                                                                               | CSS en línea, `defer` en `app.js`, sin la librería                    |
| 4   | Librería JS pesada sin usar                   | `vendor/three.min.js` (~650 KiB sin comprimir), nadie la usa                  | Directa: `unused-javascript` (~118 KiB de `three.min.js` sin usar en transferencia)                                                                                            | Se elimina la librería y su `<script>`                                |
| 5   | Fuentes web sin `font-display`                | `@font-face` de `css/styles.css` (Inter 400 y 700)                            | Directa: `font-display-insight` (las dos fuentes)                                                                                                                              | `font-display: swap` y `<link rel="preload">` de la fuente de 400     |
| 6   | Imágenes bajo el pliegue sin `loading="lazy"` | Las 6 imágenes de `.grid` en `index.html`                                     | **Indirecta**: Lighthouse 13 ya no tiene la auditoría `offscreen-images`. Se ve en `resources.byType.image` (~8,1 MiB) y en `total-byte-weight`, y se confirma leyendo el HTML | `loading="lazy"` y `decoding="async"` en la galería                   |
| 7   | Tarea larga en el hilo principal (TBT)        | `buildSearchIndex()` de `js/app.js`, tras el primer pintado                   | Directa: `bootup-time` y `mainthread-work-breakdown` (`js/app.js` ≈ 1,6 s de CPU) y TBT en `poor`                                                                              | El índice se construye en trozos de 5 000 elementos que ceden el hilo |

## Notas para quien evalúe

- **Recall:** el problema 6 solo es detectable de forma indirecta, así que una skill que
  lo identifique tiene que apoyarse en `resources` + lectura del código, no en una oportunidad.
  Los otros seis aparecen con su id de auditoría.
- **Agrupar por causa raíz:** `image-delivery-insight` junta los problemas 1 y 6 en una sola
  oportunidad (hero y galería), y `unsized-images` y `cls-culprits-insight` son el mismo problema (2).
- **Lo que queda en `site-fixed/`:** `image-delivery-insight` sigue marcando un ahorro por formato
  (WebP/AVIF), porque las imágenes se generan con `sips`, que solo escribe JPEG. No es un problema
  catalogado.
- **Reproducibilidad:** el servidor (`demo/serve.ts`) comprime el texto y pone caché larga para que
  ninguno de esos dos hallazgos ensucie la lista, y añade 300 ms de latencia a imágenes y
  fuentes. Sin ella, en localhost llegarían antes del primer pintado y ni el CLS ni `font-display`
  se reproducirían.
- Las imágenes se generan con `node demo/generate-images.ts` (solo macOS) y están versionadas.
  Las fuentes son Inter (SIL OFL 1.1, vía fontsource) y `three.min.js` es three.js r160 (MIT).
