# Comparación 1: demo rota (:4173) vs demo arreglada (:4174)

Comando: `npx wperf compare .perf/reports/127.0.0.1-4173/2026-10-21T19-42-38Z-mobile.json .perf/reports/127.0.0.1-4174/2026-10-21T19-43-21Z-mobile.json --format json` (código de salida 0).

## Veredicto: `improved`

| Reporte | id                            | URL                      | Etiqueta      | Git               |
| ------- | ----------------------------- | ------------------------ | ------------- | ----------------- |
| Antes   | `2026-10-21T19-42-38Z-mobile` | `http://127.0.0.1:4173/` | demo v0       | `3bbc3a2` (dirty) |
| Después | `2026-10-21T19-43-21Z-mobile` | `http://127.0.0.1:4174/` | demo fixed v0 | `3bbc3a2` (dirty) |

Score: **41 → 99** (+58, `improved`). Ambos mobile, 3 ejecuciones.

**Fiabilidad.** El único aviso del CLI es que las URLs son distintas (`:4173` vs `:4174`). Esto no es una misma URL medida en el tiempo, sino dos _versiones del sitio_ servidas en puertos distintos. La comparación es válida, pero (1) mide el efecto del conjunto de diferencias entre ambas versiones, no el de un cambio concreto, y (2) git no puede atribuirlas (ver causas). La respuesta corta a "¿es real la mejora?": sí, el CLI marca `improved` en las cinco métricas que se movieron y ninguna regresa; el tamaño del cambio (cientos de ms a decenas de segundos, y 7,4 MiB menos transferidos) no es del orden del ruido que el CLI descarta con su umbral.

## Métricas

### Mejoradas (`improved`)

| Métrica | Antes     | Después  | Δ          | Δ %     | Rating                   |
| ------- | --------- | -------- | ---------- | ------- | ------------------------ |
| LCP     | 40 728 ms | 2 104 ms | −38 624 ms | −94,8 % | poor → good              |
| FCP     | 2 495 ms  | 1 413 ms | −1 082 ms  | −43,4 % | needs-improvement → good |
| TBT     | 641 ms    | 17 ms    | −624 ms    | −97,3 % | poor → good              |
| CLS     | 0,291     | 0        | −0,291     | −100 %  | poor → good              |
| SI      | 2 495 ms  | 1 413 ms | −1 082 ms  | −43,4 % | good → good              |

### Empeoradas (`regressed`)

Ninguna.

### Sin cambio / ruido (`unchanged`)

| Métrica | Antes  | Después | Δ   | Rating      |
| ------- | ------ | ------- | --- | ----------- |
| TTFB    | 752 ms | 752 ms  | 0   | good → good |

TTFB no cambia: coherente con que la diferencia está en lo que se descarga y ejecuta, no en el servidor.

Nota: SI mejora, pero su rating ya era `good` antes; no cambia de categoría.

## Oportunidades (por causa raíz)

- **Resueltas** (`resolved`): `render-blocking-insight` (−1 550 ms), `unused-javascript` (−1 050 ms, −120 895 B ≈ −118 KiB), `font-display-insight` (−300 ms); y `unsized-images`, `cls-culprits-insight`, `lcp-discovery-insight`, `total-byte-weight` (sin ahorro medido antes: el problema desapareció, no hay cifra de mejora asociada).
- **Mejoradas** (`better`): `image-delivery-insight` (−32 750 ms, −7 607 813 B ≈ −7,26 MiB; queda un ahorro residual de 150 ms / 546 774 B, aún con impacto `high`), `bootup-time` y `mainthread-work-breakdown` (−650 ms cada una; pasan de impacto `high` a `low`).
- **Sin cambio** (`same`): `network-dependency-tree-insight`.
- **Nuevas / peores:** ninguna.

Lectura por causa raíz:

- _Imágenes sin optimizar_: `image-delivery-insight` (better) + `total-byte-weight` (resolved). Es el mayor efecto con diferencia en tiempo y bytes. Sigue habiendo margen residual (150 ms), así que no está "cerrado" del todo.
- _Imágenes sin dimensiones_: `unsized-images` + `cls-culprits-insight` resueltas = problema de CLS resuelto (0,291 → 0).
- _Bloqueo de render_: `render-blocking-insight` resuelta.
- _JS sin usar_: `unused-javascript` resuelta.
- _Hilo principal (TBT)_: `bootup-time` + `mainthread-work-breakdown` repiten el mismo ahorro (650 ms): es un único problema, no dos.
- _Fuentes_: `font-display-insight` resuelta.
- _LCP por descubrimiento_: `lcp-discovery-insight` resuelta.

## Recursos

| Tipo       | Antes                  | Después              | Δ            |
| ---------- | ---------------------- | -------------------- | ------------ |
| Total      | 8 699 348 B (8,30 MiB) | 906 437 B (0,86 MiB) | −7 792 911 B |
| Imágenes   | 8 492 779 B            | 867 692 B            | −7 625 087 B |
| Scripts    | 169 259 B              | 1 507 B              | −167 752 B   |
| Stylesheet | 955 B                  | 0 B                  | −955 B       |
| Documento  | 1 455 B                | 2 338 B              | +883 B       |
| Fuentes    | 34 900 B               | 34 900 B             | 0            |

La bajada de imágenes (−7 625 087 B) explica casi todo el total. Hoja de estilos a 0 con documento +883 B sugiere CSS pasado de fichero externo a inline.

## Causas probables (hipótesis)

**Lo que git permite afirmar:** nada. Antes y después comparten el commit `3bbc3a2` con `dirty: true`, así que ningún commit explica la diferencia: viene de ficheros sin commitear (y de que son dos versiones del sitio). Además `3bbc3a2` es anterior a los commits que hoy contienen la demo (`e97681e Fase 2: web demo`, `098fd26 Fase 3`), de modo que `git log 3bbc3a2..HEAD` no sirve para atribuir nada de esto. Como pediste "qué la causó", comparé las carpetas servidas (`diff -rq` y `diff` de `demo/site` frente a `demo/site-fixed`, sin tocar nada). Lo siguiente son **hipótesis** que cuadran con lo que se movió; ninguna está aislada:

1. **Imágenes a variantes con `srcset`/`sizes`, `loading="lazy"`, `decoding="async"`** (`site-fixed/img/*-480|960|1600.jpg`; el hero con `fetchpriority="high"`). Apoya: `image-delivery-insight` better con −7,26 MiB, imágenes −7 625 087 B, y cuadra con la caída de LCP (el reporte original lista `img/hero.jpg` con 3 003 499 B en `image-delivery-insight`; que ese sea el elemento LCP no lo he verificado). Confirmar: servir la versión arreglada pero con las imágenes originales y re-auditar.
2. **`width`/`height` en todas las `<img>`**. Apoya: `unsized-images` y `cls-culprits-insight` resueltas, CLS 0,291 → 0. Confirmar: quitar solo esos atributos y comprobar que CLS vuelve.
3. **Eliminar `vendor/three.min.js` y cargar `app.js` con `defer`; CSS en línea**. Apoya: `unused-javascript` resuelta (en el reporte "antes" el único ítem es `vendor/three.min.js`, 120 895 B desperdiciados de 167 861 B), `render-blocking-insight` resuelta, scripts −167 752 B, stylesheet −955 B. Esto explica la mejora de FCP/SI (−1 082 ms).
4. **Índice de búsqueda construido en trozos que ceden el hilo** (en `site-fixed/js/app.js`, frente a un bucle de 150 000 entradas más una ordenación en una sola tarea en la versión rota). Apoya: TBT 641 → 17 ms, `bootup-time`/`mainthread-work-breakdown` −650 ms; en el reporte "antes", `js/app.js` figura con `cpuMs` 1650 en `bootup-time`. Confirmar: restaurar solo el `app.js` original en la versión arreglada.
5. **`font-display: swap` y preload de la fuente**. Apoya: `font-display-insight` resuelta (−300 ms). Efecto pequeño frente al resto.

**Qué no se puede decir:** cuánto aporta cada arreglo por separado. Todos cambian a la vez; para repartirlo hay que aplicarlos de uno en uno y medir cada paso con `wperf compare`.

## Siguiente paso

¿Confirmas que `:4174` es la versión arreglada que esperabas comparar con `:4173`? Si quieres aislar el aporte de cada arreglo, `perf-fix` puede aplicarlos uno a uno y medir cada uno. No se ha editado código.
