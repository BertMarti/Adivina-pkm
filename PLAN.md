# PLAN.md — Hoja de ruta de PokéQuién

Actualizado el 26/10/2026 (versión 1.0.0). Prioridad de arriba abajo.

## ✅ Hecho hoy (24/10/2026, v0.2.0)

- Web jugable en GitHub Pages (build de Expo con ruta base `/Adivina-pkm`, CSP, HTML en español, foco visible).
- Enlace de invitación correcto bajo `/Adivina-pkm/` y ejemplo de código de sala válido.
- Servidor de salas endurecido (límites por IP, heartbeat, 413/429, validación de mensajes) y testeable.
- 26 pruebas automáticas (servidor + motor) y CI con gitleaks, tipos, pruebas, verificación del Solitario y build web.
- Dependabot semanal, `SECURITY.md`, Expo 57.0.31 y `npm audit fix` (sin avisos críticos).
- Privacidad: fuera la IP LAN real; `.env` ignorado.
- README para jugadores con banner, capturas reales y FAQ; guía técnica en `docs/DESARROLLO.md`; AGENTS/CLAUDE/MEMORY/PLAN,
  subagentes y skills de Claude.

## ✅ Hecho en la fase 2 (24/10/2026, v0.3.0)

- Servidor separado en `server/`, scripts de arranque y ayuda, pruebas y despliegue de Render con `rootDir: server`.
- Health diagnosticable, lista blanca de imágenes, manejo de errores WebSocket y CSP de conexiones restringida.
- Guía de tres pasos, invitaciones, mensajes de error, créditos y documentación de administración.
- Dependabot actualizado y reglas para evitar saltos parciales de SDK.

## ✅ Hecho en la fase 3 (25/10/2026, v0.4.0)

- Expo SDK 58 completo; `zod` corregido; `node-forge` sin parche publicado (solo herramienta de desarrollo).
- `App.tsx` troceado por pantallas; regiones vivas para fases, turno y resultado; objetivos táctiles ≥ 44 px.
- Fuente PokeQuien Pixel con mayúsculas acentuadas legibles.
- Prueba de humo de la web con Chromium sin cabeza (local y CI).
- PWA instalable: Solitario sin red y caché de retratos.

## ✅ Versión 1.0.0 (26/10/2026)

- Versión 1.0.0 en la app, el servidor de salas y la pantalla «Acerca de»; el servidor informa de su versión en `GET /`.
- Duelo sin bloqueos: botón CANCELAR mientras conecta, errores junto al panel que los provoca (o arriba con un enlace de
  invitación), salida de la sala en la elección y la espera, y aviso de rival desconectado en todas las fases.
- Solitario: el historial confirma antes de borrar y avisa al copiarlo.
- Prueba de humo con servidor de salas dormido y caído; prueba de coherencia de versiones.
- Documentación de usuario y de seguridad al día; documentos de fases anteriores marcados como históricos.

## ⏭️ Después de la 1.0

1. **Render (Alberto)**: poner Root Directory `server` (o Blueprints → Sync), volver a desplegar y comprobar que
   `GET /` devuelve `"version":"1.0.0"`. Verificar también que llega `CF-Connecting-IP` (si no, los límites por IP usan
   la primera IP de `X-Forwarded-For`, que el cliente puede falsificar).
2. **Licencias antes de tiendas o anuncios**: sustituir los GIF de espera y los sonidos de terceros por recursos propios.
3. **node-forge**: cuando salga una versión corregida de GHSA-86w9-cpqp-85rv, aceptar la PR de Dependabot y quitar el
   `overrides` de zod si @expo/cli ya trae zod 4.
4. **Duelo en CI**: ampliar `npm run test:web` con un Duelo completo entre dos pestañas contra un servidor local
   (hoy se prueba a mano y con el script de la revisión).
5. **Reglas compartidas**: extraer las transiciones a un módulo JS común (o pruebas de contrato) para que servidor y
   motor no diverjan.
6. **Accesibilidad en móvil real**: TalkBack (Android) y VoiceOver (iOS); en web ya se anuncian las fases.
7. **Avisar al rival al salir a propósito**: hoy, al pulsar SALIR por WebSocket, el rival espera 60 s como si fuera
   una desconexión; un mensaje `leave` permitiría cerrar la partida al momento.
8. **APK de Android 1.0.0**: generarla con EAS (`docs/RELEASE_0_1_GRATUITA.md`) cuando se resuelva el punto 2.

## 💡 Ideas

- Almacenamiento efímero gratuito (p. ej. Redis/Upstash free) para que las salas sobrevivan a un reinicio.
- Ajustes de sonido y vibración; modo daltónico extra para el tachado.
- Estadísticas del Solitario (preguntas medias, Pokémon más difíciles) exportables.
