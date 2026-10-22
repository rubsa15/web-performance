## Propuesta de arreglo: imágenes sin dimensiones (CLS)

**Línea base.** Uso el reporte `2026-10-22T07-39-28Z-mobile` (mobile, red `default`, 3 ejecuciones, URL `http://127.0.0.1:4173/`). Se midió con el commit `abbfa96` y `dirty: false`. Ahora `HEAD` es `abbfa96` y `git status --short` sale vacío, así que el reporte vale como "antes" y no hace falta auditar de nuevo. No hay cambios sin commitear que no sean míos. CLS no depende de la red, así que mido solo el perfil mobile + `default`.

Valores de partida (fuente: reporte base):
- CLS = 0.291, rating `poor` (min 0.291, max 0.291).
- `unsized-images`: 7 imágenes sin `width`/`height`. Son `img/hero.jpg` y `img/cafe-1.jpg` a `img/cafe-6.jpg`.
- `cls-culprits-insight` está presente, pero con `items: []`. El reporte no señala ningún elemento concreto, y el único defecto con recursos es `unsized-images`.

**Causa (verificada en el código).** En `index.html`, las 7 etiquetas `<img>` no tienen `width` ni `height` (líneas 27, 57, 61, 65, 69, 73 y 77). El CSS ya las escala bien: `.hero-img` y `.grid img` tienen `width: 100%; height: auto`, y no hace falta tocarlo. Sin atributos, el navegador no conoce la proporción hasta que la imagen se descarga. Entonces el hero y las tarjetas del catálogo pasan de altura 0 a su altura real y empujan el contenido de debajo. Esto es una hipótesis razonable sobre el CLS de 0.291, porque el código confirma el defecto del reporte. Lo que mide el reporte es el CLS en sí y que las imágenes no tienen dimensiones.

Dimensiones intrínsecas (fuente: `file` sobre los JPEG):
- `img/hero.jpg`: 3200x2000
- `img/cafe-1.jpg` a `img/cafe-6.jpg`: 1600x1067 cada una

**Diff propuesto** (solo `index.html`, 7 líneas, sin ficheros nuevos):

```diff
--- a/index.html
+++ b/index.html
@@ -27 +27 @@
-        <img class="hero-img" src="img/hero.jpg" alt="Tonos cálidos de café recién tostado" />
+        <img class="hero-img" src="img/hero.jpg" width="3200" height="2000" alt="Tonos cálidos de café recién tostado" />
@@ -57 +57 @@
-            <img src="img/cafe-1.jpg" alt="Ilustración abstracta: tueste claro" />
+            <img src="img/cafe-1.jpg" width="1600" height="1067" alt="Ilustración abstracta: tueste claro" />
@@ -61 +61 @@
-            <img src="img/cafe-2.jpg" alt="Ilustración abstracta: tueste oscuro" />
+            <img src="img/cafe-2.jpg" width="1600" height="1067" alt="Ilustración abstracta: tueste oscuro" />
@@ -65 +65 @@
-            <img src="img/cafe-3.jpg" alt="Ilustración abstracta: lote verde" />
+            <img src="img/cafe-3.jpg" width="1600" height="1067" alt="Ilustración abstracta: lote verde" />
@@ -69 +69 @@
-            <img src="img/cafe-4.jpg" alt="Ilustración abstracta: tonos rojizos" />
+            <img src="img/cafe-4.jpg" width="1600" height="1067" alt="Ilustración abstracta: tonos rojizos" />
@@ -73 +73 @@
-            <img src="img/cafe-5.jpg" alt="Ilustración abstracta: tonos azulados" />
+            <img src="img/cafe-5.jpg" width="1600" height="1067" alt="Ilustración abstracta: tonos azulados" />
@@ -77 +77 @@
-            <img src="img/cafe-6.jpg" alt="Ilustración abstracta: tonos dorados" />
+            <img src="img/cafe-6.jpg" width="1600" height="1067" alt="Ilustración abstracta: tonos dorados" />
```

Solo se añaden atributos. No se cambia ningún nombre de fichero, `src`, `alt` ni regla de CSS.

**Qué espero que mueva.** El CLS y la oportunidad `unsized-images`, que debería quedar resuelta. No prometo ninguna cifra. El veredicto lo dará `wperf compare`. Si el CLS sale `unchanged` pero `unsized-images` desaparece, lo contaré como corrección sin efecto medible.

**Riesgos.**
- Como el CSS ya fija `width: 100%; height: auto`, la imagen no debería deformarse. El navegador usa los atributos solo para calcular la proporción (`aspect-ratio`) antes de cargar.
- Antes de editar guardaré una instantánea con `page-check` (texto, imágenes, errores de consola, peticiones fallidas). Después compararé con `page-check diff` y miraré la captura para comprobar que las proporciones y el layout siguen intactos.
- Si queda CLS residual, pueden influir las fuentes (`font-display-insight`, sin `font-display`). Eso es otra causa y no la toco en esta ronda.

**Cómo se revierte.** `git checkout -- index.html`. Es el único fichero que toco y no hay otros cambios sin commitear. Si la re-auditoría empeora alguna métrica o `page-check` detecta la página rota, lo deshago yo con ese comando. Tu aprobación cubre ese revertir y nada más. No haré commit ni push, así que los cambios se quedan en el árbol de trabajo para que los revises.

**Plan de verificación tras tu aprobación.**
1. Servir la web con el mismo comando y puerto (4173) antes y después.
2. Instantánea previa, edición, instantánea posterior y `page-check diff`.
3. Re-auditoría mobile + `default` con 3 ejecuciones, y `wperf compare` contra el reporte base.

Anoto sin tocarlas otras causas del mismo reporte: imagen del hero pesada (`image-delivery-insight`), recursos que bloquean el render, JavaScript sin usar, `font-display` y TBT.

¿Apruebas este diff (7 etiquetas `<img>` de `index.html`) para que lo aplique y lo mida?
