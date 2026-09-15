# 🤖 Registro de agentes y simulación

## Agentes de revisión disponibles

La sesión contó con seis ejecuciones previas completadas en paralelo:

| Agente | Entrega |
| --- | --- |
| Kant | 20.000 partidas, 17.974 victorias, 2.026 inconsistencias, 94.018 preguntas. |
| Fermat | 20.000 partidas, 17.974 victorias, 2.026 inconsistencias, 94.026 preguntas. |
| Carver | 20.000 partidas, 17.994 victorias, 2.006 inconsistencias, 94.014 preguntas. |
| Plato | 20.000 partidas, 18.012 victorias, 1.988 inconsistencias, 94.126 preguntas. |
| Boyle | 20.000 partidas, 18.069 victorias, 1.931 inconsistencias, 94.117 preguntas. |
| Euclid | 20.000 partidas, 18.008 victorias, 1.992 inconsistencias, 94.188 preguntas. |

Los shards de estas ejecuciones viven en `artifacts/soak-shards/` y el histórico combinado en `artifacts/single-player-soak-results-merged.json`.

## Flota nacional reproducible

El entorno no admite 50 hilos interactivos simultáneos, así que se añadió `npm run single-player:fleet`. Este comando crea 50 agentes lógicos, cada uno con 1.000 partidas nacionales por defecto, usando la misma lógica de preguntas del modo solitario. Para que la ejecución sea resistente y reanudable, guarda los eventos en fragmentos y un manifiesto dentro de `artifacts/single-player-national-fleet-50000/`:

```text
50 agentes × 1.000 sesiones = 50.000 partidas
cada evento = pregunta + SÍ/NO + candidatos antes/después + ids restantes
manifest.json = métricas globales + lista de fragmentos
```

La semilla fija hace que QA pueda reproducir el resultado. `SINGLE_PLAYER_FLEET_AGENTS`, `SINGLE_PLAYER_FLEET_RUNS` y `SINGLE_PLAYER_FLEET_SEED` permiten variar el experimento.

La última ejecución de 50.000 sesiones queda registrada en el manifiesto generado
al terminar. Resultado de la campaña final:

```text
50.000 sesiones · 494.925 preguntas · media 9,90 preguntas/partida
32.004 victorias · 1.748 inconsistencias deliberadas
16.248 empates · 0 partidas agotadas por límite en esta distribución

El motor mantiene un máximo de 30 preguntas por partida; el límite está
cubierto por la prueba de producto aunque no se alcanzó en esta campaña.
```

La semilla fija hace que QA pueda reproducir el resultado. Los 50 fragmentos
JSON contienen el detalle de cada sesión.

La validación posterior del motor tolerante, el catálogo evolutivo y el banco
sin generación está en
`artifacts/single-player-national-fleet-smoke-v5/`: 100 sesiones, 1.213
preguntas, 86 aciertos de la máquina, 14 empates y ninguna pregunta prohibida.
La campaña de 50.000 se conserva como línea base histórica, no como sustituto
de este smoke actualizado.

La validación posterior del motor tolerante y del banco sin generación está en
`artifacts/single-player-national-fleet-smoke-v3/`: 100 sesiones, 1.224
preguntas, 45 aciertos de la máquina, 55 empates y ninguna pregunta prohibida.
La campaña de 50.000 se conserva como línea base histórica, no como sustituto
de este smoke actualizado.

## Regla de honestidad

Estos agentes son jugadores de prueba deterministas, no una IA que vea imágenes
ni una conexión remota a 50 modelos. La elección se mantiene fuera de las
preguntas y las respuestas de la flota se generan a partir de la ficha visual y
de tipos de cada candidato para validar consistencia, rendimiento y
almacenamiento. No se entrenan preguntas numéricas ni basadas en peso.
