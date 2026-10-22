# ¿Ha cambiado el rendimiento entre `antes-1` y `antes-2`?

**No hay cambio medible. El `verdict: improved` del CLI lo dispara solo el `score`, y el `score` se mueve con el ruido.**

|          | Reporte "antes"               | Reporte "después"             |
| -------- | ----------------------------- | ----------------------------- |
| Etiqueta | `antes-1`                     | `antes-2`                     |
| Id       | `2026-10-22T19-09-11Z-mobile` | `2026-10-22T19-09-38Z-mobile` |
| Fecha    | 2026-10-22 19:09:11Z          | 2026-10-22 19:09:38Z          |
| Commit   | `b10171f` (dirty: false)      | `b10171f` (dirty: false)      |

- Es la misma URL (`http://127.0.0.1:4173/`), `mobile`, red `default`, y cada lado tiene 3 ejecuciones. `warnings` viene vacío.
- El `verdict` del CLI es `improved`. El `score` va de 41 a 47 (delta +6, `change: improved`, umbral 5).
- **Ninguna métrica salió `improved` ni `regressed`.** Las seis son `unchanged`.
- Con 3 ejecuciones por lado, el `score` puede cruzar su umbral sin que la página cambie, sobre todo por el TBT.
- Los recursos son idénticos y el elemento LCP es el mismo. Por eso lo trato como **ruido probable (hipótesis)**, no como mejora de la página.

## Métricas (todas `unchanged`, es decir, ruido)

| Métrica     | Antes     | Después   | Delta   | Δ %     | Rating                                | Por qué es `unchanged`                                                                                                      |
| ----------- | --------- | --------- | ------- | ------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| LCP         | 40 730 ms | 40 954 ms | +224 ms | +0,5 %  | poor → poor                           | El delta no supera el umbral (4 073 ms). Además los rangos se solapan: 40 729–40 805 frente a 40 728–43 504.                |
| FCP         | 2 498 ms  | 2 498 ms  | 0 ms    | 0 %     | needs-improvement → needs-improvement | El delta es 0 (umbral 249,8 ms).                                                                                            |
| TBT         | 608 ms    | 1 133 ms  | +525 ms | +86,3 % | poor → poor                           | **El delta supera el umbral (304 ms), pero los rangos se solapan:** 574–661 frente a 392–1 873.                             |
| CLS         | 0,291     | 0,291     | 0       | 0 %     | poor → poor                           | El delta es 0 (umbral 0,02). Pero `rangeAfter` es 0–0,291, así que alguna ejecución de `antes-2` no tuvo el desplazamiento. |
| Speed Index | 2 498 ms  | 2 498 ms  | 0 ms    | 0 %     | good → good                           | El delta es 0 (umbral 249,8 ms).                                                                                            |
| TTFB        | 753 ms    | 752 ms    | −1 ms   | −0,1 %  | good → good                           | El delta no supera el umbral (150,6 ms).                                                                                    |

- **El TBT es la única cifra que se mueve mucho:** +525 ms (+86,3 %) y un rango "después" muy ancho (392–1 873 ms). Es el motivo principal de que el `score` se mueva. Aun así el CLI lo marca `unchanged`, y yo no lo reclasifico como regresión.
- Con solo 3 ejecuciones por lado, los rangos dan una confianza limitada. Un "no hay cambio medible" no demuestra que no haya ninguna diferencia, solo que esta medida no puede distinguirla.

Resumen en tres bloques:

- `improved`: ninguna.
- `regressed`: ninguna.
- `unchanged` (ruido): LCP, FCP, TBT, CLS, SI y TTFB.

## Oportunidades

- **`resolved`: `mainthread-work-breakdown`** (ahorro estimado 600 ms → desaparece, `deltaMs` −600).
  - Es la única entrada que el CLI marca con un cambio de estado. Es un dato del CLI, pero no tiene cifra de mejora asociada.
  - Va en la misma línea que `bootup-time` (abajo): ahorro de JavaScript en el hilo principal que se mueve con el TBT. Mientras el TBT sea `unchanged`, no lo leo como mejora de la página.
- **`same`** (cambios por debajo del umbral del CLI, aunque el número se mueva):
  - `image-delivery-insight`: 33 800 → 32 900 ms (`deltaMs` −900, umbral 16 900 ms) y 8 381 381 → 8 154 587 bytes (`deltaBytes` −226 794, umbral 1 676 276,2 bytes).
  - `bootup-time`: 600 → 350 ms (`deltaMs` −250, umbral 300 ms). Su impacto pasa de `high` a `medium`.
  - Idénticas en ambos reportes (delta 0):
    - `render-blocking-insight`: 1 550 ms
    - `unused-javascript`: 1 050 ms y 120 895 bytes
    - `font-display-insight`: 300 ms
    - `cls-culprits-insight`, `lcp-discovery-insight`, `network-dependency-tree-insight`, `total-byte-weight` y `unsized-images`: 0 ms
- No hay oportunidades `new` ni `worse`.

Se mantienen los mismos problemas de fondo en los dos reportes: imágenes pesadas, recursos que bloquean el renderizado, JavaScript sin usar y desplazamientos de layout.

## Elemento LCP

`lcpElement.changed` es `false`. En ambos reportes es `body > main > section.hero > img.hero-img`, así que el LCP es comparable entre las dos medidas.

## Recursos

No hay ningún cambio: `delta` es 0 en todos los tipos.

| Tipo       | Bytes (antes = después) |
| ---------- | ----------------------- |
| total      | 8 699 207 (8,30 MiB)    |
| image      | 8 492 779               |
| script     | 169 118                 |
| font       | 34 900                  |
| document   | 1 455                   |
| stylesheet | 955                     |

El contenido medido es el mismo en las dos auditorías.

## Cruce con git

Ambos reportes son del mismo commit (`b10171f`) y sin cambios sin commitear, así que `git log b10171f..b10171f` no tiene nada que listar. No hay ningún cambio de código que pueda explicar una diferencia. Tampoco busco causas del `score`: no hay una diferencia real que explicar.

## Causas probables (hipótesis) y qué confirmar

- **Hipótesis:** el salto de 41 a 47 es variabilidad de la medida, sobre todo del TBT.
  - Lo que lo apoya:
    - Mismo commit, árbol limpio y recursos idénticos.
    - Mismo elemento LCP.
    - Ninguna métrica `improved`.
    - El rango de TBT de `antes-2` es muy ancho (392–1 873 ms).
    - El `score` solo supera su umbral (5) por 1 punto.
  - **Cómo confirmarla:** repetir la auditoría de la misma versión de la web unas cuantas veces más y ver si el `score` sigue oscilando (con `wperf history`, o comparando cada nuevo reporte con `antes-2`).
- **Conclusión práctica:** para este sitio, en este entorno, una diferencia de unos 6 puntos de `score` o de unos 500 ms de TBT entre dos medidas no sirve como evidencia de mejora. Para validar un arreglo, conviene exigir métricas `improved` en el CLI y rangos que no se solapen.

## Cierre

No hay ninguna regresión real en el código, así que no hace falta `perf-fix`. ¿Quieres que repita el análisis con otro par de reportes, por ejemplo comparar `antes-2` con `despues-1`?
