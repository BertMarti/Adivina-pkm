@AGENTS.md

## Específico de Claude Code

- Lee también `MEMORY.md` (decisiones, trampas, estado) y `PLAN.md` (qué sigue) antes de cambios grandes.
- Subagentes en `.claude/agents/`:
  - `revisor-seguridad`: antes de una PR que toque `server/`, `roomClient.ts`, `.env*`, workflows o dependencias.
  - `probador-web`: tras cambios de interfaz; construye la web, la sirve bajo `/Adivina-pkm/` y hace capturas.
- Skills en `.claude/skills/`:
  - `publicar-pages`: build web, ruta base, CSP y workflow de Pages.
  - `verificar-servidor-salas`: comprobaciones del servidor de salas tras tocar reglas o protocolo.
- `.claude/settings.json` habilita el plugin `expo` oficial.
- No lances el Duelo contra el servidor de Render de producción con bots: usa `npm run room-server` en local.
- Si actualizas el estado del proyecto, apúntalo en `MEMORY.md` con fecha y mueve tareas en `PLAN.md`.
