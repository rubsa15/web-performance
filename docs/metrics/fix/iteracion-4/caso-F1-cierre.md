## Veredicto: mejora medida

TBT `improved` y ninguna métrica `regressed`. Comparación `2026-10-22T19-30-59Z-mobile` → `2026-10-22T19-34-56Z-mobile`, veredicto global del CLI `improved`, `warnings` vacío. Mismo perfil en ambos lados (mobile, red `default`, 5 ejecuciones), misma URL (`http://127.0.0.1:4173/`) y servida con el mismo comando y puerto. Id "antes": `2026-10-22T19-30-59Z-mobile`; id "después": `2026-10-22T19-34-56Z-mobile`. Rangos del TBT sin solape (`rangesOverlap: false`), así que no repetí la medición.

## Qué se cambió

Sin commit; el cambio está en el árbol de trabajo (`git status --short`: ` M js/app.js`).

- `js/app.js`: se aplicó exactamente el diff aprobado (comprobado: `git diff` idéntico al propuesto; +56/−9 líneas, fuente: git). `buildSearchIndex()` ahora es `async`: genera las entradas y las ordena en tramos de 1000, los mezcla por pares (merge estable) y cede el hilo con `setTimeout(0)` cuando el trozo actual pasa de 5 ms. Resultado final y orden idénticos; `window.searchIndex` se asigna al terminar. No se tocó ningún otro fichero ni se crearon ficheros.

## Antes → después (cifras de `wperf compare`)

**Mejora**

| Métrica | Antes           | Después        | Delta             | `change`   |
| ------- | --------------- | -------------- | ----------------- | ---------- |
| TBT     | 625 ms (`poor`) | 44 ms (`good`) | -581 ms (-93,0 %) | `improved` |
| Score   | 41              | 57             | +16               | `improved` |

**Ruido (`unchanged`)**

| Métrica | Antes                         | Después                       | Delta |
| ------- | ----------------------------- | ----------------------------- | ----- |
| LCP     | 40729 ms (`poor`)             | 40729 ms (`poor`)             | 0 ms  |
| FCP     | 2497 ms (`needs-improvement`) | 2498 ms (`needs-improvement`) | +1 ms |
| SI      | 2497 ms (`good`)              | 2498 ms (`good`)              | +1 ms |
| CLS     | 0,291 (`poor`)                | 0,291 (`poor`)                | 0     |
| TTFB    | 752 ms (`good`)               | 752 ms (`good`)               | 0 ms  |

**Empeora:** ninguna.

| Oportunidad                 | `status` | `deltaMs` | `deltaBytes` |
| --------------------------- | -------- | --------- | ------------ |
| `mainthread-work-breakdown` | `better` | -600      | 0            |
| `bootup-time`               | `better` | -550      | 0            |

El resto de oportunidades siguen `same` (`image-delivery-insight`, `render-blocking-insight`, `unused-javascript`, `font-display-insight`, `unsized-images`, etc.). Rangos min–max del TBT: 515–1591 ms antes y 43–45 ms después (no se solapan). `lcpElement.changed` es `false` (sigue siendo `img.hero-img`).

Matiz que conviene saber: el troceo reparte la CPU, no la reduce. En los reportes, `js/app.js` pasa de `cpuMs` 1633 a 1567 (fuente: reportes `2026-10-22T19-30-59Z` y `2026-10-22T19-34-56Z`), prácticamente lo mismo, y el diagnóstico `long-tasks` pasa de "3 long tasks found" a "2 long tasks found". Es decir, la mejora medida del TBT está demostrada; que el mecanismo sea el troceo del índice es la hipótesis de partida y es coherente con estos datos, pero las 2 tareas largas que quedan no las he investigado (hipótesis: parte del coste de `three.min.js`, del propio documento o de los scripts bloqueantes).

## Integridad de la página

- `wperf check diff` (instantánea previa tomada antes de editar vs. posterior): "La página sigue íntegra", código de salida 0. Mismo texto, 7 imágenes cargadas, `searchIndexLength` 150000 en ambos lados (el índice sigue construyéndose completo), y los mismos errores: 1 error de consola y 1 petición fallida (404 de `favicon.ico`, fuente: page-check), ya presentes antes.
- El proyecto no tiene `package.json`, build, lint ni tests, así que no había nada más que ejecutar. `node --check js/app.js` correcto.
- Capturas (`antes.png` y `despues.png`): las he mirado y son visualmente idénticas (mismo layout, hero, 6 tarjetas, suscripción y pie). Este arreglo no toca HTML ni CSS. Aun así, te pido que les eches un vistazo tú.
- Riesgo conocido: `window.searchIndex` ahora se asigna de forma asíncrona y más tarde que antes; nada del repo lo lee hoy.

## Qué queda

Causas vistas y no tocadas (siguen `same`):

- Imágenes pesadas (`image-delivery-insight`, ahorro 8154587 bytes en el reporte): el LCP sigue en `poor` (40729 ms).
- Imágenes sin `width`/`height` (`unsized-images`): CLS en `poor` (0,291).
- Recursos que bloquean el render (`render-blocking-insight`) y `three.min.js` sin usar (`unused-javascript`). Ahora que la tarea larga está troceada, esto se puede abordar vigilando el TBT.
- `font-display` (`font-display-insight`).
- Quedan 2 long tasks en el diagnóstico.

Los cambios no están commiteados (`js/app.js` modificado). Para revertir: `git checkout -- js/app.js`. ¿Abordo otra causa (te propongo dimensiones de imágenes + `font-display`, o el peso de las imágenes para el LCP)?
