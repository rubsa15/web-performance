# web-performance

CLI `wperf` (Node + TypeScript) que audita el rendimiento de una web con Lighthouse, prioriza mejoras y compara auditorías. Va acompañado de skills de Claude Code que interpretan los resultados. Especificación en `docs/SPEC.md`, fases en `docs/PLAN.md`.

## Regla principal

**El CLI produce hechos, la IA produce criterio.** El CLI es determinista y no llama a ningún LLM. Toda cifra que aparezca en una respuesta de una skill debe salir del JSON del CLI, nunca del modelo. Las causas probables se marcan como hipótesis.

## Comandos

- `npm run verify` — typecheck + lint + tests. **Ejecútalo tras cada cambio** y no des una tarea por terminada si falla.
- `npm test` — Vitest (`npm run test:watch` para modo watch).
- `npm run typecheck`, `npm run lint`, `npm run format` (Prettier).
- `npm run build` — compila `src/` a `dist/`; `bin/wperf` ejecuta `dist/cli.js`, así que hay que compilar antes de usar `npx wperf`.

## Arquitectura

Módulos previstos (ver SPEC §3): `runner` → `normalizer` → `store` → `compare` / `budget`, más `render` y `cli`. Cada módulo vive en `src/` y se puede probar por separado.

- `src/program.ts` — define el programa de `commander` y los códigos de salida; `src/cli.ts` es solo el punto de entrada.
- Códigos de salida: `0` correcto, `1` presupuesto/regresión superada, `2` error de uso, `3` error de ejecución (Chrome, red, timeout).
- Los reportes se guardan en `.perf/reports/<sitio>/<timestamp>-<device>.json`; los LHR crudos en `.perf/raw/` (ignorado por git).

## Convenciones

- ESM estricto (`"type": "module"`): los imports relativos llevan extensión `.js`.
- TypeScript estricto; sin `any` salvo justificación.
- Los tests usan fixtures de LHR guardados, sin Chrome. Los que lanzan Chrome real se marcan como `slow`.
- Lighthouse va con la versión fijada (sin `^`). El `normalizer` es el único módulo que conoce el formato de Lighthouse.
- Commits directos en `main`, sin ramas nuevas.
