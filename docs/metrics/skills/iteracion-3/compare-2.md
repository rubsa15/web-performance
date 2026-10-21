# Comparación de las dos últimas auditorías con red 3g de http://127.0.0.1:4173/

Reportes elegidos con `npx wperf compare --url http://127.0.0.1:4173/ --network 3g --format json` (los dos últimos de esa URL, device mobile, perfil `3g` y el mismo throttling). `npx wperf history http://127.0.0.1:4173/ --network 3g` confirma que solo existen esos dos reportes 3g para la URL, así que el "antes" es el único posible.

## Veredicto

**`unchanged`: no hay cambio medible.** Score 49 → 49 (delta 0), `change: unchanged`. `warnings` vacío.

|         | Id                                                   | Fecha                | Commit                    |
| ------- | ---------------------------------------------------- | -------------------- | ------------------------- |
| Antes   | `2026-10-21T21-04-16Z-mobile-3g` (etiqueta "red 3g") | 2026-10-21 21:04:16Z | `098fd26`, `dirty: true`  |
| Después | `2026-10-21T21-08-38Z-mobile-3g`                     | 2026-10-21 21:08:38Z | `55b5fde`, `dirty: false` |

Misma URL, mismo device (mobile), mismo perfil de red (3g), 3 ejecuciones por lado. Con solo 3 ejecuciones la confianza es limitada, pero los rangos son muy estrechos (ver abajo).

## Métricas (todas ruido)

| Métrica     | Antes     | Después   | Delta | Δ %    | `change`  | Rating                                |
| ----------- | --------- | --------- | ----- | ------ | --------- | ------------------------------------- |
| LCP         | 90 455 ms | 90 454 ms | -1 ms | -0,0 % | unchanged | poor → poor                           |
| FCP         | 4 598 ms  | 4 596 ms  | -2 ms | -0,0 % | unchanged | poor → poor                           |
| TBT         | 43 ms     | 41 ms     | -2 ms | -4,7 % | unchanged | good → good                           |
| CLS         | 0,291     | 0,291     | 0     | 0 %    | unchanged | poor → poor                           |
| Speed Index | 4 598 ms  | 4 596 ms  | -2 ms | -0,0 % | unchanged | needs-improvement → needs-improvement |
| TTFB        | 1 202 ms  | 1 202 ms  | 0 ms  | 0 %    | unchanged | needs-improvement → needs-improvement |

- **Mejoradas:** ninguna.
- **Empeoradas:** ninguna.
- **Ruido (`unchanged`):** las seis. Ningún rating cambia.

Los rangos min–max de los reportes originales son muy estrechos y se solapan: por ejemplo LCP 90 454–90 456 ms antes y 90 453–90 455 ms después; TBT 42–43 ms antes y 41–43 ms después (fuente: fichero). Un TBT que baja 2 ms (-4,7 %) está muy por debajo del umbral mínimo de 50 ms, así que no es una mejora.

## Oportunidades

Las 11 oportunidades están en `same`, todas con deltaMs 0 y deltaBytes 0. No hay `new`, `resolved`, `better` ni `worse`. Las que pesan en este perfil:

- `image-delivery-insight`: 81 500 ms y 8 154 587 bytes (7,78 MiB) de ahorro estimado, en ambos reportes.
- `render-blocking-insight`: 3 050 ms.
- `unused-javascript`: 0 ms de ahorro y 120 895 bytes (118 KiB) en ambos reportes.
- `font-display-insight`: 300 ms. `bootup-time` y `mainthread-work-breakdown`: 50 ms cada una (mismo problema de hilo principal, no dos).
- `cls-culprits-insight`, `lcp-discovery-insight`, `network-dependency-tree-insight`, `total-byte-weight`, `unsized-images`: 0 ms.

## Recursos

Idénticos byte a byte (delta 0 en todos los tipos): total 8 699 348 bytes (8,30 MiB), imágenes 8 492 779 bytes (8,10 MiB), scripts 169 259 bytes (165 KiB), fuentes 34 900 bytes (34 KiB), documento 1 455 bytes, hojas de estilo 955 bytes, media 0. El sitio descargado es el mismo en las dos medidas.

## Cruce con git (hipótesis)

Los commits son distintos (`098fd26` sucio vs. `55b5fde` limpio). `git log --oneline 098fd26..55b5fde` lista `93ba4a7` (wperf audit: perfiles de red) y `55b5fde` (skills perf-audit y perf-compare y su evaluación). Excluyendo `tests/`, `src/experiments/` y `docs/`, el `git diff --stat` solo toca el CLI (`src/`), las skills, `README.md` y `CLAUDE.md`; no toca `demo/` (el sitio servido en 4173) (fuente: código, `git diff --stat`). Por tanto no hay candidato plausible a causa de un cambio de rendimiento, y tampoco hay cambio que explicar. El "antes" era `dirty: true`, pero los recursos y las métricas idénticos indican que esos cambios sin commitear no afectaron al sitio.

## Conclusión

Entre las dos últimas auditorías con red 3g no hay diferencia medible: todo es ruido según el CLI. La web sigue igual, con LCP 90 454 ms (poor) y CLS 0,291 (poor) en 3g, dominado por las imágenes.

Nota: esto compara solo reportes 3g entre sí. No lo cruces con los reportes `default` o `4g` del mismo sitio: son otros perfiles de red y el CLI no los compara. Si quieres saber en qué red es peor, `perf-audit` cruza perfiles.

¿Quieres que mire otro intervalo o que investigue algo concreto?
