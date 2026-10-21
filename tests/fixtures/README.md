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
