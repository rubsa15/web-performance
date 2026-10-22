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

Con varios dispositivos, los tres perfiles se repiten en cada uno y se cruzan **dentro de cada dispositivo** (paso 3); presenta una sección por dispositivo. En desktop `default` ya es una red rápida, y `4g` se le parece mucho: dilo si los resultados apenas difieren. Si solo quiere una medición rápida, usa `default` y dile que no habrá comparación entre redes.

Las mediciones se lanzan **una detrás de otra, nunca en paralelo**: dos Chrome a la vez compiten por la CPU y falsean las métricas.

**Antes de auditar una URL, pregunta al usuario qué quiere medir, en este orden y de forma secuencial**: tres preguntas, cada una en su propia llamada a `AskUserQuestion` (una pregunta por llamada), y no lanzas la siguiente hasta tener la respuesta de la anterior. Así cada pregunta puede apoyarse en lo ya elegido. Salta la pregunta que el usuario ya haya respondido en su mensaje (p. ej. "con 5 ejecuciones", "solo 3g" o "en desktop"), y no preguntes nada si pide interpretar un reporte ya guardado.

1. **Para qué dispositivos** (`multiSelect: true`): `mobile` (recomendado: es lo que mide Core Web Vitals en Lighthouse) y `desktop`. Si no marca ninguno, usa `mobile`.
2. **Qué presets de red** (`multiSelect: true`): `default`, `3g`, `4g`. Marca los tres como opción recomendada (es lo que permite cruzar perfiles en el paso 3). Si elige uno solo, trabaja como en "una medición rápida": sin comparación entre redes. Menciona en la pregunta los dispositivos elegidos en el paso anterior.
3. **Cuántas ejecuciones por preset** (`--runs`; el CLI usa la mediana): `3` (recomendada, por defecto del CLI), `5` (más fiable, la mediana aguanta más ruido) o `1` (rápido, pero sin dispersión: la mediana no se puede valorar). El usuario puede escribir otro número con "Other". Antes de preguntar, calcula con las respuestas anteriores cuántas cargas implica cada opción (dispositivos × presets × ejecuciones) y avisa del coste en la propia pregunta: el tiempo total es ≈ esas cargas × lo que tarda una, y todo se lanza en serie.

Si el usuario no contesta o dice "lo que quieras", usa `mobile`, los tres presets y 3 ejecuciones. Usa las mismas ejecuciones en todos los presets y dispositivos: con números distintos, los rangos `min`–`max` no son comparables entre perfiles.

- Si el usuario da una URL: ejecuta la auditoría (con el CLI ya comprobado en el paso 0). Un solo comando mide todos los perfiles: `--device` y `--network` admiten listas separadas por comas, y el CLI audita cada dispositivo × red **en serie**, en el orden dado.
  ```sh
  OUT=<carpeta temporal propia de esta auditoría>   # un nombre por sitio, para no pisar resultados
  npx wperf audit <url> --device <p. ej. mobile o mobile,desktop> --network <p. ej. default,3g,4g> \
    --runs <ejecuciones elegidas> --format json > $OUT/reportes.json 2> $OUT/progreso.log
  grep "Reporte guardado" $OUT/progreso.log    # rutas de los reportes en .perf/reports/
  ```
  Con varios perfiles, stdout es un **array** de `Report` (uno por perfil, en el orden en que se midieron) y cada línea de progreso en stderr lleva el perfil delante: `[mobile/3g] Auditando…`, `[mobile/3g] ejecución 2/3`, `[mobile/3g] Reporte guardado en …`, `[mobile/3g] Error: …`; la última línea es `Terminado: N de M perfiles medidos` (con `; fallaron …` si alguno falló). Con un solo perfil, stdout es un único `Report` y las líneas no llevan prefijo ni hay `Terminado`. `.perf/reports/<sitio>/` acumula reportes de auditorías anteriores: usa los de esta ejecución (las rutas de `Reporte guardado`), no el último que encuentres.

  **Avisa al usuario mientras corre.** Cada perfil tarda de medio minuto a varios y, en segundo plano, el usuario no ve nada salvo lo que le escribas. Por eso:
  1. Lanza el comando **en segundo plano** (`run_in_background`). Es uno solo para todos los perfiles: no lances un comando por perfil ni dos a la vez.
  2. Engancha `Monitor` al fichero de progreso con un filtro que deje pasar solo los eventos útiles, p. ej. `tail -n +1 -F $OUT/progreso.log | grep --line-buffered -E "Auditando|ejecución|Reporte guardado|rror|Terminado"`. Si `Monitor` aparece como herramienta diferida, cárgala antes con `ToolSearch`. Páralo con `TaskStop` cuando llegue `Terminado` o cuando te avisen de que el comando en segundo plano ha acabado (con un solo perfil no hay línea `Terminado`).
  3. **Por cada evento que reciba el monitor, escribe al usuario una línea corta** ("`mobile/3g`: ejecución 2/3 en curso", "`mobile/default` guardado, empieza `mobile/3g`"). `ejecución n/N` se emite al *empezar* esa ejecución, así que no digas que la anterior "ha terminado" salvo con la línea `Reporte guardado`. Son avisos de estado: sin cifras de métricas y sin interpretar nada hasta tener todos los reportes.
  4. Al terminar, manda además una notificación con `PushNotification` (también diferida: cárgala con `ToolSearch`), de una línea: sitio, perfiles medidos y fallidos (sale de `Terminado`). Sin cifras de rendimiento. Si falla un perfil, la notificación debe decirlo.
  5. Si `Monitor` o `PushNotification` no están disponibles, avisa de ello, lanza igualmente el comando en segundo plano y escribe al usuario cuando termine.
- Lee los reportes del fichero de stdout o de las rutas de `.perf/reports/`: el JSON es largo y no hace falta volcarlo entero al contexto.
- Si un perfil falla, el CLI sigue con los demás, escribe en stdout los que sí midió y sale con código 3 (`Fallaron N de M perfiles: …`). Cuéntalo y trabaja con los medidos; no rellenes el hueco. `warnings` puede avisar de que Lighthouse no aplicó el perfil pedido: en ese caso descarta ese reporte.
- Si la URL es la demo (`127.0.0.1:4173`) y no responde, arranca `npm run demo` en segundo plano antes de auditar.
- Si el usuario indica un reporte ya guardado, léelo de `.perf/reports/` (o con `npx wperf history <url>` para localizarlo) en vez de auditar de nuevo. Si solo hay uno, trabaja con ese perfil (mira `environment.network`; ausente = `default`) y dilo.
- Errores: código 2 = uso (corrige la invocación), código 3 = ejecución (Chrome, red, timeout; cuéntalo tal cual y sugiere `CHROME_PATH` o reintentar). Con un solo perfil, o si no se midió ninguno, no sigas. Con varios, un código 3 tras `Terminado: N de M` significa que alguno falló: sigue con los medidos y dilo.
- Revisa `warnings` y `environment.runs`: si hay avisos o solo una ejecución, dilo, porque afecta a la fiabilidad. Mira también la dispersión: una métrica es inestable si su rango `max − min` supera el umbral de ruido que usa `wperf compare` (el mayor de: LCP/FCP/SI 150 ms o 10 % de la mediana, TBT 50 ms o 50 %, TTFB 100 ms o 20 %, CLS 0,02). Entonces la mediana es válida pero poco fiable (p. ej. LCP de 2 429 a 7 230 ms): avísalo junto a esa métrica. Un rango pequeño que no cruza ningún `rating` (CLS de 0 a 0,011) no hace falta comentarlo. `git` describe el repo desde el que se ejecutó `wperf`, no el sitio auditado: en una URL ajena ignóralo; en una web de este repo, si `git.dirty` es `true`, menciónalo como nota (el reporte incluye cambios sin commitear).

### 2. Leer los reportes

Campos útiles del `Report` (esquema `ReportSchema` en `src/schema.ts` del repo de `wperf`): `score`, `metrics.{lcp,fcp,tbt,cls,si,ttfb}` (`value`, `min`, `max`, `rating`), `opportunities[]` (`id`, `category`, `savingsMs`, `savingsBytes`, `impact`, `affectedMetrics`, `items[]`), `diagnostics[]`, `resources.byType` y `lcp` (`element`, `breakdown`, `discovery`).

Trampas frecuentes, verificadas en la demo y en webs reales:

- **`impact` no basta para ordenar.** Es una regla sobre ahorro en ms/KiB. `unsized-images` y `cls-culprits-insight` salen con ahorro 0 e `impact: low` aunque el CLS esté en `poor` y sea el problema más visible. Cruza siempre con `affectedMetrics` y el `rating` de esas métricas: una oportunidad "low" que apunta a una métrica `poor` merece subir.
- **`impact: high` tampoco garantiza urgencia.** Una oportunidad con ahorro grande pero cuya `affectedMetrics` está solo en `good` o `needs-improvement` es mejora real pero va después de las que mueven una métrica `poor`.
- **`cache-insight` mide visitas repetidas, no la primera carga.** Su ahorro (a veces enorme) no mejora LCP/TBT del primer acceso: preséntalo aparte, nunca como causa de una métrica de primera carga.
- **`cpuMs` no es TBT.** El `cpuMs` de un script (`bootup-time`) es CPU total; el TBT solo cuenta el bloqueo de tareas largas. No los compares ni los restes.
- **Diagnósticos vs. métricas.** `diagnostics[]` es informativo y puede contradecir una métrica (`server-response-time` dice "0 ms" con `ttfb` de 752 ms). Cita siempre `metrics.*` y usa el diagnóstico solo como pista. Del mismo modo, para el peso de la página usa `resources.totalBytes`; `total-byte-weight` e `image-delivery-insight` miden por su cuenta y difieren en unos bytes: di de qué id sale cada cifra.
- **No todo problema es una oportunidad.** Lighthouse 13 no tiene `offscreen-images`: las imágenes sin `loading="lazy"` solo se ven de forma indirecta, en `resources.byType.image` (o `total-byte-weight`) muy alto en relación con lo que se ve en pantalla. Lo mismo pasa con vídeo y otros `media` (`resources.byType.media`), que solo asoman en `total-byte-weight` y `cache-insight`. Si los datos lo sugieren, comprueba el HTML (en el repo, o con un único `curl` si es una web ajena) y preséntalo como **hallazgo indirecto**, citando la cifra de bytes medida y marcando la causa como hipótesis hasta verificarla. Si el vídeo o la imagen dominante es o no el LCP lo dice `lcp.element`: úsalo en vez de suponerlo.
- **El bloque `lcp` es un hecho medido; su lectura, no.** `lcp.element` identifica el elemento (`selector`, `snippet` y `url` si el `src` está completo; si falta `url`, el `src` estaba truncado o era un fondo CSS). `lcp.discovery` dice si tiene `fetchpriority=high`, si se descubre en el HTML inicial y si no es `loading=lazy`: un `false` es evidencia directa de una causa S. `lcp.breakdown` reparte el LCP en TTFB, retraso de carga, carga y retraso de render; se mide en la carga real de Chrome y **no suma el valor simulado de `metrics.lcp`**, así que úsalo por proporción ("la carga es el 82 % del desglose"), nunca para restar de la métrica. Si falta `lcp`, el LCP no es un elemento (o es un reporte anterior al campo) y debes decir que no está identificado. Si `warnings` dice que el elemento cambia entre ejecuciones, repórtalo: la mediana mezcla dos LCP distintos. Con varias redes, compara `lcp.element` entre perfiles: si cambia, el LCP no es el mismo problema en todas.

Un item sin `url` (p. ej. `unsized-images` con la URL vacía) se identifica por `items[].selector`.

### 3. Cruzar los perfiles de red

No uses `wperf compare` entre perfiles: el CLI lo rechaza a propósito (error de uso) porque no son medidas comparables como "antes/después". La comparación entre redes la haces tú leyendo los tres `Report`, y solo con cifras que salen de ellos.

Para cada causa raíz anota en qué perfiles aparece y con qué ahorro (`savingsMs`, `savingsBytes` de cada reporte). Con eso la clasificas en una de estas tres, que es lo que más le sirve al usuario para decidir:

- **Independiente de la red**: aparece en los tres con `savingsMs` máximo/mínimo ≤ 1,5 (y la métrica afectada no cambia de `rating`) (en la demo, `font-display-insight` con 300 ms, y los problemas de CLS, sin ahorro medido pero con la métrica igual en los tres). Prioridad estable.
- **Sensible a la red**: el cociente `savingsMs` máximo/mínimo entre perfiles es > 1,5, o el ahorro llega a 0 en alguno (pero no en todos: con 0 ms en los tres no hay cociente; clasifica entonces por `savingsBytes`, y si tampoco cambian, es independiente). Esa regla es mecánica a propósito; la lectura que haces encima no (el ahorro en ms cambia con la red). En la demo `image-delivery-insight` va de 5 050 ms (`4g`) a 81 500 ms (`3g`) con los mismos bytes: la red decide cuánto duele. Mira primero los `savingsBytes`: si son iguales y el tiempo no, la causa son los bytes, no la lógica.
- **Solo visible en un perfil, o que se mueve sin lógica aparente**: cuéntalo tal cual y trata la causa como hipótesis. No des por hecho que el hilo principal (`bootup-time`, `mainthread-work-breakdown`, TBT) sea indiferente a la red: en la demo el TBT es 43 ms en `3g`, 518 ms en `default` y 1 406 ms en `4g`, y el ahorro de `bootup-time` va de 50 a 1 350 ms, aunque la CPU es la misma. Hipótesis a mencionar: el TBT solo cuenta las tareas largas entre FCP y TTI, y con red lenta el FCP se retrasa tanto que esa tarea cae antes de la ventana. El problema de CPU sigue ahí; lo que cambia es que la métrica lo ve o no. Por eso el perfil donde el TBT parece bueno no es una absolución: un TBT bajo en `3g` junto a uno alto en `4g` significa que la tarea larga existe.

Reglas para esa lectura:

- **El `impact` y los `affectedMetrics` pueden cambiar entre perfiles** (`render-blocking-insight` es `high`, `high`, `low`; `unused-javascript` apunta a FCP y LCP en unos y solo a FCP en otro). Usa los del perfil de referencia para ordenar, cita los de los demás en la fila y no los ocultes.
- **TBT `poor` en los tres perfiles** (con CPU parecida) es un problema de hilo principal estable: la red no lo explica ni lo arregla. Diferéncialo del caso de la demo, donde el TBT se mueve con la red. Si los rangos `min`–`max` de dos perfiles se solapan, no digas que uno es peor.
- **El `score` no ordena las redes.** Pesa distinto cada métrica (el TBT, sobre todo) y puede subir al empeorar la red; no lo uses para decir qué perfil "va mejor".
- Las cifras de `references/` son de otra medición: no las reutilices, aunque el sitio sea el mismo.
- **Si el conjunto de `items[]` cambia entre perfiles** (6 imágenes detectadas en uno y 3 en otro), los bytes no son comparables: dilo y no apliques la regla de "mismos bytes, distinto tiempo".
- **Cita el ahorro de la oportunidad, no el `wastedMs` de un item**: el del item es del recurso suelto, no se suma y puede ser mayor que el ahorro total (Dynatrace, `wastedMs` 1 364 ms dentro de una oportunidad que ahorra 500 ms). Del mismo modo, no contrastes la suma de los `items[]` con `resources.byType`: pueden incluir peticiones que ahí no se cuentan.
- **`cache-insight` trae `savingsMs` y `affectedMetrics` de primera carga, pero mide visitas repetidas**: el CLI los copia de Lighthouse. No lo uses para ordenar causas de la primera carga.

- El perfil de referencia del informe es `default`; los demás son contexto. Si un `rating` cambia entre perfiles (p. ej. LCP `good` en `4g` y `poor` en `3g`), eso es un hallazgo: dilo con las tres cifras.
- Compara cada métrica con el rango `min`–`max` de su perfil. Si dos perfiles se solapan en rango, no afirmes que uno es peor que el otro.
- "Aparece en N de 3 perfiles" es un recuento tuyo sobre los reportes: está bien, y las cifras de ahorro de cada perfil las citas tal cual.
- No extrapoles: tres redes simuladas no son todas las redes. Habla de "estos perfiles", no de "los usuarios reales".

### 4. Agrupar por causa raíz

Varias oportunidades suelen ser el mismo problema. Agrúpalas antes de priorizar; el usuario necesita 4–7 acciones, no 11 filas de Lighthouse. Los terceros (analítica, consentimiento, tag managers) no tienen oportunidad propia: si pesan, agrúpalos tú por origen a partir de los `items[]` y marca la suma como `(fuente: cálculo)`. Los `items[]` son parciales (p. ej. `total-byte-weight` trae solo los 10 mayores): presenta esa suma como un mínimo. Usa [references/causas-raiz.md](references/causas-raiz.md) para el mapa de ids → causa y para estimar esfuerzo. Cada grupo debe citar los ids que lo componen.

### 5. Priorizar y presentar

Orden: (1) causas cuya `affectedMetrics` incluye una métrica `poor` en el perfil de referencia, y a continuación las que solo son `poor` en otro perfil (indica en cuál); (2) las de una métrica `needs-improvement`; (3) el resto. Dentro de cada grupo, por `impact`, `savingsMs` y `savingsBytes` (el orden del CLI), con dos matices: una causa sin ahorro medido (ahorro 0 o hallazgo indirecto) que es la explicación de una métrica `poor` (el caso típico es el CLS) sube al **segundo** puesto de su grupo, justo detrás de la de mayor ahorro; solo una por métrica `poor`, las demás sin ahorro van al final del grupo; y en el segundo grupo (`poor` solo en otro perfil) va primero la que lo es en más perfiles y, a igualdad, la de mayor `savingsMs` entre perfiles. Toma las métricas afectadas del `affectedMetrics` del JSON, no del mapa de causas: el mapa es una guía, el reporte manda. Si dos causas comparten recurso en sus `items[]` (p. ej. el mismo script en `render-blocking-insight` y `unused-javascript`), déjalas en filas separadas si el arreglo difiere, di que se solapan y no sumes sus ahorros. El `rating` cambia de una auditoría a otra (el mismo problema puede ser `poor` hoy y `needs-improvement` mañana), así que el orden del ejemplo no es una plantilla. Formato de cifras: ms enteros con espacio de millares (`40 728 ms`), MiB con 2 decimales si el valor supera 1 MiB, KiB enteros por debajo, coma decimal; redondea, no trunques. Esfuerzo (S/M/L) es hipótesis tuya, justificada en una frase: S = cambio de atributo o configuración; M = tocar varios ficheros o regenerar assets; L = rediseño o refactor de lógica.

Estructura de la respuesta (ejemplo de un perfil en [references/ejemplo-salida.md](references/ejemplo-salida.md); de tres perfiles de red en [references/ejemplo-multiperfil.md](references/ejemplo-multiperfil.md)):

1. **Resumen**: URL, dispositivo (con varios, una tabla por dispositivo), fecha/ids de los reportes, nº de ejecuciones y una tabla con una columna por perfil de red: `score` y las seis métricas (valor y `rating`). Una frase de diagnóstico general que diga cuánto depende la web de la red.
2. **Tabla priorizada** — una fila por causa raíz: prioridad, problema, evidencia medida (recurso + ahorro, con ids de auditoría), **comportamiento ante la red** (independiente / sensible / solo en un perfil, con el ahorro en cada perfil), métricas afectadas, esfuerzo (S/M/L, hipótesis).
3. **Detalle por problema** (unas 4–6 líneas cada uno): qué pasa en lenguaje claro, evidencia (`items[]`: URL del recurso y su ahorro), causa probable marcada como *hipótesis*, y cómo comprobarla. Sin código fuente (web ajena), la comprobación es "inspecciona el HTML/DevTools"; no finjas haber leído el código.
4. **Qué no está medido**: hallazgos indirectos, oportunidades sin ahorro y diagnósticos sin `impact` (`bf-cache`, `non-composited-animations`…) que no mereció la pena priorizar.
5. **Siguiente paso**: pregunta qué problemas quiere abordar; ofrece `perf-fix` para aplicarlos y volver a auditar con `perf-compare`.

Con un solo perfil, omite las columnas por red y la clasificación. Con dos, mantén una columna por perfil y clasifica solo lo que puedas sostener con dos reportes (no hay "aparece en 2 de 3"). Guarda el informe como Markdown junto al reporte si el usuario lo pide (`.perf/reports/<sitio>/<id>.md`); no lo hagas por defecto.

## Antes de responder: comprobación de cifras

Repasa tu borrador y verifica que cada número aparece en el JSON (o es una conversión directa: ms→s, bytes→KiB/MiB). Si has redondeado, redondea igual en todo el informe y di la unidad. Si no localizas el origen de una cifra, quítala.
