---
name: perf-fix
description: Corrige en el código de una web un problema de rendimiento detectado por `wperf` (una oportunidad de Lighthouse o una causa raíz de `perf-audit`) - localiza el origen, propone un diff pequeño, lo aplica solo tras la aprobación del usuario, vuelve a auditar con `wperf audit` y valida el resultado con `wperf compare`; si no mejora o rompe la página, lo revierte o lo explica. Úsala siempre que el usuario pida arreglar, aplicar, implementar o corregir una mejora de rendimiento en el repo de la web (LCP, CLS, TBT, imágenes pesadas, scripts bloqueantes, fuentes, lazy-load…), o diga "aplica la mejora 2" tras una auditoría, aunque no mencione wperf.
---

# perf-fix

Aplica un arreglo de rendimiento en el código y demuestra con mediciones que sirvió. El CLI mide antes y después; tú localizas, propones y editas. Lo que hace útil esta skill es que **ningún cambio se queda sin verificar** y que el usuario manda sobre el código.

## Reglas que no se negocian

1. **No edites nada sin aprobación explícita del diff.** Primero enseñas el cambio propuesto (ficheros y líneas exactas) y esperas la respuesta. Una aprobación vale para ese diff: si cambia (porque descubres algo al aplicarlo), vuelves a pedirla. Leer, buscar y auditar no necesitan permiso.
2. **Toda cifra de mejora sale de `wperf compare`.** Antes/después, deltas y porcentajes se copian del JSON de la comparación, nunca se estiman ni se prometen. Antes de aplicar puedes decir *qué esperas que mueva* (métrica, hipótesis), pero no *cuánto*. Las cifras que no son del CLI (bytes de un fichero generado, dimensiones, líneas del diff) llevan `(fuente: fichero)`, `(fuente: código)`, `(fuente: cálculo)` o `(fuente: page-check)` (códigos HTTP, tamaño del índice de búsqueda…).
3. **El veredicto es el de `compare`, no el tuyo.** Una métrica `unchanged` es ruido aunque el número baje; no la vendas como mejora. Si el objetivo no mejora de forma medible, lo dices.
4. **Diff mínimo, una causa raíz por ronda.** Resuelve lo que se pidió y nada más: sin refactors, sin formatear ficheros enteros, sin tocar otras causas aunque las veas (las anotas al final). Cada ronda se audita sola; si mezclas dos arreglos no sabrás cuál funcionó.
5. **Revertir es parte del trato.** Al pedir la aprobación avisas de que, si la re-auditoría empeora algo o rompe la página, deshaces tus cambios. Esa aprobación cubre el revertir lo que tú escribiste, y nada más.
6. **No hagas commit ni push** salvo que el usuario lo pida. Los cambios se quedan en el árbol de trabajo para que los revise.

## Flujo

### 0. Comprobar el CLI

Ejecuta `npx --no-install wperf --version`.

- Si responde con una versión, sigue. Si estás en el repo de `wperf` (tiene `bin/wperf` y `src/`), ejecuta además `npm run build` para no medir con un `dist/` viejo.
- Si falla, `wperf` no está instalado en este proyecto: pide permiso y ejecuta `npm install -D @rubensa15/wperf` (o, desde el repositorio, `npm install -D github:rubsa15/web-performance`). **No uses `npx wperf` sin instalar**: npm descargaría otro paquete llamado `wperf` que no es este.
- Necesita Chrome (o `CHROME_PATH`) y Node ≥ 22.19.

### 1. Qué se arregla y con qué línea base

Entrada: un id de oportunidad (`image-delivery-insight`), una causa raíz de `perf-audit` ("la fila 2") o una descripción ("las imágenes no tienen dimensiones"). Si es ambigua, pregunta cuál.

- Necesitas un reporte **anterior al cambio** del mismo dispositivo y perfil de red con el que vas a comparar. Mira `npx wperf history <url>`: sirve el último si su `git.commit` es el `HEAD` actual y `git.dirty` es `false` (o si el código no ha cambiado desde entonces). Si no existe, está desfasado o no sabes qué código midió, audita ahora (`npx wperf audit <url> --device <d> --network <n> --runs 3 --label antes-<causa> --format json > <fichero>`); el CLI ya comprobado en el paso 0.
- Perfil de medición: el mismo en que el problema es relevante. Por defecto `mobile` + `default`, 3 ejecuciones. Si la causa es sensible a la red (`perf-audit` lo marca), mide también `3g`. Perfiles distintos no se comparan entre sí (código 2): el "antes" y el "después" de cada perfil van emparejados. Usa las mismas ejecuciones en ambos lados.
- Las mediciones se lanzan **una detrás de otra, nunca en paralelo**, y con la web servida de la misma forma antes y después (mismo puerto y comando). Si hay que arrancar un servidor (`npm run demo`, `npm run dev`, un `serve`), averigua el comando en `package.json`/README y pregúntalo si dudas.
- Anota los valores de partida del reporte base: la métrica objetivo y su `rating`, la oportunidad y su ahorro (`opportunities[].items[]` dice qué recursos).
- **Estado de git**: ejecuta `git status --short`. Si hay cambios sin commitear que no son tuyos, díselo al usuario: la re-auditoría los incluirá y revertir se hace por fichero, nunca con `git checkout .`/`git reset --hard`. Sin git, copia los ficheros que vayas a tocar a `.perf/backup/<fecha>/` antes de editar.

### 2. Localizar el origen en el código

Los datos del reporte dicen *qué* recurso falla; busca *dónde* se produce:

- `items[].url`, `items[].selector` y `lcp.element` (`selector`, `snippet`) → `grep` del nombre del fichero, de la clase o del `src` en el repo.
- Si lo que sirve el servidor es una salida generada (`dist/`, `build/`, HTML minificado), busca la **fuente** (plantilla, componente, configuración del bundler) y edita ahí, no en la salida.
- **Verifica que el código confirma el hallazgo** antes de proponer (p. ej. que el `<img>` realmente no tiene `width`/`height`, o que el script no usa la librería). Si el código contradice el reporte, dilo y no propongas nada.
- **Cuando el origen no está en el repo** (script de un tercero, CDN, cabeceras del servidor, CMS, vídeo alojado fuera), no hay diff que proponer: explica qué se podría hacer fuera del repo y termina ahí. No inventes ficheros.
- Los arreglos por tipo de problema (qué tocar, riesgos, cómo comprobar que no se rompe) están en [references/catalogo-arreglos.md](references/catalogo-arreglos.md). Es una guía de partida: adáptala al código que encuentres.

### 3. Proponer el diff y pedir aprobación

Antes de editar, presenta en un solo mensaje:

1. **Qué y por qué**: la causa (hipótesis si la deduces del código; medición si está en el reporte), el recurso afectado con su cifra del reporte base.
2. **El diff** exacto, en bloque ```diff, o la lista de cambios si implica ficheros nuevos o generados (qué comando los produce y cuánto pesan, `(fuente: fichero)`). Un diff pequeño y revisable.
3. **Qué esperas que mueva** (métrica, sin cifra) y **riesgos**: qué podría romperse (layout, contenido, comportamiento) y cómo lo comprobarás.
4. **Cómo se revierte** y la frase de que lo harás si la re-auditoría no lo respalda.

5. **Interacciones entre causas.** Si el arreglo adelanta el primer pintado (`defer`/`async`, quitar un script o CSS bloqueante) y el reporte tiene una tarea larga en el hilo principal (`bootup-time` con un script de CPU alta, TBT que no está en `good`), el TBT puede **empeorar** aunque el FCP mejore: la tarea larga pasa a caer dentro de la ventana que cuenta para el TBT. Dilo en los riesgos y proponle al usuario arreglar antes la tarea larga; es lo que ocurrió al medir `defer` y quitar `three.min.js` en la demo (ver [references/ejemplo-revertido.md](references/ejemplo-revertido.md)).

Pregunta si lo aplicas y **para**. Si el usuario pide ajustes, repropón. Si rechaza, no insistas.

### 4. Aplicar y comprobar que la página sigue sana

Tras la aprobación:

1. **Instantánea previa (si procede).** Para una web servida, `npx wperf check snapshot <url> <antes.json> --screenshot <antes.png>` guarda texto, imágenes, errores de consola, peticiones fallidas y el estado del JS **antes de editar**. Es opcional pero recomendable: sin ella, "no se rompió" es solo una impresión.
2. Aplica **solo** el diff aprobado (con `Edit`/`Write`). Si tienes que generar ficheros (imágenes redimensionadas), usa la herramienta que hayas dicho en la propuesta.
3. Si el repo tiene `build`, `typecheck`, `lint` o tests, ejecútalos. Un fallo es un fallo del arreglo hasta que se demuestre lo contrario.
4. Sirve la web como antes, repite la instantánea (`<después>.json`) y compara: `npx wperf check diff <antes.json> <después.json>` (código de salida 1 si algo se rompió). Lo que marque (texto distinto, imagen que no carga, error de consola nuevo, JS que dejó de ejecutarse) rompe el arreglo. Mira también la captura: el CLS o un cambio de layout no se ven en el diff de texto; si no puedes mirarla, pide al usuario que la revise.

Si algo está roto, **no sigas a medir**: arréglalo con un ajuste mínimo y, si no es evidente, revierte y cuéntalo (paso 6).

### 5. Re-auditar y comparar

```sh
npx wperf audit <url> --device <d> --network <n> --runs 3 --label despues-<causa> --format json > <despues.json>
npx wperf compare <id-antes> <id-despues> --format json > <comparacion.json>
```

Redirige stdout a ficheros (el JSON es largo) y lee de ahí. Los ids salen de `Reporte guardado` en stderr o de `npx wperf history <url>`. Revisa `warnings` de la comparación: perfil, versión de Lighthouse o URL distintos le quitan valor. Si el "antes" y el "después" se sirvieron en puertos distintos, la URL cambia: es válido, pero dilo.

Cuando el arreglo toca LCP, mira `lcpElement.changed` en la comparación: si el elemento LCP cambió, el salto no se debe atribuir sin más al arreglo.

### 6. Veredicto y qué hacer

Con la comparación delante, clasifica el resultado por lo que dice el CLI:

| Resultado                                                                                                            | Acción                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La métrica objetivo `improved` y nada `regressed`, página íntegra                                                    | **Mejora medida.** Mantén el cambio.                                                                                                                                                                                                                    |
| Mejora (`improved`) pero otra métrica `regressed`                                                                    | **Compensación.** Cuéntala con las dos cifras y pregunta al usuario si lo mantiene; no decidas tú. Si empeora algo importante (una métrica pasa a `poor`), revierte.                                                                                      |
| Métrica objetivo `unchanged`, pero la oportunidad pasa a `resolved`/`better` (o el defecto ya no aparece en el reporte) | **Corrección sin efecto medible.** Mantén el cambio si es correcto por sí mismo (ancho/alto de imágenes, `font-display`), pero di que no hay mejora demostrada. Posibles motivos, como hipótesis: la métrica no es sensible a esto en este perfil, o ruido. |
| Todo `unchanged` y la oportunidad sigue igual                                                                        | **No funcionó.** Revierte y explica por qué puede ser (hipótesis: no era la causa, o el cambio no llegó al servidor).                                                                                                                                   |
| Alguna métrica `regressed` y ninguna mejora, o la página rota                                                        | **Revierte** (regla 5) y cuenta qué pasó.                                                                                                                                                                                                               |

**No atribuyas un mecanismo que no has medido.** Si la métrica mejora pero lo que esperabas que cambiara no cambió (el LCP baja y `resources.byType.image` sigue igual tras un `loading="lazy"`, el `lcp.breakdown` no mejora), cuenta la mejora medida y di que el mecanismo no está demostrado (hipótesis: efecto del modelo de simulación, no de la descarga).

Revertir: `git checkout -- <ficheros que tocaste>` (y borra los que creaste), o restaura de `.perf/backup/`. Comprueba con `git status --short` que el árbol queda como antes (salvo lo que ya estaba sucio). No uses `git reset --hard`/`git stash` sobre cambios ajenos.

Si la comparación avisa de un `warnings` serio o la medición es dudosa (rangos min–max solapados con un solo cambio pequeño), repite la re-auditoría una vez antes de concluir; no la repitas más de una vez ni hasta que "salga bien".

### 7. Cerrar

Responde con (formato en [references/ejemplo-salida.md](references/ejemplo-salida.md); con el arreglo revertido, [references/ejemplo-revertido.md](references/ejemplo-revertido.md)):

1. **Veredicto**: una línea (mejora medida / corrección sin efecto medible / revertido / compensación) con el id de la comparación y los ids antes/después.
2. **Qué se cambió**: ficheros y resumen del diff aplicado (o "revertido; el árbol no tiene cambios tuyos").
3. **Antes → después**: tabla de las métricas con `change` del CLI (clasificadas en mejora / empeora / ruido) y de la oportunidad (`status`, `deltaMs`, `deltaBytes`). Cifras copiadas, ms enteros, MiB con dos decimales (coma decimal).
4. **Integridad de la página**: resultado de `wperf check diff` o de los tests, y qué falta por mirar a mano (captura).
5. **Qué queda**: causas que viste pero no tocaste, y la pregunta de si abordas otra. Recuerda que los cambios no están commiteados.

## Antes de responder: comprobación de cifras

Cada número de tu informe debe estar en el JSON de `compare`, en un reporte, o llevar su marca de fuente. Verifica que cada "mejora" que afirmas tiene `change: improved` en el JSON, y cada "ruido" tiene `unchanged`. Si no localizas el origen de una cifra, quítala.
