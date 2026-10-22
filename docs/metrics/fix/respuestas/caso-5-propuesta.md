## Propuesta: arreglar `font-display-insight` (fuentes web)

**Línea base (paso 1)**
- Reporte base: `2026-10-22T07-39-28Z-mobile`, mobile, red `default`, 3 ejecuciones, etiqueta `base-fix-eval`. Su `git.commit` es `abbfa96`, igual que el `HEAD` actual, y `git.dirty` es `false`. Sirve como "antes" y no hace falta auditar de nuevo.
- Estado de git: `git status --short` sale vacío. No hay cambios ajenos. `.perf/` está ignorado por git.
- Oportunidad `font-display-insight`: ahorro de 300 ms (`savingsMs`), 0 bytes, impacto `medium`, afecta a `fcp`. Recursos (`wastedMs` 300 ms cada uno):
  - `http://127.0.0.1:4173/fonts/inter-latin-700.woff2`
  - `http://127.0.0.1:4173/fonts/inter-latin-400.woff2`
- Métricas de partida:
  - FCP 2495 ms (`needs-improvement`).
  - LCP 40729 ms (`poor`).
  - TBT 417 ms (`needs-improvement`).
  - CLS 0,291 (`poor`).
  - Score 47.

**Qué y por qué (paso 2)**
- Causa, confirmada en el código: los dos `@font-face` de `css/styles.css` no declaran `font-display`.
  - Líneas 1-5: Inter 400, `../fonts/inter-latin-400.woff2`.
  - Líneas 7-11: Inter 700, `../fonts/inter-latin-700.woff2`.
- `body` usa `font-family: 'Inter', system-ui, sans-serif` (línea 19). Sin `font-display`, el navegador oculta el texto hasta que baja la fuente.
- No hay otras fuentes en el repo. `index.html` y `js/app.js` no tocan fuentes. Las fuentes se sirven desde `fonts/` y la hoja de estilos es fuente directa, no generada, así que el origen está en el repo.
- Hipótesis: el texto invisible durante la carga de las dos fuentes explica el `wastedMs` de 300 ms por fuente. Es una deducción del código y de la oportunidad, no una medición.

**Diff propuesto (paso 3, solo `css/styles.css`, +2 líneas)**

```diff
--- a/css/styles.css
+++ b/css/styles.css
@@ -1,11 +1,13 @@
 @font-face {
   font-family: 'Inter';
   font-weight: 400;
   src: url('../fonts/inter-latin-400.woff2') format('woff2');
+  font-display: swap;
 }
 
 @font-face {
   font-family: 'Inter';
   font-weight: 700;
   src: url('../fonts/inter-latin-700.woff2') format('woff2');
+  font-display: swap;
 }
```

- No hay ficheros nuevos ni generados.
- No añado `<link rel="preload">`. Eso sería una segunda mejora en el mismo ciclo, y la regla de la skill es una causa raíz por ronda. Lo dejo anotado como posible siguiente paso.

**Qué espero que mueva (sin cifra)**
- La oportunidad `font-display-insight` debería pasar a `resolved` o `better`.
- La métrica que podría moverse es FCP. La hipótesis es que el texto se pinta antes con la fuente de respaldo. Puede no haber efecto medible en este perfil.

**Riesgos**
- Con `swap` se ve un cambio de tipografía cuando llega Inter. La fuente de respaldo `system-ui` tiene otras métricas y podría mover el texto un poco. Eso podría subir el CLS, que ya está en `poor` (0,291). Lo vigilaré en la comparación.
- Cómo lo compruebo:
  - Antes de editar, haré una instantánea con `page-check snapshot`.
  - Tras editar, repetiré la instantánea y ejecutaré `page-check diff`. Revisaré texto, errores de consola y peticiones fallidas, y que las dos `.woff2` cargan.
  - Miraré la captura.
  - Re-auditaré con las mismas condiciones: mobile, `default`, 3 ejecuciones, mismo puerto 4173 y mismo comando de servidor.
  - Compararé con `wperf compare`.

**Cómo se revierte**
- `git checkout -- css/styles.css`. Es el único fichero que toco, y está limpio ahora mismo.
- Si la re-auditoría empeora alguna métrica, o `page-check` detecta algo roto, deshago mi cambio. Tu aprobación cubre ese revertido, y nada más.
- No haré commit ni push. El cambio se queda en el árbol de trabajo para que lo revises.

**Fuera de alcance (las anoto, no las toco)**
- `image-delivery-insight`: 32900 ms de ahorro estimado.
- `render-blocking-insight`: 1550 ms.
- `unused-javascript`: 1050 ms.
- `bootup-time`: 400 ms.

¿Aplico este diff (`font-display: swap` en los dos `@font-face` de `css/styles.css`)?
