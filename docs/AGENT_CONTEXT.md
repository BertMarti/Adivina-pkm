# Contexto compartido del proyecto

> Documento de coordinación para cualquier persona o agente que trabaje en **PokéQuién**.

## Objetivo

Crear una experiencia móvil fiel al flujo visual de las referencias del proyecto: una partida de “Quién es quién” con retratos PMD, salas por código, selección secreta, dos tableros 5×5, tachado reversible y resultado final con curiosidades.

La aplicación es un fan project no oficial. La inspiración visible debe reconocer a **Checo_512** y los retratos deben reconocer a **SpriteCollab (PMD)**.

## Principios que no se deben romper

1. La cuadrícula siempre conserva 25 casillas y cinco columnas.
2. La selección secreta ocurre directamente sobre la cuadrícula; no existe una pantalla neutra de “pasa el móvil”.
3. El secreto del rival nunca se envía al cliente antes de `finished`.
4. Cada jugador solo puede modificar los tachados de su propio tablero.
5. Debe quedar al menos un Pokémon libre. La victoria llega cuando queda exactamente el secreto rival.
6. Un cierre inesperado inicia una ventana de reconexión de 60 segundos.
7. Los recursos externos necesitan fallback y no deben bloquear la partida si una imagen falla.
8. Respetar `prefers-reduced-motion`, etiquetas accesibles y zonas táctiles cómodas.

## Estructura principal

| Área | Archivo o carpeta | Responsabilidad |
|---|---|---|
| Entrada y UI | `App.tsx` | Navegación, salas, tablero, audio, modal de victoria y fondo. |
| Reglas puras | `src/game/engine.ts` | Selección, tachado, candidatos restantes y victoria local. |
| Red | `src/game/roomClient.ts` | WebSocket, sesión persistente y reintentos de reconexión. |
| Servidor | `server/room-server.js` | Estado autoritativo en memoria, privacidad y ciclo de sala. |
| Catálogo | `src/data/pokemon.ts` | PokéAPI, Kanto local, URLs SpriteCollab y fallbacks. |
| Curiosidades | `src/data/pokemonFacts.ts` | Tres textos cortos por Pokémon o fallback determinista. |
| Solitario | `src/singlePlayer/` | Preguntas SÍ/NO, motor de deducción e historial local. |
| Audio | `src/audio/sounds.ts`, `assets/*.wav` | Efectos locales y tonos de interacción. |
| Guías | `docs/` | Contexto de diseño, reglas, recursos y verificación. |

## Contrato de pantallas

```text
HOME
 ├─ CREAR SALA → ROOM → SELECTION → WAITING-FOR-SELECTION → GAME → FINISHED MODAL
 ├─ UNIRSE POR CÓDIGO ────────────────────────────────────────┘
 └─ JUGAR CONTRA LA MÁQUINA → MODO SOLITARIO
```

`abandoned` vuelve a HOME con un mensaje que indica qué jugador abandonó.

## Checklist de cambios

- Mantener las reglas en el motor o servidor, nunca solo en estilos o textos.
- Si se cambia el estado compartido, actualizar simultáneamente cliente, servidor y `PROJECT_CONTEXT.md`.
- Comprobar `npm run typecheck`, `npx expo export --platform web` y `git diff --check`.
- Probar al menos un flujo de sala con dos pestañas y un flujo de solitario.
- El catálogo nacional está generado localmente; la selección de 25 sigue siendo ligera y el modo solitario puede usar las 1.025 entradas sin una petición a PokéAPI.

## Estado de esta iteración

- Fondo local de SpriteCollab incorporado en `assets/spritecollab-background.png`.
- Fallback de retrato `Happy → Normal → retrato base → PokeAPI` y `Sad → Normal → retrato base → PokeAPI`.
- Rematch en la misma sala, reconexión de un minuto y estado `abandoned`.
- Modal de resultado con victoria/derrota, audio específico, sprite y curiosidades únicamente del Pokémon elegido por el jugador local, más `JUGAR DE NUEVO`.
- Título flotante, Poké Ball de espera con movimiento suave y nombres/Dex en casillas.
- Banco solitario nacional con preguntas de tipos, colores, silueta, animal de inspiración, hábitat y cuerpo; sin preguntas de número nacional, peso, región ni generación.
- Motor solitario con semilla por ronda, ganancia de información ponderada por creencia, tolerancia a respuestas imperfectas y límite de 30 preguntas; el historial local guarda cada respuesta y resultado.
