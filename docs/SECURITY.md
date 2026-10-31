# 🛡️ Seguridad de PokéQuién

Estado: revisión aplicada el 14/09/2026 y ampliada el 24/10/2026.

## Modelo de amenaza

PokéQuién no tiene cuentas, contraseñas ni datos personales. La sala se identifica con un código corto y cada dispositivo recibe un token aleatorio de reconexión. El objetivo realista es evitar manipulación automatizada del WebSocket, filtrado prematuro de secretos y agotamiento sencillo del servidor; no se puede prometer seguridad de nivel bancario para una sala pública sin identidad.

## Controles actuales

| Zona | Control |
| --- | --- |
| Identidad temporal | Token de 48 bytes hexadecimales, guardado con `expo-secure-store` en Android/iOS y `sessionStorage` aislado por pestaña en web. |
| Privacidad | `publicState()` solo envía el secreto propio; el secreto rival se queda en `null` hasta el final. El popup final solo muestra curiosidades del Pokémon elegido por ese jugador. |
| Reglas | El servidor valida generación, tablero de 25 candidatos distintos, ids 1–1025 y fase antes de cada selección/tachado. |
| Entrada | Límite de payload WebSocket de 64 KiB, texto/URLs acotados y JSON parseado sin `eval`. |
| WebSocket (24/10/2026) | El manejador de errores se registra al principio de cada conexión (también las rechazadas por cupo de IP): un marco inválido o mayor de 64 KiB cierra esa conexión sin tumbar el proceso. |
| Abuso | Máximo de 40 mensajes por conexión cada 10 segundos, máximo de 500 salas y limpieza de salas inactivas. |
| Abuso por IP (24/10/2026) | 300 peticiones HTTP por minuto e IP (429 + `Retry-After`), 20 salas creadas por IP cada 10 minutos, 20 conexiones WebSocket simultáneas por IP. Con `ROOM_SERVER_TRUST_PROXY=1` la IP sale de `CF-Connecting-IP` o, si falta, de la primera de `X-Forwarded-For`. |
| Conexiones muertas (24/10/2026) | Heartbeat ping/pong cada 30 s; los sockets que no responden se cierran. |
| Cuerpo HTTP (24/10/2026) | Máximo 64 KiB con respuesta 413; el JSON debe ser un objeto y los ids, enteros. |
| Web (24/10/2026) | La build de Pages lleva CSP (`default-src 'self'`, sin `unsafe-eval`, `object-src 'none'`, imágenes solo de `raw.githubusercontent.com`). |
| Imágenes (24/10/2026) | Las fuentes remotas del tablero se limitan a `raw.githubusercontent.com/PMDCollab/SpriteCollab/` y `raw.githubusercontent.com/PokeAPI/sprites/`, comprobadas sobre la URL normalizada (sin `..`, query ni usuario); también se aceptan PNG/GIF/WebP/JPEG embebidos. |
| Health (24/10/2026) | `GET /` devuelve CORS `*` y `originAllowed` (`true`, `false` o `null`) para que la web diagnostique su origen; no relaja el control del WebSocket. |
| CSP (24/10/2026) | `connect-src` permite solo `'self'` y el servidor de salas configurado, no cualquier `https:` o `wss:`. |
| Repositorio (24/10/2026) | CI con gitleaks sobre todo el historial, Dependabot semanal y `.env` ignorado. |
| CSWSH | Allowlist de orígenes configurable con `ROOM_SERVER_ALLOWED_ORIGINS`; en local se permiten `localhost` y `127.0.0.1`. Las apps nativas sin `Origin` siguen funcionando. |
| Sesiones | Comparación constante del token de reconexión, una conexión por jugador y ventana de reconexión de 60 segundos. |
| Recursos | TTL de salas desconectadas y retención corta del estado abandonado. |
| Cliente | Las URLs de sprites solo se presentan como fuentes de imagen; no se interpolan como HTML. |
| Almacenamiento local (31/10/2026) | Ajustes (`adivina-pkm:ajustes:v1`) e historial del Solitario (`adivina-pkm:single-player-log:v1`) con prefijo del proyecto, porque `bertmarti.github.io` es un origen compartido; no contienen nada sensible y se validan al leerlos (un valor manipulado se descarta). Las exportaciones CSV escapan celdas que empiezan por `= + - @` para evitar fórmulas en hojas de cálculo. |

## Estado en producción (31/10/2026)

El 31/10/2026 Render ya ejecuta el servidor 1.0.0 (`GET /` → `"version":"1.0.0"`). La 1.1.0 no cambia el servidor ni el
protocolo (solo su número de versión), así que no hace falta volver a desplegarlo con prisa.

### Hecho

- Cliente web y WebSocket en GitHub Pages y Render con HTTPS/WSS.
- El servidor acepta `PORT` (con prioridad sobre `ROOM_SERVER_PORT`).
- `ROOM_SERVER_ALLOWED_ORIGINS` en Render: `https://bertmarti.github.io`.
- La CSP de Pages está aplicada en la build; Pages no permite cabeceras propias, por lo que no incluye `frame-ancestors`.
- Límites por IP y heartbeat activos.

### Limitaciones conocidas

- Las salas viven en un `Map` en memoria y se pierden si Render reinicia.
- La lista de orígenes acepta además `localhost` y `127.0.0.1` a propósito para desarrollo.
- No hay observabilidad ni alertas.
- Las licencias de GIF y sonidos de terceros deben revisarse antes de publicar en tiendas.

## Verificación

```text
npm run typecheck
npm test
node --check server/room-server.js
git diff --check
```

Dependencias (31/10/2026, SDK 58, expo 58.0.21): `node-forge` 1.4.2 (publicada el 27/10/2026) corrige GHSA-86w9-cpqp-85rv y otros 11 avisos de forge; `npm audit` ya no da ninguna alta ni crítica. Quedan 12 avisos moderados/bajos, todos dentro de las herramientas de Expo (`@expo/cli`, `@expo/config`, `@expo/metro-config`…), por tres paquetes sin versión corregida dentro de su major: `glob` 13 (GHSA-3g3m-2fjr-6pw4, se corrige en 14.0.2), `minimatch` 10 (GHSA-g3hv-75wg-m249, en 11.0.1) y `deepmerge` 4.3.1 (GHSA-gcqx-w48m-w2h4, baja, sin parche). Solo se usan en el ordenador de desarrollo o en CI con patrones y archivos del propio repo; no llegan a la APK, la web ni el servidor de salas. La «solución» de `npm audit fix --force` (bajar a expo 51) no tiene sentido; se aceptarán cuando Expo publique un parche del SDK 58 con esas majors. `npm audit` dentro de `server/` da 0 vulnerabilidades. `zod` se fuerza a `^4.6.7` dentro de `@expo/cli` con `overrides` en `package.json` (GHSA-mrhx-c7xc-m3w5 resuelto; el CLI solo usa API compatible con zod 4).

Las decisiones siguen la [guía de seguridad WebSocket de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html): allowlist de `Origin`, validación de cada mensaje, límites de tamaño, rate limiting y limpieza de conexiones. `expo-secure-store` se usa solo para el token pequeño de sesión, siguiendo su almacenamiento seguro en [Android/iOS](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/); el historial local de partidas sigue siendo deliberadamente no sensible.
