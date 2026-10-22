## Propuesta perf-fix: tarea larga en el hilo principal (bootup-time, mainthread-work-breakdown, TBT)

**Estado previo (paso 1)**
- Reporte base: `2026-10-22T07-39-28Z-mobile` (mobile, red default, 3 ejecuciones, Lighthouse 13.5.0). Se midió en `commit abbfa96`, `dirty: false`.
- `git status --short` está limpio ahora (`.perf/` está ignorado). El código no ha cambiado desde esa medición, así que sirve como línea base sin volver a auditar.
- Valores de partida del reporte:
  - TBT: 417 ms, `needs-improvement`, rango min–max 309–610 ms. El rango es ancho, así que la medición tiene ruido.
  - `bootup-time` (impacto `medium`, afecta a `tbt`): ahorro estimado 400 ms. Por script (`cpuMs`):

    | Script | cpuMs |
    | --- | --- |
    | `js/app.js` | 1424 |
    | Unattributable | 224 |
    | `/` (documento) | 135 |
    | `vendor/three.min.js` | 95 |
  - Diagnósticos: `mainthread-work-breakdown` marca 1.9 s y `long-tasks` marca "2 long tasks found".

**Origen en el código (paso 2)**
- `js/app.js` ocupa casi toda la CPU del reporte. La función `buildSearchIndex()` (líneas 25-40) genera 150 000 entradas en un bucle y las ordena con `localeCompare(..., 'es')`. Todo ocurre de una vez en el hilo principal, en un `setTimeout(…, 0)` dentro de `requestAnimationFrame` tras `DOMContentLoaded` (líneas 43-47).
- El código confirma el hallazgo. Sospecho que la tarea larga sale de esa función, sobre todo del `sort`; es una hipótesis, porque el reporte no desglosa por función.
- Nada del repo lee `window.searchIndex`. Lo comprobé con `grep` en todo el repo salvo `vendor/`, y solo aparece en `js/app.js`. No hay `package.json`, build ni tests.
- `three.min.js` (95 ms de CPU) y los 224 ms "Unattributable" no se tocan en esta ronda.

**Qué y por qué**
- La causa es una única tarea larga que genera y ordena 150 000 objetos en el hilo principal. El orden de los elementos solo importa dentro del cálculo, así que se puede mover entero a un Web Worker.
- El resultado sigue llegando a `window.searchIndex` con el mismo contenido y el mismo orden. Lo único que cambia es que ya no ocupa el hilo principal.

**Diff propuesto** (1 fichero modificado, 1 fichero nuevo)

`js/app.js`: sustituir las líneas 23-47.
```diff
--- a/js/app.js
+++ b/js/app.js
@@ -20,28 +20,13 @@
   onResize();
 });
 
-// Índice de búsqueda del catálogo: se construye de una sola vez en el hilo principal
-// justo después del primer pintado (problema 7: tarea larga).
-function buildSearchIndex() {
-  var origins = ['Etiopía', 'Brasil', 'Colombia', 'Kenia', 'Guatemala', 'Costa Rica', 'Perú'];
-  var entries = [];
-  for (var i = 0; i < 150000; i++) {
-    var origin = origins[i % origins.length];
-    entries.push({
-      id: i,
-      name: origin + ' lote ' + ((i * 7919) % 10007),
-      score: (i * 31) % 100,
-    });
-  }
-  entries.sort(function (a, b) {
-    return a.name.localeCompare(b.name, 'es') || b.score - a.score;
-  });
-  window.searchIndex = entries;
-}
-
-// Arranca justo después del primer pintado, mientras el usuario ya puede interactuar.
+// Índice de búsqueda del catálogo: se construye en un Web Worker (js/search-index.worker.js)
+// para no bloquear el hilo principal. Arranca justo después del primer pintado.
 document.addEventListener('DOMContentLoaded', function () {
   requestAnimationFrame(function () {
-    setTimeout(buildSearchIndex, 0);
+    var worker = new Worker('js/search-index.worker.js');
+    worker.onmessage = function (e) {
+      window.searchIndex = e.data;
+      worker.terminate();
+    };
   });
 });
```

`js/search-index.worker.js` (fichero nuevo, unas 20 líneas, sin generar nada con comandos). Es el mismo cuerpo de `buildSearchIndex()`, movido tal cual:
```js
// Worker: construye el índice de búsqueda del catálogo fuera del hilo principal.
var origins = ['Etiopía', 'Brasil', 'Colombia', 'Kenia', 'Guatemala', 'Costa Rica', 'Perú'];
var entries = [];
for (var i = 0; i < 150000; i++) {
  var origin = origins[i % origins.length];
  entries.push({
    id: i,
    name: origin + ' lote ' + ((i * 7919) % 10007),
    score: (i * 31) % 100,
  });
}
entries.sort(function (a, b) {
  return a.name.localeCompare(b.name, 'es') || b.score - a.score;
});
self.postMessage(entries);
```

**Qué espero que mueva**
- Principalmente TBT (con `bootup-time` y `mainthread-work-breakdown`), en el perfil mobile/default con 3 ejecuciones. No prometo cifra: lo que valga lo dirá `wperf compare`.

**Riesgos y cómo los compruebo**
- Disponibilidad asíncrona: `window.searchIndex` pasa a estar disponible algo más tarde que ahora. Hoy nada del repo lo lee, pero cualquier código futuro que lo lea de forma síncrona justo después del arranque lo encontraría vacío.
- Coste de copia: `postMessage` copia las 150 000 entradas al hilo principal, y esa deserialización podría seguir siendo una tarea corta o media allí. Es posible que el TBT no baje del todo; lo dirá la medición.
- El `Worker` solo funciona servido por HTTP, no con `file://`. La web se sirve por HTTP, así que no debería afectar.
- Cómo lo compruebo: antes de editar guardo una instantánea con `page-check snapshot` y después hago `page-check diff`. Busco errores de consola nuevos, peticiones fallidas (el `.worker.js` debe cargar) y que el estado del JS sea el mismo, incluida la longitud de `window.searchIndex`. También miro la captura.
- Medición: re-audito en las mismas condiciones que la base (`mobile`, red `default`, 3 ejecuciones, servidor en el puerto 4173 con el mismo comando) y comparo con `wperf compare`.

**Cómo se revierte**
- `git checkout -- js/app.js` y borrar `js/search-index.worker.js`.
- Si la re-auditoría empeora algo (una métrica `regressed`) o la página se rompe, deshago mis cambios con eso y te lo cuento. La aprobación cubre únicamente revertir lo que yo escriba.
- No hago commit ni push; los cambios se quedan en el árbol de trabajo.

**Fuera de esta ronda** (solo las anoto, no las toco): `three.min.js` sin usar y bloqueante, imágenes pesadas y sin dimensiones, y `font-display`.

¿Apruebas este diff (modificar `js/app.js` y crear `js/search-index.worker.js`) para que lo aplique, compruebe la página y re-audite?
