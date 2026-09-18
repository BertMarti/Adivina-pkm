# ⚡ Resumen visual de PokéQuién

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
- Poké Ball de espera basada en el GIF pixel-art proporcionado, con fondo eliminado, recorte responsive y fallback estático para movimiento reducido.
- Pikachu animado como compañero visual en la espera del rival.
- Cuadrículas responsive de cinco columnas, con retrato, nombre y número Dex.
- X roja grande, animada y visible en toda la casilla.
- Modal de resultado centrado, desplazable y preparado para pantallas pequeñas.
- Marca `PokéQuién`, título de pestaña actualizado e icono pixel-art propio: Poké Ball central, dos tarjetas enfrentadas y acento eléctrico amarillo, preparado para máscaras cuadradas o redondeadas.
- CTA grande y contrastado de `JUGAR CONTRA LA MÁQUINA`, visible desde el menú principal.

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
victoria    ──▶ audio de victoria, una sola vez para el ganador
derrota     ──▶ tono de derrota para el jugador perdedor
```

## 🧠 Modo solitario

- Catálogo local completo de Kanto (151) para empezar al instante.
- Pokédex nacional local (1.025 candidatos) sin dependencia de red para los datos.
- Preguntas de tipo, colores, animal de inspiración, silueta y situaciones cotidianas deterministas.
- No se usan preguntas de número de Pokédex, rango nacional, peso, región ni generación.
- Preguntas binarias de ganancia de información.
- Cinco pistas genéricas de evolución también disponibles en el catálogo nacional.
- El Pokémon elegido permanece visible para el jugador durante toda la ronda de preguntas.
- La elección secreta permanece fuera del conocimiento de la máquina.
- Historial local de preguntas, respuestas y resultados.
- Selector tipo Akinator: creencia probabilística, ganancia de información y exploración reproducible entre preguntas casi equivalentes.
- Ganancia de información posterior: la siguiente pregunta tiene en cuenta la tolerancia a respuestas imperfectas (`0,9` / `0,1`) y no solo el corte bruto del catálogo.
- Base de curiosidades para el popup final.

## 📚 Documentación creada

- `AGENT_CONTEXT.md`: reglas de colaboración y mapa del proyecto.
- `UI_UX_NOTES.md`: responsive, estados y accesibilidad.
- `AUDIO_NOTES.md`: eventos y criterios de calidad sonora.
- `SPRITECOLLAB_ASSET_NOTES.md`: URLs, fondo y fallbacks.
- `ROOM_RECONNECT_CONTRACT.md`: contrato de sala, reconexión y rematch.
- `USER_GUIDE.md`: instrucciones para jugadores.
- `PROJECT_VISUAL_SUMMARY.md`: este resumen visual.
- `WORK_COMPLETION_REPORT.md`: informe final con métricas, QA, seguridad y próximos pasos.
- `SOLO_PLAYER_IMPROVEMENT_REPORT.md`: arquitectura del razonamiento adaptativo, historial local, smoke actual y roadmap del modo solitario.
- `WAITING_SCREEN_MEDIA_REVIEW.md`: tratamiento de los GIF, transparencia, fallback accesible y composición de la pantalla de espera.
- `APP_ICON_IDENTITY.md`: concepto, variantes y criterios del nuevo icono móvil/web.

## 🧾 Créditos

Inspirado por **Checo_512** y su juego [Adivina Quién Pokémon](https://adivina-quien-pokemon.vercel.app/). Retratos de [SpriteCollab (PMD)](https://github.com/PMDCollab/SpriteCollab). Datos de [PokéAPI](https://pokeapi.co/).
