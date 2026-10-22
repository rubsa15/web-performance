## Propuesta perf-fix: carga diferida de la galería (`#cafes`)

**Línea base.** Uso el reporte `2026-10-22T07-39-28Z-mobile` (mobile, red `default`, 3 ejecuciones). Se midió sobre `abbfa96` con `dirty: false`. `git status --short` está limpio y `HEAD` es `abbfa96`, así que el código no ha cambiado desde la medición y sirve como "antes". No hace falta volver a auditar.

| Dato del reporte | Valor |
|---|---|
| Score | 47 |
| LCP | 40729 ms (`poor`) |
| CLS | 0,291 (`poor`) |
| TBT | 417 ms (`needs-improvement`) |
| `resources.byType.image` | 8492779 B (8,10 MiB, fuente: cálculo) de 8699348 B totales |

**Matiz sobre tu premisa.** Lighthouse no marca una oportunidad de imágenes fuera de pantalla (`offscreen-images`). Pero las 6 imágenes de la galería sí salen en `image-delivery-insight`, por estar sobredimensionadas (~0,87 MB de desperdicio cada una). Ese es otro defecto y no lo toco en esta ronda.

### Qué y por qué

- **Qué pasa (confirmado en el código).** `index.html` líneas 57, 61, 65, 69, 73 y 77: las seis `<img src="img/cafe-N.jpg">` de `section#cafes > div.grid > figure` no tienen `loading`, `decoding`, `width` ni `height`. Se descargan todas de forma inmediata, aunque estén tras el hero, las tres características y el título del catálogo.
- **Peso de la galería.** Las 6 imágenes suman 5487844 B (5,23 MiB, fuente: `ls -l img/`), cada una de ~0,9 MB. Compiten por ancho de banda con `hero.jpg`, que es el elemento LCP (3003499 B, `lcp.element`).
- **Qué no toco.** `hero.jpg` sigue cargando de forma inmediata, porque es el LCP y `loading="lazy"` lo retrasaría.
- **Por qué se añaden `width` y `height`.** Sin ellas, una imagen diferida mide 0 px de alto hasta cargarse, y al aparecer desplaza el contenido de debajo. El CLS ya es `poor` (0,291) y `unsized-images` lista estas seis imágenes. Las dimensiones intrínsecas son 1600×1067 (fuente: `file img/cafe-*.jpg`) y las seis son iguales.
- **Compatibilidad con el CSS.** `.grid img` ya tiene `width: 100%; height: auto` (`css/styles.css` líneas 106-111), así que los atributos solo reservan el hueco y no deforman nada.
- **Posible confusión al atribuir el efecto.** `width`/`height` son un segundo cambio dentro del mismo diff. Si en el CLS se ve efecto, no sabré separar cuánto es de las dimensiones y cuánto de `lazy`. Si prefieres, aplico solo `loading="lazy" decoding="async"`, pero con riesgo de saltos de layout.

### Diff propuesto (solo `index.html`, 6 líneas cambiadas)

```diff
--- a/index.html
+++ b/index.html
@@ -54,26 +54,32 @@
         <div class="grid">
           <figure>
-            <img src="img/cafe-1.jpg" alt="Ilustración abstracta: tueste claro" />
+            <img src="img/cafe-1.jpg" alt="Ilustración abstracta: tueste claro" width="1600" height="1067" loading="lazy" decoding="async" />
             <figcaption>Etiopía Guji · tueste claro</figcaption>
           </figure>
           <figure>
-            <img src="img/cafe-2.jpg" alt="Ilustración abstracta: tueste oscuro" />
+            <img src="img/cafe-2.jpg" alt="Ilustración abstracta: tueste oscuro" width="1600" height="1067" loading="lazy" decoding="async" />
             <figcaption>Brasil Cerrado · tueste oscuro</figcaption>
           </figure>
           <figure>
-            <img src="img/cafe-3.jpg" alt="Ilustración abstracta: lote verde" />
+            <img src="img/cafe-3.jpg" alt="Ilustración abstracta: lote verde" width="1600" height="1067" loading="lazy" decoding="async" />
             <figcaption>Colombia Huila · tueste medio</figcaption>
           </figure>
           <figure>
-            <img src="img/cafe-4.jpg" alt="Ilustración abstracta: tonos rojizos" />
+            <img src="img/cafe-4.jpg" alt="Ilustración abstracta: tonos rojizos" width="1600" height="1067" loading="lazy" decoding="async" />
             <figcaption>Kenia Nyeri · tueste medio</figcaption>
           </figure>
           <figure>
-            <img src="img/cafe-5.jpg" alt="Ilustración abstracta: tonos azulados" />
+            <img src="img/cafe-5.jpg" alt="Ilustración abstracta: tonos azulados" width="1600" height="1067" loading="lazy" decoding="async" />
             <figcaption>Guatemala Antigua · tueste medio</figcaption>
           </figure>
           <figure>
-            <img src="img/cafe-6.jpg" alt="Ilustración abstracta: tonos dorados" />
+            <img src="img/cafe-6.jpg" alt="Ilustración abstracta: tonos dorados" width="1600" height="1067" loading="lazy" decoding="async" />
             <figcaption>Costa Rica Tarrazú · tueste claro</figcaption>
           </figure>
```

No se crean ni se generan ficheros, y las imágenes originales no se modifican.

### Qué espero que mueva y riesgos

- **Qué espero que mueva (hipótesis, sin cifra).** Debería bajar `resources.byType.image` y los bytes transferidos al cargar. Si la galería competía con el hero, podría mejorar el LCP. Si las dimensiones se aplican bien, el CLS también.
- **Riesgo 1.** Alguna imagen de la galería podría estar dentro del primer viewport en pantallas grandes. En mobile (hero + características + título), la galería queda claramente debajo.
- **Riesgo 2.** Un hueco o una deformación visible por las dimensiones. El CSS ya escala con `height: auto`, así que no debería pasar.
- **Riesgo 3.** Que una imagen no cargue al hacer scroll.
- **Cómo lo comprobaré.** Haré una instantánea con `page-check` antes de editar y otra después, con scroll. Comparo con `page-check diff` y reviso la captura (proporciones y saltos de layout). Después hago la re-auditoría con las mismas condiciones: mobile, red `default`, 3 ejecuciones, mismo puerto 4173 y mismo comando de servidor.
- **Aviso sobre el perfil.** El peso de imágenes es sensible a la red. Si quieres, además mido el perfil `3g`, con su propio "antes" y "después". Por defecto me quedo en `default`.

### Cómo se revierte

Con `git checkout -- index.html`. Es el único fichero que toco, así que el árbol queda como ahora (limpio). Si la re-auditoría empeora algo o la página se rompe, lo deshago yo. Esta aprobación cubre solo revertir lo que yo escriba. No haré commit ni push.

### Otras causas que he visto y no toco

Cada una iría en su propia ronda:

- Hero y galería sobredimensionados (`image-delivery-insight`).
- `three.min.js` sin usar.
- Scripts que bloquean el render.
- La tarea larga de `buildSearchIndex` en `js/app.js` (TBT).
- `@font-face` sin `font-display`.
- El hero sin `width`/`height` y sin `fetchpriority`.

**¿Aplico este diff?** (Si prefieres solo `lazy` sin las dimensiones, o sumar el perfil `3g`, dímelo y lo reproongo.)
