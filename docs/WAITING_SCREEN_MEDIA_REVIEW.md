# 🎬 Revisión visual de la pantalla de espera

**Fecha:** 18/09/2026  
**Pantalla:** `waiting-for-selection`  
**Objetivo:** mantener la estética pixelada de PokéQuién y hacer que la espera
sea comprensible, responsive y agradable en móvil.

## Cambios aplicados

- 🟡 Se sustituyó la Poké Ball dibujada con CSS por la animación adjunta
  `assets/pokeball-capture.gif`.
- 🧼 Se eliminó el fondo claro del GIF mediante transparencia por fotograma y
  se recortó el lienzo para que la Poké Ball no aparezca diminuta dentro de un
  canvas de 800×600.
- ♿ Se añadió `assets/pokeball-capture-static.png` para `prefers-reduced-motion`.
- 🧩 La pantalla ahora está contenida en una tarjeta con estado `SALA · LISTA`,
  pastilla `EN ESPERA`, título en dos líneas, conector visual entre el Pokémon
  propio y la Poké Ball, tarjeta del secreto guardado y mensaje de arranque
  automático.
- 🧱 El Pokémon propio ya no aparece sobre un círculo: ahora usa una tarjeta
  rectangular pixelada con marco interior, etiqueta `TU SECRETO` y nombre.
- ✨ La flecha amarilla se sustituyó por un indicador neutral de conexión con
  tres nodos pixelados, evitando una dirección visual tosca o ambigua.
- ⚡ Se incorporó `assets/pikachu-flight.gif` como acompañante visual de la
  espera, manteniendo el fondo transparente y el estilo pixel.

## Criterios responsive

- La tarjeta usa `width: 100%` y `maxWidth`, no posiciones absolutas.
- El contenido está dentro de `ScrollView`, por lo que un móvil pequeño no
  pierde el mensaje ni el nombre del Pokémon.
- La Poké Ball usa una imagen contenida y un tamaño estable, evitando que el
  GIF original dependa de la resolución del dispositivo.
- La animación completa se sustituye por una versión estática cuando el usuario
  tiene activado reducir movimiento.
- La pantalla conserva contraste, texto de estado y áreas táctiles compatibles
  con el resto de la aplicación.

## Archivos

| Archivo | Uso |
|---|---|
| `assets/pokeball-capture.gif` | Animación principal de espera. |
| `assets/pokeball-capture-static.png` | Fallback accesible sin movimiento. |
| `assets/pikachu-flight.gif` | Detalle decorativo de la pantalla de espera. |
| `App.tsx` | Composición de `PokeballCapture`, `WaitingScreen` y estilos. |

Los GIF son assets locales proporcionados para este proyecto. Si se redistribuye
la aplicación, conserva la atribución y revisa las condiciones de uso del autor
del material original.
