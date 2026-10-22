## Propuesta perf-fix: imagen hero (`image-delivery-insight` + `lcp-discovery-insight`)

**Línea base (reporte `2026-10-22T07-39-28Z-mobile`, mobile, red default, 3 ejecuciones)**
- Está emparejado con el código actual: `git.commit` = `abbfa96` (HEAD), `dirty: false`, y `git status --short` está limpio. Lo uso como "antes" sin re-auditar.
- LCP = 40729 ms, `rating: poor` (min 40727, max 40730). El elemento LCP es `body > main > section.hero > img.hero-img` (`img/hero.jpg`).
- Desglose del LCP: ttfb 4 ms, loadDelay 12 ms, loadDuration 458 ms, renderDelay 75 ms. Es la carga real y no suma el LCP simulado (40729 ms).
- `image-delivery-insight`: impacto `high`, savingsMs 32900, savingsBytes 8154587. Para el hero, `totalBytes` 3003499 y `wastedBytes` 2949349.
- `lcp-discovery-insight`: impacto `low`, savings 0. `priorityHinted: false`, `requestDiscoverable: true`, `eagerlyLoaded: true`. El hero ya se descubre pronto y no tiene `loading="lazy"`; lo único que falta es la prioridad alta.
- Otras métricas, para vigilar regresiones: FCP 2495 ms (needs-improvement), TBT 417 ms (needs-improvement), CLS 0.291 (poor), SI 2495 ms (good).

**Código** (`index.html`, línea 25 de `$CASE`)
```html
<img class="hero-img" src="img/hero.jpg" alt="Tonos cálidos de café recién tostado" />
```
- El fichero `img/hero.jpg` mide 3200×2000 px y pesa 3003499 B (fuente: `sips` y reporte). Se sirve tal cual a todos los dispositivos.
- El `<img>` no tiene `srcset`, `sizes` ni `fetchpriority`, así que el código confirma el hallazgo.
- En `css/styles.css`, `.hero-img` es `width:100%; height:auto` y ningún contenedor limita el ancho, así que `sizes="100vw"` es correcto.
- La fuente es HTML estático, sin build ni `dist/`. No hay `package.json`, así que no hay build, typecheck, lint ni tests que ejecutar.

**1. Qué y por qué**
- Causa (medición): el hero se sirve en 3200 px de ancho y 3003499 B cuando en móvil se pinta a unos pocos cientos de píxeles. Es el elemento LCP, y el reporte marca ahorro de 32900 ms en la oportunidad.
- Causa (hipótesis): la descarga de ese fichero domina el LCP. Que el hero no lleve `fetchpriority="high"` es secundario, porque el reporte ya da ahorro 0 en `lcp-discovery-insight`.

**2. El diff** (una causa raíz: el hero; las otras 6 imágenes del catálogo quedan sin tocar)

Ficheros nuevos, variantes generadas a partir de `img/hero.jpg`, que se conserva como original:
```sh
sips --resampleWidth 480  -s format jpeg -s formatOptions 70 img/hero.jpg --out img/hero-480.jpg    # 480x300
sips --resampleWidth 960  -s format jpeg -s formatOptions 70 img/hero.jpg --out img/hero-960.jpg    # 960x600
sips --resampleWidth 1600 -s format jpeg -s formatOptions 70 img/hero.jpg --out img/hero-1600.jpg   # 1600x1000
```
Los pesos de los tres ficheros nuevos los mediré al generarlos y los citaré con `(fuente: fichero)`. Ahora no los invento.

```diff
--- a/index.html
+++ b/index.html
@@ -25 +25,9 @@
-        <img class="hero-img" src="img/hero.jpg" alt="Tonos cálidos de café recién tostado" />
+        <img
+          class="hero-img"
+          src="img/hero-960.jpg"
+          srcset="img/hero-480.jpg 480w, img/hero-960.jpg 960w, img/hero-1600.jpg 1600w"
+          sizes="100vw"
+          fetchpriority="high"
+          alt="Tonos cálidos de café recién tostado"
+        />
```
(Ver nota 2 más abajo sobre `src`.)

**3. Qué espero que mueva y riesgos**
- Espero que mueva el LCP y la oportunidad `image-delivery-insight` (bytes del hero, `deltaBytes`). Posiblemente también FCP y SI, aunque eso lo dirá `compare`. No prometo cifras: las que cuente saldrán de `wperf compare`.
- Riesgos:
  - Calidad visible: JPEG al 70 %. Lo reviso en la captura.
  - `sizes="100vw"` hace que pantallas anchas o de alta densidad elijan 960 o 1600 px.
  - Las variantes son ficheros nuevos en `img/`.
  - Con `fetchpriority="high"` puede cambiar el orden de las peticiones y mover algo la carga del resto.
  - No añado `width`/`height` al hero, aunque es una causa distinta (CLS).
- Cómo lo compruebo: antes de editar guardo `page-check snapshot`; después hago `page-check diff` (todas las imágenes cargan, sin errores de consola ni peticiones fallidas) y miro la captura.
- Re-auditaré con las mismas condiciones: mobile, red default, 3 ejecuciones, mismo puerto 4173 y mismo comando. Compararé con `wperf compare` contra el reporte base.

**4. Cómo se revierte**
- Es un repo git con árbol limpio, solo con el commit `abbfa96`.
- Se revierte con `git checkout -- index.html` y borrando `img/hero-480.jpg`, `img/hero-960.jpg` e `img/hero-1600.jpg`. Después compruebo con `git status --short` que el árbol queda limpio.
- Si la re-auditoría empeora algo o rompe la página, lo deshago yo. Tu aprobación cubre revertir lo que escriba, y nada más.
- No haré commit ni push.

**Nota 1.** Dejo sin tocar y anoto para después: las otras 6 imágenes del catálogo (cada una con 0,86–0,87 MB de ahorro en `image-delivery-insight`), `render-blocking-insight`, `unused-javascript`, `font-display-insight`, `bootup-time`, y las imágenes sin dimensiones (`unsized-images`, `cls-culprits-insight`).

**Nota 2.** Dejo `src` apuntando a `hero-960.jpg` (no al original) para que un navegador sin soporte de `srcset` tampoco descargue 3 MB. Si prefieres mantener `src="img/hero.jpg"`, dímelo y lo ajusto.

¿Apruebas este diff, incluida la generación de las tres variantes con `sips`, para que lo aplique y lo mida?
