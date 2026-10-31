# AGENTS.md — PokéQuién (repo Adivina-pkm)

Juego de deducción pixel-art tipo «¿Quién es Quién?» con Pokémon. App Expo / React Native en TypeScript (web,
Android, iOS) con dos modos: **Duelo** (2 jugadores, servidor de salas Node + WebSocket/HTTPS) y **Solitario**
(la máquina adivina, 100 % local). Web publicada en <https://bertmarti.github.io/Adivina-pkm/>.

## Reglas de siempre (no se tocan)

- Mantener la máquina de estados pura en `src/game/engine.ts`.
- No mover secretos Pokémon al estado público cuando se añada un backend.
- Tratar las imágenes remotas como dependencias externas: cachear, mostrar fallback y conservar atribución.
- Validar siempre accesibilidad móvil: controles ≥44 px, contraste, etiquetas de estado y tachado no dependiente solo del color.

## Estructura

| Ruta | Qué hay |
| --- | --- |
| `App.tsx` | Orquestación del Duelo: estado, cliente de salas, manejadores y qué pantalla se ve; anuncios de fase |
| `src/screens/` | Pantallas del Duelo: `HomeScreen`, `RoomScreen`, `SelectionScreen`, `WaitingScreen`, `GameScreen` (+ victoria) |
| `src/ui/components.tsx`, `src/ui/appStyles.ts`, `src/ui/theme.ts` | Piezas comunes, estilos del Duelo, paleta y `PIXEL_FONT` |
| `src/hooks/` | `useReduceMotion` y `useGameSounds` (respeta los Ajustes: sonido, volumen y vibración) |
| `src/settings/` | Ajustes: modelo puro (`settingsModel.ts`), contexto + AsyncStorage (`SettingsContext.tsx`, clave `adivina-pkm:ajustes:v1`) y vibración web (`vibration.ts`) |
| `src/ui/SettingsModal.tsx` | Ventana de Ajustes: sonido, vibración, tachado visible (modo daltónico) y estadísticas del Solitario con exportación CSV/JSON |
| `src/game/singlePlayerStats.ts` | Estadísticas del Solitario (puras) a partir del historial y exportación CSV/JSON |
| `src/game/roomNavigation.ts` | Códigos de sala, enlace de invitación y pantalla según el estado |
| `src/game/engine.ts` | Motor puro del Duelo (+ `engine.test.ts`) |
| `src/game/roomClient.ts` | Cliente de salas: WebSocket en web, sondeo HTTPS en móvil, reconexión |
| `src/game/singlePlayerEngine.ts`, `src/singlePlayer/` | Motor y pantalla del Solitario |
| `src/version.ts` | Versión visible; `src/version.test.ts` la compara con los manifiestos |
| `src/data/` | Catálogo local de 1.025 Pokémon y banco de preguntas (generados; no editar a mano sin regenerar) |
| `server/room-server.js` | Servidor de salas: `createRoomServer(opciones)` (+ `room-server.test.js`) |
| `public/index.html`, `app.config.js`, `scripts/build-web.mjs`, `scripts/add-web-csp.mjs`, `scripts/add-web-pwa.mjs` | Build web para Pages (CSP y PWA) |
| `scripts/smoke-web.mjs` | Prueba de humo de la web (`npm run test:web`) |
| `.github/workflows/` | `ci.yml` (gitleaks, tipos, pruebas, build) y `pages.yml` (despliegue) |
| `docs/` | Guías: `DESARROLLO.md` (técnica), `SECURITY.md`, `USER_GUIDE.md`, `RELEASE_0_1_GRATUITA.md`, revisiones |

## Comandos exactos

```bash
npm ci                          # instalar (Node 22.13+ o 24.3+; lo exige el SDK 58 de Expo)
npm start                       # Expo interactivo
npm run web                     # web en local
npm run server                  # servidor de salas en 8787
npm run server:help             # ayuda del servidor en español
npm run room-server             # alias de server
npm --prefix server start       # solo el servidor
npm --prefix server test        # tests del servidor
npm run typecheck               # tsc --noEmit
npm test                        # node --test server/room-server.test.js && tsx --test src/*.test.ts src/game/*.test.ts src/settings/*.test.ts src/ui/*.test.ts
npm run single-player:verify    # verificación del Solitario
npm run build:web               # dist/ con ruta base /Adivina-pkm + CSP + PWA (como Pages)
npm run test:web                # prueba de humo de dist/ con Chromium sin cabeza (Solitario, Duelo con servidor dormido/caído y sin red)
```

Antes de dar algo por terminado: `npm run typecheck && npm test && npm run single-player:verify`; si tocas la web,
también `npm run build:web && npm run test:web`.

## Convenciones

- Textos de la app, comentarios, commits y documentación en **español de España**.
- TypeScript estricto. Sin dependencias nuevas sin motivo; para paquetes de Expo usa `npx expo install`.
- El servidor JS **replica** reglas del motor TS: si cambias una regla, cambia ambos y añade la prueba en los dos tests.
- **Versionado:** al subir de versión se cambian a la vez `package.json`, `package-lock.json` (2 sitios), `app.json`, `server/package.json`, `server/package-lock.json` (2 sitios) y `src/version.ts`, además de añadir la entrada correspondiente en `CHANGELOG.md`.
- Mensajes de error del servidor: cortos, en español y sin datos internos. Son parte de la UX.
- Estética: paleta de `COLORS` en `App.tsx` (fondo `#05070B`, panel `#1D1E2A`, amarillo `#FFD000`, azul `#4C6BE8`,
  naranja `#F06B00`) y fuente PokeQuien Pixel (`PIXEL_FONT`, Press Start 2P con mayúsculas acentuadas redibujadas; se regenera con `scripts/generate-pixel-font.py`).
- No hay framework de UI ni router: navegación por estado en `App.tsx`. No cambiar de framework.
- Accesibilidad: los cambios de fase se anuncian con `accessibilityLiveRegion` + `aria-live` (web/Android) y
  `AccessibilityInfo.announceForAccessibility` (iOS). Todo control táctil mide ≥ 44 px.
- Almacenamiento local: claves con prefijo `adivina-pkm:` (origen compartido `bertmarti.github.io`) y nada sensible.
  Los colores del tachado visible están en `MARKED_CROSS` (`src/ui/theme.ts`) y su contraste lo prueba `src/ui/contrast.test.ts`.
- Service worker: solo en la build (`scripts/add-web-pwa.mjs`), scope `/Adivina-pkm/` y cachés `pokequien-*`; nunca
  intercepta rutas ni borra cachés de otras webs del origen compartido `bertmarti.github.io`.

## Seguridad y privacidad

- Nunca subir secretos, tokens, correos ni IPs reales. En ejemplos usa `192.168.1.50` / `localhost`.
- `.env*` está ignorado salvo `.env.example`. `EXPO_PUBLIC_*` acaba en el bundle: nunca pongas nada secreto ahí.
- `publicState()` del servidor jamás envía el `secretId` del rival antes de `finished`.
- Toda entrada del servidor se valida (objeto plano, `type` conocido, ids enteros del tablero, código `^[A-Z2-9]{8}$`)
  y hay límites por conexión e IP. No registres tokens ni mensajes completos.
- Orígenes web permitidos: `ROOM_SERVER_ALLOWED_ORIGINS` (en Render: `https://bertmarti.github.io`). Nunca `*`.
- La CSP de la web va en `scripts/add-web-csp.mjs`; si la app empieza a cargar de otro dominio, añádelo ahí.
- No añadir al repo imágenes/sonidos con derechos de Pokémon sin revisar licencia. Los retratos de SpriteCollab
  (CC BY-NC 4.0) se cargan en remoto con atribución.

## Publicar

- Web: merge a `master` → `.github/workflows/pages.yml` publica en Pages (origen «GitHub Actions»).
- Servidor: Render con `render.yaml` (`node server/room-server.js`, plan gratuito, salas en memoria).
- Android: `eas build --profile preview --platform android` (ver `docs/RELEASE_0_1_GRATUITA.md`).

## Referencias

`PROJECT_CONTEXT.md` (arquitectura y fases), `docs/DESARROLLO.md`, `docs/ROOM_RECONNECT_CONTRACT.md`,
`SINGLE_PLAYER_TEST_PLAN.md`, `docs/SECURITY.md`, `MEMORY.md` (decisiones y trampas), `PLAN.md` (hoja de ruta).
