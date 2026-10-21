# Fixtures de LHR

LHR reales de Lighthouse 13.5.0 (Chrome 155, `throttlingMethod: simulate`), capturados el 2026-10-21 con la categoría `performance`:

| Fichero                      | URL                       | Perfil  |
| ---------------------------- | ------------------------- | ------- |
| `lhr-bbc-mobile.json`        | https://www.bbc.com/news  | mobile  |
| `lhr-wikipedia-desktop.json` | https://www.wikipedia.org | desktop |

Se recortaron para reducir el tamaño: se eliminaron `i18n`, `fullPageScreenshot`, `stackPacks`, `timing`, `entities`, `categoryGroups`, las descripciones de las auditorías, los `details` de capturas/treemap/tareas/red, los `debugData` grandes y los `items` por encima de 15. Los valores no se han tocado.

Los tests dependen de estos valores concretos; si se recapturan hay que actualizar las aserciones.
