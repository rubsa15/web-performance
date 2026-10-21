# Evaluación de las skills `perf-audit` y `perf-compare`

SPEC §9, PLAN fase 4. **Iteraciones 1 y 2**, 2026-10-21 (macOS, Lighthouse 13.5.0, Chrome 155, mobile, 3 ejecuciones por auditoría).

## Método

- Cada skill la ejecuta un **subagente independiente** (contexto limpio) que lee su `SKILL.md` y la sigue como lo haría un usuario. A los subagentes se les prohibió leer `demo/site/ISSUES.md`, `tests/` y `docs/metrics/`.
- Las respuestas completas están en [skills/](skills/) y los reportes auditados en [skills/reports/](skills/reports/). Las auditorías corrieron una detrás de otra, nunca en paralelo.
- Las respuestas se comprueban sin LLM con `src/experiments/skill-eval.ts`:
  - `node dist/experiments/skill-eval.js recall <respuesta.md>`: cuántos de los 7 problemas de `ISSUES.md` menciona.
  - `node dist/experiments/skill-eval.js figures <respuesta.md> <reporte.json>...`: cifras de la respuesta que no salen del JSON (se admiten conversiones de unidad, redondeos y cifras dentro de los textos de Lighthouse).
- Las cifras que aparecen marcadas por `figures` se revisan **a mano** y se clasifican: inventada, derivada (suma o porcentaje de cifras del JSON) o de otra fuente (código, `curl`).

## Resultados

| Respuesta                                  | Recall (demo) | Cifras sin origen en el JSON | Clasificación de esas cifras                                                                                                                                                             |
| ------------------------------------------ | ------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `perf-audit` · demo (`audit-demo`)         | **7/7**       | 4                            | 0 inventadas. Dimensiones en píxeles de dos imágenes (`sips`) y tamaño del bucle de `app.js` (150 000), leídos fuera del reporte y declarados por el agente como "dato mío, no del CLI". |
| `perf-audit` · ametllerorigen.com          | n/a           | 5                            | 0 inventadas. Tamaño del HTML (`curl`), parámetros de URL (`q=90`, `sw=800`) y un `1 460 KiB` truncado en vez de redondeado (1 460,5).                                                   |
| `perf-audit` · bancosantander.es           | n/a           | 3                            | 0 inventadas. Suma de dos vídeos (7,26 MiB) y un porcentaje (80 %) calculados con cifras del JSON.                                                                                       |
| `perf-compare` · demo rota → arreglada     | n/a           | 1                            | 0 inventadas. Tamaño del bucle de `app.js` leído en el código.                                                                                                                           |
| `perf-compare` · dos auditorías de la demo | n/a           | 2                            | 0 inventadas. Diferencia de 43 s entre `createdAt` (cálculo) y el score de otra comparación (99).                                                                                        |

**Criterio de "hecho" de la fase 4 (`perf-audit` ≥ 6/7 sin inventar cifras): cumplido** en esta iteración, con 7/7 y ninguna cifra inventada en las 5 respuestas. El recall sobre las webs públicas no aplica: los 7 problemas son específicos de la demo.

### Resultados de las auditorías

| Auditoría          | Score | LCP  | FCP               | TBT               | CLS  | SI                |
| ------------------ | ----- | ---- | ----------------- | ----------------- | ---- | ----------------- |
| Demo rota          | 45    | poor | needs-improvement | needs-improvement | poor | good              |
| ametllerorigen.com | 67    | good | good              | poor              | good | needs-improvement |
| bancosantander.es  | 33    | poor | needs-improvement | poor              | good | poor              |

Valores completos en los reportes de [skills/reports/](skills/reports/).

## Revisión manual de las webs públicas (pendiente)

Las recomendaciones de `audit-ametller.md` y `audit-santander.md` están sin validar por una persona. Hay que revisar, para cada una: ¿la causa raíz priorizada es correcta?, ¿las hipótesis están bien marcadas?, ¿la acción es accionable? El resultado se anota aquí.

## Hallazgos de la evaluación y qué se cambió

Fricciones que reportaron los subagentes y que se corrigieron en las skills tras esta iteración (cada punto se vuelve a medir en la iteración 2):

- **Hueco real**: la regla "toda cifra sale del JSON" no cubría cifras legítimas de verificar el código, un `curl` o un cálculo. Ahora esas cifras van en una línea con `(fuente: código|fichero|curl|cálculo)` y `skill-eval figures` las excluye de la comprobación (quedan para revisión manual).
- **Webs reales**: vídeo/`media` pesado no estaba en el mapa de causas (caso Santander, 7,92 MiB de vídeo); `cache-insight` (visitas repetidas) parecía lo más grande; `cpuMs` se mezclaba con TBT; los diagnósticos contradicen a veces las métricas (`server-response-time` 0 ms con TTFB 752 ms). Añadidos a `perf-audit`.
- **Ordenación**: "primero lo que mueve una métrica `poor`" pasa a ser una regla explícita en tres niveles; el `rating` cambia entre ejecuciones (el TBT de la demo salió `poor` y `needs-improvement` en auditorías distintas) y el orden del ejemplo no es una plantilla.
- **`perf-compare`**: caso "mismo commit y `dirty`" (el CLI no avisa y la causa solo está en los `items[]` de los reportes originales; nuevo [ejemplo-regresion.md](../../.claude/skills/perf-compare/references/ejemplo-regresion.md), sacado de la respuesta real del subagente); qué hacer cuando la regresión es un cambio de línea base y no hay nada que corregir; umbrales de `same`/`better`/`worse` y dónde leer los rangos min–max.
- Formato de cifras (ms, MiB, KiB, redondeo) unificado.

## Iteración 2: skills corregidas y auditoría en varios perfiles de red

Tras la iteración 1, `perf-audit` pasó a auditar por defecto tres perfiles de red (`default`, `3g`, `4g`; `wperf audit --network`) para un mismo dispositivo y a clasificar cada causa raíz según cómo responde a la red. Segunda ronda con subagentes nuevos (mismo método). Respuestas en [skills/iteracion-2/](skills/iteracion-2/) y reportes en [skills/iteracion-2/reports/](skills/iteracion-2/reports/): 3 perfiles × 3 sitios, auditados uno detrás de otro.

| Respuesta                                  | Recall (demo) | Cifras sin origen en el JSON | Clasificación                                                                                                                     |
| ------------------------------------------ | ------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `perf-audit` · demo, 3 redes               | **7/7**       | 0                            | —                                                                                                                                 |
| `perf-audit` · ametllerorigen.com, 3 redes | n/a           | 1                            | `641 KiB`: error de redondeo del agente (el JSON da 640,497 KiB). Ninguna inventada.                                              |
| `perf-audit` · bancosantander.es, 3 redes  | n/a           | 0                            | —                                                                                                                                 |
| `perf-compare` · demo rota → arreglada     | n/a           | 2                            | Puertos escritos como `(4173)`: artefacto del comprobador.                                                                        |
| `perf-compare` · dos auditorías de la demo | n/a           | 2                            | Score y LCP de un tercer reporte que el agente leyó con `wperf history` (reales; el comprobador solo recibía los dos comparados). |
| `perf-compare` · red 3g vs 4g              | n/a           | 0                            | El agente respetó el código 2 del CLI, no forzó una comparación y derivó a `perf-audit`.                                          |

Resultados notables:

- **El 7/7 se mantiene** con la skill multiperfil y no aparece ninguna cifra inventada en las 6 respuestas. Se corrigió además el comprobador (`figures` admite N reportes, ignora versiones de Chrome y parámetros propuestos como `q=75`).
- **Hallazgo medido sobre la demo:** el TBT no es independiente de la red (43, 518 y 1 406 ms en `3g`, `default` y `4g` en el reporte del ejemplo; 41, 573 y 1 353 ms en el de los subagentes), con una CPU casi igual (`app.js` entre 1 581 y 1 717 ms según `bootup-time`). En Santander, en cambio, el TBT es `poor` en las tres redes: un problema de CPU estable. La skill no presupone cuál de los dos casos es y lo deduce de los datos.
- **El score no ordena las redes** (en la demo sube de 44 a 49 en `3g` y baja a 36 en `4g`).
- Santander: el vídeo (`media`) es el 80 % del peso y no es una oportunidad de Lighthouse; el agente lo detectó por `resources.byType.media` y un único `curl`, que es lo que se añadió a la skill tras la iteración 1.

Fricciones de esta ronda y qué se cambió:

- **`perf-audit`:** reglas explícitas de orden (una causa con ahorro 0 sobre una métrica `poor` cuenta como `high`; desempate entre perfiles por nº de redes donde la métrica es `poor`), umbral numérico para clasificar sensible/independiente (cociente de `savingsMs` > 1,5 o ahorro 0 en algún perfil), tratamiento de `impact` y `affectedMetrics` que cambian entre perfiles, caso "TBT `poor` en las tres redes", `git` ignorable en webs ajenas, `min` 0 también como inestable, nombres de fichero por sitio y cómo localizar los reportes del lote, y los `items[]` parciales (los terceros se presentan como mínimo).
- **`perf-compare`:** fórmula completa del umbral (`max(absoluto, relativo × antes)` y rangos que no se solapan), qué hacer con "¿en qué red es peor?" (no se compara; se deriva a `perf-audit`), `items[]` que parecen contradecir la clasificación, mirar `wperf history` antes de dar una mejora por buena, y limitar `git diff --stat` a `*.html`, `*.css`, `*.js`.
- **CLI:** `wperf compare --network` (los dos últimos reportes de ese perfil), que la comparación 3g/4g mostró que faltaba.

Los cambios de esta última ronda **no se han vuelto a medir**: harían falta una iteración 3 y una revisión humana de las recomendaciones (más abajo).

## Limitaciones

- **Prueba no del todo ciega.** Los comentarios de `demo/site/js/app.js` citan "problema 3/4/7 de ISSUES.md", y el ejemplo de cada skill usa cifras de la propia demo. El recall 7/7 se apoya sobre todo en los ids del reporte, que no dependen de esa fuga, pero el 6 (lazy-load) y el análisis de código sí pudieron beneficiarse.
- Una ejecución por skill y caso (no se mide variabilidad entre ejecuciones del modelo).
- `skill-eval figures` comprueba que el número existe en el JSON, no que se atribuya al concepto correcto.
- Las medianas de las webs públicas son inestables entre ejecuciones (p. ej. LCP de 2 429 a 7 230 ms en Ametller); las skills ya lo advierten.
