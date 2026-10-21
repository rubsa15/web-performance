# Comparación 3g vs 4g de la demo: no hay comparación válida

> Comando: `npx wperf compare .perf/reports/127.0.0.1-4173/2026-10-21T21-04-16Z-mobile-3g.json .perf/reports/127.0.0.1-4173/2026-10-21T21-04-42Z-mobile-4g.json --format json`

## Resultado del CLI

Código de salida **2** (error de uso). Mensaje: "No se pueden comparar reportes con distinto perfil de red (3g vs 4g)." No hay JSON de comparación, ni veredicto, ni deltas.

## Qué significa para tu pregunta ("¿cuál ha empeorado?")

La pregunta no tiene respuesta con `wperf compare`, y no la fuerzo a mano:

- Un reporte 3g y uno 4g son **dos condiciones de red distintas sobre la misma web**, no un antes y un después. Ninguno "ha empeorado" respecto al otro: el perfil de red (`environment.network`) es parte de lo que define una medición, y el CLI solo compara reportes con el mismo `device`, el mismo perfil de red y el mismo `throttling` (SPEC §6).
- Comparar por restar a mano valores de dos redes distintas daría un delta que mide la red, no un cambio en la web, y sin clasificación del CLI (ruido / mejora / regresión) no podría respaldarlo.

## Datos de contexto (fuente: fichero, sin comparar)

Cada reporte por separado, ambos `mobile`, 3 ejecuciones, commit `098fd26` con `dirty: true`, URL http://127.0.0.1:4173/ y `warnings` vacío:

| Métrica | `…21-04-16Z-mobile-3g`       | `…21-04-42Z-mobile-4g` |
| ------- | ---------------------------- | ---------------------- |
| Score   | 49                           | 36                     |
| LCP     | 90 455 ms (poor)             | 7 164 ms (poor)        |
| FCP     | 4 598 ms (poor)              | 1 096 ms (good)        |
| TBT     | 43 ms (good)                 | 1 406 ms (poor)        |
| CLS     | 0,291 (poor)                 | 0,291 (poor)           |
| SI      | 4 598 ms (needs-improvement) | 1 096 ms (good)        |
| TTFB    | 1 202 ms (needs-improvement) | 422 ms (good)          |

Estas filas no son una comparación: son dos fotos de condiciones distintas, y esta tabla no clasifica ningún cambio. Lo único que se puede decir es descriptivo: en 3g los tiempos de carga (LCP, FCP, SI, TTFB) son claramente peores, mientras que el TBT es peor en 4g. Que el TBT sea mayor con red más rápida es una **hipótesis** y no una conclusión: con más ancho de banda los scripts llegan antes y el trabajo de CPU cae dentro de la ventana que cuenta para TBT (a confirmar mirando `bootup-time` y `long-tasks` de cada reporte). El score (49 vs 36) tampoco indica cuál "empeoró": resume métricas ponderadas en condiciones distintas.

## Qué sí se puede comparar

Mismo perfil de red:

- `wperf history http://127.0.0.1:4173/ --network 3g` (o `4g`) lista la serie de cada perfil. En el historial hay un segundo reporte 3g (`2026-10-21T21-08-38Z-mobile-3g`, otro commit: `55b5fde`), así que se puede comparar 3g contra 3g.
- Para 4g solo hay un reporte (`…21-04-42Z-mobile-4g`): no hay con qué compararlo hasta que se audite otra vez con `--network 4g` (`perf-audit`).
- Si lo que buscas es si el sitio es peor en una red que en otra, eso es una pregunta de `perf-audit` (varios perfiles de red, qué depende de la red y qué no), no de `perf-compare`.

## Cierre

¿Quieres que compare los dos reportes 3g entre sí (`…21-04-16Z-mobile-3g` y `…21-08-38Z-mobile-3g`), o que se haga una nueva auditoría 4g para tener un par comparable?
