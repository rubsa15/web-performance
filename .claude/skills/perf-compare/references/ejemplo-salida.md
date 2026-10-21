# Ejemplo de salida de `perf-compare`

Comparación real de la demo rota (`2026-10-21T19-42-38Z-mobile`, `http://127.0.0.1:4173/`) contra la arreglada (`2026-10-21T19-43-21Z-mobile`, `http://127.0.0.1:4174/`); ambas mobile, 3 ejecuciones, throttling `simulate`. Modelo de **forma y tono**, no de cifras.

---

## Veredicto: `improved`

| Reporte | id                            | Etiqueta        | Git                  |
| ------- | ----------------------------- | --------------- | -------------------- |
| Antes   | `2026-10-21T19-42-38Z-mobile` | demo v0         | `3bbc3a2` (dirty)    |
| Después | `2026-10-21T19-43-21Z-mobile` | demo fixed v0   | `3bbc3a2` (dirty)    |

Score: **41 → 99** (+58, `improved`). Aviso del CLI: las URLs son distintas (`:4173` vs `:4174`), es decir, esto compara dos versiones del sitio, no una misma URL en el tiempo.

## Métricas

| Métrica | Antes     | Después  | Δ          | Cambio     | Rating               |
| ------- | --------- | -------- | ---------- | ---------- | -------------------- |
| LCP     | 40 728 ms | 2 104 ms | −38 624 ms | improved   | poor → good          |
| FCP     | 2 495 ms  | 1 413 ms | −1 082 ms  | improved   | needs-improvement → good |
| TBT     | 641 ms    | 17 ms    | −624 ms    | improved   | poor → good          |
| CLS     | 0,291     | 0        | −0,291     | improved   | poor → good          |
| SI      | 2 495 ms  | 1 413 ms | −1 082 ms  | improved   | good → good          |
| TTFB    | 752 ms    | 752 ms   | 0          | unchanged  | good → good          |

Sin regresiones. TTFB no cambió: era esperable, el servidor no se tocó.

## Oportunidades

- **Resueltas:** `render-blocking-insight` (−1 550 ms), `unused-javascript` (−1 050 ms, −118 KiB), `font-display-insight` (−300 ms), `unsized-images` y `cls-culprits-insight` (sin ahorro medido: el problema desapareció), `lcp-discovery-insight`, `total-byte-weight`.
- **Mejoradas:** `image-delivery-insight` (−32 750 ms, −7,26 MiB), `bootup-time` y `mainthread-work-breakdown` (−650 ms cada una).
- **Sin cambio:** `network-dependency-tree-insight`.

Lectura por causa raíz: desaparecen los bloqueos de render, la librería sin usar, el problema de fuentes y el de imágenes sin dimensiones; las imágenes siguen marcando algún ahorro (formato), pero muy por debajo.

## Recursos

Total 8,30 MiB → 0,86 MiB (−7 792 911 B). Imágenes: 8 492 779 B → 867 692 B. Scripts: 169 259 B → 1 507 B.

## Causas probables (hipótesis)

Antes y después comparten commit `3bbc3a2` con `dirty: true`, así que **git no permite atribuir la diferencia a un commit**. Lo que se sabe es que la diferencia viene de cambios no commiteados o de que son dos carpetas distintas del sitio. *Hipótesis* a confirmar con el usuario: la caída de scripts (−167 752 B) cuadra con haber eliminado `three.min.js`, y la de imágenes con las variantes `srcset`; ambas se pueden comprobar con `git diff --no-index demo/site demo/site-fixed`.

## Siguiente paso

¿Confirmas que la versión "después" es la corregida que esperabas? Si alguna mejora concreta te interesa aislar (p. ej. cuánto aporta solo `srcset`), `perf-fix` puede aplicarlas una a una y medir cada una con `wperf compare`.
