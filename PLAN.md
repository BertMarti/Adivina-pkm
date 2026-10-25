# PLAN.md — Hoja de ruta de PokéQuién

Actualizado el 25/10/2026. Prioridad de arriba abajo.

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

## ⏭️ Siguiente

1. **Tras fusionar**: comprobar que Render aplica `rootDir: server`, `ROOM_SERVER_ALLOWED_ORIGINS=https://bertmarti.github.io` y
   `ROOM_SERVER_TRUST_PROXY=1` (si el servicio no está enlazado al Blueprint, ponerlas a mano) y jugar un Duelo desde Pages.
   Verificar también que las peticiones llegan con la cabecera `CF-Connecting-IP` (si no, los límites por IP usan la
   primera IP de `X-Forwarded-For`, que el cliente puede falsificar).
2. **Licencias**: sustituir GIF y sonidos de terceros por recursos propios antes de publicar en tiendas o con anuncios.
3. **node-forge**: cuando salga una versión corregida de GHSA-86w9-cpqp-85rv, actualizar (Dependabot la propondrá).
4. **Reglas compartidas**: extraer las transiciones a un módulo JS común (o pruebas de contrato) para que servidor y
   motor no diverjan.
5. **Accesibilidad**: probar con TalkBack (Android) y VoiceOver (iOS) en un móvil real; en web ya se anuncian las fases.
6. **Pruebas de UI del Duelo**: ampliar `npm run test:web` con un Duelo entre dos pestañas contra un servidor local.

## 💡 Ideas

- Almacenamiento efímero gratuito (p. ej. Redis/Upstash free) para que las salas sobrevivan a un reinicio.
- Ajustes de sonido y vibración; modo daltónico extra para el tachado.
- Estadísticas del Solitario (preguntas medias, Pokémon más difíciles) exportables.
