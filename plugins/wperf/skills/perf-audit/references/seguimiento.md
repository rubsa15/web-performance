# Avisar al usuario mientras corre la auditoría

Paso 1 de `perf-audit`, cuando se audita una URL. Cada perfil tarda de medio minuto a varios y, con el comando en segundo plano, el usuario no ve nada salvo lo que le escribas.

## Qué escribe el CLI en stderr (`$OUT/progreso.log`)

Con varios perfiles, cada línea lleva el perfil delante:

```
[mobile/default] Auditando http://… (mobile, 3 ejecuciones)…
[mobile/default] ejecución 1/3
[mobile/default] Reporte guardado en .perf/reports/…
[mobile/3g] Error: …
Terminado: 2 de 3 perfiles medidos; fallaron mobile/3g.
```

`Terminado` es siempre la última línea. Con un solo perfil las líneas no llevan prefijo y no hay `Terminado`.

## Pasos

1. Lanza el comando **en segundo plano** (`run_in_background`). Es uno solo para todos los perfiles: no lances un comando por perfil ni dos a la vez.
2. Engancha `Monitor` al fichero de progreso con un filtro que deje pasar solo los eventos útiles, p. ej. `tail -n +1 -F $OUT/progreso.log | grep --line-buffered -E "Auditando|ejecución|Reporte guardado|rror|Terminado"`. Si `Monitor` aparece como herramienta diferida, cárgala antes con `ToolSearch`. Páralo con `TaskStop` cuando llegue `Terminado` o cuando te avisen de que el comando en segundo plano ha acabado (con un solo perfil no hay `Terminado`).
3. **Por cada evento que reciba el monitor, escribe al usuario una línea corta** ("`mobile/3g`: ejecución 2/3 en curso", "`mobile/default` guardado, empieza `mobile/3g`"). `ejecución n/N` se emite al *empezar* esa ejecución, así que no digas que la anterior "ha terminado" salvo con la línea `Reporte guardado`. Son avisos de estado: sin cifras de métricas y sin interpretar nada hasta tener todos los reportes.
4. Al terminar, manda además una notificación con `PushNotification` (también diferida: cárgala con `ToolSearch`), de una línea: sitio, perfiles medidos y fallidos (sale de `Terminado`). Sin cifras de rendimiento. Si falla un perfil, la notificación debe decirlo.
5. Si `Monitor` o `PushNotification` no están disponibles, avisa de ello, lanza igualmente el comando en segundo plano y escribe al usuario cuando termine.
