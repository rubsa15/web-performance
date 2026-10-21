# web-performance

CLI `wperf` para auditar el rendimiento de una web, priorizar mejoras y comparar auditorías, con skills de Claude Code que interpretan los resultados. Ver [docs/SPEC.md](docs/SPEC.md) y [docs/PLAN.md](docs/PLAN.md).

## Desarrollo

Requiere Node ≥ 22.19.

```sh
npm install        # instala y compila (script prepare)
npx wperf --help
npm run verify     # typecheck + lint + tests
```

## Uso

Requiere Chrome instalado (o `CHROME_PATH` apuntando a su binario). Compila antes con `npm run build`.

```sh
npx wperf audit https://example.com --runs 3                # resumen en terminal
npx wperf audit https://example.com --device desktop --format md
npx wperf audit https://example.com --format json --no-save # solo el Report por stdout
```

Cada auditoría guarda un reporte en `.perf/reports/<sitio>/<timestamp>-<device>.json` (con `--keep-raw`, también los LHR crudos en `.perf/raw/`). El progreso y la ruta guardada van por stderr, así que `--format json` deja stdout limpio.

### Comparar y ver el histórico

```sh
npx wperf compare                                   # los dos últimos reportes (del sitio más reciente)
npx wperf compare --url https://example.com         # los dos últimos de esa URL
npx wperf compare <antes> <después> --format md     # ids o rutas a reportes concretos
npx wperf history https://example.com --metric lcp  # evolución de una métrica
```

`compare` clasifica cada métrica como `improved`, `regressed` o `unchanged` (ruido) y cada oportunidad como `new`, `resolved`, `better`, `worse` o `same`. Una métrica solo cambia si el salto supera su umbral **y** los rangos min–max de ambos reportes no se solapan; los umbrales salen de [docs/metrics/noise.md](docs/metrics/noise.md). No compara reportes de distinto `device` o `throttling` (error de uso, código 2) y avisa si cambia la versión de Lighthouse o de Chrome, o si las URLs difieren.

Los tests que lanzan Chrome real son lentos y van aparte: `npm run test:slow`.

## Web demo

`demo/site/` es una web de ejemplo con siete problemas de rendimiento intencionados, catalogados en [demo/site/ISSUES.md](demo/site/ISSUES.md); `demo/site-fixed/` es la misma página con todos corregidos.

```sh
npm run demo         # http://127.0.0.1:4173/  (versión con problemas)
npm run demo:fixed   # http://127.0.0.1:4174/  (versión corregida)
npx wperf audit http://127.0.0.1:4173/ --runs 3
```

El servidor añade 300 ms de latencia a imágenes y fuentes (`--latency <ms>`) para que el CLS y `font-display` se reproduzcan en localhost. Las imágenes se regeneran con `node demo/generate-images.ts` (solo macOS).
