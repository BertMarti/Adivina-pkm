# Contexto técnico del proyecto

> Estado de referencia comprobado el 14/09/2026. Este documento describe la implementación que existe actualmente en el repositorio, no una arquitectura futura.

## 1. Objetivo y alcance

**Adivina Quién Pokémon** es un prototipo mobile-first de un juego de deducción para dos jugadores. Cada jugador comparte una sala, recibe la misma cuadrícula de 25 Pokémon, elige en privado un Pokémon secreto y va descartando candidatos de su propio tablero hasta dejar uno. Gana quien deja como único candidato el secreto del rival.

El cliente funciona en web, Android e iOS mediante Expo/React Native. La primera versión está pensada para jugar en local o dentro de una red de confianza: el servidor de salas es un proceso Node.js con estado en memoria y WebSocket. No es todavía un servicio multiusuario persistente ni un backend listo para producción.

El producto busca conservar la lectura inmediata de las referencias visuales: tablero 5×5, dos lados enfrentados, estados muy visibles, estética pixel/arcade y una espera explícita mientras el oponente completa una acción.

## 2. Arquitectura actual

### Capas

- **Presentación y orquestación — `App.tsx`**: contiene la navegación por estado (`home`, `room`, `selection`, `waiting`, `game`, `single-player`), los componentes de pantalla, la carga de fuentes, audio/hápticos, clipboard, compartir, enlaces de invitación, reconexión y accesibilidad.
- **Dominio puro — `src/game/engine.ts`**: define `LocalGameState`, fases, jugadores y transiciones puras para crear partida, empezar selección, seleccionar secreto, empezar juego y tachar/destachar candidatos. No tiene efectos de red, UI ni almacenamiento.
- **Transporte de sala — `src/game/roomClient.ts`**: cliente WebSocket con URL configurable, timeout inicial de 5 segundos, serialización de `create`, `join`, `reconnect`, `select`, `toggle` y `rematch`, sesión persistente y reintentos durante la ventana de reconexión.
- **Servidor autoritativo local — `server/room-server.js`**: servidor HTTP/WebSocket basado en `ws`. Asigna `p1`/`p2`, conserva salas en un `Map`, valida el esquema del tablero, acciones y generación, calcula el ganador y emite una proyección privada del estado a cada socket. Limita cada payload WebSocket a 64 KiB y evita asociar una conexión a más de una sala.
- **Datos — `src/data/pokemon.ts`**: catálogo de generaciones, roster local de Kanto, carga de PokéAPI, traducción de tipos, metadatos derivados, selección aleatoria y caché de rosters en memoria.
- **Audio — `src/audio/sounds.ts`**: efecto PCM corto para tachar. `App.tsx` reproduce localmente los WAV de selección/victoria descargados por petición del usuario y usa un respaldo con `AudioContext` en web; la victoria se protege contra doble reproducción.

El servidor JavaScript replica actualmente parte de las reglas de `engine.ts` porque no importa el módulo TypeScript. La máquina de estados del dominio debe seguir siendo pura; al evolucionar las reglas conviene eliminar esta duplicación mediante un módulo compartido o pruebas de contrato.

### Flujo de datos

1. El usuario crea una sala o introduce un código existente.
2. Para crear, el cliente ejecuta `loadRoster(generation)`, genera o usa un código de ocho caracteres y envía el tablero de 25 elementos al servidor.
3. El servidor guarda el tablero, la generación y los datos privados de cada jugador; devuelve `p1` en `waiting-for-player`.
4. El segundo cliente envía `join`. El servidor lo asigna como `p2`, cambia a `selecting` y hace broadcast.
5. Cada acción de selección o tachado viaja al servidor. El servidor modifica su estado y envía un `state` personalizado a cada jugador.
6. `App.tsx` aplica cada estado, sincroniza la pantalla y renderiza el tablero. Los secretos se filtran en `publicState`: cada jugador recibe el suyo; el secreto rival es `null` hasta `finished`.

## 3. Archivos y responsabilidades

| Archivo | Responsabilidad actual |
| --- | --- |
| `App.tsx` | Aplicación completa: pantallas de inicio, sala, selección, espera y partida; composición de tableros; visuales retro; enlaces; compartir; clipboard; sonidos; hápticos; movimiento reducido; manejo de errores. |
| `index.ts` | Punto de entrada Expo mediante `registerRootComponent(App)`. |
| `src/game/engine.ts` | Tipos `PlayerId`, `LocalPhase`, `PlayerState`, `LocalGameState` y transiciones puras. |
| `src/game/roomClient.ts` | Cliente WebSocket y tipos `RoomGameState`/mensajes de sala. Usa `EXPO_PUBLIC_ROOM_SERVER_URL` o defaults por plataforma. |
| `server/room-server.js` | HTTP health check y servidor WebSocket local. Mantiene salas en memoria, proyecta secretos, valida acciones, conserva tokens de sesión, reconexión de 60 s y rematch. |
| `src/data/pokemon.ts` | `GenerationId`, `PokemonCandidate`, generaciones 1–9, `BOARD_SIZE = 25`, roster local de Kanto y carga/caché de PokéAPI. |
| `src/audio/sounds.ts` | Constantes WAV embebidas para selección, tachado y restauración. |
| `assets/spritecollab-background.png` | Fondo local obtenido de la web de SpriteCollab, usado como `ImageBackground`, oscurecido y cubierto con scanlines CRT. |
| `assets/icon.png`, `android-icon-*`, `splash-icon.png`, `favicon.png` | Iconos y recursos declarados por `app.json` para Android, web y splash. |
| `app.json` | Configuración Expo: nombre, slug, scheme `adivinapokemon`, orientación vertical, iconos, identificadores Android/iOS y plugins de audio, assets y fuentes. |
| `package.json` / `package-lock.json` | Dependencias y scripts de Expo, React Native, WebSocket, fuentes, audio, clipboard, hápticos y TypeScript. |
| `README.md` | Guía visual para jugadores, sin instrucciones técnicas de arranque. |
| `docs/*.md` | Contexto compartido, notas UX/audio/sprites, contrato de sala, guía de usuario y resumen visual. |
| `AGENTS.md` | Restricciones de mantenimiento: dominio puro, secretos privados, imágenes remotas con fallback/atribución y accesibilidad móvil. |

El estado `roster` de `App.tsx` conserva el roster cargado, pero la UI renderiza el tablero que llega en `game.board`; el valor no se usa después de guardarlo. `PokemonTile` muestra ahora retrato, nombre y número Dex en una casilla cuadrada responsive.

## 4. Estado, flujo de sala y fases

### Estado compartido

`RoomGameState` extiende `LocalGameState` con `generation`:

- `phase`: una de `waiting-for-player`, `selecting`, `waiting-for-selection`, `playing`, `finished` o `abandoned`.
- `roomCode`: identificador de invitación.
- `generation`: `all` o una generación de 1 a 9.
- `board`: exactamente 25 `PokemonCandidate` con id, nombre, tipos, peso, URLs y metadatos.
- `players.p1` y `players.p2`: `secretId` privado y lista `crossedIds` de su tablero.
- `playerCount`: 1 o 2 sockets conectados.
- `presence`: conexión actual de `p1` y `p2`; `disconnectedPlayer` y `reconnectDeadline` describen una ventana activa de reconexión.
- `winner`: `p1`, `p2` o `null`.

La proyección del servidor mantiene públicos el tablero, la generación y los descartes de ambos tableros, pero oculta el secreto del contrario. En `finished` se revelan ambos secretos a los dos jugadores.

### Fases de producto

1. **`waiting-for-player` — sala creada**
   El creador es `p1`, ve el código, puede copiarlo o compartir un enlace y espera al segundo jugador. La pantalla muestra `1 / 2 CONECTADOS`.

2. **`selecting` — sala completa**
   Al entrar `p2`, ambos ven la misma cuadrícula 5×5 y pueden pulsar una casilla para fijar su secreto. La selección se guarda de inmediato; no existe una pantalla de transferencia ni se muestra el secreto al rival.

3. **`waiting-for-selection` — selección asimétrica**
   El jugador que ya eligió ve su Pokémon y una pantalla de espera con Poké Ball animada. El jugador que aún no eligió conserva la cuadrícula de selección. En cuanto ambos tienen `secretId`, el servidor pasa automáticamente a `playing`.

4. **`playing` — deducción simultánea**
   Cada jugador ve su tablero interactivo y el tablero rival en modo consulta. El bloque central muestra `TÚ` frente a `RIVAL`; el secreto propio es visible y el rival aparece como `?`.

5. **`finished` — resultado**
   Se deshabilitan las acciones de juego, se muestra un modal de victoria o derrota desde el punto de vista local, se presenta el Pokémon ganador, se revelan ambos secretos y se muestran descripción/hasta tres curiosidades. `JUGAR DE NUEVO` limpia secretos y tachados en la misma sala para que ambos vuelvan a elegir.

6. **`abandoned` — abandono**
   Si el jugador desconectado no recupera su sesión en 60 segundos, la sala se marca como abandonada y el cliente vuelve al menú mostrando quién se fue.

### Desconexiones

Al cerrar un socket durante una partida, el servidor conserva el jugador, secreto y tachados durante 60 segundos. El cliente guarda un token de sesión local y reintenta conectarse; si vuelve dentro del plazo recupera el mismo rol. Si no vuelve, la sala entra en `abandoned`. Las partidas terminadas conservan el resultado para los clientes conectados y permiten rematch mientras la sala siga viva.

## 5. Reglas del juego

- El tablero contiene 25 Pokémon, en una cuadrícula 5×5.
- `Todas` cubre ids 1–1025 y elige 25 elementos aleatorios. Una generación concreta usa su rango nacional y toma los primeros 25 en el orden de PokéAPI; la primera generación usa el roster local de Kanto.
- El código generado por el cliente tiene ocho caracteres y usa `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, evitando caracteres ambiguos como `I`, `O`, `0` y `1`. El servidor acepta exactamente ocho caracteres `[A-Z2-9]`.
- Cada jugador puede elegir una única vez y el servidor no impide que ambos elijan el mismo Pokémon.
- Cada jugador solo puede modificar su propia lista `crossedIds`. Pulsar un candidato lo tacha; pulsarlo otra vez lo destacha.
- El servidor rechaza dejar cero candidatos sin tachar.
- Cuando el jugador deja exactamente un candidato y ese id coincide con el `secretId` privado del rival, la sala pasa a `finished` y ese jugador gana.
- No hay turnos: ambos jugadores pueden tachar en paralelo. Los descartes se sincronizan por broadcast.
- El servidor rechaza acciones fuera de fase, Pokémon que no pertenezcan al tablero, una segunda selección y una sala con más de dos jugadores.
- El código de sala es un identificador de invitación, no un secreto de sesión ni un mecanismo de autenticación.

## 6. UX y dirección visual

### Referencia visual

El fondo activo en `assets/spritecollab-background.png` procede de la web de SpriteCollab y presenta un collage/mapa pixel-art. La aplicación lo usa como fondo de pantalla completo (`ImageBackground`), añade una capa azul-negra translúcida y 80 líneas horizontales de 2 px. El fondo queda detrás de tarjetas opacas para conservar legibilidad.

La interfaz actual traduce esa referencia a:

- orientación vertical, `SafeAreaView` y contenido desplazable;
- ancho máximo de 720 px para web/tablet y adaptación del tamaño de retratos a la ventana;
- fondo casi negro, tarjetas gris carbón, tipografía pixel `PressStart2P`, títulos amarillos, acciones azules/naranjas y estados verde/rojo;
- marcos gruesos, sombras, botones con relieve y cabeceras centradas con regla horizontal;
- estados de pulsación, X grande visible para el tachado y cambio a retrato `Sad`, de modo que el estado no depende solo del color.

### Pantallas y acciones

- **Inicio**: logotipo `ADIVINA QUIÉN`, subtítulo de sala multijugador, selector horizontal de `Todas`/generaciones, código de invitación pre-generado, `COPIAR ENLACE`, `CREAR SALA`, campo de código rival, `CONECTAR` y acceso rápido `CREAR SALA DE PRUEBA KANTO`. Si se copia desde esta pantalla, la sala se crea con ese mismo código antes de copiar el enlace. Los errores aparecen como alerta.
- **Sala**: muestra generación, código, `COPIAR CÓDIGO`, `COPIAR ENLACE`, contador de conexiones y un estado de espera o de sala completa.
- **Selección**: título “ELIGE TU POKÉMON SECRETO”, jugador y sala, cuadrícula 5×5; la casilla elegida queda resaltada en amarillo y la acción se envía inmediatamente.
- **Espera**: enseña el secreto propio, mensaje de espera y una Poké Ball animada que se desplaza entre un objetivo y el centro. Con `prefers-reduced-motion`/ajuste de accesibilidad la animación queda estática.
- **Partida**: barra con salir, sala y estado; tablero propio con contador de Pokémon libres y ayuda de tachar/destachar; separador `VS`; tablero rival con contador y mensaje de solo consulta. Solo el tablero propio activa `toggle`.
- **Resultado**: tarjeta de `VICTORIA` o `HAS PERDIDO`, texto contextual, retrato y dato curioso del Pokémon descubierto (el último candidato que coincide con el secreto rival), revelación de ambos secretos con descripción y dato, bloque de información del descubierto y botón `JUGAR DE NUEVO`.

### Accesibilidad y feedback

Hay `accessibilityRole`/`accessibilityState` en botones, radios, casillas y campo de código; las casillas exponen nombre y estado (`disponible`, `seleccionado`, `tachado`), los errores usan `accessibilityRole="alert"` y se mantiene un título de pantalla oculto para tecnologías de asistencia. Se respetan `AccessibilityInfo.isReduceMotionEnabled()` y `prefers-reduced-motion` en web. En nativo se añade háptica: selección/restauración para acciones leves, warning para tachado y success para victoria.

La accesibilidad es funcional pero todavía requiere auditoría: los botones principales son de 51 px, las casillas de al menos 48 px y el chip de generación de 44 px; los controles de volver y salir tienen áreas táctiles ampliadas. Los nombres se dibujan en cada casilla y también se exponen por etiqueta de accesibilidad; los contrastes no están medidos de forma automatizada.

## 7. Datos y assets externos

### PokéAPI

Para generaciones distintas de la 1, `loadRoster` llama a:

```text
GET https://pokeapi.co/api/v2/pokemon?limit=<rango>&offset=<inicio-1>
GET <url individual>     # hasta 25 detalles en paralelo
```

De cada detalle usa id, nombre, tipos, peso y sprites. El peso de PokéAPI, expresado en hectogramos, se convierte a kg dividiendo entre 10. Los nombres se pasan a title case, los tipos se traducen al español y se deriva una descripción y un dato con número de Pokédex/peso. `legendaryIds` es una lista manual; los Pokémon remotos llevan `stage: 0` y `stageKnown: false`, por lo que aún no hay cálculo de líneas evolutivas.

El roster local `LOCAL_KANTO_ROSTER` contiene exactamente los ids 1–25, con nombres, tipos, fase evolutiva, pesos, descripciones y datos preparados. Sirve para la generación 1 y para el botón de demo. La caché de rosters es un `Map` en memoria del proceso de cada cliente; no es una caché persistente de red.

### SpriteCollab PMD y fallback

Los retratos principales se construyen con estas URLs de SpriteCollab:

```text
https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/<id de 4 dígitos>/Happy.png
https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/<id de 4 dígitos>/Normal.png
https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/<id de 4 dígitos>/Sad.png
```

`Happy` se usa en la mayoría de vistas, `Normal` en la espera/captura y `Sad` en candidatos tachados. El componente `Portrait` avanza por una cadena de fallback específica, priorizando otro retrato de SpriteCollab antes de llegar a PokeAPI:

```text
https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/<id>.png
```

Si PokéAPI entrega otro sprite oficial o `front_default`, se usa como último fallback. Las imágenes remotas son dependencias externas: tienen fallback de componente, pero actualmente no hay caché de archivos, precarga, placeholder específico ni modo offline. Hay que conservar atribución de SpriteCollab y revisar licencia de cada recurso antes de distribución comercial. El texto de créditos actual presenta el proyecto como fan project no oficial; también deben revisarse los derechos de la marca Pokémon.

## 8. Ejecución local

Requisitos prácticos: Node.js/npm instalados y dependencias del proyecto. En la comprobación actual se usaron Node `v24.19.0`, npm `11.17.0` y Expo CLI `57.0.24`.

Instalación:

```powershell
npm install
```

Arrancar el servidor de salas en una terminal:

```powershell
npm run room-server
```

El servidor escucha por defecto en `ws://0.0.0.0:8787`; su endpoint HTTP de health check responde en `http://localhost:8787` con `{ "ok": true, "rooms": <n> }`.

Arrancar la aplicación en otra terminal:

```powershell
npm run web       # previsualización web
npm run start     # Expo interactivo
npm run android   # Expo + emulador/dispositivo Android
npm run ios       # Expo + iOS; requiere macOS/Xcode
```

Comprobación de tipos:

```powershell
npm run typecheck
```

En web, el default del cliente es `ws://<hostname de la ventana>:8787`. En Android emulado, el default nativo es `ws://10.0.2.2:8787`. Un móvil físico debe apuntar a la IP LAN del ordenador y ambos dispositivos deben estar en la misma red Wi-Fi.

## 9. Variables de entorno y enlaces

| Variable | Uso | Default / ejemplo | ¿Secreto? |
| --- | --- | --- | --- |
| `ROOM_SERVER_PORT` | Puerto del proceso `server/room-server.js`. | `8787`; por ejemplo `18787` para una prueba aislada. | No. |
| `EXPO_PUBLIC_ROOM_SERVER_URL` | URL WebSocket que usa el cliente Expo. | `ws://192.168.1.20:8787` o `wss://...` en despliegue seguro. | No; el prefijo `EXPO_PUBLIC_` la expone al bundle. |

Ejemplo PowerShell para un móvil físico:

```powershell
$env:EXPO_PUBLIC_ROOM_SERVER_URL = "ws://IP-DE-TU-ORDENADOR:8787"
npm run start
```

No hay API keys ni secretos configurados. El código se puede compartir como enlace: en web se genera `/?room=<codigo>` sobre el origen actual; en nativo se genera `adivinapokemon://join?room=<codigo>` mediante el `scheme` de `app.json`. `App.tsx` procesa la URL inicial y los eventos de enlace, rellena el código y trata de unirse automáticamente.

## 10. Pruebas y verificaciones realizadas

Resultados de esta revisión:

- `npm run typecheck` — **correcto**, `tsc --noEmit` terminó sin errores.
- Smoke test efímero del protocolo WebSocket en el puerto aislado `18787` — **correcto**: creó una sala, unió a `p2`, verificó el cambio `waiting-for-player → selecting`, comprobó que la selección de cada jugador permaneciera privada, verificó `playing` tras ambas selecciones y confirmó que un `toggle` se sincronizara a los dos clientes. El proceso de prueba se cerró al finalizar y no se modificaron archivos del repositorio.
- Inspección estática de accesibilidad, assets, variables, fases y validaciones del servidor — realizada contra `App.tsx`, `engine.ts`, `roomClient.ts`, `room-server.js`, `pokemon.ts`, `sounds.ts`, `app.json` y los assets presentes.

No existe actualmente script de test, framework de unit tests, pruebas de componentes, E2E de UI ni pipeline CI. Tampoco se ha validado aquí una build Android/iOS ni se ha hecho una auditoría visual automática en dispositivos físicos.

## 11. Limitaciones conocidas

- **Persistencia y disponibilidad**: las salas viven solo en memoria; reiniciar Node las elimina. No hay base de datos, expiración, limpieza por TTL, multi-instancia, TLS configurado, métricas ni health check operativo más allá de la respuesta básica.
- **Sesiones y reconexión**: el MVP local ya tiene token de sesión, recuperación de rol y una ventana de 60 s, pero no hay autenticación de usuario, almacenamiento seguro nativo ni protección de producción contra suplantación o robo de token.
- **Confianza en el cliente**: la creación sigue recibiendo el tablero desde el cliente, aunque el servidor ya valida estrictamente los 25 registros, ids únicos, metadatos mínimos, generación y tamaño de payload. Para producción aún conviene generar o verificar el tablero en backend, añadir rate limit y separar el código de invitación de un token de sesión.
- **Duplicación de reglas**: `engine.ts` y `server/room-server.js` implementan transiciones similares, lo que puede producir divergencias futuras.
- **Red y datos externos**: una caída de PokéAPI o de raw.githubusercontent.com puede impedir cargar una generación o dejar retratos en fallback; `Promise.all` hace fallar la carga completa si falla un detalle. No hay persistencia local de imágenes ni roster completo offline.
- **Cobertura Pokémon**: solo Kanto 1–25 está definido localmente. Las generaciones remotas no calculan evoluciones y la clasificación legendaria depende de una lista manual.
- **Experiencia de sala**: no hay chat, turnos, historial, espectadores, enlace con preview web ni confirmación antes de salir. Sí hay rematch dentro de la misma sala e indicación de reconexión.
- **Audio**: no hay ajuste de volumen ni interruptor para desactivar audio/hápticos; movimiento reducido no desactiva sonidos. La selección y el destachado usan `assets/selection-reference.wav`, la victoria usa `assets/victory-reference.wav` y el tachado mantiene un efecto genérico local. Hay que revisar derechos antes de distribución pública.
- **Accesibilidad**: falta auditoría de contraste, anuncios completos de cambios de fase y garantía de 44 px en todos los controles; la navegación por teclado web y la compatibilidad con lectores de pantalla deben probarse en dispositivos reales.
- **Licencias**: la app es fan project no oficial. SpriteCollab indica atribución y licencia CC BY-NC 4.0 en el contexto del proyecto; antes de publicar hay que verificar los términos de cada recurso, la atribución final y los derechos de Pokémon.

## 12. Próximos pasos recomendados

1. Extraer un contrato común de estado/transiciones para que servidor y cliente compartan `engine.ts` o validar ambos con tests de contrato.
2. Añadir unit tests del motor para selección duplicada, fase inválida, tachado/destachado, mínimo de un candidato y victoria; añadir integración WebSocket y E2E de dos clientes.
3. Sustituir el servidor en memoria por backend persistente con sesiones separadas, secreto por jugador, TTL de salas, reconexión segura, validación de payloads, rate limit y `wss`/TLS.
4. Mejorar datos y resiliencia: caché persistente, reintentos/backoff, fallback de roster por generación, precarga/almacenamiento de imágenes y tratamiento parcial de errores de PokéAPI.
5. Completar accesibilidad y responsive QA: elevar chips y controles auxiliares a 44 px o más, auditar contraste, añadir anuncios de estado y probar web/Android/iOS con lector de pantalla y teclado.
6. Añadir preferencias de audio/hápticos y una política explícita de movimiento reducido.
7. Hacer una pasada de QA visual sobre las capturas de referencia y pantallas pequeñas, incluyendo nombres largos, fallos de imágenes, red lenta, rotación bloqueada, desconexión y doble pulsación.
8. Preparar distribución solo después de cerrar atribuciones/licencias, configuración de producción, variables seguras, builds nativas y documentación de despliegue.

## 13. Modo 1 jugador añadido

La aplicación incluye ahora un flujo individual separado del motor de salas. Se accede desde `JUGAR CONTRA LA MÁQUINA` en la pantalla inicial.

### Flujo

1. El jugador elige en secreto un Pokémon de un catálogo buscable.
2. El motor escoge la pregunta binaria con mayor ganancia de información.
3. La UI solo ofrece `SÍ` y `NO`, muestra la pregunta actual y el número de candidatos restantes.
4. Cuando queda una propuesta, se solicita confirmación. Si la respuesta es `NO`, `rejectWinner` elimina esa propuesta y la partida continúa.
5. `VICTORIA`, contradicción o ambigüedad terminan la sesión y conservan el registro.

### Conocimiento

- `src/data/singlePlayerKnowledge.ts` contiene el catálogo local de 25 Pokémon de Kanto, 95 preguntas semánticas, líneas evolutivas, rasgos visuales y umbrales de Pokédex. `src/data/pokemonFacts.ts` aporta hasta tres datos curiosos por Pokémon: curados para Kanto y deterministas para el catálogo nacional.
- El botón `CARGAR POKÉDEX NACIONAL · 1.025` obtiene los detalles de la PokéAPI en lotes, crea 1.025 candidatos y genera 1.062 preguntas (tipo, doble tipo, legendario, peso y cortes de Pokédex). Los cortes de Pokédex permiten distinguir ids aunque no exista todavía conocimiento semántico específico para cada especie.
- Las imágenes se sirven desde SpriteCollab con fallback a PokeAPI y muestran el número Dex. El catálogo nacional se carga bajo demanda para que el inicio siga siendo rápido.
- La máquina nunca recibe `selectedPokemonId`: el secreto permanece en el estado local de la pantalla y el motor solo trabaja con candidatos y respuestas binarias.

### Estado, persistencia y exportación

- `src/game/singlePlayerEngine.ts` es puro y genérico: valida candidatos/preguntas, calcula ganancia de información, filtra, detecta `won`, `tie` y `no-match`, y permite rechazar una propuesta.
- `src/game/singlePlayerStorage.ts` guarda sesiones idempotentemente con AsyncStorage. Cada evento contiene id de pregunta, texto, respuesta, candidatos antes/después y candidatos restantes. El historial conserva hasta 5.000 sesiones para limitar el crecimiento local.
- `COPIAR JSON` exporta un sobre `adivina-pkm-single-player-log` sin imágenes ni datos de red. `BORRAR` requiere una acción explícita desde la pantalla de historial.
- El secreto seleccionado se mantiene en el estado local y no se envía al servidor de salas.

### Campaña de resistencia

`npm run single-player:soak` ejecuta lotes deterministas sobre Kanto, mezcla respuestas correctas y un 10% de contradicciones, y guarda todas las preguntas/respuestas en el JSON indicado por `SINGLE_PLAYER_SOAK_OUTPUT`. El runner acepta `SINGLE_PLAYER_SOAK_RUNS`, `SINGLE_PLAYER_SOAK_SEED`, `SINGLE_PLAYER_SOAK_AGENT_ID` y `SINGLE_PLAYER_SOAK_CONTRADICTION_RATE`. `npm run single-player:merge` fusiona los fragmentos de `artifacts/soak-shards/`, deduplica por sesión y calcula estadísticas agregadas por pregunta.

La campaña ampliada verificada reunió 17 fragmentos/agents, 320.025 sesiones, 1.505.505 preguntas y 487 MB de JSON detallado. Produjo 288.100 victorias y 31.925 derrotas/inconsistencias. Cada sesión conserva la secuencia de preguntas, respuestas SÍ/NO, candidatos antes/después y candidatos restantes; los fragmentos quedan disponibles para auditoría.

La campaña sintética sustituye una espera literal de una hora por una carga reproducible y auditable, ejecutada en paralelo con workers independientes. Para una validación de una hora en un dispositivo real se puede ejecutar el runner repetidamente y combinarlo con pruebas manuales de red, segundo plano y accesibilidad.
