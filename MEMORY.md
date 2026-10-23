# MEMORY.md — PokéQuién

Memoria del proyecto para personas y agentes: decisiones, trampas conocidas y estado. Última actualización: **24/10/2026**.

## Estado actual (24/10/2026)

- Versión **0.2.0**. Web jugable en <https://bertmarti.github.io/Adivina-pkm/> (tras fusionar la rama
  `mejoras-2026-10-24` y activar Pages con origen «GitHub Actions»).
- Solitario: 100 % local, funciona en la web sin servidor.
- Duelo: servidor de salas en Render (plan gratuito, salas en memoria). La web de Pages conecta por WSS si
  `ROOM_SERVER_ALLOWED_ORIGINS` incluye `https://bertmarti.github.io` en Render.
- Pruebas: 14 del servidor + 12 del motor (`npm test`), verificación del Solitario y CI en cada PR.

## Decisiones y por qué

| Fecha | Decisión | Por qué |
| --- | --- | --- |
| 24/10/2026 | Publicar la build web real de Expo en Pages (no una landing) | `react-native-web` ya estaba y la app funcionaba en web; el Solitario no necesita servidor. |
| 24/10/2026 | `app.config.js` que solo añade `experiments.baseUrl` si existe `PAGES_BASE_URL` | No cambiar `npm run web` ni las builds móviles; la ruta base solo hace falta en Pages. |
| 24/10/2026 | CSP inyectada en `dist/index.html` por `scripts/add-web-csp.mjs`, no en `public/index.html` | En desarrollo Metro usa WebSocket y se conecta a IP de la LAN; una CSP en la plantilla lo bloquearía. |
| 24/10/2026 | `build:web` como script Node (`scripts/build-web.mjs`) | Funciona igual en Linux y PowerShell (Alberto usa Windows a veces). |
| 24/10/2026 | `createRoomServer(opciones)` exportable | Permite probar el servidor con `node:test` en puertos efímeros sin tocar el arranque en Render. |
| 24/10/2026 | Límites por IP: 300 peticiones HTTP/min, 20 salas/10 min, 20 conexiones WS | Dos jugadores en la misma Wi-Fi comparten IP y el cliente móvil sondea cada 2 s (~30 pet./min cada uno); se dejó margen para CGNAT. |
| 24/10/2026 | `ROOM_SERVER_TRUST_PROXY=1` en Render y primera IP de `X-Forwarded-For` | Detrás del proxy de Render todas las conexiones llegan con la IP del proxy. Es falsificable, pero solo sirve para esquivar límites, no para afectar a otros. |
| 24/10/2026 | Expo 57.0.31 + `npm audit fix` (de 11 avisos con 1 crítico a 5 altos) | Los 5 restantes (node-forge, zod) vienen de `@expo/cli`, herramienta de desarrollo; no hay parche dentro del SDK 57 y la «solución» de npm (expo@44) es absurda. |
| 24/10/2026 | IP LAN real sustituida por `192.168.1.50` en `.env.example` y docs | Privacidad. Sigue en el historial de git (riesgo bajo: IP privada de LAN); no se reescribe historial. |
| 24/10/2026 | `.gitignore` ignora `.env` y `.env*` salvo `.env.example` | Antes solo ignoraba `.env*.local` y un `.env` real podía subirse. |

## Trampas conocidas

- **Render gratis se duerme**: la primera conexión puede tardar ~45 s; el cliente hace un *warm-up* HTTP y espera.
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
- **Node en la Raspberry**: Node 20.19.2 da avisos `EBADENGINE` con RN 0.86; en CI se usa Node 22.
- **`render.yaml` instala todo el proyecto** (`npm ci --omit=dev` en la raíz) aunque el servidor solo necesita `ws`.

## Recursos con derechos

Retratos de SpriteCollab (CC BY-NC 4.0, carga remota), `assets/pikachu-flight.gif`, `assets/pokeball-capture*.{gif,png}`,
`assets/spritecollab-background.png` y audios de referencia ya estaban en el repo. Fan project no oficial y sin ánimo de
lucro; revisar licencias antes de cualquier distribución en tiendas. No se han añadido recursos nuevos con derechos.
