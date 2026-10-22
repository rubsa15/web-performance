# web-performance

CLI `wperf` (Node + TypeScript) que audita el rendimiento de una web con Lighthouse, prioriza mejoras y compara auditorías. Va acompañado de skills de Claude Code que interpretan los resultados. Especificación en `docs/SPEC.md`, fases en `docs/PLAN.md`.

## Regla principal

**El CLI produce hechos, la IA produce criterio.** El CLI es determinista y no llama a ningún LLM. Toda cifra que aparezca en una respuesta de una skill debe salir del JSON del CLI, nunca del modelo. Las causas probables se marcan como hipótesis.

## Comandos

- `npm run verify` — typecheck + lint + tests. **Ejecútalo tras cada cambio** y no des una tarea por terminada si falla.
- `npm test` — Vitest sin Chrome (`npm run test:watch` para modo watch). `npm run test:slow` lanza los `*.slow.test.ts`, que usan Chrome real.
- `npm run typecheck`, `npm run lint`, `npm run format` (Prettier).
- `npm run build` — compila `src/` a `dist/`; `bin/wperf` ejecuta `dist/cli.js`, así que hay que compilar antes de usar `npx wperf`.

## Arquitectura

Módulos previstos (ver SPEC §3): `runner` → `normalizer` → `store` → `compare`, más `render` y `cli`. Cada módulo vive en `src/` y se puede probar por separado.

- Implementados (fase 1): `runner.ts` (Chrome + Lighthouse ×N, con costuras para tests), `normalizer.ts` (LHR → `Report`), `schema.ts` (zod, fuente de verdad del `Report`), `rules.ts` (rating, impacto, mediana), `store.ts`, `git.ts`, `render.ts` y `commands/audit.ts`. Errores: `UsageError` (salida 2) y `RuntimeError` (salida 3) en `errors.ts`.
- `--network default|3g|4g` en `audit` (`src/network.ts`, `environment.network` en el `Report`; sin el campo = `default`): `compare`, `history` y el id distinguen el perfil de red igual que el `device`.
- `Report.lcp` (elemento LCP, desglose y descubrimiento) sale de `lcp-breakdown-insight`/`lcp-discovery-insight` en el normalizer; `compare` añade `lcpElement`. El desglose es de la carga real, no suma el LCP simulado.
- Implementados (fase 3): `compare.ts` (`compareReports`, puro), `history.ts` (`buildHistory`), `render-compare.ts`, `commands/compare.ts`, `commands/history.ts` y, en `rules.ts`, `DEFAULT_THRESHOLDS` y `classifyMetric`/`classifyScore`. `store.ts` suma `listReports` y `resolveReport`. `src/experiments/noise.ts` es el experimento de ruido (`node dist/experiments/noise.js`, ver `docs/metrics/noise.md`); si cambias los umbrales, repítelo.
- Implementado (fase 4): skills `perf-audit` y `perf-compare` en `.claude/skills/` (cada una con `references/ejemplo-salida.md`, cuyas cifras salen de `tests/fixtures/reports/ejemplo-skill-*.json`). `src/experiments/skill-eval.ts` evalúa una respuesta sin LLM: `node dist/experiments/skill-eval.js figures <respuesta.md> <reporte.json>...` (cifras sin origen en el JSON) y `recall <respuesta.md>` (cuántos de los 7 problemas de `ISSUES.md` menciona). Si cambias una skill, repite la evaluación.
- Implementado (fase 5): skill `perf-fix` en `.claude/skills/perf-fix/` (con `references/catalogo-arreglos.md`, `ejemplo-salida.md` y `ejemplo-revertido.md`, cuyas cifras salen de `tests/fixtures/reports/ejemplo-fix-*.json`). `src/experiments/page-check.ts` comprueba que la página sigue íntegra tras un arreglo: `node dist/experiments/page-check.js snapshot <url> <salida.json> [captura.png]` y `diff <antes.json> <después.json>`. `node demo/serve.ts --root <dir>` sirve una copia de la demo (así se evaluó, ver `docs/metrics/fix.md`). Si cambias la skill, repite la evaluación.
- `demo/` (fase 2): `site/` es la web con 7 problemas intencionados y `ISSUES.md` como ground truth; `site-fixed/` es la versión corregida; `serve.ts` las sirve (`npm run demo`, `npm run demo:fixed`). Si cambias la demo, mídela con `wperf audit` y actualiza `ISSUES.md`; `tests/demo.slow.test.ts` comprueba los ids esperados.
- `src/program.ts` — define el programa de `commander` y los códigos de salida; `src/cli.ts` es solo el punto de entrada.
- Códigos de salida: `0` correcto, `2` error de uso, `3` error de ejecución (Chrome, red, timeout); el `1` no se usa.
- Los reportes se guardan en `.perf/reports/<sitio>/<timestamp>-<device>.json`; los LHR crudos en `.perf/raw/` (ignorado por git).

## Convenciones

- ESM estricto (`"type": "module"`): los imports relativos llevan extensión `.js`.
- TypeScript estricto; sin `any` salvo justificación.
- Los tests usan fixtures de LHR guardados, sin Chrome. Los que lanzan Chrome real se marcan como `slow`.
- Fixtures en `tests/fixtures/` (LHR reales recortados, ver su README). Para otra versión de Lighthouse hay que recapturarlos.
- Lighthouse va con la versión fijada (sin `^`). El `normalizer` es el único módulo que conoce el formato de Lighthouse.
- Commits directos en `main`, sin ramas nuevas.
