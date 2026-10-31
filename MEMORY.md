# MEMORY.md — PokéQuién

Memoria del proyecto para personas y agentes: decisiones, trampas conocidas y estado. Última actualización: **31/10/2026**.

## Estado actual (31/10/2026)

- Versión **1.1.0** con Expo SDK 58 (expo 58.0.22, React Native 0.88.1, React 19.3). Novedad: ventana de **Ajustes**
  (sonido y volumen, vibración, tachado visible para daltonismo y estadísticas del Solitario exportables). Web jugable en
  <https://bertmarti.github.io/Adivina-pkm/>, instalable como PWA; el Solitario funciona sin red.
- Solitario: 100 % local, funciona en la web sin servidor.
- Duelo: servidor de salas en Render (plan gratuito, salas en memoria). La web de Pages conecta por WSS si
  `ROOM_SERVER_ALLOWED_ORIGINS` incluye `https://bertmarti.github.io` en Render.
- Pruebas: 22 del servidor + 21 de la app (`npm test`), verificación del Solitario, prueba de humo de la
  web (`npm run test:web`) y CI en cada PR.

## Decisiones y por qué

| Fecha | Decisión | Por qué |
| --- | --- | --- |
| 24/10/2026 | Publicar la build web real de Expo en Pages (no una landing) | `react-native-web` ya estaba y la app funcionaba en web; el Solitario no necesita servidor. |
| 24/10/2026 | `app.config.js` que solo añade `experiments.baseUrl` si existe `PAGES_BASE_URL` | No cambiar `npm run web` ni las builds móviles; la ruta base solo hace falta en Pages. |
| 24/10/2026 | CSP inyectada en `dist/index.html` por `scripts/add-web-csp.mjs`, no en `public/index.html` | En desarrollo Metro usa WebSocket y se conecta a IP de la LAN; una CSP en la plantilla lo bloquearía. |
| 24/10/2026 | `build:web` como script Node (`scripts/build-web.mjs`) | Funciona igual en Linux, macOS y Windows/PowerShell. |
| 24/10/2026 | `createRoomServer(opciones)` exportable | Permite probar el servidor con `node:test` en puertos efímeros sin tocar el arranque en Render. |
| 24/10/2026 | Límites por IP: 300 peticiones HTTP/min, 20 salas/10 min, 20 conexiones WS | Dos jugadores en la misma Wi-Fi comparten IP y el cliente móvil sondea cada 2 s (~30 pet./min cada uno); se dejó margen para CGNAT. |
| 24/10/2026 | `ROOM_SERVER_TRUST_PROXY=1` en Render: IP de `CF-Connecting-IP` y, si falta, primera IP de `X-Forwarded-For` | Detrás del proxy de Render todas las conexiones llegan con la IP del proxy. `CF-Connecting-IP` la pone Cloudflare y no se puede falsificar; la primera IP de `X-Forwarded-For` sí (solo serviría para esquivar límites). **Pendiente: verificar en Render que llega `CF-Connecting-IP`.** |
| 24/10/2026 | Expo 57.0.31 + `npm audit fix` (de 11 avisos con 1 crítico a 5 altos) | Los 5 restantes (node-forge, zod) vienen de `@expo/cli`, herramienta de desarrollo; no hay parche dentro del SDK 57 y la «solución» de npm (expo@44) es absurda. |
| 24/10/2026 | IP LAN real sustituida por `192.168.1.50` en `.env.example` y docs | Privacidad. Sigue en el historial de git (riesgo bajo: IP privada de LAN); no se reescribe historial. |
| 24/10/2026 | `.gitignore` ignora `.env` y `.env*` salvo `.env.example` | Antes solo ignoraba `.env*.local` y un `.env` real podía subirse. |
| 24/10/2026 | `ws` se mantiene en `package.json` raíz y en `server/package.json` | La raíz conserva la configuración antigua de Render y el servidor aislado instala solo su dependencia. |
| 24/10/2026 | `originAllowed` y CORS `*` solo en `GET /` | La web puede diagnosticar si el origen está permitido sin relajar el control de origen del WebSocket. |
| 24/10/2026 | Lista blanca de imágenes del tablero | Evita que quien crea una sala use una imagen remota para rastrear la IP del rival. |
| 24/10/2026 | Dependabot ignora saltos de SDK y cambios descoordinados de React/RN | Expo 57 requiere actualizar el conjunto completo, no mezclar versiones. |
| 24/10/2026 | `connect-src` de la CSP se limita a la web y al servidor configurado | Evita conexiones arbitrarias desde la build publicada. |

| 25/10/2026 | Expo SDK 58 completo de una vez | Cerraba las alertas pendientes del SDK 57 que sí tenían arreglo y Dependabot no puede subir el SDK por piezas. |
| 25/10/2026 | `overrides` de `zod` ^4.6.7 solo dentro de `@expo/cli` (**quitado el 31/10/2026**: @expo/cli 58.1.18 ya no depende de zod) | El CLI usa zod solo para validar complementos de DevTools/MCP con API que zod 4 mantiene; `expo-doctor`, `expo export` y `expo start` funcionan. Quitar el override cuando `@expo/cli` dependa de zod ≥ 4.6.6. |
| 25/10/2026 | `node-forge` 1.4.0 se deja (alerta abierta) | No existe versión corregida; solo lo usa `@expo/cli` para certificados de firma (iOS y expo-updates), que este proyecto no usa. **Resuelto el 31/10/2026:** `npm audit fix` sube a 1.4.2 (dentro del rango `^1.4.0` de `@expo/cli`). |
| 25/10/2026 | Fuente derivada «PokeQuien Pixel» | Press Start 2P encoge las mayúsculas acentuadas. La OFL permite modificarla, pero con otro nombre (nombre reservado). |
| 25/10/2026 | PWA generada en la build (`scripts/add-web-pwa.mjs`), no en `public/` | La lista de precaché depende de los nombres con hash de cada build; y en `expo start --web` no debe haber service worker. |
| 25/10/2026 | Service worker con scope `/Adivina-pkm/` y cachés `pokequien-*` | El origen `bertmarti.github.io` es común a todas las webs de BertMarti: no puede tocar rutas ni cachés ajenas. |
| 25/10/2026 | Prueba de humo sin dependencias (CDP por WebSocket de Node 22) | Evita instalar Puppeteer/Playwright (cientos de MB) en la Raspberry y en CI. |
| 26/10/2026 | Versión en el health sin que el cliente dependa de ella | Render puede ir por detrás; el cliente no bloquea el Duelo por una versión del servidor antigua. |
| 26/10/2026 | Cancelación de conexiones con un contador en `RoomClient` y en `App` | Una conexión tardía ya no saca al jugador del Solitario. |
| 26/10/2026 | Estado y errores del Duelo junto al panel que los provoca | El jugador identifica si el problema corresponde a CREAR PARTIDA, UNIRSE A PARTIDA o al enlace de invitación. |
| 31/10/2026 | Ajustes en un contexto de React (`src/settings/`) guardados con AsyncStorage en `adivina-pkm:ajustes:v1` | Origen compartido de Pages: clave con prefijo y nada sensible. Solo se guardan los ajustes cambiados; el resto sigue los valores por defecto (así la vibración puede depender de «reducir movimiento»). |
| 31/10/2026 | Vibración web solo con `navigator.vibrate` y tras la primera pulsación (`userActivation.hasBeenActive`) | Safari de iPhone y los ordenadores no la tienen; Chrome bloquea y avisa en consola si se llama antes de que la persona toque la página. |
| 31/10/2026 | Tachado visible (modo daltónico) con velo, aspa blanca con contorno negro, borde discontinuo y «FUERA» | Cuatro señales que no dependen del tono; `src/ui/contrast.test.ts` comprueba WCAG AA (texto ≥ 4,5:1, gráficos ≥ 3:1). |
| 31/10/2026 | Estadísticas del Solitario calculadas del historial existente (`src/game/singlePlayerStats.ts`), sin almacenamiento nuevo | Una sola fuente de verdad: borrar estadísticas es borrar el historial. CSV con `;`, BOM y protección contra fórmulas para Excel en español. |
| 31/10/2026 | Avisos moderados de `glob` 13 / `minimatch` 10 sin `overrides` (deepmerge desapareció con expo 58.0.22) | Son majors dentro de las herramientas de Expo; forzarlas podría romper `expo export`. Se esperan al parche del SDK. |

## Trampas conocidas

- **Service worker en desarrollo**: si abres la build de `dist/` en `localhost` y luego `npm run web` en el mismo
  puerto, el service worker de la build puede servir la versión vieja. DevTools → Application → «Unregister».
- **Node 20 en la Raspberry**: el sistema trae Node 20.19; para el SDK 58 hace falta Node ≥ 22.13 (en CI ya es 22).

- **Render gratis se duerme**: la primera conexión puede tardar hasta 1 minuto; el cliente hace un *warm-up* HTTP y espera.
- **Salas en memoria**: un reinicio o redeploy del servidor termina todas las partidas activas.
- **`npm ci --dry-run` borra `node_modules`**: vuelve a ejecutar `npm ci` después.
- **Reglas duplicadas**: `server/room-server.js` replica las reglas de `src/game/engine.ts`; cambia ambos y sus tests.
- **Ruta base**: solo se aplica con `PAGES_BASE_URL`. En Pages, el enlace de invitación debe conservar
  `/Adivina-pkm/` (arreglado en `inviteLinkFor` usando `window.location.pathname`).
- **Fuente**: Press Start 2P encoge «Á É Í Ó Ú Ü Ñ» y se leían como minúsculas. Desde el 25/10/2026 la app usa PokeQuien Pixel (`assets/fonts/`, generada con `scripts/generate-pixel-font.py`), con el acento 250 unidades por encima de la altura de mayúsculas: si un texto con mayúsculas acentuadas queda recortado arriba, dale algo más de `lineHeight` o de margen superior.
- **`aria-checked` en la web**: react-native-web 0.21 no traduce `accessibilityState.checked/selected`; en interruptores y
  radios hay que pasar también `aria-checked` (los lectores de pantalla de la web no se enteraban del estado).
- **Autoplay en web**: `expo-audio` no captura el rechazo de `play()` si no hubo interacción; aparece un
  `NotAllowedError` en consola solo en navegadores sin gesto del usuario (p. ej. pruebas automáticas). Es inofensivo.
- **Solitario tolerante a errores**: «Quedan N» no baja siempre tras cada respuesta; el motor usa creencias
  probabilísticas, no filtrado duro. No es un bug.
- **Versión de Node**: la app (SDK 58) pide Node ≥ 22.13 (o ≥ 24.3); con Node 20 Expo CLI avisa de que no está soportado. El servidor de salas (`server/`) sigue aceptando Node ≥ 20.19.4. En CI se usa Node 22.
- **Host inválido**: la URL de cada petición se resuelve con base fija `http://localhost` y los errores no capturados de `handleHttpRequest` responden 400; antes una cabecera `Host: a b` tumbaba el proceso.
- **`/usr/share/nodejs/ws` en la Raspberry** puede hacer que `require('ws')` funcione sin `node_modules`; no sirve para probar el caso de dependencia `ws` ausente.
- **Caché de Metro y `EXPO_PUBLIC_*`**: sin `--clear`, `expo export` reutilizaba una build anterior con otra `EXPO_PUBLIC_ROOM_SERVER_URL` (la CSP nueva bloqueaba la URL vieja). `npm run build:web` ya pasa `--clear`.

## Recursos con derechos

Retratos de SpriteCollab (CC BY-NC 4.0, carga remota), `assets/pikachu-flight.gif`, `assets/pokeball-capture*.{gif,png}`,
`assets/spritecollab-background.png` y audios de referencia ya estaban en el repo. Fan project no oficial y sin ánimo de
lucro; revisar licencias antes de cualquier distribución en tiendas. No se han añadido recursos nuevos con derechos.
