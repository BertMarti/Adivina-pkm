# PLAN.md — Hoja de ruta de PokéQuién

Actualizado el 24/10/2026. Prioridad de arriba abajo.

## ✅ Hecho hoy (24/10/2026, v0.2.0)

- Web jugable en GitHub Pages (build de Expo con ruta base `/Adivina-pkm`, CSP, HTML en español, foco visible).
- Enlace de invitación correcto bajo `/Adivina-pkm/` y ejemplo de código de sala válido.
- Servidor de salas endurecido (límites por IP, heartbeat, 413/429, validación de mensajes) y testeable.
- 26 pruebas automáticas (servidor + motor) y CI con gitleaks, tipos, pruebas, verificación del Solitario y build web.
- Dependabot semanal, `SECURITY.md`, Expo 57.0.31 y `npm audit fix` (sin avisos críticos).
- Privacidad: fuera la IP LAN real; `.env` ignorado.
- README para jugadores con banner, capturas reales y FAQ; guía técnica en `docs/DESARROLLO.md`; AGENTS/CLAUDE/MEMORY/PLAN,
  subagentes y skills de Claude.

## ⏭️ Siguiente

1. **Tras fusionar**: comprobar que Render aplica `ROOM_SERVER_ALLOWED_ORIGINS=https://bertmarti.github.io` y
   `ROOM_SERVER_TRUST_PROXY=1` (si el servicio no está enlazado al Blueprint, ponerlas a mano) y jugar un Duelo desde Pages.
   Verificar también que las peticiones llegan con la cabecera `CF-Connecting-IP` (si no, los límites por IP usan la
   primera IP de `X-Forwarded-For`, que el cliente puede falsificar).
2. **`server/package.json` propio** con solo `ws`, y `rootDir: server` en `render.yaml`, para no instalar Expo en Render
   (despliegues más rápidos y sin los avisos de `@expo/cli` en producción).
3. **Reglas compartidas**: extraer las transiciones a un módulo JS común (o pruebas de contrato) para que servidor y
   motor no diverjan.
4. **Trocear `App.tsx`** (790 líneas con JSX en una sola línea) en componentes por pantalla, sin cambiar el aspecto.
5. **Accesibilidad**: anunciar cambios de fase con `accessibilityLiveRegion`, revisar chips de generación (≥ 44 px) y
   probar con lector de pantalla en Android.
6. **Fuente**: sustituir las vocales acentuadas en mayúscula por una variante legible o usar otra fuente pixel con «Á É Í Ó Ú».
7. **Pruebas de UI** de humo con Chromium sin cabeza sobre la build web (cargar, entrar en Solitario, responder).
8. **Licencias**: revisar derechos de GIFs, fondo y audios antes de publicar en tiendas.

## 💡 Ideas

- Almacenamiento efímero gratuito (p. ej. Redis/Upstash free) para que las salas sobrevivan a un reinicio.
- Ajustes de sonido y vibración; modo daltónico extra para el tachado.
- PWA instalable con caché de retratos para jugar el Solitario sin red.
- Estadísticas del Solitario (preguntas medias, Pokémon más difíciles) exportables.
