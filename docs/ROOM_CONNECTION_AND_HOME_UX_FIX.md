# Mejora de conexión y menú móvil

## Problemas observados

- En móviles, al desplazarse por el menú principal se perdía el contexto del
  encabezado y el panel de creación podía quedar visualmente cortado.
- Algunas builds antiguas conservaban una URL local del servidor de salas. En
  un teléfono real esa URL no es accesible fuera de la red doméstica y acababa
  mostrando un error genérico.

## Cambios realizados

- El menú principal incorpora una barra compacta fija con la marca `PokéQuién`
  y el estado `MENÚ PRINCIPAL`, manteniendo la orientación al desplazarse.
- El margen superior del contenido se ha ajustado para respetar el área segura
  del sistema sin crear un hueco excesivo.
- Los errores de conexión ahora aparecen en una tarjeta diferenciada con el
  botón accesible `REINTENTAR`, que repite la última acción de crear o unirse.
- El cliente WebSocket prueba la URL configurada y, si no responde, utiliza
  automáticamente `wss://pokequien-rooms.onrender.com` como respaldo público.
- El tiempo de espera por endpoint queda limitado a 12 segundos para que el
  usuario pueda recuperarse sin quedarse bloqueado durante 45 segundos.

## Validación

- `npm run typecheck` ✅
- `git diff --check` ✅
- `npx expo export --platform web` ✅
- El endpoint público responde `{"ok":true,"rooms":0}` y acepta WebSocket.

## Nota para la APK

Una APK ya instalada no recibe cambios de JavaScript automáticamente. Hay que
generar e instalar una nueva build para incluir este ajuste. La configuración
de producción debe usar `wss://`; las direcciones `localhost`, `10.0.2.2` y
`192.168.x.x` se reservan para desarrollo local.
