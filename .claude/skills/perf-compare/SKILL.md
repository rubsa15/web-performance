---
name: perf-compare
description: Compara dos auditorías de rendimiento con `wperf compare` y explica qué mejoró, qué empeoró y qué es solo ruido, cruzando con el historial de git entre ambos reportes para proponer causas probables (siempre como hipótesis). Úsala siempre que el usuario quiera comparar antes/después de un cambio, saber si una mejora fue real, investigar una regresión de LCP/CLS/TBT/score, ver la evolución de una URL (`wperf history`) o validar el efecto de un arreglo, aunque no diga "compare" ni mencione wperf.
---

# perf-compare

Explica la diferencia entre dos reportes de `wperf`. El CLI decide qué cambio es real (umbral + rangos min–max que no se solapan) y qué es ruido; tú no reclasificas. Tu aportación es contar qué significa y qué lo pudo causar, sin presentar conjeturas como hechos.

## Reglas que no se negocian

1. **Toda cifra medida sale del JSON de `wperf compare`.** Valores antes/después, deltas, porcentajes, bytes: cópialos. Si necesitas un dato que el comparador no da (rangos min–max, `items[]` de una oportunidad), léelo del reporte original, no lo calcules de memoria. Las cifras que no sean del CLI (una diferencia de tiempos entre reportes, una suma, algo leído en el código) son válidas si las pones en una línea con `(fuente: cálculo)`, `(fuente: código)` o `(fuente: fichero)`; así se distingue lo medido de lo derivado.
2. **Respeta la clasificación del CLI.** Una métrica `unchanged` es ruido aunque el número cambie: no la cuentes como mejora ni regresión. Es la razón de ser de las skills encima de un CLI determinista; si la contradices, el usuario no puede fiarse de ninguna conclusión.
3. **Causas = hipótesis.** El cruce con git solo ofrece *candidatos*. Etiquétalos como hipótesis, di qué los apoya y cómo confirmarlos, y deja que el usuario confirme la causa.
4. **No edites código.** Corregir una regresión es trabajo de `perf-fix`.

## Flujo

### 1. Elegir los reportes

- Dos reportes concretos (ids o rutas): `npx wperf compare <antes> <después> --format json`.
- Una URL: `npx wperf compare --url <url> --format json` compara los dos últimos de esa URL, device, perfil de red y throttling.
- Sin nada: `npx wperf compare --format json` usa los dos últimos reportes guardados.
- Si el usuario cambió algo y quiere saber el efecto pero solo hay un reporte, audita con `perf-audit` (o `npx wperf audit`) y compara después. Para elegir ids, `npx wperf history <url>` los lista.
- JSON por stdout; las rutas "Antes/Después" salen por stderr. Ejecuta `npm run build` antes y redirige stdout a un fichero para no volcar el JSON entero al contexto.
- Si dos reportes distintos comparten etiqueta (`demo v0`), identifícalos por `id`, no por etiqueta; el CLI no avisa de ello.
- **Perfiles de red distintos no se comparan** (código 2). Si el usuario pregunta "¿en qué red es peor?", no restes valores a mano: explica el motivo, enséñale los valores de cada reporte lado a lado marcándolo como *no* comparación, y derívalo a `perf-audit`, que sí cruza perfiles. Para comparar un perfil concreto a lo largo del tiempo usa `npx wperf compare --url <url> --network 3g --format json` (los dos últimos de ese perfil) o `npx wperf history <url> --network 3g`.
- Código 2 (distinto `device`, perfil de red `environment.network` o `throttling`, o solo hay un reporte): explica el motivo; no hay comparación válida y no debes forzar una a mano. Código 3: error de ejecución, cuéntalo.

### 2. Comprobar que la comparación es fiable

Antes de interpretar, lee `warnings` y `before`/`after`:

- URLs distintas, Lighthouse o Chrome distintos, "antes" posterior a "después", una sola ejecución: dilo al principio y rebaja la confianza en consecuencia.
- El CLI solo avisa de lo formal. Que `warnings` esté vacío no garantiza que se haya medido el mismo contenido: si las oportunidades `new`/`resolved` o los cambios de `resources` son grandes con el mismo commit, sospecha que el sitio cambió entre medidas (ver paso 4).
- Si `before` y `after` tienen distinta URL (p. ej. demo rota vs. arreglada en otro puerto), es una comparación entre dos *versiones del sitio*, no de una misma URL: es válida, pero git no explicará la diferencia (ver paso 4).

### 3. Contar el resultado

Estructura (ejemplo de mejora en [references/ejemplo-salida.md](references/ejemplo-salida.md); de regresión en [references/ejemplo-regresion.md](references/ejemplo-regresion.md)):

0. **Aviso de orden**: si el CLI avisa de que "antes" es posterior a "después" y la comparación es legítima (p. ej. la versión rota medida más tarde que la arreglada), no inviertas los reportes: di que es válida pero medida al revés.
1. **Veredicto**: `verdict` (`improved` / `regressed` / `mixed` / `unchanged`), `score` antes→después y su `change`, ids y fechas de ambos reportes.
2. **Métricas**: tabla con antes, después, delta, `change` y el cambio de `rating` (p. ej. poor → good). El JSON de `compare` no trae el rango min–max ni el umbral; si quieres explicar por qué algo es ruido, lee `metrics.<id>.min/max` de los reportes originales (con 3 ejecuciones por lado, la confianza es limitada: dilo) y los umbrales por defecto de la SPEC §6 (el umbral efectivo es el **mayor** de los dos valores: LCP/FCP/SI 150 ms o 10 % del valor "antes", TBT 50 ms o 50 %, TTFB 100 ms o 20 %, CLS 0,02, score 5 puntos; y además los rangos min–max no deben solaparse. Por eso un LCP que sube 974 ms sobre 39 754 ms es `unchanged`: el 10 % son 3 975 ms). Separa en tres bloques lo que el CLI marca como `improved`, `regressed` y `unchanged` (ruido). Si todo es `unchanged`, la conclusión es "no hay cambio medible", y está bien decirlo.
3. **Oportunidades**: agrupa por `status` (`resolved`, `better`, `new`, `worse`, `same`) con `deltaMs`/`deltaBytes`. Una oportunidad presente en ambos es `better`/`worse` solo si su ahorro cambia más de 100 ms o 50 % (o 10 KiB o 20 % en bytes); por debajo es `same` aunque el número se mueva (+200 ms sobre 32 700 ms es `same`). No lo reclasifiques. Interpreta en causa raíz, no id a id (ver [la guía de causas de perf-audit](../perf-audit/references/causas-raiz.md)): p. ej. `unsized-images` + `cls-culprits-insight` resueltas = problema de CLS resuelto.
4. **Elemento LCP**: si `lcpElement.changed` es `true`, el LCP de "antes" y el de "después" son elementos distintos y el salto de la métrica puede no ser comparable con lo que se arregló; dilo junto al LCP y no atribuyas la mejora a un arreglo sin comprobarlo (hipótesis). Si es `false`, es el mismo elemento. Si falta `lcpElement`, algún reporte no lo tiene.
5. **Recursos**: cambios relevantes de `resources` (total y por tipo), que suelen explicar por qué cambió el resto. Formato: ms enteros; en la prosa, MiB con 2 decimales si superan 1 MiB y KiB enteros por debajo (redondea, con coma decimal); en tablas de recursos puedes dar los bytes exactos del JSON.
6. **Causas probables (hipótesis)** y **qué confirmar**.

Una oportunidad `resolved` con ahorro 0 es un buen dato (el problema desapareció) pero no tiene cifra de mejora: no le inventes una. El efecto cuantificable está en las métricas.

### 4. Cruzar con git (solo hipótesis)

Cada reporte trae `git: { commit, dirty }` cuando se auditó dentro de un repo. Úsalo para listar candidatos:

```sh
git log --oneline <commit-antes>..<commit-después>
git diff --stat <commit-antes> <commit-después>
```

Antes de dar una mejora por buena, mira `npx wperf history <url>`: si el "antes" no es representativo (un reporte ya degradado, o un cambio de contenido entre medidas con la misma etiqueta) la mejora es frente a una base mala; dilo.

Casos que cambian lo que puedes afirmar:

- **Mismo commit en ambos** (típico con `dirty: true`): git no ayuda; no inventes un commit culpable. Pero la causa a veces se ve en los propios reportes: compara los `items[]` de las oportunidades que cambiaron (qué URLs aparecen en un reporte y no en el otro, con sus bytes). Es la evidencia más sólida que tienes en este caso; preséntala como *medición* (qué recurso cambió) y la explicación (qué se tocó y por qué) como *hipótesis*. Ejemplo completo: [references/ejemplo-regresion.md](references/ejemplo-regresion.md). `git diff` del árbol actual no sirve para esto: refleja el estado de ahora, no el de cada auditoría.
- **Falta `git` en alguno**: no hay base para el cruce; dilo.
- **`dirty: true`**: el reporte incluye cambios que ningún commit recoge; los commits listados son solo parte de la explicación.
- **Commit inexistente en el repo actual** (otro clon, historial reescrito): `git log` fallará; no lo disimules.
- **Distinta URL / otra versión del sitio**: git no explica la diferencia. Si el usuario pregunta por la causa, compara los directorios con `git diff --no-index --stat <dirA> <dirB> | grep -E '\.(html|css|js)'` (el filtro va en el `grep`: con `--no-index` un pathspec hace fallar a git, y sin filtro `--stat` lista documentación y binarios que solo meten ruido); si no pregunta, no lo hagas. Si los commits de los reportes son anteriores a esos ficheros (el árbol de entonces no está en git), compara el árbol actual y márcalo `(fuente: código)` e hipótesis.
- **`items[]` que parece contradecir la clasificación** (p. ej. `bootup-time` es `better` y el TBT baja, pero el `cpuMs` de un script sube): no reclasifiques. Preséntalo como dato medido y propón una hipótesis (aquí, que el trabajo se trocea en tareas cortas).

Para cada candidato, relaciona *qué tocó el commit* (ficheros del `diff --stat`, mensaje) con *qué empeoró o mejoró* (métrica y oportunidad). Un candidato sin relación plausible con las métricas que se movieron no se menciona. Indica siempre cómo confirmarlo: revertir ese cambio y volver a auditar, o `git stash` + `wperf audit` + `wperf compare`.

### 5. Cierre

Pregunta al usuario si confirma la causa o quiere que se investigue otra. Ofrece `perf-fix` solo si hay una regresión real en el código. Si la diferencia viene de un cambio de línea base (el "antes" ya estaba degradado, o el sitio cambió entre medidas sin commit), no hay nada que arreglar: avisa de qué reporte es una referencia sensata (`npx wperf history <url>` muestra la serie) y de que cualquier comparación anterior contra ese "antes" mide frente a una base degradada.

## Antes de responder: comprobación de cifras

Cada número de tu informe debe estar en el JSON de `compare` (o ser una conversión directa de unidad). Los porcentajes: usa `deltaPct` del JSON (es fracción: -0,948 = −94,8 %). Si no encuentras el origen de una cifra, quítala. Si afirmas una mejora o regresión, verifica que su `change` en el JSON lo respalda.
