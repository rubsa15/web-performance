# Ejemplo de salida de `perf-compare`: evolución de una URL

Cifras reales de seis auditorías de la demo (`http://127.0.0.1:4173/`, mobile, red `default`, 3 ejecuciones cada una), del `2026-10-21T19-41-55Z-mobile` al `2026-10-21T21-03-50Z-mobile`. Muestra cómo leer una serie: encontrar el salto con `vsPrevious`, detallarlo con `compare` y descartar una deriva lenta comparando los extremos. Modelo de **forma y de razonamiento**, no de cifras.

```sh
npx wperf history http://127.0.0.1:4173/ --device mobile --network default --format json > historial.json
npx wperf compare 2026-10-21T19-41-55Z-mobile 2026-10-21T19-42-38Z-mobile --format json > salto.json
npx wperf compare 2026-10-21T19-41-55Z-mobile 2026-10-21T21-03-50Z-mobile --format json > extremos.json
npx wperf compare 2026-10-21T19-42-38Z-mobile 2026-10-21T21-03-50Z-mobile --format json > tras-salto.json
```

---

## Serie: un salto y el resto ruido

| Reporte     | Score | LCP       | TBT    | CLS   | Frente al anterior (`vsPrevious`)                                 |
| ----------- | ----- | --------- | ------ | ----- | ----------------------------------------------------------------- |
| `19-41-55Z` | 57    | 39 754 ms | 171 ms | 0,291 | — (primero de la serie)                                           |
| `19-42-38Z` | 41    | 40 728 ms | 641 ms | 0,291 | **`regressed`**: score −16; FCP +691 ms, TBT +470 ms, SI +691 ms |
| `19-55-08Z` | 42    | 40 729 ms | 585 ms | 0,291 | `unchanged`                                                       |
| `19-55-29Z` | 44    | 43 503 ms | 908 ms | 0     | `unchanged` (ver abajo)                                           |
| `19-56-14Z` | 41    | 40 727 ms | 623 ms | 0,291 | `unchanged`                                                       |
| `21-03-50Z` | 44    | 40 730 ms | 518 ms | 0,291 | `unchanged`                                                       |

**Un solo salto.** Solo `2026-10-21T19-42-38Z-mobile` tiene algo distinto de `unchanged` en `vsPrevious`. El resto de la serie se mueve dentro del ruido.

**Números que saltan y son ruido.** `19-55-29Z` tiene el TBT más alto de la serie (908 ms) y un CLS de 0, y aun así es `unchanged` frente al anterior. La comparación de ese par lo explica: el TBT sube 323 ms, más que su `threshold` (292,5 ms), pero `rangesOverlap` es `true` (`rangeAfter` 484–2 173 ms); el CLS baja 0,291 con `rangeAfter` 0–0,291, es decir, alguna de las tres ejecuciones sí tuvo el problema de CLS. No es ni mejora ni regresión.

## El salto: `19-41-55Z` → `19-42-38Z`

`wperf compare` del par: **`regressed`**, score 57 → 41 (−16; `threshold` 5).

| Métrica | Antes     | Después   | Δ       | `threshold` | Resultado                                                         |
| ------- | --------- | --------- | ------- | ----------- | ----------------------------------------------------------------- |
| FCP     | 1 804 ms  | 2 495 ms  | +691 ms | 180 ms      | `regressed`                                                       |
| TBT     | 171 ms    | 641 ms    | +470 ms | 85,5 ms     | `regressed` (good → poor)                                         |
| SI      | 1 804 ms  | 2 495 ms  | +691 ms | 180 ms      | `regressed`                                                       |
| LCP     | 39 754 ms | 40 728 ms | +974 ms | 3 975 ms    | `unchanged`: no supera el umbral, aunque los rangos no se solapan |

Oportunidades: aparecen `unused-javascript`, `bootup-time` y `mainthread-work-breakdown` (`new`) y empeora `render-blocking-insight` (`worse`, +700 ms). Los dos reportes tienen el mismo commit (`3bbc3a2`, con cambios sin commitear), así que git no explica el salto; el análisis completo de este par, con los `items[]`, está en [ejemplo-regresion.md](ejemplo-regresion.md).

## ¿Deriva lenta?

| Comparación                         | Veredicto   | Score   |
| ----------------------------------- | ----------- | ------- |
| Extremos (`19-41-55Z` → `21-03-50Z`) | `regressed` | 57 → 44 |
| Tras el salto (`19-42-38Z` → `21-03-50Z`) | `unchanged` | 41 → 44 |

Los extremos dan `regressed` (FCP, TBT y SI), pero desde el salto todo es `unchanged`: la regresión de la serie es la del salto y la página no ha seguido empeorando después. **No hay deriva lenta.**

## Conclusión

- Hay **un** cambio real en la serie, en `2026-10-21T19-42-38Z-mobile`: FCP, SI y TBT empeoran, y el TBT pasa de `good` a `poor`.
- Desde entonces el rendimiento es estable dentro del ruido.
- *Hipótesis:* si ese cambio fue intencionado, la línea base para futuras comparaciones es cualquier reporte posterior al salto; si no lo fue, es una regresión que corregir con `perf-fix`.

¿Fue intencionado el cambio de `19-42-38Z`, o quieres que investigue su causa?
