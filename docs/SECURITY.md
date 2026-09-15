# 🛡️ Seguridad de PokéQuién

Estado: revisión aplicada el 14/09/2026.

## Modelo de amenaza

PokéQuién no tiene cuentas, contraseñas ni datos personales. La sala se identifica con un código corto y cada dispositivo recibe un token aleatorio de reconexión. El objetivo realista es evitar manipulación automatizada del WebSocket, filtrado prematuro de secretos y agotamiento sencillo del servidor; no se puede prometer seguridad de nivel bancario para una sala pública sin identidad.

## Controles actuales

| Zona | Control |
| --- | --- |
| Identidad temporal | Token de 48 bytes hexadecimales, guardado con `expo-secure-store` en Android/iOS y `sessionStorage` aislado por pestaña en web. |
| Privacidad | `publicState()` solo envía el secreto propio; el secreto rival se queda en `null` hasta el final. El popup final solo muestra curiosidades del Pokémon elegido por ese jugador. |
| Reglas | El servidor valida generación, tablero de 25 candidatos distintos, ids 1–1025 y fase antes de cada selección/tachado. |
| Entrada | Límite de payload WebSocket de 64 KiB, texto/URLs acotados y JSON parseado sin `eval`. |
| Abuso | Máximo de 40 mensajes por conexión cada 10 segundos, máximo de 500 salas y limpieza de salas inactivas. |
| CSWSH | Allowlist de orígenes configurable con `ROOM_SERVER_ALLOWED_ORIGINS`; en local se permiten `localhost` y `127.0.0.1`. Las apps nativas sin `Origin` siguen funcionando. |
| Sesiones | Comparación constante del token de reconexión, una conexión por jugador y ventana de reconexión de 60 segundos. |
| Recursos | TTL de salas desconectadas y retención corta del estado abandonado. |
| Cliente | Las URLs de sprites solo se presentan como fuentes de imagen; no se interpolan como HTML. |

## Puesta en producción pendiente

- Servir el cliente y el WebSocket con HTTPS/WSS; `EXPO_PUBLIC_ROOM_SERVER_URL` debe usar `wss://` fuera de localhost.
- En un PaaS que inyecte `PORT`, el servidor lo acepta antes de `ROOM_SERVER_PORT`; `render.yaml` deja preparada una instancia única para la beta.
- Sustituir el `Map` en memoria por almacenamiento efímero y añadir límites por IP/proxy si se publica.
- Configurar `ROOM_SERVER_ALLOWED_ORIGINS` con el dominio exacto y eliminar la tolerancia a localhost.
- Añadir heartbeat/ping del proxy, observabilidad sin registrar tokens ni mensajes completos y alertas de abuso.
- Entregar el cliente web con CSP, `frame-ancestors 'none'`, `object-src 'none'` y cabeceras de seguridad del hosting; la [CSP de MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP) sirve como referencia de configuración.
- Revisar licencias/atribuciones de retratos, audios y fondo antes de distribuir públicamente.

## Verificación

```text
npm run typecheck
node --check server/room-server.js
git diff --check
```

Las decisiones siguen la [guía de seguridad WebSocket de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html): allowlist de `Origin`, validación de cada mensaje, límites de tamaño, rate limiting y limpieza de conexiones. `expo-secure-store` se usa solo para el token pequeño de sesión, siguiendo su almacenamiento seguro en [Android/iOS](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/); el historial local de partidas sigue siendo deliberadamente no sensible.

## Auditoría de dependencias

`npm audit --omit=dev --audit-level=high` no detecta vulnerabilidades altas o críticas, pero informa 10 moderadas transitivas relacionadas con `uuid`/`xcode` dentro de la cadena Expo. `npm audit fix --force` propone degradar Expo y rompería el SDK actual, por lo que no se aplicó automáticamente. Queda anotado para resolverlo con una actualización coordinada de Expo.
