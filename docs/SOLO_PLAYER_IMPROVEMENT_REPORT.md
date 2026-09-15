# 🧠 Informe de mejora · Modo solitario

**Fecha:** 15/09/2026  
**Producto:** PokéQuién · Duelo Pixel

## Resultado

El modo solitario ya no sigue una lista fija de preguntas. Cada ronda crea una
semilla propia y mantiene una creencia sobre los Pokémon compatibles. En cada
turno escoge una pregunta SÍ/NO con alta ganancia de información, pero permite
variar entre preguntas prácticamente equivalentes. El límite continúa siendo
de 30 preguntas: si la máquina no acierta, gana el jugador.

```text
elección secreta del jugador
          ↓
creencia inicial sobre el catálogo
          ↓
pregunta más informativa + exploración controlada
          ↓
respuesta SÍ/NO → actualización tolerante de probabilidades
          ↓
propuesta explícita de la máquina o siguiente pregunta
          ↓
máquina acierta / jugador corrige / se alcanzan 30 preguntas
```

## Qué se ha cambiado

### 1. Selector adaptativo

`src/game/singlePlayerEngine.ts` mantiene el estado puro y ahora incorpora:

- puntuación tipo posterior para cada candidato no descartado;
- actualización tolerante (`0,9` si la respuesta encaja y `0,1` si parece
  contradictoria), para que un error humano no elimine inmediatamente al
  Pokémon correcto;
- ganancia de información ponderada por esa creencia, no solo por el número
  bruto de candidatos;
- exploración reproducible dentro de un margen de `0,08`, con semilla distinta
  por partida para evitar que todas empiecen con “camina sobre dos patas”;
- propuesta de candidato solo después de varias respuestas y cuando la
  confianza y la diferencia con el segundo candidato son suficientemente
  claras;
- lista explícita de candidatos restantes en cada evento para auditar cómo
  razonó la máquina;
- límite de producto blindado en el motor: se permiten pruebas con menos de 30
  preguntas, pero nunca una partida configurada por encima de 30;
- rechazo de una propuesta sin inventar una respuesta a una pregunta que no se
  hizo; el candidato rechazado queda excluido y el juego continúa.

La selección no consulta el Pokémon secreto. La pantalla lo muestra únicamente
al jugador local para que pueda contestar, y el motor solo recibe sus respuestas.

### 2. Banco de preguntas depurado

`src/data/singlePlayerKnowledge.ts` conserva preguntas de:

- tipos y tipo dual;
- evolución y categorías básicas de Pokémon;
- colores dominantes;
- animal o inspiración visual amplia;
- manos, brazos, patas, alas, cola, cuernos y silueta;
- flotación, forma, hábitat y situaciones cotidianas sencillas.

El catálogo nacional se ha enriquecido con la línea evolutiva pública de
PokéAPI. Así, las preguntas genéricas de forma básica, evolución previa,
posibilidad de evolucionar, evolución final y línea de varias etapas también
funcionan fuera de Kanto, sin mencionar nombres concretos.

Se han eliminado del banco jugable las preguntas sobre número de Pokédex,
rango numérico, peso, región y generación. Esos valores pueden existir como
metadatos para catálogo, sprites o QA, pero no son preguntas disponibles para
el jugador.

### 3. Registro de mis partidas

`src/game/singlePlayerStorage.ts` guarda en `AsyncStorage` una sesión por
partida humana. Cada registro incluye:

- catálogo y versión de conocimiento;
- semilla y límite de la ronda;
- Pokémon escogido por el jugador, solo en almacenamiento local;
- cada pregunta, respuesta SÍ/NO, candidatos antes/después e ids restantes;
- propuesta de la máquina, correcciones y resultado final;
- fecha de inicio y finalización.

La escritura es idempotente y está serializada con una cola para no perder
respuestas cuando se pulsan botones rápidamente. Se conservan como máximo 5.000
sesiones. Desde el menú del modo solitario se puede copiar el JSON completo o
borrar el historial. No se envía este registro al servidor de salas.

### 4. QA y simulación

La campaña nacional de referencia de 50.000 partidas sigue disponible en
`artifacts/single-player-national-fleet-50000/`. Fue generada antes de la
última capa de creencia tolerante y sirve como línea base histórica.

El smoke actual, ejecutado ya con el motor nuevo, el catálogo evolutivo y el
banco depurado, está en
`artifacts/single-player-national-fleet-smoke-v5/`:

| Métrica | Resultado |
| --- | ---: |
| Sesiones | 100 |
| Preguntas almacenadas | 1.213 |
| Victorias de la máquina | 86 |
| Empates por perfiles indistinguibles | 14 |
| Inconsistencias | 0 |
| Partidas sobre 30 preguntas | 0 |
| Preguntas prohibidas detectadas | 0 |

Las 14 ambigüedades restantes no son fallos ocultos: indican perfiles que
comparten las pistas disponibles y sirven como inventario para añadir rasgos
visuales curados.

También se ha comprobado que diferentes semillas producen aperturas y
secuencias diferentes, que el límite de 30 funciona y que rechazar una
propuesta en la última pregunta concede la victoria al jugador.

## Relación con Akinator

La web de [Akinator](https://en.akinator.com/) presenta la experiencia como un
personaje que intenta descubrir lo que el jugador está pensando. La
implementación exacta no se puede copiar desde su servicio: su base y reglas
internas no están publicadas como una API. La literatura que analiza el juego
describe como ideas útiles el árbol de decisión, la ganancia de información y
la adaptación a respuestas binarias.

Por eso PokéQuién usa principios públicos y apropiados para un fan project:
creencia local, preguntas informativas, exploración controlada, tolerancia a
errores y propuesta verificable. No se afirma que sea una réplica del código
propietario de Akinator.

## Ideas para la siguiente versión

### Prioridad alta

1. Curar manualmente los rasgos más ambiguos de Paras, Parasect y familias con
   retratos parecidos; el informe del banco identifica colisiones concretas.
2. Añadir cobertura de tests para cada pregunta, asegurando que ningún rasgo
   activo vuelva a derivarse únicamente de un tipo cuando el retrato indique
   otra cosa.
3. Medir por sesión cuántas propuestas fueron correctas, rechazadas o
   agotaron el límite, siempre de forma local y opt-in si algún día se exporta
   analítica.
4. Añadir una herramienta de QA que muestre por qué se escogió cada pregunta:
   equilibrio, ganancia, confianza y candidatos supervivientes.

### Prioridad media

1. Representar `no lo sé` internamente como `unknown` sin romper la interfaz
   actual de dos botones; ahora una contradicción se tolera como probabilidad
   baja.
2. Dar un pequeño indicador visual de confianza sin revelar la respuesta ni
   hacer que el jugador sienta que la máquina hace trampas.
3. Permitir elegir entre “Kanto” y “Nacional” antes de empezar y conservar la
   preferencia local.
4. Añadir una pantalla de estadísticas personales: partidas, aciertos de la
   máquina, victorias del jugador y media de preguntas.

### Antes de publicar

- Validar licencias y atribuciones de SpriteCollab, audio, fondo y marca.
- Usar HTTPS/WSS y un backend efímero con límites si se habilitan partidas por
  Internet.
- Mantener el secreto de la sala fuera de la proyección pública y no reutilizar
  el historial local como telemetría remota.
- Ejecutar auditoría de contraste y lectores de pantalla en Android, iOS y
  tablet.

## Archivos relacionados

- [Motor del modo solitario](../src/game/singlePlayerEngine.ts)
- [Pantalla del modo solitario](../src/singlePlayer/SinglePlayerScreen.tsx)
- [Persistencia local](../src/game/singlePlayerStorage.ts)
- [Banco de preguntas](./QUESTION_BANK.md)
- [Revisión del banco](./QUESTION_BANK_REVIEW.md)
- [Adaptación tipo Akinator](./AKINATOR_ADAPTATION_REVIEW.md)
- [Revisión UX](./UX_SOLO_REVIEW.md)
- [Plan de QA](../SINGLE_PLAYER_TEST_PLAN.md)
