# Resumen visual del trabajo realizado

## ✨ Resultado

```text
┌──────────────┐      ┌──────────────┐
│   CREAR      │ ───▶ │   ELEGIR     │
│   SALA       │      │   1 de 25    │
└──────────────┘      └──────┬───────┘
                             │
                ambos eligen │
                             ▼
┌──────────────┐      ┌──────────────┐
│  MI TABLERO  │ ◀──▶ │ TABLERO      │
│  X roja      │      │ RIVAL        │
└──────┬───────┘      └──────────────┘
       │ queda el secreto rival
       ▼
┌────────────────────────────────────┐
│ VICTORIA · sprite · curiosidades   │
│ [ JUGAR DE NUEVO ]                  │
└────────────────────────────────────┘
```

## 🎨 Cambios visuales

- Fondo local inspirado en la web de SpriteCollab, con oscurecido y scanlines.
- Título principal con flotación suave y respeto por movimiento reducido.
- Poké Ball de espera con desplazamiento lateral, rotación, rebote y escala sutiles.
- Cuadrículas responsive de cinco columnas, con retrato, nombre y número Dex.
- X roja grande, animada y visible en toda la casilla.
- Modal de resultado centrado, desplazable y preparado para pantallas pequeñas.

## 🎮 Cambios de jugabilidad

- Selección directa en la tabla sin “pasar el móvil”.
- El rival permanece oculto hasta el final.
- Tachado y destachado solo del tablero propio.
- Victoria autoritativa cuando queda exactamente el secreto rival.
- Rematch en la misma sala.
- Reconexión con conservación de estado durante 60 segundos.
- Estado `abandoned` y retorno al menú si no hay reconexión.

## 🔊 Cambios de audio

```text
seleccionar ──▶ tono de referencia
tachar      ──▶ confirmación corta
destachar   ──▶ tono de referencia
victoria    ──▶ audio de victoria, una sola vez
```

## 🧠 Modo solitario

- Catálogo local de Kanto para empezar al instante.
- Pokédex nacional bajo demanda.
- Preguntas binarias de ganancia de información.
- La elección secreta permanece fuera del conocimiento de la máquina.
- Historial local de preguntas, respuestas y resultados.
- Base de curiosidades para el popup final.

## 📚 Documentación creada

- `AGENT_CONTEXT.md`: reglas de colaboración y mapa del proyecto.
- `UI_UX_NOTES.md`: responsive, estados y accesibilidad.
- `AUDIO_NOTES.md`: eventos y criterios de calidad sonora.
- `SPRITECOLLAB_ASSET_NOTES.md`: URLs, fondo y fallbacks.
- `ROOM_RECONNECT_CONTRACT.md`: contrato de sala, reconexión y rematch.
- `USER_GUIDE.md`: instrucciones para jugadores.
- `PROJECT_VISUAL_SUMMARY.md`: este resumen visual.

## 🧾 Créditos

Inspirado por **Checo_512** y su juego [Adivina Quién Pokémon](https://adivina-quien-pokemon.vercel.app/). Retratos de [SpriteCollab (PMD)](https://github.com/PMDCollab/SpriteCollab). Datos de [PokéAPI](https://pokeapi.co/).

