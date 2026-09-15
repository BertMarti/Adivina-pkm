# ⚡ Informe de trabajo · PokéQuién

> Estado de la revisión: 14/09/2026 · primera versión jugable verificada en local.

## Resultado en una pantalla

```text
POKÉ QUIÉN
   ├─ CREAR PARTIDA · código listo · COPIAR ENLACE
   ├─ UNIRSE A PARTIDA · código del rival
   ├─ MODO SOLITARIO · JUGAR CONTRA LA MÁQUINA
   └─ DUELO 2 JUGADORES · tablero 5 × 5 · X roja · rematch
```

## Trabajo realizado

| Área | Resultado |
| --- | --- |
| Marca | `PokéQuién · Duelo Pixel`, `pokequien://` y título web `PokéQuién · Duelo Pixel`. |
| Icono | Icono cuadrado pixel-art de mascota eléctrica amarilla en `assets/icon.png`, favicon y foreground Android. |
| Catálogo | 151 Pokémon de Kanto y 1.025 entradas nacionales locales, con nombres, tipos, peso, Dex, retrato, fallback, descripción y tres datos. |
| Solo | Botón visible en el inicio, elección secreta, 126 preguntas Kanto / 86 nacionales de tipo, evolución, color, silueta, hábitat y conocimiento básico, selector adaptativo tipo Akinator con creencia tolerante y exploración por semilla, máximo de 30 preguntas, respuestas SÍ/NO y registro local de cada sesión humana. Si la máquina no acierta en 30, gana el jugador y ve su sprite y curiosidades. |
| Multijugador | Sala por código, enlace directo, dos clientes, selección privada, dos tableros independientes, tachado reversible, rematch y reconexión de 60 segundos. |
| Victoria | Solo gana quien deja un candidato y coincide con el secreto rival; se evita dejar el tablero vacío. Modal con sprite y datos del Pokémon propio. |
| Audio | Selección/destachado, tachado corto, victoria para el ganador y derrota para el perdedor; deduplicación de resultado y háptica. |
| Responsive | Cuadrícula 5 × 5 flexible, retratos con `contain`, nombres/Dex legibles y modal desplazable para móvil pequeño y tablet. |
| Accesibilidad | Roles y estados accesibles, alertas, foco, respeto por movimiento reducido y controles con etiquetas claras. |
| Seguridad | Validación server-side, payload máximo 64 KiB, rate limit, allowlist Origin, TTL de salas, tokens de reconexión comparados en tiempo constante y almacenamiento seguro nativo. |
| Documentación | Contexto de agentes, catálogo, audio, UI/UX, reconexión, seguridad, guía de usuario, README visual y este informe. |

## Simulación nacional

El entorno no permitió abrir 50 hilos interactivos simultáneos. Para no falsear el resultado, se implementó una flota reproducible de **50 agentes lógicos** con el mismo motor y banco de preguntas de la aplicación:

```text
50 agentes × 1.000 partidas = 50.000 sesiones
494.925 preguntas binarias
32.004 victorias
1.748 sesiones inconsistentes por respuestas contradictorias deliberadas
16.248 sesiones ambiguas por perfiles semánticos indistinguibles
0 sesiones agotadas por límite en esta distribución; el límite de 30 está cubierto por prueba directa del motor
```

El detalle completo de la campaña de referencia queda en `artifacts/single-player-national-fleet-50000/`; el
`manifest.json` contiene las métricas y `shard-001.json` a `shard-050.json`
contienen todas las preguntas, respuestas, candidatos antes/después y ids
restantes. Se puede regenerar con `npm run single-player:fleet`.

Tras la mejora de creencia tolerante, la capa de evolución pública y la retirada
de preguntas de generación, el smoke actual de 100 sesiones está en
`artifacts/single-player-national-fleet-smoke-v5/`: 1.213 preguntas, 86
victorias de la máquina, 14 empates, 0 inconsistencias, 0 partidas por encima
del límite y 0 preguntas prohibidas.

## Verificaciones ejecutadas

```text
✓ npm run typecheck
✓ npx expo-doctor                 21/21 checks
✓ npx expo export --platform web
✓ node --check server/room-server.js
✓ git diff --check
✓ npm audit --omit=dev --audit-level=high
✓ smoke WebSocket de dos jugadores y privacidad del secreto rival
✓ comprobación visual del menú, título de pestaña y botón de modo solitario
```

`npm audit` no encontró vulnerabilidades altas o críticas, pero sí 10 moderadas transitivas de la cadena Expo (`uuid`/`xcode`). No se aplicó `npm audit fix --force` porque propone un cambio destructivo de SDK.

## Cómo probarlo ahora

1. Mantén un único servidor de salas en ejecución con `npm run room-server`; si aparece `EADDRINUSE` en `8787`, ya existe una instancia activa y no debes lanzar otra.
2. Mantén Expo en ejecución con `npm run start` y abre la URL web que muestre Expo.
3. En el inicio, pulsa **MODO SOLITARIO · JUGAR CONTRA LA MÁQUINA** para probar la IA.
4. Para dos jugadores, crea una sala, copia el enlace y ábrelo en otra pestaña; elige un secreto en cada pantalla.
5. En la partida, cada cliente solo puede tachar/destachar su tablero. Deja como última casilla el secreto del rival para ver el resultado.

## Pendientes antes de publicar

- Usar HTTPS/WSS y configurar `ROOM_SERVER_ALLOWED_ORIGINS` con dominios exactos.
- Sustituir el `Map` en memoria por almacenamiento efímero si se publica el servidor.
- Configurar CSP y cabeceras de seguridad del hosting web.
- Revisar licencias y atribuciones de retratos, audios y fondo antes de distribución pública.

## Créditos

Inspirado por **Checo_512** y [Adivina Quién Pokémon](https://adivina-quien-pokemon.vercel.app/). Retratos de [SpriteCollab (PMD)](https://github.com/PMDCollab/SpriteCollab). Datos estructurados de [PokéAPI](https://pokeapi.co/).

Fan project no oficial y sin ánimo de lucro.
