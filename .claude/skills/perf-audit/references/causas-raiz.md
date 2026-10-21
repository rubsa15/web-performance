# Mapa de ids de auditoría → causa raíz

Ids de Lighthouse 13 tal y como salen en `opportunities[].id`. La columna "esfuerzo típico" es una **hipótesis de partida**: ajústala tras mirar el código.

| Causa raíz                          | Ids que la componen                                                   | Qué significa                                                                                     | Esfuerzo típico                                                      |
| ----------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Imágenes sin optimizar              | `image-delivery-insight`, `total-byte-weight`, `uses-optimized-images`, `modern-image-formats` | Imágenes más pesadas de lo necesario (resolución, compresión, formato, sin `srcset`)               | M (regenerar variantes + `srcset`/`sizes`); S si solo hay que comprimir |
| LCP tardío por descubrimiento       | `lcp-discovery-insight`, `network-dependency-tree-insight`            | El recurso LCP se descubre o prioriza tarde (sin `fetchpriority`, cadena de dependencias)          | S (`fetchpriority="high"`, `preload`)                                |
| Imágenes sin dimensiones            | `unsized-images`, `cls-culprits-insight`                              | Sin `width`/`height` el navegador no reserva espacio y el contenido salta (CLS)                    | S                                                                    |
| Recursos que bloquean el render     | `render-blocking-insight`, `render-blocking-resources`                | CSS/JS síncronos en `<head>` retrasan el primer pintado (FCP/LCP)                                  | S (`defer`/`async`, CSS crítico en línea) a M                        |
| JavaScript sin usar o excesivo      | `unused-javascript`, `legacy-javascript`, `duplicated-javascript-insight`, `unminified-javascript` | Se descarga y parsea código que la página no ejecuta                                              | S si se puede eliminar; M–L si requiere code-splitting               |
| Hilo principal ocupado (TBT)        | `bootup-time`, `mainthread-work-breakdown`, `long-tasks` (diagnóstico), `third-parties-insight` | Tareas largas de JS bloquean la interactividad                                                    | M–L (trocear trabajo, mover a worker, diferir)                       |
| Fuentes web                         | `font-display-insight`                                                | Sin `font-display` el texto queda invisible o salta al cargar la fuente                            | S                                                                    |
| Servidor / red                      | `server-response-time` (diagnóstico), `redirects`, `uses-text-compression` | TTFB alto, redirecciones o texto sin comprimir                                                    | M (depende de infraestructura; fuera del repo de la web a menudo)   |
| Vídeo y otros `media` pesados       | *(sin oportunidad propia)* → `resources.byType.media`, `total-byte-weight`, `cache-insight` | Vídeos con `autoplay` o sin `preload="none"`/póster descargan MiB que no hacen falta al cargar. **Hallazgo indirecto**: verificar en el HTML | S (`preload="none"`, póster, diferir) a M |
| Imágenes bajo el pliegue sin lazy   | *(sin oportunidad propia)* → `resources.byType.image`, `total-byte-weight` | Se descargan imágenes que no se ven al cargar. **Hallazgo indirecto**: verificar en el HTML         | S (`loading="lazy"`, `decoding="async"`)                             |

## Notas

- `image-delivery-insight` puede cubrir a la vez la imagen hero (LCP) y las de la galería: los `items[]` dicen cuáles. Separa la fila (hero / resto) cuando el arreglo difiere, no por el tamaño: el hero se arregla con `srcset`/`sizes`/`fetchpriority`; la galería, con compresión y `loading="lazy"`.
- `bootup-time` y `mainthread-work-breakdown` suelen repetir el mismo ahorro de TBT: es un único problema, no dos. `items[]` de `bootup-time` indica qué script gasta CPU (`cpuMs`).
- `cache-insight` y `uses-long-cache-ttl` hablan de visitas repetidas: no son causa de métricas de primera carga.
- Un id que no esté aquí: agrúpalo por su `category` y trátalo como causa propia, diciendo que no está en el mapa.
- Una causa en la tabla no implica que exista en la web auditada: solo se incluye lo que aparece en el reporte.
