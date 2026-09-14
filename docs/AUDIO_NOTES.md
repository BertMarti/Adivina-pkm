# Audio y feedback

## Mapa de sonidos

| Evento | Fuente actual | Feedback adicional |
|---|---|---|
| Elegir secreto | `assets/selection-reference.wav` | Haptic de selección en móvil. |
| Tachar | Efecto local corto `CROSS_WAV` | Haptic de aviso; debe ser seco pero no agresivo. |
| Destachar | `assets/selection-reference.wav` | Haptic de selección. |
| Victoria | `assets/victory-reference.wav` | Haptic de éxito. |

Los audios descargados conservan las URLs de referencia en comentarios de `src/audio/sounds.ts`. Antes de distribuir públicamente hay que revisar derechos de uso del audio y de la marca.

## Reglas de reproducción

1. Reiniciar el reproductor con `seekTo(0)` antes de reproducir.
2. La victoria se dispara una sola vez por transición a `finished`; existe una ventana anti-duplicado.
3. En web, mantener un tono Web Audio de respaldo por si el reproductor nativo no puede reproducir el recurso.
4. No bloquear la interacción si el audio falla.
5. Reducir volumen y duración antes que competir con el contenido visual.

## Criterio de calidad

El tachado debe sonar como una confirmación rápida de interfaz, no como ruido fuerte. La selección y el destachado deben compartir el tono de confirmación elegido por el usuario. La victoria debe ser identificable, breve y no repetirse dos veces por una actualización duplicada del servidor.

