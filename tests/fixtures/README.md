# Fixtures de LHR

LHR reales de Lighthouse 13.5.0 (Chrome 155, `throttlingMethod: simulate`), capturados el 2026-10-21 con la categoría `performance`:

| Fichero                      | URL                       | Perfil  |
| ---------------------------- | ------------------------- | ------- |
| `lhr-bbc-mobile.json`        | https://www.bbc.com/news  | mobile  |
| `lhr-wikipedia-desktop.json` | https://www.wikipedia.org | desktop |

Se recortaron para reducir el tamaño: se eliminaron `i18n`, `fullPageScreenshot`, `stackPacks`, `timing`, `entities`, `categoryGroups`, las descripciones de las auditorías, los `details` de capturas/treemap/tareas/red, los `debugData` grandes y los `items` por encima de 15. Los valores no se han tocado.

Los tests dependen de estos valores concretos; si se recapturan hay que actualizar las aserciones.

## Reportes (`reports/`)

`Report` reales de `wperf audit --runs 3` (mobile, Lighthouse 13.5.0) sobre la demo, tomados del experimento de ruido (`docs/metrics/noise/`, ver `docs/metrics/noise.md`). Sirven para probar `compare` con datos reales.

| Fichero                    | Origen                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| `demo-rota-1.json`         | `demo/site`, auditoría 1 de 10                                                              |
| `demo-rota-2.json`         | `demo/site`, auditoría 4 de 10 (misma página que la anterior: par de ruido)                 |
| `demo-rota-cls-ruido.json` | `demo/site`, auditoría 2 de 10: CLS mediana 0 con rango 0–0,291 (la carga varió entre runs) |
| `demo-arreglada-1.json`    | `demo/site-fixed`, auditoría 1 de 10                                                        |
| `demo-arreglada-2.json`    | `demo/site-fixed`, auditoría 2 de 10                                                        |

Los tests dependen de estos valores concretos; si se recapturan hay que actualizar las aserciones.

Los dos siguientes son los reportes de los que salen las cifras de los ejemplos de `.claude/skills/perf-audit/references/ejemplo-salida.md` y `.claude/skills/perf-compare/references/ejemplo-salida.md`; `tests/skill-eval.test.ts` comprueba que esas cifras salen de ellos.

| Fichero                                                  | Origen                                                                                                                                                                                 |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ejemplo-skill-rota.json`                                | `demo/site`, `wperf audit --runs 3` (id `2026-10-21T19-42-38Z-mobile`)                                                                                                                 |
| `ejemplo-skill-regresion-antes.json`                     | `demo/site`, `wperf audit --runs 3` (id `2026-10-21T19-41-55Z-mobile`): "antes" del ejemplo de regresión de `perf-compare` (contra `ejemplo-skill-rota`)                               |
| `ejemplo-skill-red-default.json`, `-3g.json`, `-4g.json` | `demo/site`, `wperf audit --network default\|3g\|4g --runs 3` (ids `2026-10-21T21-03-50Z-mobile`, `…21-04-16Z-mobile-3g`, `…21-04-42Z-mobile-4g`): ejemplo multiperfil de `perf-audit` |
| `ejemplo-skill-arreglada.json`                           | `demo/site-fixed`, igual (id `2026-10-21T19-43-21Z-mobile`)                                                                                                                            |
