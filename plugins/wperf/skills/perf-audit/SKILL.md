---
name: perf-audit
description: Audita el rendimiento de una web con el CLI `wperf` (Lighthouse) en varios perfiles de red y dispositivos (los pregunta antes de medir) y explica los resultados - agrupa las oportunidades por causa raíz, distingue las que dependen de la red de las que no, estima esfuerzo S/M/L y entrega una tabla priorizada impacto/esfuerzo con la evidencia medida. Úsala siempre que el usuario pida auditar, medir, analizar o diagnosticar el rendimiento o la velocidad de una URL o de la web del repo (LCP, CLS, TBT, Lighthouse, "va lenta", "qué mejoro primero"), aunque no mencione wperf, y también para interpretar un reporte ya guardado en `.perf/reports/`.
---

# perf-audit

Convierte una auditoría de `wperf` en un plan de mejora priorizado. El CLI mide; tú interpretas. Esa frontera es lo que hace útil el resultado: el usuario tiene que poder fiarse de cada cifra.

## Reglas que no se negocian

1. **Toda cifra medida sale del JSON del CLI.** Tiempos, bytes, puntuaciones, número de recursos: cópialos del `Report`, nunca los estimes ni los recuerdes. Si una mejora no tiene dato de ahorro (`savingsMs` y `savingsBytes` a 0), escribe "sin ahorro medido" en lugar de inventar uno.
   - Cuando verifiques un hallazgo fuera del reporte (dimensiones de una imagen, tamaño de un bucle en el código, bytes de un HTML descargado con `curl`) o calcules algo (suma de dos recursos, porcentaje sobre el total, cociente entre perfiles), la cifra es válida pero **no es del CLI**: ponla en una línea que diga `(fuente: código)`, `(fuente: fichero)`, `(fuente: curl)` o `(fuente: cálculo)` con los operandos. Es lo que permite revisar de un vistazo qué viene del CLI y qué no, y lo que `skill-eval figures` entiende.
2. **Separa medición de hipótesis.** Lo que está en el JSON es *medición*; la causa probable, el esfuerzo y cualquier cosa que deduzcas leyendo el código es *hipótesis*. Márcalo en la salida (columna o etiqueta), porque el usuario decide con esa distinción.
3. **No sumes ahorros.** Los ahorros de Lighthouse se solapan (p. ej. imagen y LCP). Presenta cada uno por separado y no calcules "total ahorrable".
4. **El usuario elige.** Termina proponiendo qué abordar primero, pero no edites código: eso es `perf-fix`.

## Flujo

### 0. Comprobar el CLI

Ejecuta `npx --no-install wperf --version`.

- Si responde con una versión, sigue. Si estás en el repo de `wperf` (tiene `bin/wperf` y `src/`), ejecuta además `npm run build` para no medir con un `dist/` viejo.
- Si falla, `wperf` no está instalado en este proyecto: pide permiso y ejecuta `npm install -D @rubensa15/wperf` (o, desde el repositorio, `npm install -D github:rubsa15/web-performance`). **No uses `npx wperf` sin instalar**: npm descargaría otro paquete llamado `wperf` que no es este.
- Necesita Chrome (o `CHROME_PATH`) y Node ≥ 22.19.

### 1. Obtener los reportes

Una sola medición engaña: la misma web puede estar bien con buena red y fatal con una mala, y los problemas que dependen de los bytes no son los mismos que los que dependen de la CPU. Por eso, salvo que el usuario pida otra cosa, **audita tres perfiles de red por cada dispositivo** que elija (`mobile` por defecto):

| `--network` | Qué simula                                                                    |
| ----------- | ----------------------------------------------------------------------------- |
| `default`   | La red del dispositivo (mobile: 150 ms de RTT y 1,6 Mbps; desktop: 40 ms y 10 Mbps). Es la que puntúa Lighthouse: el perfil de referencia del informe. |
| `3g`        | 300 ms de RTT y 700 Kbps. Red lenta.                                          |
| `4g`        | 40 ms de RTT y 10 Mbps. Red rápida.                                           |

La CPU conserva la ralentización del dispositivo en los tres, así que lo que cambia entre perfiles es solo la red.

Con varios dispositivos, los tres perfiles se repiten en cada uno y se cruzan **dentro de cada dispositivo** (paso 3), con una sección por dispositivo. En desktop `default` ya es una red rápida y se parece mucho a `4g`: dilo si apenas difieren. Las mediciones van **siempre en serie**: dos Chrome a la vez compiten por la CPU y falsean las métricas.

**Antes de auditar una URL, pregunta qué medir**: tres preguntas, cada una en su propia llamada a `AskUserQuestion` y en este orden, sin lanzar la siguiente hasta tener la respuesta (cada una se apoya en las anteriores). Salta las que el usuario ya haya respondido ("con 5 ejecuciones", "solo 3g", "en desktop") y no preguntes nada si pide interpretar un reporte ya guardado.

1. **Dispositivos** (`multiSelect: true`): `mobile` (recomendado: es lo que mide Core Web Vitals en Lighthouse) y `desktop`. Sin respuesta, `mobile`.
2. **Presets de red** (`multiSelect: true`): `default`, `3g`, `4g`, con los tres como opción recomendada (permiten el cruce del paso 3); menciona los dispositivos ya elegidos. Con uno solo no hay comparación entre redes: díselo.
3. **Ejecuciones por preset** (`--runs`; el CLI usa la mediana): `3` (recomendada), `5` (más fiable) o `1` (rápido, pero sin dispersión: la mediana no se puede valorar); otro número con "Other". En la propia pregunta, avisa del coste de cada opción: dispositivos × presets × ejecuciones cargas, todas en serie.

Si no contesta o dice "lo que quieras": `mobile`, los tres presets y 3 ejecuciones. Usa las mismas ejecuciones en todos los perfiles: si no, los rangos `min`–`max` no son comparables.

- Si el usuario da una URL: ejecuta la auditoría (con el CLI ya comprobado en el paso 0). Un solo comando mide todos los perfiles: `--device` y `--network` admiten listas separadas por comas, y el CLI audita cada dispositivo × red **en serie**, en el orden dado.
  ```sh
  OUT=<carpeta temporal propia de esta auditoría>   # un nombre por sitio, para no pisar resultados
  npx wperf audit <url> --device <p. ej. mobile o mobile,desktop> --network <p. ej. default,3g,4g> \
    --runs <ejecuciones elegidas> --format json > $OUT/reportes.json 2> $OUT/progreso.log
  grep "Reporte guardado" $OUT/progreso.log    # rutas de los reportes en .perf/reports/
  ```
  Con varios perfiles, stdout es un **array** de `Report` (uno por perfil, en el orden en que se midieron); con uno, un único `Report`. `.perf/reports/<sitio>/` acumula reportes de auditorías anteriores: usa los de esta ejecución (las rutas de `Reporte guardado`), no el último que encuentres.

  Lanza el comando **en segundo plano** y **avisa al usuario mientras corre** siguiendo [references/seguimiento.md](references/seguimiento.md): formato del progreso, `Monitor`, una línea al usuario por evento y notificación al terminar.
- Lee los reportes del fichero de stdout o de las rutas de `.perf/reports/`: el JSON es largo y no hace falta volcarlo entero al contexto.
- Si un perfil falla, el CLI sigue con los demás, escribe en stdout los que sí midió y sale con código 3 (`Fallaron N de M perfiles: …`). Cuéntalo y trabaja con los medidos; no rellenes el hueco. `warnings` puede avisar de que Lighthouse no aplicó el perfil pedido: en ese caso descarta ese reporte.
- Si la URL es la demo (`127.0.0.1:4173`) y no responde, arranca `npm run demo` en segundo plano antes de auditar.
- Si el usuario indica un reporte ya guardado, léelo de `.perf/reports/` (o con `npx wperf history <url>` para localizarlo) en vez de auditar de nuevo. Si solo hay uno, trabaja con ese perfil (mira `environment.network`; ausente = `default`) y dilo.
- Errores: código 2 = uso (corrige la invocación), código 3 = ejecución (Chrome, red, timeout; cuéntalo tal cual y sugiere `CHROME_PATH` o reintentar). Con un solo perfil, o si no se midió ninguno, no sigas. Con varios, un código 3 tras `Terminado: N de M` significa que alguno falló: sigue con los medidos y dilo.
- Revisa `warnings` y `environment.runs`: si hay avisos o solo una ejecución, dilo, porque afecta a la fiabilidad. Mira también la dispersión: una métrica es inestable si su rango `max − min` supera el umbral de ruido que usa `wperf compare` (el mayor de: LCP/FCP/SI 150 ms o 10 % de la mediana, TBT 50 ms o 50 %, TTFB 100 ms o 20 %, CLS 0,02). Entonces la mediana es válida pero poco fiable: avísalo junto a esa métrica. Un rango pequeño que no cruza ningún `rating` no hace falta comentarlo. `git` describe el repo desde el que se ejecutó `wperf`, no el sitio auditado: en una URL ajena ignóralo; en una web de este repo, si `git.dirty` es `true`, menciónalo como nota (el reporte incluye cambios sin commitear).

### 2. Leer los reportes

Campos útiles del `Report` (esquema `ReportSchema` en `src/schema.ts` del repo de `wperf`): `score`, `metrics.{lcp,fcp,tbt,cls,si,ttfb}` (`value`, `min`, `max`, `rating`), `opportunities[]` (`id`, `category`, `savingsMs`, `savingsBytes`, `impact`, `affectedMetrics`, `items[]`), `diagnostics[]`, `resources.byType` y `lcp` (`element`, `breakdown`, `discovery`).

Trampas frecuentes, verificadas en la demo y en webs reales:

- **`impact` no basta para ordenar.** Es una regla sobre ahorro en ms/KiB. `unsized-images` y `cls-culprits-insight` salen con ahorro 0 e `impact: low` aunque el CLS esté en `poor` y sea el problema más visible. Cruza siempre con `affectedMetrics` y el `rating` de esas métricas: una oportunidad "low" que apunta a una métrica `poor` merece subir.
- **`impact: high` tampoco garantiza urgencia.** Una oportunidad con ahorro grande pero cuya `affectedMetrics` está solo en `good` o `needs-improvement` es mejora real pero va después de las que mueven una métrica `poor`.
- **`cache-insight` mide visitas repetidas, no la primera carga.** Su ahorro (a veces enorme) no mejora LCP/TBT del primer acceso: preséntalo aparte, nunca como causa de una métrica de primera carga. Trae `savingsMs` y `affectedMetrics` de primera carga porque el CLI los copia de Lighthouse; no los uses para ordenar.
- **`cpuMs` no es TBT.** El `cpuMs` de un script (`bootup-time`) es CPU total; el TBT solo cuenta el bloqueo de tareas largas. No los compares ni los restes.
- **Diagnósticos vs. métricas.** `diagnostics[]` es informativo y puede contradecir una métrica (`server-response-time` puede decir "0 ms" con un `ttfb` alto). Cita siempre `metrics.*` y usa el diagnóstico solo como pista. Del mismo modo, para el peso de la página usa `resources.totalBytes`; `total-byte-weight` e `image-delivery-insight` miden por su cuenta y difieren en unos bytes: di de qué id sale cada cifra.
- **No todo problema es una oportunidad.** Lighthouse 13 no tiene `offscreen-images`: las imágenes sin `loading="lazy"` solo se ven de forma indirecta, en `resources.byType.image` (o `total-byte-weight`) muy alto en relación con lo que se ve en pantalla. Lo mismo pasa con vídeo y otros `media` (`resources.byType.media`), que solo asoman en `total-byte-weight` y `cache-insight`. Si los datos lo sugieren, comprueba el HTML (en el repo, o con un único `curl` si es una web ajena) y preséntalo como **hallazgo indirecto**, citando la cifra de bytes medida y marcando la causa como hipótesis hasta verificarla. Si el vídeo o la imagen dominante es o no el LCP lo dice `lcp.element`: úsalo en vez de suponerlo.
- **El bloque `lcp` es un hecho medido; su lectura, no.** `lcp.element` identifica el elemento (`selector`, `snippet` y `url` si el `src` está completo; si falta `url`, el `src` estaba truncado o era un fondo CSS). `lcp.discovery` dice si tiene `fetchpriority=high`, si se descubre en el HTML inicial y si no es `loading=lazy`: un `false` es evidencia directa de una causa S. `lcp.breakdown` reparte el LCP en TTFB, retraso de carga, carga y retraso de render; se mide en la carga real de Chrome y **no suma el valor simulado de `metrics.lcp`**, así que úsalo por proporción ("la carga es el 82 % del desglose"), nunca para restar de la métrica. Si falta `lcp`, el LCP no es un elemento (o es un reporte anterior al campo) y debes decir que no está identificado. Si `warnings` dice que el elemento cambia entre ejecuciones, repórtalo: la mediana mezcla dos LCP distintos. Con varias redes, compara `lcp.element` entre perfiles: si cambia, el LCP no es el mismo problema en todas.

Un item sin `url` (p. ej. `unsized-images` con la URL vacía) se identifica por `items[].selector`.

### 3. Cruzar los perfiles de red

No uses `wperf compare` entre perfiles: el CLI lo rechaza a propósito (error de uso) porque no son medidas comparables como "antes/después". La comparación entre redes la haces tú leyendo los tres `Report`, y solo con cifras que salen de ellos.

Para cada causa raíz anota en qué perfiles aparece y con qué ahorro (`savingsMs`, `savingsBytes` de cada reporte). Con eso la clasificas en una de estas tres, que es lo que más le sirve al usuario para decidir:

- **Independiente de la red**: aparece en los tres con `savingsMs` máximo/mínimo ≤ 1,5 y la métrica afectada no cambia de `rating` (p. ej. un problema de CLS: sin ahorro medido y con la métrica igual en los tres). Prioridad estable.
- **Sensible a la red**: el cociente `savingsMs` máximo/mínimo entre perfiles es > 1,5, o el ahorro llega a 0 en alguno (pero no en todos: con 0 ms en los tres no hay cociente; clasifica entonces por `savingsBytes`, y si tampoco cambian, es independiente). Esa regla es mecánica a propósito; la lectura que haces encima no (el ahorro en ms cambia con la red). El caso típico son las imágenes: los mismos bytes cuestan mucho más tiempo en `3g` que en `4g`, y la red decide cuánto duele. Mira primero los `savingsBytes`: si son iguales y el tiempo no, la causa son los bytes, no la lógica.
- **Solo visible en un perfil, o que se mueve sin lógica aparente**: cuéntalo tal cual y trata la causa como hipótesis. No des por hecho que el hilo principal (`bootup-time`, `mainthread-work-breakdown`, TBT) sea indiferente a la red: el TBT puede ser bajo en `3g` y `poor` en `4g` con la misma CPU (compara el `cpuMs` de `bootup-time` entre perfiles; hay un caso real en [references/ejemplo-multiperfil.md](references/ejemplo-multiperfil.md)). Hipótesis a mencionar: el TBT solo cuenta las tareas largas entre FCP y TTI, y con red lenta el FCP se retrasa tanto que esa tarea cae antes de la ventana. El problema de CPU sigue ahí; lo que cambia es que la métrica lo ve o no. Por eso el perfil donde el TBT parece bueno no es una absolución: un TBT bajo en `3g` junto a uno alto en `4g` significa que la tarea larga existe.

Reglas para esa lectura:

- **El `impact` y los `affectedMetrics` pueden cambiar entre perfiles** (`high` en dos perfiles y `low` en el tercero; FCP y LCP en uno y solo FCP en otro). Usa los del perfil de referencia para ordenar, cita los de los demás en la fila y no los ocultes.
- **TBT `poor` en los tres perfiles** (con CPU parecida) es un problema de hilo principal estable: la red no lo explica ni lo arregla. Diferéncialo del caso anterior, en que el TBT se mueve con la red.
- **El `score` no ordena las redes.** Pesa distinto cada métrica (el TBT, sobre todo) y puede subir al empeorar la red; no lo uses para decir qué perfil "va mejor".
- Las cifras de `references/` son de otra medición: no las reutilices, aunque el sitio sea el mismo.
- **Si el conjunto de `items[]` cambia entre perfiles** (6 imágenes detectadas en uno y 3 en otro), los bytes no son comparables: dilo y no apliques la regla de "mismos bytes, distinto tiempo".
- **Cita el ahorro de la oportunidad, no el `wastedMs` de un item**: el del item es del recurso suelto, no se suma y puede ser mayor que el ahorro total. Del mismo modo, no contrastes la suma de los `items[]` con `resources.byType`: pueden incluir peticiones que ahí no se cuentan.

- El perfil de referencia del informe es `default`; los demás son contexto. Si un `rating` cambia entre perfiles (p. ej. LCP `good` en `4g` y `poor` en `3g`), eso es un hallazgo: dilo con las tres cifras.
- Compara cada métrica con el rango `min`–`max` de su perfil. Si dos perfiles se solapan en rango, no afirmes que uno es peor que el otro.
- "Aparece en N de 3 perfiles" es un recuento tuyo sobre los reportes: está bien, y las cifras de ahorro de cada perfil las citas tal cual.
- No extrapoles: tres redes simuladas no son todas las redes. Habla de "estos perfiles", no de "los usuarios reales".

### 4. Agrupar por causa raíz

Varias oportunidades suelen ser el mismo problema. Agrúpalas antes de priorizar; el usuario necesita 4–7 acciones, no 11 filas de Lighthouse. Los terceros (analítica, consentimiento, tag managers) no tienen oportunidad propia: si pesan, agrúpalos tú por origen a partir de los `items[]` y marca la suma como `(fuente: cálculo)`. Los `items[]` son parciales (p. ej. `total-byte-weight` trae solo los 10 mayores): presenta esa suma como un mínimo. Usa [references/causas-raiz.md](references/causas-raiz.md) para el mapa de ids → causa y para estimar esfuerzo. Cada grupo debe citar los ids que lo componen.

### 5. Priorizar y presentar

**Orden de la tabla.** Asigna cada causa al primer nivel que cumpla, según su `affectedMetrics` (del JSON, no del mapa de causas: el mapa es una guía, el reporte manda):

1. Afecta a una métrica `poor` en el perfil de referencia.
2. Afecta a una métrica que es `poor` solo en otro perfil (di en cuál). Entre ellas, primero la que es `poor` en más perfiles; a igualdad, la de mayor `savingsMs` en cualquier perfil.
3. Afecta a una métrica `needs-improvement`.
4. El resto.

Dentro de cada nivel, el orden del CLI (`impact`, luego `savingsMs`, luego `savingsBytes`), con una excepción: una causa sin ahorro medido (ahorro 0 o hallazgo indirecto) que explica una métrica `poor` (el caso típico es el CLS) va **segunda** en su nivel, justo detrás de la de mayor ahorro. Solo una por métrica `poor`; las demás sin ahorro van al final de su nivel. El `rating` cambia de una auditoría a otra, así que el orden del ejemplo no es una plantilla.

Además:

- Si dos causas comparten recurso en sus `items[]` (p. ej. el mismo script en `render-blocking-insight` y `unused-javascript`), déjalas en filas separadas si el arreglo difiere, di que se solapan y no sumes sus ahorros.
- Formato de cifras: ms enteros con espacio de millares (`40 728 ms`), MiB con 2 decimales si el valor supera 1 MiB, KiB enteros por debajo, coma decimal; redondea, no trunques.
- Esfuerzo (S/M/L) es hipótesis tuya, justificada en una frase: S = cambio de atributo o configuración; M = tocar varios ficheros o regenerar assets; L = rediseño o refactor de lógica.

Estructura de la respuesta (ejemplo de un perfil en [references/ejemplo-salida.md](references/ejemplo-salida.md); de tres perfiles de red en [references/ejemplo-multiperfil.md](references/ejemplo-multiperfil.md)):

1. **Resumen**: URL, dispositivo (con varios, una tabla por dispositivo), fecha/ids de los reportes, nº de ejecuciones y una tabla con una columna por perfil de red: `score` y las seis métricas (valor y `rating`). Una frase de diagnóstico general que diga cuánto depende la web de la red.
2. **Tabla priorizada** — una fila por causa raíz: prioridad, problema, evidencia medida (recurso + ahorro, con ids de auditoría), **comportamiento ante la red** (independiente / sensible / solo en un perfil, con el ahorro en cada perfil), métricas afectadas, esfuerzo (S/M/L, hipótesis).
3. **Detalle por problema** (unas 4–6 líneas cada uno): qué pasa en lenguaje claro, evidencia (`items[]`: URL del recurso y su ahorro), causa probable marcada como *hipótesis*, y cómo comprobarla. Sin código fuente (web ajena), la comprobación es "inspecciona el HTML/DevTools"; no finjas haber leído el código.
4. **Qué no está medido**: hallazgos indirectos, oportunidades sin ahorro y diagnósticos sin `impact` (`bf-cache`, `non-composited-animations`…) que no mereció la pena priorizar.
5. **Siguiente paso**: pregunta qué problemas quiere abordar; ofrece `perf-fix` para aplicarlos y volver a auditar con `perf-compare`.

Con un solo perfil, omite las columnas por red y la clasificación. Con dos, mantén una columna por perfil y clasifica solo lo que puedas sostener con dos reportes (no hay "aparece en 2 de 3"). Guarda el informe como Markdown junto al reporte si el usuario lo pide (`.perf/reports/<sitio>/<id>.md`); no lo hagas por defecto.

## Antes de responder: comprobación de cifras

Repasa tu borrador y verifica que cada número aparece en el JSON (o es una conversión directa: ms→s, bytes→KiB/MiB). Si has redondeado, redondea igual en todo el informe y di la unidad. Si no localizas el origen de una cifra, quítala.
