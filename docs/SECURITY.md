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

## Puesta en producción pendiente

- Servir el cliente y el WebSocket con HTTPS/WSS; `EXPO_PUBLIC_ROOM_SERVER_URL` debe usar `wss://` fuera de localhost.
- En un PaaS que inyecte `PORT`, el servidor lo acepta antes de `ROOM_SERVER_PORT`; `render.yaml` deja preparada una instancia única para la beta.
- Sustituir el `Map` en memoria por almacenamiento efímero (los límites por IP/proxy ya están desde el 24/10/2026).
- Configurar `ROOM_SERVER_ALLOWED_ORIGINS` con el dominio exacto y eliminar la tolerancia a localhost.
- Añadir observabilidad sin registrar tokens ni mensajes completos y alertas de abuso (el heartbeat ya existe).
- La web de GitHub Pages ya lleva CSP por `<meta>`; Pages no permite cabeceras propias, así que `frame-ancestors` no se puede aplicar ahí. Referencia: [CSP de MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP).
- Revisar licencias/atribuciones de retratos, audios y fondo antes de distribuir públicamente.

## Verificación

```text
npm run typecheck
npm test
node --check server/room-server.js
git diff --check
```

Dependencias (25/10/2026, SDK 58): `zod` se fuerza a `^4.6.7` dentro de `@expo/cli` con `overrides` en `package.json` (aviso GHSA-mrhx-c7xc-m3w5 resuelto; el CLI solo usa API compatible con zod 4). Queda `node-forge` ≤ 1.4.0 (GHSA-86w9-cpqp-85rv), **sin versión corregida publicada**: solo lo usa `@expo/cli` (herramienta de desarrollo) para leer certificados de firma de iOS y de expo-updates, funciones que este proyecto no usa; no llega a la APK, a la web ni al servidor de salas. Se quitará cuando salga una versión corregida (Dependabot la propondrá).

Las decisiones siguen la [guía de seguridad WebSocket de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html): allowlist de `Origin`, validación de cada mensaje, límites de tamaño, rate limiting y limpieza de conexiones. `expo-secure-store` se usa solo para el token pequeño de sesión, siguiendo su almacenamiento seguro en [Android/iOS](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/); el historial local de partidas sigue siendo deliberadamente no sensible.

## Auditoría de dependencias

`npm audit --omit=dev --audit-level=high` no detecta vulnerabilidades altas o críticas, pero informa 10 moderadas transitivas relacionadas con `uuid`/`xcode` dentro de la cadena Expo. `npm audit fix --force` propone degradar Expo y rompería el SDK actual, por lo que no se aplicó automáticamente. Queda anotado para resolverlo con una actualización coordinada de Expo.
