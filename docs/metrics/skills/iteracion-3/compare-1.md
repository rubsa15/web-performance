# Comparación: ¿ha cambiado algo entre las dos auditorías?

## Veredicto

**`unchanged`: no hay cambio medible.** Todas las métricas y el score salen `unchanged` en `wperf compare`.

|         | Id                                                     | Fecha                | Commit                    |
| ------- | ------------------------------------------------------ | -------------------- | ------------------------- |
| Antes   | `2026-10-21T21-03-50Z-mobile` (etiqueta "red default") | 2026-10-21 21:03:50Z | `098fd26`, `dirty: true`  |
| Después | `2026-10-21T21-08-09Z-mobile`                          | 2026-10-21 21:08:09Z | `55b5fde`, `dirty: false` |

Mismo sitio (`http://127.0.0.1:4173/`), mismo device (mobile), mismo perfil de red (`default`), 3 ejecuciones por lado. `warnings` está vacío.

Score: 44 → 42 (delta -2), `change: unchanged`.

## Fiabilidad

La comparación es formalmente válida. Dos detalles:

- Los commits registrados son distintos (`098fd26` con árbol sucio y `55b5fde` limpio). Que no hayas tocado el sitio no implica el mismo commit: en el repo hubo commits entre ambos (ver abajo), pero ninguno toca el sitio auditado.
- Cada lado son solo 3 ejecuciones, así que los rangos min–max son orientativos.

## Métricas (todas ruido)

| Métrica     | Antes     | Después   | Delta  | Δ %     | `change`  | Rating                                |
| ----------- | --------- | --------- | ------ | ------- | --------- | ------------------------------------- |
| LCP         | 40 730 ms | 40 729 ms | -1 ms  | -0,0 %  | unchanged | poor → poor                           |
| FCP         | 2 499 ms  | 2 496 ms  | -3 ms  | -0,1 %  | unchanged | needs-improvement → needs-improvement |
| TBT         | 518 ms    | 573 ms    | +55 ms | +10,6 % | unchanged | needs-improvement → needs-improvement |
| CLS         | 0,291     | 0,291     | 0      | 0 %     | unchanged | poor → poor                           |
| Speed Index | 2 499 ms  | 2 496 ms  | -3 ms  | -0,1 %  | unchanged | good → good                           |
| TTFB        | 752 ms    | 752 ms    | 0 ms   | 0 %     | unchanged | good → good                           |

Bloques según el CLI:

- **Mejoradas:** ninguna.
- **Empeoradas:** ninguna.
- **Ruido (`unchanged`):** las seis.

El único número que se mueve algo es el TBT (+55 ms, +10,6 %). Es ruido: el umbral efectivo es el mayor de 50 ms o el 50 % del valor "antes" (259 ms), y los rangos min–max de los reportes originales se solapan: 443–679 ms antes y 450–604 ms después (fuente: fichero). Un TBT con esa dispersión entre ejecuciones del mismo lado no permite afirmar nada con 3 ejecuciones. No cuenta como regresión.

## Oportunidades

Las 11 oportunidades tienen `status: same`; no hay `new`, `resolved`, `better` ni `worse`.

- `bootup-time` y `mainthread-work-breakdown` pasan de 500 ms a 550 ms de ahorro (deltaMs +50). Es `same` porque el cambio no supera 100 ms ni el 50 %. Ambas reflejan el mismo problema de hilo principal (guía de causas de perf-audit), no dos.
- El resto no se mueve (deltaMs 0): `image-delivery-insight` (32 900 ms, 8 154 587 bytes), `render-blocking-insight` (1 550 ms), `unused-javascript` (1 050 ms, 120 895 bytes), `font-display-insight` (300 ms), `cls-culprits-insight`, `lcp-discovery-insight`, `network-dependency-tree-insight`, `total-byte-weight` y `unsized-images` (0 ms).

## Recursos

Sin cambios en ningún tipo (delta 0):

- Total: 8 699 348 bytes (8,30 MiB).
- Imágenes: 8 492 779 bytes (8,10 MiB).
- Scripts: 169 259 bytes (165 KiB).
- Fuentes: 34 900 bytes (34 KiB).
- Documento: 1 455 bytes. Hojas de estilo: 955 bytes. Media: 0.

Mismo contenido descargado byte a byte, lo que apoya que el sitio no cambió entre medidas.

## Cruce con git (hipótesis, y solo contexto)

`git log --oneline 098fd26..55b5fde` lista dos commits:

- `93ba4a7` wperf audit: perfiles de red (--network default|3g|4g)
- `55b5fde` Fase 4: skills perf-audit y perf-compare y su evaluación

El `git diff --stat` (excluyendo `tests/`, `src/experiments/` y `docs/`) toca el CLI (`src/`), las skills (`.claude/skills/`), `README.md` y `CLAUDE.md`. No toca `demo/`, el sitio auditado en 4173 (fuente: código, `git diff --stat`). Ese cambio no puede explicar un cambio de rendimiento del sitio, y de hecho no hay cambio medible. Además, el reporte "antes" era `dirty: true`, así que incluía cambios sin commitear que git no recoge; los resultados idénticos indican que no afectaban al sitio.

## Conclusión

No ha cambiado nada medible: ni métricas, ni oportunidades, ni recursos. La diferencia de -2 puntos de score y los +55 ms de TBT son ruido entre ejecuciones, según el CLI. Esto es coherente con que no hayas tocado el sitio.

Como el sitio sigue igual, sus problemas persisten: LCP 40 729 ms (poor) y CLS 0,291 (poor), con 8,10 MiB en imágenes. Si quieres, pasa a `perf-audit` para priorizarlos.

¿Quieres que mire algo más, o compare contra otro reporte?
