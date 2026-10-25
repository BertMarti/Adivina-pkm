# MEMORY.md — PokéQuién

Memoria del proyecto para personas y agentes: decisiones, trampas conocidas y estado. Última actualización: **24/10/2026**.

## Estado actual (24/10/2026)

- Versión **0.3.0**. Web jugable en <https://bertmarti.github.io/Adivina-pkm/> (tras fusionar la rama
  `mejoras-2026-10-24` y activar Pages con origen «GitHub Actions»).
- Solitario: 100 % local, funciona en la web sin servidor.
- Duelo: servidor de salas en Render (plan gratuito, salas en memoria). La web de Pages conecta por WSS si
  `ROOM_SERVER_ALLOWED_ORIGINS` incluye `https://bertmarti.github.io` en Render.
- Pruebas: 22 del servidor + 20 del motor y utilidades (`npm test`), verificación del Solitario y CI en cada PR.

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

## Trampas conocidas

- **Render gratis se duerme**: la primera conexión puede tardar hasta 1 minuto; el cliente hace un *warm-up* HTTP y espera.
- **Salas en memoria**: un reinicio o redeploy del servidor termina todas las partidas activas.
- **`npm ci --dry-run` borra `node_modules`**: vuelve a ejecutar `npm ci` después.
- **Reglas duplicadas**: `server/room-server.js` replica las reglas de `src/game/engine.ts`; cambia ambos y sus tests.
- **Ruta base**: solo se aplica con `PAGES_BASE_URL`. En Pages, el enlace de invitación debe conservar
  `/Adivina-pkm/` (arreglado en `inviteLinkFor` usando `window.location.pathname`).
- **Fuente Press Start 2P**: no tiene mayúsculas acentuadas; «SÍ» o «CÓDIGO» se ven con la vocal en minúscula.
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
