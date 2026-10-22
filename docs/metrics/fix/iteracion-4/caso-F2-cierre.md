## Veredicto: compensación (decides tú)

El FCP mejora de forma medida, pero el TBT empeora mucho y el score baja. Comparación `2026-10-22T19-13-10Z-mobile` → `2026-10-22T19-39-37Z-mobile`, veredicto global del CLI `mixed`, `warnings` vacío. Mismo perfil en ambos lados (mobile, red `default`, 3 ejecuciones), misma URL (`http://127.0.0.1:4173/`) servida con el mismo comando y puerto.

Esto es justo el riesgo del que te avisé y que aceptaste. Según la skill, una mejora con otra métrica en `regressed` es una compensación y la decisión de mantenerla es tuya. **He dejado el cambio aplicado, sin revertir y sin commit**, esperando tu respuesta. Mi recomendación está más abajo.

## Qué se cambió

Solo el diff aprobado, en `index.html` (líneas 12-13). `git status --short` muestra ` M index.html` (2 inserciones, 2 borrados, fuente: `git diff --stat`). Sin commit.

```diff
-    <script src="vendor/three.min.js"></script>
-    <script src="js/app.js"></script>
+    <script defer src="vendor/three.min.js"></script>
+    <script defer src="js/app.js"></script>
```

## Antes → después (cifras de `wperf compare`)

**Mejora**

| Métrica | Antes                         | Después          | Delta              | `change`   |
| ------- | ----------------------------- | ---------------- | ------------------ | ---------- |
| FCP     | 2496 ms (`needs-improvement`) | 1354 ms (`good`) | -1142 ms (-45,8 %) | `improved` |
| SI      | 2496 ms (`good`)              | 1354 ms (`good`) | -1142 ms (-45,8 %) | `improved` |

**Empeora**

| Métrica | Antes           | Después          | Delta              | `change`    |
| ------- | --------------- | ---------------- | ------------------ | ----------- |
| TBT     | 624 ms (`poor`) | 1499 ms (`poor`) | +875 ms (+140,2 %) | `regressed` |
| Score   | 41              | 34               | -7                 | `regressed` |

**Ruido (`unchanged`)**

| Métrica | Antes    | Después  | Delta    |
| ------- | -------- | -------- | -------- |
| LCP     | 40729 ms | 37354 ms | -3375 ms |
| CLS     | 0,291    | 0,291    | 0        |
| TTFB    | 752 ms   | 752 ms   | 0 ms     |

El LCP baja 3375 ms, pero el CLI lo deja en `unchanged` (umbral 4073 ms), así que no lo cuento como mejora. Sigue en `poor`. El elemento LCP no cambió (`lcpElement.changed: false`).

| Oportunidad                 | `status`   | `deltaMs` | `deltaBytes` |
| --------------------------- | ---------- | --------- | ------------ |
| `render-blocking-insight`   | `better`   | -1150     | 0            |
| `bootup-time`               | `worse`    | +850      | 0            |
| `mainthread-work-breakdown` | `resolved` | -600      | 0            |

El ahorro estimado de `render-blocking-insight` baja de 1550 ms a 400 ms, y el impacto pasa de `high` a `medium`. Queda solo la hoja de estilos como bloqueante, como esperaba. El resto de oportunidades siguen `same`.

La medición es sólida y no la repetí. Los rangos min–max del TBT no se solapan (446–742 ms antes, 1471–1718 ms después) y el delta supera de sobra su umbral (312 ms). Lo mismo para el FCP (2495–2498 ms antes, 1353–1354 ms después).

**Hipótesis (no medida):** es lo que describía la propuesta. Al adelantarse el primer pintado, la tarea larga de `buildSearchIndex()` (`bootup-time`: 1632 ms de CPU en `js/app.js` en el reporte base) cae dentro de la ventana que cuenta para el TBT. Antes quedaba en parte fuera. El defecto sigue siendo esa tarea; `defer` solo cambió dónde se mide. Para confirmarlo hay que arreglar la tarea larga y repetir la medición.

## Integridad de la página

`wperf check diff` (instantánea antes de editar contra instantánea después): **"La página sigue íntegra"**, salida 0. En ambas instantáneas hay 7 imágenes, 1 error de consola, 1 petición fallida e índice de búsqueda de 150000 entradas (fuente: page-check). El error y la petición fallida son los mismos que antes, no se han añadido nuevos. El proyecto no tiene `package.json`, `build`, `lint` ni tests.

He mirado las dos capturas y a simple vista se ven idénticas (misma cabecera, hero, tarjetas de cafés, suscripción y pie). Un salto de layout fino no lo ve el diff de texto, así que si quieres abre tú también `.perf/check/antes.png` y `.perf/check/despues.png`.

## Qué queda

- **Tu decisión:**
  - **A (mi recomendación): revertir.** Se pierde la mejora de FCP, pero el TBT queda en 624 ms en lugar de 1499 ms. Ejecutaría `git checkout -- index.html`.
  - **B: mantener el cambio**, asumiendo un TBT mucho peor. No lo recomiendo salvo que el FCP te importe más que la interactividad.
  - **C (el camino lógico): conservar `defer` y arreglar la tarea larga en una ronda siguiente.** Es otra causa raíz y otra ronda con su propia aprobación: trocear, diferir o mover `buildSearchIndex()` (`js/app.js`) a un Web Worker. Sin eso, el `defer` no es un cambio neto positivo.
- **Causas vistas y no tocadas (siguen `same`):**
  - Tarea larga en `js/app.js` (el TBT empeorado).
  - Imágenes pesadas (`image-delivery-insight`): el LCP sigue en `poor`.
  - Imágenes sin `width`/`height` (CLS 0,291 en `poor`).
  - `three.min.js` sin usar (`unused-javascript`).
  - `font-display`.
  - La hoja de estilos `css/styles.css`, que sigue bloqueando (400 ms de ahorro estimado).
- Los cambios no están commiteados. ¿Revierto (A), mantengo (B) o abordo la tarea larga (C)?
