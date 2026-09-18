# 🚀 PokéQuién 0.1 — release móvil gratuita

Esta guía convierte el proyecto en una beta instalable en teléfonos Android.
La APK es el cliente y el servidor de salas es un servicio separado. Para
jugar desde redes distintas, ambos móviles deben apuntar a una URL pública
`wss://`; la IP `192.168.x.x` solo sirve dentro de la red de casa.

## Estado preparado en el repositorio

- `app.json` ya define `PokéQuién`, versión `0.1.0` y el paquete Android
  `com.pokequien.app`.
- `eas.json` incluye el perfil `preview`, que produce una APK instalable y no
  un AAB de tienda.
- `render.yaml` crea el servidor WebSocket como servicio Node gratuito.
- `server/room-server.js` acepta el `PORT` que asigna el hosting y conserva
  `ROOM_SERVER_PORT` para el desarrollo local.
- El cliente incluye como respaldo `wss://pokequien-rooms.onrender.com` y
  espera hasta 45 segundos para que el servicio gratuito despierte. La
  variable de EAS sigue siendo recomendable si en el futuro cambias de host.
- El servidor conserva salas en memoria y mantiene la ventana de reconexión
  de 60 segundos. Un reinicio del servicio termina las salas activas; es una
  limitación asumida para esta beta.

## 1. Crear el servidor público gratuito

1. Sube este repositorio a GitHub (privado o público).
2. Crea una cuenta gratuita en Render.
3. Pulsa **New → Blueprint** y selecciona el repositorio.
4. Render detectará `render.yaml`. Confirma el servicio `pokequien-rooms` y
   conserva el plan `Free`.
5. En **Environment**, establece `ROOM_SERVER_ALLOWED_ORIGINS` con los
   orígenes web exactos que vayan a usar el cliente, separados por comas.
   Para una APK nativa se puede dejar vacío porque las conexiones nativas no
   envían `Origin`.
6. Espera a que el despliegue termine y copia la URL `https://...onrender.com`.

Comprueba la salud del servicio abriendo esa URL en el navegador. Debe
responder un JSON parecido a:

```json
{"ok":true,"rooms":0}
```

La URL WebSocket equivalente cambia `https://` por `wss://`:

```text
wss://tu-servicio.onrender.com
```

⚠️ El plan gratuito puede suspender servicios inactivos. Por ello sirve para
una beta y pruebas, pero no garantiza que una sala sobreviva a una suspensión
o reinicio. No escales a varias instancias: este servidor usa memoria local.

## 2. Crear la APK standalone

Desde PowerShell, en la raíz del proyecto:

```powershell
npx eas-cli@latest login
npx eas-cli@latest build:configure
```

Antes de compilar, guarda la URL real de Render en el entorno `preview` de
EAS. Es una URL pública, no una contraseña, y debe ser `wss://`:

```powershell
npx eas-cli@latest env:set `
  --name EXPO_PUBLIC_ROOM_SERVER_URL `
  --value "wss://tu-servicio.onrender.com" `
  --environment preview `
  --visibility plaintext
npx eas-cli@latest build --platform android --profile preview
```

También puedes crearla desde **Project settings → Environment variables** en
expo.dev. El perfil `preview` ya está vinculado al entorno `preview` en
`eas.json`, por lo que la URL queda incorporada al bundle durante la build.
No guardes tokens ni contraseñas en el repositorio.

EAS entregará un enlace a un archivo `.apk`. Ábrelo en cada Android, autoriza
la instalación desde el navegador o gestor de archivos cuando el sistema lo
solicite y completa la instalación. Los dos teléfonos deben tener la misma
APK.

## 3. Probar J1 y J2

1. Abre PokéQuién en el móvil de J1.
2. Pulsa **Crear partida**.
3. Copia el código o el enlace de invitación.
4. Abre PokéQuién en el móvil de J2.
5. Pulsa **Unirse a una partida** e introduce el código.
6. Comprueba que ambos pasan a la selección 5×5.
7. Elige un Pokémon distinto en cada móvil.
8. Verifica que cada jugador solo puede tachar y destachar su tablero.
9. Completa una victoria y una derrota para comprobar los sonidos y la
   curiosidad privada del Pokémon correspondiente.
10. Cierra la aplicación de uno de los móviles, espera menos de 60 segundos,
    vuelve a abrirla y comprueba la reconexión.

## 4. Diagnóstico rápido

Desde el móvil, abre en el navegador la URL HTTPS de Render. Si no devuelve
`{"ok":true,...}`, el problema está en el despliegue del servidor. Si la
salud funciona pero la APK no conecta, la build se creó con una URL incorrecta:
la variable `EXPO_PUBLIC_ROOM_SERVER_URL` se incorpora durante la compilación
y cambiarla después no modifica una APK ya instalada.

No uses estos valores en una APK pública:

```text
ws://localhost:8787
ws://10.0.2.2:8787
ws://192.168.0.98:8787
```

## 5. Coste y límites

- Render Free: coste cero, con suspensión y límites del plan.
- EAS Free: suficiente para una beta pequeña, sujeto a su cuota mensual.
- APK compartida por enlace: no requiere pagar Google Play.
- Google Play: solo si se publica en la tienda; requiere cuenta de desarrollador.
- iPhone: no usa APK; requiere una distribución iOS específica.

Para una beta fan de dos móviles, la ruta más económica es Render Free + EAS
Free + APK compartida por enlace.

## 6. Lo que queda para una versión posterior

- Persistir salas en Redis o una base de datos.
- Añadir heartbeat y métricas sin registrar tokens.
- Añadir un dominio propio y una página de descarga.
- Generar AAB firmado para Google Play.
- Revisar licencias y atribuciones de Pokémon, SpriteCollab, fondo y audios
  antes de distribuir públicamente.
