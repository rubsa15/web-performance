# Ejemplo de cierre de `perf-fix`: mejora medida

Caso real (evaluación en `docs/metrics/fix.md`): la tarea larga `buildSearchIndex()` de la demo movida a un Web Worker. Las cifras salen de `tests/fixtures/reports/ejemplo-fix-antes.json` y `ejemplo-fix-despues.json` y de su comparación. **No las reutilices** para otra web, y el orden de las secciones es la plantilla, no el texto.

Antes de este cierre, el usuario vio la propuesta (paso 3: diff, qué se espera que mueva, riesgos y cómo se revierte) y la aprobó.

---

## Veredicto: mejora medida

TBT `improved` y ninguna métrica `regressed` (comparación `2026-10-22T07-39-28Z-mobile` → `2026-10-22T07-56-52Z-mobile`, veredicto global `improved`). Mismo perfil en ambos lados (mobile, red `default`, 3 ejecuciones), misma URL servida con el mismo comando. `warnings` vacío.

## Qué se cambió

Sin commit; los cambios están en el árbol de trabajo (`git status --short`: `M js/app.js`, `?? js/search-index.worker.js`).

- `js/app.js`: se eliminó `buildSearchIndex()` y su arranque con `setTimeout`. Tras `DOMContentLoaded` y `requestAnimationFrame` crea un `Worker('js/search-index.worker.js')` que al terminar asigna `window.searchIndex` y se cierra.
- `js/search-index.worker.js` (nuevo): el mismo bucle y el mismo `sort`, movidos tal cual (fuente: código).

## Antes → después (cifras de `wperf compare`)

**Mejora**

| Métrica | Antes                        | Después       | Delta                | `change`   |
| ------- | ---------------------------- | ------------- | -------------------- | ---------- |
| TBT     | 417 ms (`needs-improvement`) | 39 ms (`good`) | -378 ms (-90,6 %)    | `improved` |
| Score   | 47                           | 57            | +10                  | `improved` |

**Ruido (`unchanged`)**

| Métrica | Antes   | Después | Delta |
| ------- | ------- | ------- | ----- |
| LCP     | 40729 ms | 40728 ms | -1 ms |
| FCP     | 2495 ms  | 2492 ms  | -3 ms |
| CLS     | 0,291    | 0,291    | 0     |

**Empeora:** ninguna.

| Oportunidad   | `status`   | `deltaMs` | `deltaBytes` |
| ------------- | ---------- | --------- | ------------ |
| `bootup-time` | `resolved` | -400      | 0            |

Los rangos min–max del TBT no se solapan (309–610 ms antes, 38–39 ms después), así que la mejora no se explica por la dispersión y no hizo falta repetir la medición. `lcpElement.changed` es `false`. El resto de oportunidades siguen `same`.

## Integridad de la página

`wperf check diff`: "La página sigue íntegra". Mismo texto y mismas imágenes, `window.searchIndex` con el mismo tamaño en ambos lados y los mismos errores de consola y peticiones fallidas que antes (el 404 del favicon, fuente: page-check). El proyecto no tiene `package.json`, build ni tests. **Falta mirar a mano** las capturas (`antes.png`, `despues.png`): este arreglo no toca HTML ni CSS, pero un salto de layout no lo ve el diff de texto. Riesgo conocido: `window.searchIndex` ahora se asigna de forma asíncrona; nada del repo lo lee hoy.

## Qué queda

Causas vistas y no tocadas (siguen `same`):

- Imágenes pesadas (`image-delivery-insight`): el LCP sigue en `poor`.
- Imágenes sin `width`/`height` (CLS en `poor`).
- Recursos que bloquean el render y `three.min.js` sin usar.
- `font-display`.

Los cambios no están commiteados. ¿Abordo otra causa?
