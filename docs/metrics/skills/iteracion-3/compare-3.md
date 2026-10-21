# Comparación: demo original (4173) frente a demo corregida (4174)

## Aviso previo sobre la comparación

`wperf compare` devuelve `warnings` con dos avisos:

1. "El primer reporte es posterior al segundo: 'antes' y 'después' pueden estar invertidos." El "antes" (21:08:09Z) se midió después que el "después" (19:43:21Z). Aquí no es un error: tu "antes" es la versión rota del sitio y tu "después" la corregida, y la comparación es lógica en ese sentido, aunque cronológicamente se midió al revés.
2. "Las URLs son distintas (http://127.0.0.1:4173/ vs http://127.0.0.1:4174/)." No es la evolución de una misma URL, sino una comparación entre dos versiones del sitio servidas en puertos distintos. Es válida, pero git no explica la diferencia por commits (ver más abajo).

Además cada lado tiene 3 ejecuciones y el "después" tiene una sola auditoría; la confianza es limitada, aunque, como se verá, la diferencia es enorme.

## Veredicto

**`improved`.** Score 42 → 99 (delta +57), `change: improved`.

|         | Id                                                       | Fecha                | URL                      | Commit                    |
| ------- | -------------------------------------------------------- | -------------------- | ------------------------ | ------------------------- |
| Antes   | `2026-10-21T21-08-09Z-mobile`                            | 2026-10-21 21:08:09Z | `http://127.0.0.1:4173/` | `55b5fde`, `dirty: false` |
| Después | `2026-10-21T19-43-21Z-mobile` (etiqueta "demo fixed v0") | 2026-10-21 19:43:21Z | `http://127.0.0.1:4174/` | `3bbc3a2`, `dirty: true`  |

Mismo device (mobile) y mismo perfil de red (`default`).

## Métricas

**Mejoradas (`improved`)**

| Métrica     | Antes     | Después  | Delta      | Δ %     | Rating                   |
| ----------- | --------- | -------- | ---------- | ------- | ------------------------ |
| LCP         | 40 729 ms | 2 104 ms | -38 625 ms | -94,8 % | poor → good              |
| FCP         | 2 496 ms  | 1 413 ms | -1 083 ms  | -43,4 % | needs-improvement → good |
| TBT         | 573 ms    | 17 ms    | -556 ms    | -97,0 % | needs-improvement → good |
| CLS         | 0,291     | 0        | -0,291     | -100 %  | poor → good              |
| Speed Index | 2 496 ms  | 1 413 ms | -1 083 ms  | -43,4 % | good → good              |

**Empeoradas (`regressed`):** ninguna.

**Ruido (`unchanged`)**

| Métrica | Antes  | Después | Delta | Rating      |
| ------- | ------ | ------- | ----- | ----------- |
| TTFB    | 752 ms | 752 ms  | 0 ms  | good → good |

Los rangos min–max de los reportes originales confirman que las mejoras no son ruido: no se solapan en ninguna métrica mejorada. LCP 40 728–40 729 ms frente a 2 103–2 104 ms; FCP 2 494–2 502 ms frente a 1 411–1 415 ms; TBT 450–604 ms frente a 15–24 ms; CLS 0,291 frente a 0 (fuente: fichero). Con 3 ejecuciones por lado la confianza es limitada, pero la diferencia es de órdenes de magnitud mayor que la dispersión.

## Oportunidades

- **`resolved` (7):** `render-blocking-insight` (1 550 ms de ahorro antes), `unused-javascript` (1 050 ms y 120 895 bytes antes), `font-display-insight` (300 ms antes), `cls-culprits-insight`, `lcp-discovery-insight`, `total-byte-weight` y `unsized-images` (estas cuatro con ahorro 0 antes). Las de ahorro 0 son buen dato (el problema desapareció) pero no tienen cifra de mejora; el efecto cuantificable está en las métricas.
- **`better` (3):**
  - `image-delivery-insight`: de 32 900 ms y 8 154 587 bytes a 150 ms y 546 774 bytes (deltaMs -32 750, deltaBytes -7 607 813).
  - `bootup-time`: de 550 ms a 0 ms (deltaMs -550).
  - `mainthread-work-breakdown`: de 550 ms a 0 ms (deltaMs -550). Es el mismo problema de hilo principal que `bootup-time`, no uno distinto.
- **`same` (1):** `network-dependency-tree-insight` (0 ms).
- **`new` / `worse`:** ninguna.

Leído por causa raíz (guía de causas de perf-audit):

| Causa raíz                      | Oportunidades                                                         | Resultado                                      |
| ------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------- |
| Imágenes sin optimizar          | `image-delivery-insight` (`better`), `total-byte-weight` (`resolved`) | Sigue habiendo un ahorro residual, mucho menor |
| Imágenes sin dimensiones (CLS)  | `unsized-images` + `cls-culprits-insight` (`resolved`)                | Problema de CLS resuelto: CLS 0,291 → 0        |
| Recursos que bloquean el render | `render-blocking-insight` (`resolved`)                                | Resuelto                                       |
| JavaScript sin usar             | `unused-javascript` (`resolved`)                                      | Resuelto                                       |
| Fuentes web                     | `font-display-insight` (`resolved`)                                   | Resuelto                                       |
| Hilo principal (TBT)            | `bootup-time`, `mainthread-work-breakdown` (`better`)                 | TBT 573 → 17 ms                                |

## Recursos

| Tipo          | Antes (bytes) | Después (bytes) | Delta (bytes) |
| ------------- | ------------- | --------------- | ------------- |
| total         | 8 699 348     | 906 437         | -7 792 911    |
| image         | 8 492 779     | 867 692         | -7 625 087    |
| script        | 169 259       | 1 507           | -167 752      |
| stylesheet    | 955           | 0               | -955          |
| document      | 1 455         | 2 338           | +883          |
| font          | 34 900        | 34 900          | 0             |
| media / other | 0             | 0               | 0             |

En prosa: el total baja de 8,30 MiB a 885 KiB (-7,43 MiB) y las imágenes de 8,10 MiB a 847 KiB (-7,27 MiB). Los scripts bajan de 165 KiB a 1 KiB.

## Causas probables (hipótesis)

Antes de nada: git no puede explicar esta diferencia. Los dos reportes son de URL distintas (dos versiones del sitio). Los commits registrados (`55b5fde` limpio y `3bbc3a2` sucio) no son una pareja antes/después del mismo código: el commit de la demo (`e97681e`, el único que toca `demo/`) es posterior a `3bbc3a2` (fuente: `git log --oneline -- demo`). Como el reporte "después" está marcado `dirty: true`, no puedo comprobar con git qué había en `demo/site-fixed/` al auditar. Lo que sigue compara los directorios **tal como están ahora** (fuente: `git diff --no-index` de `demo/site` y `demo/site-fixed`, filtrando a `index.html` y `js/app.js`); es una hipótesis razonable, no una prueba de qué estado se midió. Como pediste la causa, comparo los directorios.

Evidencia medida (de los reportes), seguida de la hipótesis de qué cambio la explica:

1. **Imágenes, el grueso del LCP y del peso (medido).** En el "antes", `image-delivery-insight` lista `hero.jpg` (3 003 499 bytes) y seis `cafe-N.jpg` de unos 0,9 MB cada una, todas con `wastedBytes` altísimo. En el "después" las imágenes son `hero-960.jpg` (65 506 bytes) y seis `cafe-N-960.jpg` (unos 133 000 bytes) (fuente: fichero). La imagen pasa de 8 492 779 a 867 692 bytes.
   - _Hipótesis:_ el código de `demo/site-fixed/index.html` sirve variantes redimensionadas con `srcset`/`sizes` (480/960/1600), pone `fetchpriority="high"` en la imagen hero y `loading="lazy"` + `decoding="async"` en la galería (fuente: código). Esto encaja con la bajada de LCP (40 729 → 2 104 ms) y con `image-delivery-insight` en `better`.
2. **CLS 0,291 → 0 (medido), `unsized-images` y `cls-culprits-insight` resueltas.**
   - _Hipótesis:_ las `<img>` de la versión corregida llevan `width` y `height`, el original no (fuente: código). El navegador reserva espacio y el contenido deja de saltar.
3. **Recursos que bloquean el render y JS sin usar (medido).** En el "antes", `render-blocking-insight` lista `vendor/three.min.js` (168 137 bytes, 1 501 ms), `js/app.js` (601 ms) y `css/styles.css` (451 ms); `unused-javascript` lista solo `three.min.js` (120 895 bytes sin usar de 167 861). En el "después" esas oportunidades desaparecen, `script` baja de 169 259 a 1 507 bytes y `stylesheet` a 0 (fuente: fichero).
   - _Hipótesis:_ la versión corregida no carga `three.min.js`, carga `app.js` con `defer` y mete el CSS en un `<style>` en línea (fuente: código). Esto es coherente con que `document` suba +883 bytes mientras `stylesheet` baja 955 bytes. Explicaría la bajada de FCP (-1 083 ms) y parte de la de LCP.
4. **Fuentes (medido).** `font-display-insight` pasaba de 300 ms de ahorro a `resolved`, con los bytes de fuente idénticos (34 900).
   - _Hipótesis:_ `font-display: swap` en `@font-face` más un `preload` de la fuente de 400 (fuente: código).
5. **TBT 573 → 17 ms (medido) y un dato que parece contradecir.** `bootup-time` y `mainthread-work-breakdown` pasan a 0 ms y TBT baja a 17 ms. Pero en `bootup-time` el `cpuMs` de `js/app.js` **sube** de 1 581 ms a 2 361 ms, y el diagnóstico `long-tasks` indica "2 long tasks found" en el original y "4 long tasks found" en la corregida (fuente: fichero). No reclasifico: la clasificación del CLI (TBT `improved`) manda.
   - _Hipótesis:_ la versión corregida construye el índice de búsqueda de 150 000 entradas troceándolo con `setTimeout` en bloques de 5 000 y ordenando por mezcla (fuente: código), en vez de una sola tarea larga justo tras el primer pintado. El trabajo total de CPU no baja (incluso sube) pero deja de bloquear el hilo en una sola tarea. Las "4 long tasks" podrían ocurrir antes de FCP, donde no cuentan para TBT; esto último es una conjetura a confirmar.

La sección TTFB `unchanged` (752 ms en ambos) es coherente con que no se tocó el servidor.

## Qué confirmar

- Para atribuir qué parte corresponde a cada arreglo, aplica los cambios de uno en uno a la versión original (imágenes, `width`/`height`, `defer`/CSS en línea sin `three.min.js`, troceado del índice) y audita tras cada uno con `wperf audit` + `wperf compare`.
- Verifica que `demo/site-fixed/` actual es lo que se midió en 4174 a las 19:43:21Z: el reporte es `dirty: true` y no hay commit que lo fije. Lo más sólido es volver a auditar `demo/site-fixed/` desde un commit limpio.
- Comprueba el contexto de la base: `npx wperf history http://127.0.0.1:4173/` muestra que el "antes" (score 42, LCP 40 729 ms, CLS 0,291, TBT 573 ms) es representativo de las auditorías de 4173 desde las 19:41 en adelante (LCP ~39 754–40 730 ms, CLS 0,291). La excepción es la primera, `2026-10-21T19-40-34Z-mobile` (score 74, LCP 47 029 ms, CLS 0, TBT 29 ms), con la misma etiqueta "demo v0" y el mismo commit que las siguientes. Eso sugiere que el contenido servido cambió entre medidas con la misma etiqueta; es una hipótesis, y si esa auditoría de 19:40 estaba medida sobre otro estado, no es una referencia comparable. Tu "antes" no es un reporte degradado puntual: es la base estable de la versión rota.
- Hay una sola auditoría de 4174 (`npx wperf history http://127.0.0.1:4174/`), así que no sabemos si el resultado se mantiene entre sesiones. Repetirla daría más confianza.

## Cierre

¿Es real la mejora? Sí en el sentido que mide el CLI: cinco métricas `improved` con rangos que no se solapan, cuatro de ellas pasan a `good`, y los recursos descargados bajan 7,43 MiB. Matices: es una comparación entre dos versiones del sitio (no una misma URL en el tiempo), con un "después" medido con `dirty: true` y anterior en el tiempo al "antes". La causa concreta de cada mejora sigue siendo hipótesis hasta que las apliques por separado.

¿Confirmas estas causas o quieres que investigue otra? No hay regresión que arreglar, así que no hace falta `perf-fix`; si quieres seguir bajando el ahorro residual de imágenes (`image-delivery-insight` aún suma 150 ms y 546 774 bytes), `perf-audit` sobre 4174 priorizaría lo que queda.
