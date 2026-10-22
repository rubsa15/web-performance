## Propuesta: eliminar el bloqueo de render de los scripts (`render-blocking-insight`)

**Línea base (paso 1).** Uso el reporte `2026-10-22T07-39-28Z-mobile` (mobile, red `default`, 3 ejecuciones, URL `http://127.0.0.1:4173/`). Sirve como "antes" porque su `git.commit` es `abbfa96`, que es el `HEAD` actual, y `git.dirty` es `false`. `git status --short` está limpio: no hay cambios ajenos en el árbol.

Valores de partida (fuente: reporte base):
- Oportunidad `render-blocking-insight`: ahorro estimado 1550 ms, impacto `high`, afecta a FCP.
- FCP: 2495 ms, `needs-improvement` (min–max 2494–2497 ms).
- Recursos que bloquean:

| Recurso | wastedMs | Bytes |
| --- | --- | --- |
| `vendor/three.min.js` | 1501 | 168137 |
| `js/app.js` | 601 | 1122 |
| `css/styles.css` | 451 | 955 |

**Qué pasa y dónde (paso 2).** El código confirma el hallazgo. En `/index.html`, líneas 11 y 12, hay dos `<script src>` síncronos dentro de `<head>`, sin `defer` ni `async`:

```html
<script src="vendor/three.min.js"></script>
<script src="js/app.js"></script>
```

- Ambos scripts detienen el análisis del HTML hasta descargarse y ejecutarse, así que retrasan el primer pintado.
- `js/app.js` no depende de que el DOM esté listo al ejecutarse. Todo su acceso al DOM va dentro de listeners de `DOMContentLoaded`, y un script con `defer` se ejecuta antes de ese evento (fuente: código, `js/app.js` líneas 18 y 43).
- `grep` no encuentra ningún uso de `THREE` en `index.html`, `js/` ni `css/` (fuente: código).
- Ninguno de los dos scripts usa `document.write` (fuente: código).
- No hay dependencia de orden que se rompa: `defer` conserva el orden de los scripts.
- `css/styles.css` también aparece en el reporte. No lo toco, por los motivos de más abajo.

**Diff propuesto (un solo fichero, 2 líneas).**

```diff
--- a/index.html
+++ b/index.html
@@ -9,6 +9,6 @@
       content="Café de especialidad tostado en pequeños lotes y enviado en 48 horas."
     />
     <link rel="stylesheet" href="css/styles.css" />
-    <script src="vendor/three.min.js"></script>
-    <script src="js/app.js"></script>
+    <script src="vendor/three.min.js" defer></script>
+    <script src="js/app.js" defer></script>
   </head>
```

No se crean ficheros ni se ejecuta ningún comando de generación.

**Qué espero que mueva (sin cifra).**
- FCP, y con él la oportunidad `render-blocking-insight`, que debería pasar a `resolved` o `better`. Es una hipótesis, no una promesa.
- El resto de métricas no deberían cambiar por este arreglo. Sí podría moverse TBT: al adelantarse el primer pintado, la tarea larga de `buildSearchIndex` (que arranca tras `DOMContentLoaded`) puede caer dentro de otra ventana de medición. Si TBT empeora, te lo presentaré como compensación, con las dos cifras de `compare`.

**Lo que no toco (se anota para después).**
- `css/styles.css` sigue bloqueando el render. Es una sola hoja pequeña y necesaria para el primer pintado. Para liberarla habría que meter el CSS en línea o cargarlo de forma diferida, que es un cambio mayor y con riesgo de parpadeo sin estilos. Lo dejo fuera de esta ronda, así que esa fila de la oportunidad probablemente seguirá apareciendo.
- `three.min.js` no se usa en ningún sitio. Quitarlo es otra causa raíz (`unused-javascript`) y otra ronda. Aquí solo lo hago no bloqueante.
- No toco LCP, CLS, TBT ni fuentes, aunque el reporte los marca.

**Riesgos y cómo los compruebo.**
- El momento de ejecución de los scripts cambia, y `app.js` podría dejar de funcionar si algo dependiera del orden. Lo he revisado y no veo ese caso en el código.
- Antes de editar guardaré una instantánea con `page-check snapshot` y la compararé con otra tras el cambio (`page-check diff`). Busco texto distinto, errores de consola nuevos y el estado del JS (`window.searchIndex` y la clase `compact` de la cabecera).
- Revisaré también la captura para ver si hay saltos de layout.
- La web se servirá igual antes y después (`demo/serve.ts --root $CASE --port 4173`), y las mediciones se lanzarán una detrás de otra.

**Cómo se revierte.** Con `git checkout -- index.html`. Es el único fichero que toco y hoy está limpio. Si la re-auditoría con `wperf audit` y `wperf compare` (mobile, red `default`, 3 ejecuciones) empeora algo o rompe la página, lo deshago yo. Esa aprobación cubre solo revertir lo que escriba. No haré commit ni push; los cambios se quedan en el árbol de trabajo.

¿Aplico este diff?
