# Comparación 2: misma URL (:4173), dos auditorías consecutivas

Comando: `npx wperf compare .perf/reports/127.0.0.1-4173/2026-10-21T19-41-55Z-mobile.json .perf/reports/127.0.0.1-4173/2026-10-21T19-42-38Z-mobile.json --format json` (código de salida 0, `warnings` vacío).

## Veredicto: `regressed`

| Reporte | id                            | Etiqueta | Git               |
| ------- | ----------------------------- | -------- | ----------------- |
| Antes   | `2026-10-21T19-41-55Z-mobile` | demo v0  | `3bbc3a2` (dirty) |
| Después | `2026-10-21T19-42-38Z-mobile` | demo v0  | `3bbc3a2` (dirty) |

Misma URL (`http://127.0.0.1:4173/`), mismo device (mobile), 3 ejecuciones cada uno, mismo Lighthouse 13.5.0 y Chrome 155.0.0.0, throttling `simulate`. Separados por 43 s (19:41:55Z y 19:42:38Z).

Score: **57 → 41** (−16, `regressed`).

**Fiabilidad.** El CLI no emite ningún aviso y la comparación cumple los requisitos formales (misma URL, device, throttling, versiones). Pero hay una pista de que lo que se midió NO fue el mismo sitio: ambas auditorías tienen la misma etiqueta y commit, y sin embargo los recursos cambian (ver más abajo). El "aviso" lo da el contenido de los reportes, no el CLI.

## Métricas

### Empeoradas (`regressed`)

| Métrica | Antes    | Después  | Δ       | Δ %      | Rating                                |
| ------- | -------- | -------- | ------- | -------- | ------------------------------------- |
| FCP     | 1 804 ms | 2 495 ms | +691 ms | +38,3 %  | needs-improvement → needs-improvement |
| TBT     | 171 ms   | 641 ms   | +470 ms | +274,9 % | good → **poor**                       |
| SI      | 1 804 ms | 2 495 ms | +691 ms | +38,3 %  | good → good                           |

### Mejoradas

Ninguna.

### Sin cambio / ruido (`unchanged`)

| Métrica | Antes     | Después   | Δ       | Rating      |
| ------- | --------- | --------- | ------- | ----------- |
| LCP     | 39 754 ms | 40 728 ms | +974 ms | poor → poor |
| CLS     | 0,291     | 0,291     | 0       | poor → poor |
| TTFB    | 752 ms    | 752 ms    | 0       | good → good |

El LCP sube 974 ms (+2,5 %), pero el CLI lo clasifica `unchanged`: lo trato como ruido y no lo cuento como regresión. Sigue en `poor` en ambos.

Lectura: el empeoramiento está en la carga/ejecución de JS (FCP, TBT), no en lo que ya era el problema principal (LCP y CLS idénticos, ambos `poor`).

## Oportunidades

- **Nuevas** (`new`, no existían antes): `unused-javascript` (+1 050 ms, +120 895 B ≈ 118 KiB), `bootup-time` (+650 ms), `mainthread-work-breakdown` (+650 ms).
- **Peores** (`worse`): `render-blocking-insight` (850 ms → 1 550 ms, +700 ms).
- **Sin cambio** (`same`): `image-delivery-insight` (el CLI no lo marca `worse` pese a +200 ms: 32 700 → 32 900 ms, bytes idénticos 8 154 587 B), `font-display-insight`, `cls-culprits-insight`, `lcp-discovery-insight`, `network-dependency-tree-insight`, `total-byte-weight`, `unsized-images`.
- **Resueltas / mejoradas:** ninguna.

Lectura por causa raíz: aparece un problema nuevo de **JavaScript sin usar / excesivo** (`unused-javascript`) con su consecuencia en el **hilo principal** (`bootup-time` + `mainthread-work-breakdown`, mismo ahorro de 650 ms: un único problema), y se agrava el **bloqueo de render**. Los problemas de imágenes, CLS y fuentes siguen igual.

## Recursos

| Tipo       | Antes       | Después     | Δ          |
| ---------- | ----------- | ----------- | ---------- |
| Total      | 8 557 460 B | 8 699 348 B | +141 888 B |
| Scripts    | 27 370 B    | 169 259 B   | +141 889 B |
| Imágenes   | 8 492 779 B | 8 492 779 B | 0          |
| Documento  | 1 456 B     | 1 455 B     | −1 B       |
| Stylesheet | 955 B       | 955 B       | 0          |
| Fuentes    | 34 900 B    | 34 900 B    | 0          |

Todo el cambio de bytes está en los scripts (+141 889 B), y esos bytes explican las oportunidades nuevas.

## Causas probables (hipótesis)

**Git no ayuda.** Ambos reportes tienen el mismo commit `3bbc3a2` con `dirty: true`. No hay commit candidato: `git log 3bbc3a2..3bbc3a2` está vacío, y la diferencia procede de cambios sin commitear (o del entorno/ruido). No señalo ningún commit culpable.

**Evidencia en los propios reportes (no en el JSON de `compare`, leída de los reportes originales).** El ítem de `render-blocking-insight` lista distintos scripts en cada auditoría:

- Antes: `http://127.0.0.1:4173/vendor/lodash.min.js` (26 319 B), `js/app.js`, `css/styles.css`.
- Después: `http://127.0.0.1:4173/vendor/three.min.js` (168 137 B), `js/app.js`, `css/styles.css`. Y `unused-javascript` en "después" apunta solo a `vendor/three.min.js` (120 895 B desperdiciados de 167 861 B).

_Hipótesis principal:_ entre las dos auditorías se cambió la librería de `vendor/` servida en `:4173` (de `lodash.min.js`, ~26 KB, a `three.min.js`, ~168 KB), sin commitear. Cuadra con scripts +141 889 B (169 259 − 27 370), con `unused-javascript` nuevo, con el TBT que pasa a `poor` y con el bloqueo de render más largo (la librería es síncrona en `<head>`). _Hipótesis secundaria:_ que la regresión sea solo variación entre ejecuciones; la contradice que la diferencia de bytes de scripts es determinista y el TBT cambia de `good` a `poor`, pero no puedo descartarla del todo con 3 ejecuciones por lado.

**Confirmar:** (1) comprobar que `demo/site/index.html` y `demo/site/vendor/` en el momento de cada auditoría apuntaban a librerías distintas (el árbol actual ya no refleja el estado de entonces; el commit con la demo es posterior a `3bbc3a2`); (2) volver a auditar `:4173` dos veces seguidas sin tocar nada y comparar: si salen `unchanged`, la diferencia de arriba fue el cambio de contenido, no ruido.

## Cómo interpretar este resultado

No es una regresión del sitio "real" sino un cambio de contenido entre dos medidas con la misma etiqueta (`demo v0`). Importa porque la comparación 1 usó como "antes" justo la auditoría `19-42-38Z`, que es la de la versión _ya empeorada_ (score 41); la de `19-41-55Z` tenía score 57. La mejora 41 → 99 de la comparación 1 está medida frente a esa línea base degradada, no frente a la anterior.

## Siguiente paso

¿Confirmas que se cambió la librería entre las dos auditorías (o que `19-42-38Z` es la línea base "rota" que querías)? Si la regresión fuera de un sitio real y se confirmara, ofrecería `perf-fix`; aquí no hay nada que corregir en código, solo decidir qué reporte es la referencia. No se ha editado código.
