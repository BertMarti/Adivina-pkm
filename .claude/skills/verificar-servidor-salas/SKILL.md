---
name: verificar-servidor-salas
description: Comprobar el servidor de salas multijugador de PokéQuién (server/room-server.js) tras tocar reglas, protocolo o límites. Úsalo antes de subir cambios en server/ o en src/game/engine.ts.
---

# Verificar el servidor de salas

`server/room-server.js` exporta `createRoomServer(opciones)`; al ejecutarse directamente (`npm run room-server`)
escucha en `PORT`/`ROOM_SERVER_PORT` (8787 por defecto).

## Pasos
1. `node --check server/room-server.js`
2. `npm test` — ejecuta `server/room-server.test.js` (flujo completo, privacidad del secreto, errores, límites,
   orígenes, HTTP de sondeo) y `src/game/engine.test.ts`.
3. Si cambias una regla del juego, cámbiala en `src/game/engine.ts` **y** en el servidor (el JS replica las
   reglas) y añade la prueba en los dos archivos de test.
4. Arranque real: `ROOM_SERVER_PORT=18787 npm run room-server` debe mostrar
   `Room server listening on ws://0.0.0.0:18787`. Si sale EADDRINUSE, ya hay otra instancia.
5. Prueba manual: `EXPO_PUBLIC_ROOM_SERVER_URL=ws://localhost:18787 npm run web` y abre la sala en dos pestañas.

## Reglas
- Nunca envíes el `secretId` rival antes de `finished` (`publicState`).
- Los textos de error son parte de la UX: en español de España y sin datos internos.
- No registres tokens ni mensajes completos. No metas IPs reales en ejemplos (usa `192.168.1.50`).
- Los límites por IP se configuran por opciones; en Render `ROOM_SERVER_TRUST_PROXY=1` hace que se use la IP de
  `X-Forwarded-For`.
