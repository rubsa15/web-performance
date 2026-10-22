# Ejemplo de salida de `perf-audit` con tres perfiles de red

Cifras reales de tres auditorías de la demo rota (`http://127.0.0.1:4173/`, mobile, 3 ejecuciones, Lighthouse 13.5.0), una por perfil de red: `2026-10-21T21-03-50Z-mobile` (`default`), `2026-10-21T21-04-16Z-mobile-3g` y `2026-10-21T21-04-42Z-mobile-4g`. Modelo de **forma y de razonamiento** (cómo se cruzan los perfiles), no de cifras. Solo se muestra la parte propia de la skill multiperfil; el detalle por problema sigue el formato de [ejemplo-salida.md](ejemplo-salida.md).

---

## Resumen

La página es la misma en las tres mediciones y transfiere 8,30 MiB (`resources.totalBytes`), de los que 8,10 MiB son imágenes. Con la red del dispositivo ya tiene LCP y CLS en `poor`; con `3g` el LCP es inabordable y con `4g` aparece un TBT `poor` que las otras redes no muestran.

| Métrica | `default` (referencia) | `3g`                  | `4g`                |
| ------- | ---------------------- | --------------------- | ------------------- |
| Score   | 44                     | 49                    | 36                  |
| LCP     | 40 730 ms · poor       | 90 455 ms · poor      | 7 164 ms · poor     |
| FCP     | 2 499 ms · needs-improvement | 4 598 ms · poor | 1 096 ms · good     |
| TBT     | 518 ms · needs-improvement   | 43 ms · good    | 1 406 ms · poor     |
| CLS     | 0,291 · poor           | 0,291 · poor          | 0,291 · poor        |
| SI      | 2 499 ms · good        | 4 598 ms · needs-improvement | 1 096 ms · good |
| TTFB    | 752 ms · good          | 1 202 ms · needs-improvement | 422 ms · good |

Dos cosas que conviene leer con cuidado:

- **El score no ordena las redes.** Sube en `3g` (49) y baja en `4g` (36), al revés que el LCP; *hipótesis:* el TBT, que se comporta al revés que la red (ver abajo), pesa mucho en la puntuación. No lo uses para decir que la web va "mejor" en 3G.
- **El TBT engaña.** Vale 43 ms en `3g` y 1 406 ms en `4g`, con la misma CPU: `bootup-time` atribuye 1 717 ms de CPU a `app.js` en `3g` y 1 666 ms en `4g` (casi igual). *Hipótesis:* el TBT solo cuenta las tareas largas entre FCP y TTI; con `3g` el FCP llega tan tarde (4 598 ms) que la tarea larga cae antes de esa ventana. El problema de CPU existe en las tres redes; solo en `4g` y `default` la métrica lo ve.

## Tabla priorizada (extracto)

| #   | Problema                    | Evidencia medida (ahorro por perfil: `default` / `3g` / `4g`)                                        | Ante la red                                        | Métricas   | Esfuerzo (hipótesis) |
| --- | --------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------- | -------------------- |
| 1   | Imágenes sin optimizar      | `image-delivery-insight`: 32 900 / 81 500 / 5 050 ms, siempre 7,78 MiB                                | **Sensible**: mismos bytes, el tiempo lo decide la red | LCP    | M                    |
| 2   | Imágenes sin `width`/`height` | `unsized-images` y `cls-culprits-insight` en los tres; CLS 0,291 en los tres                       | **Independiente**                                  | CLS        | S                    |
| 3   | Recursos que bloquean el render | `render-blocking-insight`: 1 550 / 3 050 / 600 ms                                                | **Sensible**: `three.min.js` bloquea 1 502 / 3 002 / 542 ms | FCP, LCP | S                  |
| 4   | JS sin usar                 | `unused-javascript`: 1 050 / 0 / 160 ms; 118 KiB sin usar en los tres                                | **Sensible, y el ahorro en ms llega a 0 en `3g`**: los bytes están, la métrica ya no los atribuye | FCP, LCP | S |
| 5   | Tarea larga en el hilo principal | `bootup-time`: 500 / 50 / 1 350 ms; `app.js` 1 525 / 1 717 / 1 666 ms de CPU                    | **Se mueve sin que cambie la CPU** (ver TBT arriba) | TBT       | M                    |
| 6   | Fuentes sin `font-display`  | `font-display-insight`: 300 ms en los tres                                                           | **Independiente**                                  | FCP        | S                    |

Prioridad: 1 y 2 van primero porque LCP y CLS son `poor` en las tres redes; el 5 sube por encima de lo que sugiere su ahorro en `3g` precisamente porque ahí la métrica lo oculta.

## Qué no está medido

- Tres redes simuladas no son todas las redes: este informe habla de estos perfiles, no de los usuarios reales.
- El ahorro de `unused-javascript` en `3g` es 0 ms con 118 KiB sin usar: no se debe leer como "no importa", sino como que Lighthouse no lo atribuye a esa red.
