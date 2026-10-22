## Propuesta: quitar `vendor/three.min.js` (oportunidad `unused-javascript`)

**Línea base (paso 1).** Uso el reporte que ya hiciste, `2026-10-22T07-39-28Z-mobile` (mobile, red `default`, 3 ejecuciones). Sirve como "antes" por dos motivos. Su `git.commit` es `abbfa96`, que es el `HEAD` actual. Su `git.dirty` es `false`, y `git status --short` en el repo no muestra nada, así que no hay cambios ajenos sin commitear.

Valores de partida del reporte:
- `unused-javascript`: ahorro estimado 1050 ms y 120895 B (fuente: reporte). Impacto `high`, afecta a FCP y LCP.
- Único recurso afectado: `http://127.0.0.1:4173/vendor/three.min.js`, con `wastedBytes` 120895 de `totalBytes` 167861 (fuente: reporte).
- Métricas actuales: LCP 40729 ms (`poor`), FCP 2495 ms (`needs-improvement`), TBT 417 ms (`needs-improvement`), CLS 0,291 (`poor`), score 47.
- El mismo fichero aparece en otras dos oportunidades:
  - `render-blocking-insight`: 1501 ms de `wastedMs`.
  - `bootup-time`: 95 ms de `cpuMs`.

**Qué y por qué (paso 2).** `index.html` carga la librería Three.js en el `<head>` con un `<script>` síncrono, en la línea 12. He comprobado en el código que nada la usa:
- No hay ninguna referencia al global `THREE` en `index.html`, `js/app.js` ni `css/styles.css` (0 coincidencias en cada uno).
- `js/app.js` solo menciona `three.min.js` en un comentario. Ese comentario dice que la librería se cargó para un visor 3D de granos que ya no existe.
- No hay `<canvas>`, WebGL ni otros scripts que puedan usarla de forma indirecta. Los únicos scripts de la página son esos dos (fuente: código).
- El repo no tiene `package.json`, bundler ni tests. Es HTML estático, así que no hay nada más que revisar.

El origen está en el repo y es la fuente que se sirve (no hay salida generada). Por eso el cambio va en `index.html`.

**Diff propuesto (1 línea eliminada, ningún fichero nuevo):**

```diff
--- a/index.html
+++ b/index.html
@@ -10,7 +10,6 @@
     <link rel="stylesheet" href="css/styles.css" />
-    <script src="vendor/three.min.js"></script>
     <script src="js/app.js"></script>
   </head>
```

Dejo fuera, a propósito, lo siguiente:
- No borro `vendor/three.min.js` del disco. Son 669884 B (fuente: `wc -c`) y se puede borrar en otra ronda si quieres. Sin la etiqueta `<script>` deja de servirse.
- No toco el comentario de `js/app.js`.
- No toco ninguna otra causa.

**Qué espero que mueva** (sin cifra, solo hipótesis). Debería desaparecer `unused-javascript` del reporte. Como el mismo script aparece en `render-blocking-insight` y en `bootup-time`, también podrían moverse FCP/LCP y TBT. No lo prometo: lo dirá `wperf compare`.

**Riesgos.**
- Que algo dependa de `THREE`, lo que daría un `ReferenceError`. El `grep` indica que no pasa. Lo comprobaré con una instantánea de `page-check` antes y después: sin errores de consola nuevos, mismo texto y todas las imágenes cargando.
- No espero ningún cambio de layout. Aun así, miraré la captura de pantalla.

**Cómo se revierte.** Con `git checkout -- index.html`, que es lo único que toco. Si la re-auditoría empeora algo o la página se rompe, deshago mi cambio. La aprobación cubre ese revertir y nada más.

**Plan de medición** (pasos 4 a 7, tras tu aprobación):
1. Instantánea previa de `page-check`.
2. Aplico el diff.
3. Instantánea posterior y `page-check diff`.
4. `wperf audit --device mobile --network default --runs 3 --label despues-unused-js`, con la web servida en el mismo puerto 4173.
5. `wperf compare` entre el reporte base y el nuevo.

No hago commit.

**Vistas pero no tocadas** (se anotarán al final):
- Imágenes pesadas: `image-delivery-insight`, con `hero.jpg` de 3003499 B.
- Scripts y CSS que bloquean el render: `render-blocking-insight`.
- Tarea larga en `js/app.js`: `bootup-time` marca 1424 ms de `cpuMs` para ese fichero.
- `font-display` ausente en las fuentes.
- Imágenes sin `width` y `height` (CLS).

¿Apruebas este diff (eliminar la línea 12 de `index.html`) para que lo aplique y lo mida?
