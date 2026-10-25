# 🛠️ Desarrollo de PokéQuién

Guía técnica para programar, probar y desplegar PokéQuién. La guía para jugadores es el [README](../README.md);
el detalle de arquitectura, fases y reglas está en [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md).

## Requisitos

- **Node.js 22 LTS** (el SDK 58 de Expo pide Node ≥ 22.13 o ≥ 24.3; los impares, 23 y 25, no valen) y npm.
- Para Android: Expo Go o una build con EAS (ver [RELEASE_0_1_GRATUITA.md](RELEASE_0_1_GRATUITA.md)).
- Para iOS: macOS con Xcode.

## Instalación

```bash
npm ci
```

> ⚠️ `npm ci --dry-run` también borra `node_modules`. Si lo usas, vuelve a ejecutar `npm ci`.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm start` | Expo interactivo (QR para Expo Go, atajos para web/Android/iOS). |
| `npm run web` | Previsualización web en local (sin ruta base). |
| `npm run android` / `npm run ios` | Expo apuntando a emulador o dispositivo. |
| `npm run server` | Servidor de salas en `ws://0.0.0.0:8787` (health check en `http://localhost:8787`). |
| `npm run room-server` | Alias de `npm run server`. |
| `npm run server:help` | Ayuda del servidor en español. |
| `npm run typecheck` | `tsc --noEmit` con TypeScript estricto. |
| `npm test` | Pruebas del servidor de salas y de los tests `src/game/*.test.ts`. |
| `cd server && npm start` | Arranca solo el servidor con su `server/package.json`. |
| `cd server && npm test` | Ejecuta los tests del servidor. |
| `npm run single-player:verify` | Verificación determinista del modo Solitario. |
| `npm run single-player:soak` / `:merge` / `:fleet` | Campañas largas de resistencia del Solitario (ver [SINGLE_PLAYER_TEST_PLAN.md](../SINGLE_PLAYER_TEST_PLAN.md)). |
| `npm run build:web` | Exporta la web a `dist/` con ruta base `/Adivina-pkm` y añade la CSP y la PWA (igual que en GitHub Pages). |
| `npm run test:web` | Prueba de humo sobre `dist/`: Chromium sin cabeza carga la web bajo `/Adivina-pkm/`, entra en el Solitario, responde «SÍ» y comprueba que la PWA carga sin red. Variables: `CHROME_PATH`, `SMOKE_DIST`, `SMOKE_SCREENSHOT`. |

## Estructura

```text
App.tsx                      Pantallas y orquestación (inicio, sala, selección, espera, partida, solitario)
index.ts                     Punto de entrada de Expo
app.json / app.config.js     Configuración de Expo; app.config.js solo añade la ruta base de Pages
public/index.html            Plantilla HTML de la web (idioma, metadatos, foco visible)
src/game/engine.ts           Motor puro del Duelo (sin red ni UI) + engine.test.ts
src/game/roomClient.ts       Cliente de salas: WebSocket en web, sondeo HTTPS en móvil, reconexión
src/game/singlePlayer*.ts    Motor y almacenamiento del Solitario
src/singlePlayer/            Pantalla del Solitario
src/data/                    Catálogo local de 1.025 Pokémon y banco de preguntas
src/audio/                   Sonidos embebidos
server/room-server.js        Servidor de salas (Node + ws) + room-server.test.js
scripts/                     Build web, CSP, generadores de catálogo/iconos/audio, pruebas del Solitario
.github/workflows/           CI (ci.yml) y despliegue en Pages (pages.yml)
render.yaml / eas.json       Despliegue del servidor (Render) y builds móviles (EAS)
```

## Arquitectura en dos líneas

El **Duelo** es autoritativo en el servidor: el cliente envía acciones (`create`, `join`, `reconnect`, `select`,
`toggle`, `rematch`) y recibe un estado personalizado en el que el secreto del rival es `null` hasta el final.
El **Solitario** es 100 % local: la máquina elige preguntas por ganancia de información con actualización tolerante a errores.

> El servidor JavaScript replica reglas de `src/game/engine.ts`. Si cambias una regla, cámbiala en los dos sitios y
> añade la prueba en `server/room-server.test.js` y en `src/game/engine.test.ts`.

## Variables de entorno

| Variable | Dónde | Uso | Ejemplo |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_ROOM_SERVER_URL` | Cliente | URL del servidor de salas. Sin ella se usa el servidor público de Render. Se incrusta en el bundle: no es secreta. | `ws://192.168.1.50:8787` (LAN) · `wss://pokequien-rooms.onrender.com` |
| `PORT` / `ROOM_SERVER_PORT` | Servidor | Puerto. `PORT` (PaaS) tiene prioridad. | `8787`, `18787` para pruebas aisladas |
| `ROOM_SERVER_ALLOWED_ORIGINS` | Servidor | Orígenes web permitidos, separados por comas. `localhost` y `127.0.0.1` siempre se aceptan; las apps nativas no envían `Origin`. | `https://bertmarti.github.io` |
| `ROOM_SERVER_TRUST_PROXY` | Servidor | `1` para leer la IP del cliente de `CF-Connecting-IP` o, si falta, de `X-Forwarded-For` (detrás de Render). | `1` |
| `PAGES_BASE_URL` | Build web | Ruta base al exportar; `npm run build:web` pone `/Adivina-pkm` si no se indica. | `/Adivina-pkm` |

Copia `.env.example` a `.env` para desarrollo local. No necesitas `.env` para usar el servidor público; los archivos `.env*.local` están ignorados por git.

## Jugar un Duelo en local

```bash
npm run server                                        # terminal 1
EXPO_PUBLIC_ROOM_SERVER_URL=ws://localhost:8787 npm run web   # terminal 2
```

En PowerShell: `$env:EXPO_PUBLIC_ROOM_SERVER_URL = "ws://localhost:8787"; npm run web`.
Para un móvil físico usa la IP LAN de tu ordenador (por ejemplo `ws://192.168.1.50:8787`) y la misma Wi-Fi.

## Límites del servidor de salas

Configurables con `createRoomServer(opciones)` (los valores por defecto entre paréntesis):
payload WS y cuerpo HTTP 64 KiB (413), 40 mensajes WS cada 10 s por conexión (cierre 1008), 300 peticiones HTTP por
minuto e IP (429 + `Retry-After`), 20 salas creadas por IP cada 10 min, 20 conexiones WS simultáneas por IP,
500 salas en total, heartbeat cada 30 s, reconexión de 60 s y limpieza de salas inactivas. Más en [SECURITY.md](SECURITY.md).

## Pruebas y CI

- Local: `npm run typecheck && npm test && npm run single-player:verify` y, si tocas la web, `npm run build:web && npm run test:web`.
- CI (`.github/workflows/ci.yml`, en cada PR y push a `master`): gitleaks (historial y árbol), comprobación de sintaxis
  del servidor, tipos, pruebas, verificación del Solitario, build web, prueba de humo con Chrome sin cabeza y
  `npm audit --audit-level=critical`.
- Dependabot (`.github/dependabot.yml`) propone actualizaciones semanales agrupadas. Los saltos de SDK de Expo se hacen
  a mano con `npx expo install --fix`.

## Despliegue

### Web (GitHub Pages)

`.github/workflows/pages.yml` publica `dist/` en <https://bertmarti.github.io/Adivina-pkm/> en cada push a `master`
(y a mano con *Run workflow*). Pages debe estar configurado con origen «GitHub Actions».

Probar antes en local con el mismo prefijo:

```bash
npm run build:web
mkdir -p /tmp/pk-serve && ln -sfn "$PWD/dist" /tmp/pk-serve/Adivina-pkm
cd /tmp/pk-serve && python3 -m http.server 8931
# http://localhost:8931/Adivina-pkm/
```

La CSP se inyecta solo en `dist/index.html` (`scripts/add-web-csp.mjs`); no está en `public/index.html` porque
bloquearía Metro y las IP de la LAN en desarrollo.

**PWA** (`scripts/add-web-pwa.mjs`, también solo en la build): `manifest.webmanifest`, iconos de `public/pwa/`,
`registrar-sw.js` (archivo aparte porque la CSP no admite scripts en línea) y `sw.js` generado con la lista de archivos
de la build. El service worker:

- se registra con `scope` `/Adivina-pkm/` y no intercepta nada fuera de esa carpeta (el origen
  `bertmarti.github.io` es compartido con otras webs);
- precachea la build entera (≈ 3,5 MB) con una caché versionada por hash (`pokequien-app-<hash>`) y borra solo sus
  propias cachés antiguas;
- navegación: primero red y, sin red, la copia guardada; archivos de la build: primero caché (llevan hash en el nombre);
- retratos: solo `PMDCollab/SpriteCollab/.../portrait/` y `PokeAPI/sprites/.../official-artwork/` de
  raw.githubusercontent.com, pedidos en modo CORS, en `pokequien-retratos-v1` (máx. 400).

Para depurarlo: DevTools → Application → Service workers / Cache storage. Si algo se queda «pegado», «Unregister» y
recarga.

**Fuente**: `assets/fonts/PokeQuienPixel-Regular.ttf` se genera con
`python3 scripts/generate-pixel-font.py node_modules/@expo-google-fonts/press-start-2p/400Regular/PressStart2P_400Regular.ttf assets/fonts/PokeQuienPixel-Regular.ttf`
(necesita `fonttools`). Solo cambia «Á É Í Ó Ú Ü Ñ»; el resto es Press Start 2P.

### Servidor de salas propio

El servidor de salas, por separado, funciona con Node.js ≥ 20.19.4 (recomendado 22 LTS) y la dependencia `ws`. En la raíz, `npm run server` y `npm run room-server` son equivalentes; para aislarlo, usa `cd server && npm ci && npm start`. Al arrancar comprueba la versión de Node y que `ws` esté instalada.

El health check `GET /` devuelve JSON con `ok`, `rooms`, `transports` (`websocket` y `https-polling`) y `originAllowed`: `true` o `false` si recibe `Origin`, `null` si no lo recibe. Esta ruta responde con CORS `*` para que la web pueda diagnosticar el servidor; el resto de la API mantiene la lista de orígenes.

### Servidor de salas (Render)

`render.yaml` define un servicio Node gratuito con `rootDir: server`, `npm ci --omit=dev` y `node room-server.js`. El plan gratuito se duerme sin tráfico: el cliente lo despierta y espera hasta 1 minuto. Las salas viven en memoria y se pierden al reiniciar.

La CSP de la web limita `connect-src` a `'self'` y al servidor de salas configurado (Render o `EXPO_PUBLIC_ROOM_SERVER_URL`); no permite cualquier `https:` o `wss:`.

### Android (EAS)

Perfil `preview` de `eas.json` → APK instalable por enlace. Pasos completos en
[RELEASE_0_1_GRATUITA.md](RELEASE_0_1_GRATUITA.md).

## Privacidad y seguridad

- Nada de secretos, tokens, correos ni IPs reales en el repositorio. En ejemplos usa `192.168.1.50`.
- No registres tokens de sesión ni mensajes completos en el servidor.
- Retratos de [SpriteCollab](https://github.com/PMDCollab/SpriteCollab) (CC BY-NC 4.0) cargados en remoto; no añadas
  recursos con derechos de Pokémon al repositorio sin revisar su licencia.
- Política de avisos: [SECURITY.md](../SECURITY.md). Controles detallados: [docs/SECURITY.md](SECURITY.md).
