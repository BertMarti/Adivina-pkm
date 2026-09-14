# Guía rápida de agentes

- Mantener la máquina de estados pura en `src/game/engine.ts`.
- No mover secretos Pokémon al estado público cuando se añada un backend.
- Tratar las imágenes remotas como dependencias externas: cachear, mostrar fallback y conservar atribución.
- Validar siempre accesibilidad móvil: controles ≥44 px, contraste, etiquetas de estado y tachado no dependiente solo del color.
