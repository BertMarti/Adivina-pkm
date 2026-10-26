# 📜 Changelog — PokéQuién

Todos los cambios notables del proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

---

## [Sin publicar]

> Cambios pendientes de incluir en la próxima versión.

## [1.0.0] - 2026-10-26

Primera versión estable de PokéQuién. Resume el camino desde el prototipo (0.1–0.4) y añade lo que faltaba para
cerrarlo: que el Duelo nunca deje al jugador colgado aunque el servidor no responda.

### 🎮 Qué trae la 1.0

- **Web jugable** en <https://bertmarti.github.io/Adivina-pkm/>, sin cuenta ni instalación, e **instalable** como app
  (PWA) en el móvil y el ordenador; el Solitario funciona **sin conexión**.
- **Duelo (2 jugadores)**: sala con código de 8 caracteres o enlace de invitación, 9 generaciones o las 1.025 especies,
  elección secreta, tablero 5×5 para tachar, revancha y 60 s para reconectar si alguien se cae.
- **Solitario**: la Pokédex adivina tu Pokémon con preguntas de SÍ o NO (máximo 30), con historial local y exportación.
- **Accesible**: lectores de pantalla anuncian fases y turnos, controles de 44 px, foco visible, movimiento reducido y
  fuente pixel con mayúsculas acentuadas legibles.
- **Seguro**: servidor de salas con límites por IP, mensajes validados y orígenes permitidos; web con CSP estricta y
  service worker limitado a su carpeta; CI con gitleaks, pruebas y prueba de humo en Chromium.

### ✨ Añadido

- Botón **CANCELAR** mientras el Duelo conecta (el servidor gratuito puede tardar 1 minuto en despertar). Ir al
  Solitario durante la conexión también la cancela.
- **‹ SALIR DE LA SALA** y aviso de rival desconectado en la elección del Pokémon y en la espera (antes no había forma de
  salir si el rival no elegía).
- La versión se ve en la app: pie **ACERCA DE · CRÉDITOS Y LICENCIAS** y ventana «Acerca de PokéQuién».
- El servidor de salas indica su versión en `GET /` y al arrancar (la app no depende de ella: funciona con un servidor
  anterior).
- Prueba de humo con dos pasos nuevos (servidor dormido → CANCELAR; servidor caído → mensaje, REINTENTAR y Solitario) y
  prueba que comprueba que la versión coincide en todos los manifiestos.
- Pruebas unitarias de las reglas de conexión del Duelo (`src/game/roomSession.ts`): plazo de reconexión propio, código
  ocupado e intentos cancelados.

### 🐛 Corregido

- Una conexión al Duelo que terminaba tarde sacaba al jugador del Solitario y lo metía en la sala.
- Los errores y avisos del Duelo salían al final de la pantalla de inicio, fuera de la vista en el móvil; ahora salen
  junto al panel que los provoca (o arriba, si se entra con un enlace de invitación).
- El botón de crear sala decía «CARGANDO POKÉDEX…» también mientras se intentaba unirse a otra sala.
- El mensaje de servidor inaccesible contempla también que esté en mantenimiento.
- Tras el abandono del rival, el cliente de la sala seguía vivo y había guardado el plazo de reconexión **del rival**:
  un corte posterior terminaba «la partida» al instante y sacaba al jugador del Solitario. Ahora el cliente se cierra al
  abandonarse la partida, solo cuenta el plazo propio, entrar en el Solitario cierra cualquier conexión pendiente y ese
  aviso ya no cambia de pantalla si se está en el Solitario.
- CANCELAR con la sala ya pedida dejaba ocupado el código y **REINTENTAR** fallaba siempre con «ya está ocupado»; ahora
  se genera un código nuevo al cancelar y ante ese error. Cancelar también aborta la comprobación del servidor en curso.
- Solitario: **BORRAR** el historial lo eliminaba con una sola pulsación; ahora pide confirmación. **COPIAR JSON** no
  avisaba en la web (ni si fallaba); ahora lo confirma o explica el error.

### 🔄 Cambiado

- Versión 1.0.0 en la app (`package.json`, `app.json`) y en el servidor de salas (`server/package.json`).
- Documentación de usuario y de seguridad al día con la 1.0.0; los documentos de fases anteriores quedan marcados como
  históricos.

### 🔐 Seguridad

- Sin cambios de dependencias. Sigue abierto el aviso de `node-forge` (GHSA-86w9-cpqp-85rv), sin versión corregida
  publicada: solo afecta a la herramienta de desarrollo de Expo, no a la web, a la APK ni al servidor.

## [0.4.0] — 2026-10-25

### 🔐 Seguridad

- Expo SDK 58 completo (React Native 0.88, React 19.3) con `npx expo install expo@^58 --fix`; `expo-doctor` 20/20.
- `zod` forzado a `^4.6.7` dentro de `@expo/cli` (GHSA-mrhx-c7xc-m3w5, alta). `node-forge` 1.4.0 sigue
  (GHSA-86w9-cpqp-85rv): no hay versión corregida publicada y solo lo usa la herramienta de desarrollo.
- Service worker limitado a `/Adivina-pkm/` y a cachés propias (`pokequien-`), sin scripts en línea.

### ✨ Añadido

- PWA instalable: se abre y se juega al Solitario sin red; guarda los retratos ya vistos.
- Prueba de humo de la web (`npm run test:web`) con Chromium/Chrome sin cabeza, también en CI.
- Fuente PokeQuien Pixel: «SÍ», «CÓDIGO» y «POKÉMON» con la mayúscula entera (antes la vocal parecía minúscula).
- Cambios de pantalla, turno y resultado anunciados a lectores de pantalla (regiones vivas y anuncios en iOS).

### 🔄 Cambiado

- `App.tsx` troceado en pantallas (`src/screens/`), componentes (`src/ui/components.tsx`), estilos y hooks, sin
  cambiar el aspecto.
- Node.js ≥ 22.13 para la app (requisito del SDK 58); el servidor de salas sigue aceptando Node ≥ 20.19.4.
- Dependabot ignora los saltos menores de módulos nativos fijados por el SDK y TypeScript 7.
- `ImageBackground` (obsoleto en RN 0.88) sustituido por `Image`.

## [0.3.0] — 2026-10-24

### 🔐 Seguridad

- El servidor ya maneja marcos WebSocket inválidos o mayores de 64 KiB sin tumbar el proceso (también en conexiones rechazadas por cupo de IP).
- Las imágenes del tablero solo aceptan SpriteCollab, PokéAPI (validado sobre la URL normalizada: sin `..`, query ni usuario) o datos PNG/GIF/WebP/JPEG embebidos.
- El health `GET /` expone `originAllowed` y CORS abierto para diagnosticar el origen sin abrir el WebSocket a cualquier web.
- La CSP limita `connect-src` al origen propio y al servidor de salas configurado.

### ✨ Añadido

- Servidor independiente en `server/` con `ws`, `npm start` y `npm test`.
- Scripts `npm run server` y `npm run server:help`; `npm run room-server` se mantiene como alias.
- Guía de juego de tres pasos, invitaciones, diagnósticos del servidor y ventana de créditos y licencias.
- 22 pruebas del servidor.

### 🔄 Cambiado

- Render usa `rootDir: server`, `npm ci --omit=dev` y `node room-server.js`.
- La app valida los códigos de sala, comparte enlaces desde móvil y espera hasta 60 segundos la reconexión del rival.

### 📦 Dependencias

- Fusionadas las PR de Dependabot #2 (react-native-web 0.21.4) y #3 (ws 8.22.0, @types/ws, tsx); cerradas #4, #5 y #6 (SDK 58 y react-dom fuera del SDK 57).
- Se ignoran saltos de SDK de Expo y las subidas mayores/menores de react, react-dom y react-native (fijados por el SDK); los parches, incluidos los de seguridad, siguen llegando.

## [0.2.0] — 2026-10-24

### 🌐 Web en GitHub Pages

- 🎮 La app se puede jugar en el navegador en https://bertmarti.github.io/Adivina-pkm/ (Solitario sin servidor;
  Duelo contra el servidor de salas).
- 🔗 El enlace de invitación conserva la ruta `/Adivina-pkm/` y el campo de código muestra un ejemplo válido.
- 🛡️ HTML en español, metadatos, foco visible al navegar con teclado y Content-Security-Policy en la build.

### 🔐 Seguridad

- 🚦 Servidor de salas con límites por IP (peticiones HTTP, salas creadas, conexiones simultáneas), heartbeat,
  respuesta 413 para cuerpos grandes y validación estricta de mensajes.
- 📦 Expo 57.0.31 y `npm audit fix`: sin avisos críticos.
- 🙈 Fuera una IP de red local real de los ejemplos; `.env` ignorado por git.
- 🤖 CI con gitleaks, tipos, pruebas y build web; Dependabot semanal; `SECURITY.md`.

### 🧪 Calidad

- ✅ 14 pruebas del servidor de salas y 12 del motor del juego (`npm test`).

### 📘 Documentación

- README para jugadores con banner, capturas reales y preguntas frecuentes; guía técnica en `docs/DESARROLLO.md`;
  `AGENTS.md`, `CLAUDE.md`, `MEMORY.md`, `PLAN.md`, subagentes y skills para asistentes de IA.

### Incluido también en esta versión (antes «Sin publicar»)


- 📱 **Safe area Android/iOS** — El contenido usa `react-native-safe-area-context`
  para que VOLVER y los controles superiores queden fuera de la barra de estado.
- 🌐 **Salas públicas por defecto** — La aplicación usa el servidor WebSocket
  gratuito desplegado como respaldo, también en teléfonos físicos, y espera
  hasta 45 segundos para que Render despierte desde suspensión.
- 🧠 **Preguntas sin particiones repetidas** — El modo solitario detecta
  preguntas distintas que separan exactamente igual a los candidatos y evita
  volver a mostrarlas.
- 🧪 **Revisión del algoritmo** — Documentada en
  [`docs/SOLO_PLAYER_ALGORITHM_REVIEW.md`](./docs/SOLO_PLAYER_ALGORITHM_REVIEW.md).
- 🧠 El modo solitario usa una creencia tolerante a respuestas imperfectas,
  semilla por ronda y propuestas de confianza; se elimina la secuencia fija.
- 🚫 El banco de preguntas excluye Pokédex, peso, región y generación como
  atajos de identificación.
- 💾 Cada partida humana se guarda localmente con preguntas, respuestas,
  candidatos supervivientes y resultado; las escrituras rápidas se serializan.
- 🌱 El catálogo nacional incorpora líneas evolutivas públicas y cinco pistas
  genéricas para reducir empates como Paras/Parasect.
- ⏱️ El motor impide configurar partidas de más de 30 preguntas; los límites
  inferiores quedan disponibles para pruebas controladas.

---

## [0.1.0] — Beta móvil preparada

### 🚀 Distribución gratuita

- 📦 Perfil EAS `preview` para generar una APK Android instalable mediante enlace.
- 🌐 Blueprint `render.yaml` para desplegar el servidor de salas en un servicio Node gratuito.
- 🔐 El servidor acepta el puerto `PORT` de plataformas cloud y mantiene el puerto local `8787` como alternativa.
- 📘 Guía completa en [`docs/RELEASE_0_1_GRATUITA.md`](./docs/RELEASE_0_1_GRATUITA.md).

> Esta beta usa salas en memoria: un reinicio del hosting termina las salas activas.

---

## [Prototipo inicial] — 2026-09-15

> Esta entrada se tituló «[1.0.0]» por error: era el primer prototipo, nunca se publicó con ese número. La versión
> 1.0.0 real es la del 26/10/2026 (arriba).

### ⚡ Lanzamiento inicial

Primera versión funcional de PokéQuién con ambos modos de juego.

### ✨ Añadido

- 🕹️ **Modo Duelo (2 jugadores)** — Partidas en tiempo real con tablero compartido 5×5
- 🤖 **Modo Solitario** — Juega contra la máquina que hace preguntas SÍ/NO inteligentes
- 🗺️ **9 generaciones + modo Todas** — Desde Kanto (#001–#151) hasta Paldea (#906–#1025), más el catálogo completo de 1.025 Pokémon
- 🏠 **Pantalla de inicio** — Selector de generación, creación de sala, enlace de invitación, código compartible y acceso directo al modo solitario
- 🔗 **Sistema de salas** — Códigos de 8 caracteres, enlace de invitación (web y deep link nativo), unirse por código
- 📋 **Copiar enlace y código** — Compartir sala por enlace o código directamente desde la app
- 🎨 **Estética pixel-art retro** — Fondo SpriteCollab con scanlines CRT, tipografía Press Start 2P, colores arcade
- 🖼️ **Retratos PMD** — Sprites Happy/Normal/Sad de SpriteCollab con cadena de fallback a PokéAPI
- 😊→😢 **Expresiones dinámicas** — Los retratos cambian de expresión al tachar (Happy → Sad)
- 🔊 **Audio contextual** — Sonidos de selección, tachado, destachado, victoria y derrota
- 📳 **Feedback háptico** — Vibraciones diferenciadas por tipo de acción en dispositivos móviles
- ♿ **Accesibilidad** — Roles, estados, etiquetas de accesibilidad, soporte para lectores de pantalla y `prefers-reduced-motion`
- 🔌 **Reconexión** — Ventana de 60 segundos para reconectar si un jugador se desconecta, con recuperación completa del estado
- 🔁 **Rematch** — Botón JUGAR DE NUEVO para repetir en la misma sala sin reconectar
- 🧠 **Motor de preguntas inteligente** — Selección por ganancia de información con exploración de preguntas y semilla por ronda
- 📊 **Historial de partidas solitario** — Guardado automático, exportación JSON y borrado del registro
- 🏗️ **Pokédex Nacional local** — 1.025 entradas con tipos, peso, color, silueta, descripción y curiosidades, sin depender de API en tiempo de juego
- 📱 **Responsive** — Diseño adaptable a móvil, tablet y web con ancho máximo de 720 px

### 🔐 Seguridad

- Validación de tablero en el servidor (25 Pokémon, ids únicos, generación válida)
- Secretos filtrados en la proyección de estado (cada jugador solo ve el suyo)
- Token de sesión para reconexión con comparación constante
- Límites de payload (64 KiB), rate de mensajes y número máximo de salas

---

<!--
## [X.Y.Z] — YYYY-MM-DD

### ✨ Añadido
- Nuevas funcionalidades

### 🔄 Cambiado
- Cambios en funcionalidades existentes

### ⚠️ Obsoleto
- Funcionalidades que serán eliminadas próximamente

### 🗑️ Eliminado
- Funcionalidades eliminadas

### 🐛 Corregido
- Correcciones de errores

### 🔐 Seguridad
- Correcciones de vulnerabilidades
-->
