# Adivina Quién Pokémon · móvil

Primera versión ejecutable de una app móvil inspirada en la experiencia de [Adivina Quién Pokémon](https://adivina-quien-pokemon.vercel.app/).

## Qué incluye la primera versión

- Crear una sala compartida con un identificador humano de 8 caracteres y entrar desde un segundo dispositivo, emulador o pestaña. La pantalla inicial ya muestra un código preparado; `COPIAR ENLACE` activa esa sala si todavía no se ha pulsado `CREAR SALA` y copia la invitación real.
- Abrir un enlace `/?room=CODIGO` en web o `adivinapokemon://join?room=CODIGO` en la app para rellenar el código y conectarse automáticamente.
- Selector de generación: Todas, 1ª a 9ª.
- Carga de nombres, tipos y peso desde [PokéAPI](https://pokeapi.co/), con caché en memoria y fallback local de Kanto.
- Retratos normales de [SpriteCollab PMD](https://github.com/PMDCollab/SpriteCollab), con fallback a sprites de PokeAPI si un retrato no está disponible.
- Selección privada e inmediata del Pokémon secreto de cada jugador, sin pantalla de transferencia.
- Si un jugador elige antes, ve una espera con Poké Ball animada mientras el rival conserva la cuadrícula de elección.
- Dos tableros de 25 casillas (cuadrícula 5×5), con retratos pixelados responsive y nombres disponibles para accesibilidad.
- El propio secreto se muestra al jugador; el del rival queda oculto como `?` hasta el final.
- Ambos jugadores ven ambos tableros, pero solo pueden tachar y destachar las casillas de su propio tablero.
- Tocar una casilla la tacha con una X animada y cambia el retrato a una expresión triste; tocarla de nuevo la recupera y sincroniza el cambio.
- Al seleccionar y destachar se reproduce el audio local de referencia indicado por el usuario; al tachar se usa un efecto genérico local y al ganar el audio local de victoria. También hay respuesta háptica en móvil.
- Fin automático cuando queda un único candidato y coincide con el secreto rival. El servidor vuelve a comprobar esta condición de forma autoritativa antes de cerrar la sala.
- Al finalizar se revelan ambos secretos y aparece el popup de `VICTORIA`/derrota con descripción y hasta tres datos curiosos del Pokémon descubierto.
- Controles nativos, etiquetas accesibles, soporte de movimiento reducido y áreas táctiles amplias.
- Dirección visual arcade inspirada en las referencias: tipografía pixel, scanlines CRT, `assets/fondo_ejemplo.png` como fondo responsive, marcos oscuros y botones con relieve. El título principal flota suavemente en bucle y respeta movimiento reducido.

## Modo 1 jugador

El botón `JUGAR CONTRA LA MÁQUINA` abre un flujo independiente: el jugador elige un Pokémon, la aplicación selecciona preguntas binarias por ganancia de información y el jugador responde únicamente `SÍ` o `NO`. La máquina no recibe el secreto elegido; solo conserva el catálogo y filtra candidatos a partir de las respuestas. Cuando queda una propuesta, la aplicación pide confirmación; un `NO` descarta esa propuesta y permite continuar.

- Kanto funciona sin esperar a la red, con 25 candidatos y 95 preguntas semánticas.
- `CARGAR POKÉDEX NACIONAL · 1.025` carga bajo demanda los 1.025 Pokémon de PokéAPI y genera más de mil cortes de Pokédex, además de preguntas de tipo, peso y categoría.
- Se puede buscar por nombre antes de elegir, cada retrato muestra su número Dex y las imágenes mantienen el fallback de PokeAPI.
- `src/data/pokemonFacts.ts` aporta tres curiosidades para Kanto y tres datos deterministas de respaldo para cada entrada nacional.
- Cada sesión guarda preguntas, respuestas, candidatos restantes, resultado, versión del catálogo y Pokémon elegido en almacenamiento local mediante AsyncStorage.
- `COPIAR JSON` exporta el historial local; `BORRAR` lo elimina explícitamente.

La base de conocimiento está en `src/data/singlePlayerKnowledge.ts`, los datos curiosos en `src/data/pokemonFacts.ts` y el motor puro en `src/game/singlePlayerEngine.ts`.

Los audios descargados se empaquetan localmente en `assets/selection-reference.wav` y `assets/victory-reference.wav`; sus URL originales se conservan como referencia en el historial de cambios. Antes de distribuir públicamente hay que comprobar los derechos de uso de esos audios y de la marca Pokémon.

## Ejecutar

```bash
npm install
npm run room-server
```

En otra terminal, inicia la app:

```bash
npm run web
```

Después:

- `npm run web` abre una previsualización en navegador.
- `npm run android` abre el proyecto en un emulador/dispositivo Android con Expo.
- En iOS, abre el proyecto con Expo Go en un dispositivo o usa `npm run ios` desde macOS.

Para ejecutar la campaña automatizada de muchas partidas y guardar cada respuesta:

```bash
npm run single-player:soak
npm run single-player:merge
```

El primer comando genera un lote en `artifacts/single-player-soak-results.json`; acepta `SINGLE_PLAYER_SOAK_RUNS`, `SINGLE_PLAYER_SOAK_SEED`, `SINGLE_PLAYER_SOAK_AGENT_ID` y `SINGLE_PLAYER_SOAK_OUTPUT` para lanzar workers independientes. El segundo fusiona los JSON de `artifacts/soak-shards/`, elimina sesiones duplicadas y añade estadísticas por pregunta en `artifacts/single-player-soak-results-merged.json`.

La campaña ampliada verificada contiene 320.025 sesiones, 1.505.505 preguntas y 487 MB de JSON detallado, con 288.100 victorias y 31.925 derrotas/inconsistencias. Cada sesión conserva la secuencia de preguntas, respuestas, candidatos antes/después y candidatos restantes.

La app web usa `ws://localhost:8787` automáticamente. Para un móvil físico conectado a la misma red Wi-Fi, arranca Expo apuntando a la IP del ordenador y define la URL del servidor antes de iniciar:

```powershell
$env:EXPO_PUBLIC_ROOM_SERVER_URL = "ws://IP-DE-TU-ORDENADOR:8787"
npm run start
```

## Arquitectura y alcance local

La lógica de las reglas está aislada en `src/game/engine.ts`. `src/game/roomClient.ts` conecta la app con el servidor WebSocket de `server/room-server.js`. El servidor asigna J1/J2, mantiene el estado autoritativo, valida el tablero, selecciones y tachados, limita el payload y no envía el secreto rival hasta que la partida termina.

El servidor de esta primera versión es intencionadamente local y en memoria: al reiniciarlo o cerrar un cliente antes del final se cierran/eliminan las salas. Para producción conviene sustituirlo por un backend persistente y autenticado (por ejemplo Firebase RTDB + Cloud Functions/Cloud Run o WebSocket con base de datos), manteniendo los secretos en datos privados por jugador.

El código de sala es un identificador de invitación, no un secreto de sesión. En producción debe llevar expiración, rate limit, no reutilizar salas activas y un token de sesión separado.

## Créditos y distribución

SpriteCollab publica sus materiales bajo CC BY-NC 4.0 con atribución. Antes de distribuir una app comercial hay que revisar la licencia de cada recurso, conservar los créditos y confirmar también los derechos de la marca Pokémon. Esta app se presenta como fan project no oficial y sin fines comerciales.

PokéAPI es una API de consumo sin autenticación. Su política recomienda limitar solicitudes y cachear recursos; por eso el cliente mantiene la Pokédex cargada durante la sesión y el MVP incorpora un roster local de fallback.
