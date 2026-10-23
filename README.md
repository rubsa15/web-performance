# web-performance

CLI `wperf` para auditar el rendimiento de una web, priorizar mejoras y comparar auditorías, con skills de Claude Code que interpretan los resultados.

## Instalación

Requiere Node ≥ 22.19 y Chrome instalado (o `CHROME_PATH` apuntando a su binario).

La instalación tiene dos partes independientes: el **CLI** (paso 1) y las **skills de Claude Code** (paso 2). `npm install` solo instala el CLI; las skills no vienen con el paquete de npm y se instalan aparte desde Claude Code. Si solo quieres usar el CLI a mano, basta el paso 1.

### 1. CLI

```sh
npm install -D @rubensa15/wperf     # en el proyecto de la web a auditar
npx wperf --help
```

Sin instalar nada: `npx @rubensa15/wperf audit https://example.com`. También se puede instalar en global (`npm install -g @rubensa15/wperf`) o directamente desde GitHub (`npm install -D github:rubsa15/web-performance`; el script `prepare` compila al instalar).

### 2. Skills de Claude Code

Este repositorio es también un marketplace de Claude Code con el plugin `wperf`, que añade tres skills: `perf-audit` (audita y prioriza), `perf-compare` (compara auditorías y separa mejora real de ruido) y `perf-fix` (aplica un arreglo y lo verifica). Después de instalar el CLI, abre Claude Code en el proyecto de la web y ejecuta:

```
/plugin marketplace add rubsa15/web-performance
/plugin install wperf@web-performance
```

Las skills usan el CLI del paso 1, que tiene que estar instalado en el proyecto de la web; si falta, se ofrecen a instalarlo. Una vez instaladas se activan solas ("audita la web", "¿mejoró el LCP?", "arregla las imágenes") y también se pueden invocar como `/wperf:perf-audit`. Con `claude plugin validate .` se comprueba el marketplace.

## Desarrollo

```sh
npm install        # instala y compila (script prepare)
npx wperf --help
npm run verify     # typecheck + lint + tests
```

## Uso

Dentro de este repo, compila antes con `npm run build`; instalado como paquete ya viene compilado.

```sh
npx wperf audit https://example.com --runs 3                # resumen en terminal
npx wperf audit https://example.com --device desktop --format md
npx wperf audit https://example.com --network 3g           # red lenta: default (la del dispositivo), 3g o 4g
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

`compare` clasifica cada métrica como `improved`, `regressed` o `unchanged` (ruido) y cada oportunidad como `new`, `resolved`, `better`, `worse` o `same`. Una métrica solo cambia si el salto supera su umbral **y** los rangos min–max de ambos reportes no se solapan; los umbrales salen de [docs/metrics/noise.md](docs/metrics/noise.md). No compara reportes de distinto `device`, perfil de red (`--network`) o `throttling` (error de uso, código 2) y avisa si cambia la versión de Lighthouse o de Chrome, o si las URLs difieren.

### Comprobar que la página no se rompió

Tras un arreglo de rendimiento, `check` verifica que la página sigue igual de sana:

```sh
npx wperf check snapshot https://example.com antes.json --screenshot antes.png
# … aplica el cambio …
npx wperf check snapshot https://example.com despues.json --screenshot despues.png
npx wperf check diff antes.json despues.json                # código 1 si algo se rompió
```

`snapshot` abre la URL en Chrome (viewport móvil), recorre la página para disparar la carga diferida y guarda el texto visible, las imágenes (cargadas o no), los errores de consola y las peticiones fallidas. `diff` marca texto o título distintos, imágenes que no cargan, y errores o peticiones fallidas que antes no estaban; ignora el origen, así que sirve entre puertos distintos. No juzga el aspecto: las capturas se revisan a mano.

Los tests que lanzan Chrome real son lentos y van aparte: `npm run test:slow`.

## Web demo

`demo/site/` es una web de ejemplo con siete problemas de rendimiento intencionados, catalogados en [demo/site/ISSUES.md](demo/site/ISSUES.md); `demo/site-fixed/` es la misma página con todos corregidos.

```sh
npm run demo         # http://127.0.0.1:4173/  (versión con problemas)
npm run demo:fixed   # http://127.0.0.1:4174/  (versión corregida)
npx wperf audit http://127.0.0.1:4173/ --runs 3
```

El servidor añade 300 ms de latencia a imágenes y fuentes (`--latency <ms>`) para que el CLS y `font-display` se reproduzcan en localhost. Las imágenes se regeneran con `node demo/generate-images.ts` (solo macOS).
