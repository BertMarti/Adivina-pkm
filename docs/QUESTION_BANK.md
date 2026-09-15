# 🧠 Banco de preguntas del modo solitario

## Objetivo

El modo solitario juega como un **Quién es quién**: el jugador escoge en
secreto un Pokémon y solo responde `SÍ` o `NO`. La máquina escoge la pregunta
que mejor divide las posibilidades restantes; nunca recibe el id secreto.
Cada partida tiene un máximo de **30 preguntas**. Si la máquina reduce el
conjunto a un candidato, propone una adivinanza; si no lo consigue antes del
límite, gana el jugador.

## Familias permitidas

| Familia | Ejemplos |
| --- | --- |
| Tipo | Fuego, Agua, Planta, Fantasma, Hada y los 18 tipos. |
| Evolución | Forma básica, fase final o línea de varias fases (Kanto y catálogo nacional). |
| Especial | Inicial, legendario o mascota reconocible. |
| Color | Rojo, azul, amarillo, verde, marrón, morado, rosa, blanco, negro y gris. |
| Animal | Mamífero, ave, reptil, insecto, animal acuático o planta. |
| Cuerpo | Manos, brazos, patas, dos patas, alas, cola, cuernos, colmillos y caparazón. |
| Silueta | Humanoide, redondeada, acuática, mecánica, mística o puntiaguda. |
| Hábitat | Cueva, bosque, pradera, montaña, mar, ciudad u orilla del agua. |
| Vida cotidiana | Mascota, ciudad, calor, frío o miedo de noche. |

## Familias prohibidas

No se generan preguntas sobre:

- número de Pokédex Nacional o rangos numéricos;
- peso, kilogramos o umbrales físicos;
- región, generación u otros atajos históricos;
- el nombre exacto del Pokémon;
- información que solo podría conocer el servidor sobre la elección del jugador.

## Datos visuales

Cada entrada nacional incluye el color dominante y la silueta pública de
PokéAPI. Los rasgos de animal, manos, postura y flotación se derivan de esos
datos y de los tipos, usando aproximaciones amplias para que la respuesta sea
razonable al mirar un retrato PMD. Se evita fingir una precisión que el sprite
no pueda sostener.

## QA y simulación

### Selector adaptativo

En cada turno se descartan las preguntas ya respondidas y las que no separan
el conjunto actual. El motor calcula la entropía de cada pregunta y prioriza
la que deja una división más informativa. Cuando varias preguntas quedan a
menos de 0,08 puntos de la mejor, una semilla exclusiva de la ronda escoge
entre ellas. Así se conserva el criterio de Akinator sin repetir siempre la
misma secuencia entre partidas; una misma semilla sigue siendo reproducible
para QA.

`npm run single-player:fleet` usa este mismo banco, 50 agentes lógicos y 1.000
partidas por agente. Cada partida conserva sus preguntas, respuestas, tamaño
del conjunto antes/después y candidatos restantes en fragmentos JSON. El
manifiesto de la ejecución está en
`artifacts/single-player-national-fleet-50000/manifest.json`.

La campaña de referencia almacenó 50.000 partidas y 494.925 preguntas antes de
la capa de creencia tolerante. La validación actual del motor se realiza con el
smoke reproducible `artifacts/single-player-national-fleet-smoke-v5/`, que usa
el selector probabilístico y el banco sin preguntas numéricas, físicas,
regionales ni de generación. El banco nacional actual contiene 86 preguntas,
incluidas cinco claves evolutivas genéricas. Las ambigüedades no son fallos
ocultos: indican perfiles que comparten las pistas disponibles y sirven como
inventario para añadir rasgos visuales curados.
