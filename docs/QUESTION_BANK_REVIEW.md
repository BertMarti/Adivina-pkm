# Revisión del banco de preguntas Akinator para Pokémon

> **Estado actualizado 15/09/2026:** las preguntas de generación que se
> mencionan en el análisis histórico ya no forman parte del banco jugable. El
> catálogo activo queda limitado a pistas semánticas, visuales y cotidianas;
> tampoco se usan número de Pokédex, peso o región.

## Alcance

Esta revisión se ha realizado leyendo únicamente `src/data/singlePlayerKnowledge.ts` y comprobando su matriz de rasgos en ejecución. No se ha modificado código ni ningún otro archivo.

Objetivo del banco: que la máquina descubra el Pokémon elegido mediante preguntas de **sí/no**, visuales o de conocimiento Pokémon muy básico, sin convertir la partida en un examen de datos técnicos.

Quedan fuera del diseño:

- número de la Pokédex, rangos o umbrales numéricos;
- peso, altura u otras medidas;
- región de origen;
- generación como atajo principal de identificación;
- preguntas que solo puedan responderse mirando una tabla interna y no el retrato o conocimientos básicos.

## Diagnóstico rápido

El banco actual tiene buena amplitud, pero todavía no tiene la calidad de un Akinator especializado:

| Área | Estado actual | Impacto |
| --- | --- | --- |
| Volumen | 126 preguntas para Kanto: 19 de tipo, 5 de evolución, 3 especiales, 10 de línea y 89 visuales | Hay variedad suficiente para empezar |
| Cobertura | Las líneas evolutivas manuales solo cubren los primeros 25 Pokémon y diez líneas declaradas | Muchos Pokémon no tienen una pista evolutiva que los separe |
| Semántica | Varios rasgos visuales se calculan a partir del tipo | La máquina puede preguntar “parece X” cuando en realidad solo está preguntando “es de tipo X” |
| Redundancia | Hay columnas de respuestas idénticas o casi idénticas | El algoritmo cree que tiene opciones distintas, pero no obtiene información nueva |
| Identificación | 121 firmas distintas para 151 candidatos; 30 candidatos quedan en colisiones | Algunas parejas no pueden resolverse aunque se respondan todas las preguntas |
| Parasect | Paras y Parasect comparten la misma firma completa | Es imposible distinguirlos con el banco actual |

La cifra de firmas se refiere a la combinación de respuestas de todas las preguntas actuales. No es un problema del orden de las preguntas: es una limitación de los datos disponibles.

## Hallazgos P0: corregir antes de seguir ajustando el algoritmo

### 1. Paras y Parasect son indistinguibles

En el catálogo actual, ambos tienen los mismos datos relevantes para el banco:

- tipos Bicho/Planta;
- color dominante rojo;
- silueta `armor`;
- hábitat bosque;
- generación 1;
- `stage: 0`;
- mismos rasgos derivados de color, silueta, tipo y hábitat.

Además, Parasect no aparece en `KANTO_SEMANTIC_TRAITS` y la línea evolutiva de Paras no existe en `SINGLE_PLAYER_KANTO_EVOLUTION_LINES` (`src/data/singlePlayerKnowledge.ts:241`, `src/data/singlePlayerKnowledge.ts:375`). Por tanto, el motor no dispone de ninguna partición que separe los IDs 46 y 47.

**Propuesta prioritaria para Parasect:** añadir una familia de rasgos visuales curados, independiente del tipo:

| Rasgo sugerido | Pregunta de sí/no | Paras | Parasect |
| --- | --- | ---: | ---: |
| `appearance.mushroomDominant` | ¿El hongo ocupa visualmente casi todo el cuerpo? | No | Sí |
| `appearance.largeMushroomCap` | ¿Tiene una seta grande que cubre la espalda y la cabeza? | No | Sí |
| `appearance.insectUnderFungus` | ¿Se ve un pequeño cuerpo de insecto bajo un hongo enorme? | Sí | Sí, con mucha más presencia del hongo |
| `appearance.redMushroomSpots` | ¿Tiene un hongo rojo con manchas claras muy visibles? | Sí | Sí |
| `evolution.parasLine` | ¿Pertenece a la línea evolutiva de Paras? | Sí | Sí |
| `evolution.evolvedFromParas` | ¿Es la forma evolucionada de Paras? | No | Sí |

Los dos primeros rasgos son los más útiles para separar Parasect de Paras. La pregunta sobre pertenecer a la línea no basta por sí sola para distinguir miembros de la misma línea; la pregunta “¿es la forma evolucionada de Paras?” sí lo hace, siempre que el dato evolutivo sea correcto.

La misma estrategia debe aplicarse a los grupos visualmente parecidos: no usar un único “tipo” o una silueta genérica; combinar línea evolutiva, estructura dominante y rasgo distintivo.

### 2. La cobertura evolutiva es incompleta

`SINGLE_PLAYER_KANTO_EVOLUTION_LINES` solo declara Bulbasaur, Charmander, Squirtle, Caterpie, Weedle, Pidgey, Rattata, Spearow, Ekans y Pikachu (`src/data/singlePlayerKnowledge.ts:178`). Esto deja fuera, entre otras, las líneas de Paras, Nidoran, Clefairy, Vulpix, Zubat, Meowth, Mankey, Abra, Machop, Bellsprout, Tentacool, Geodude, Doduo, Grimer, Drowzee, Krabby, Voltorb, Cubone, Horsea, Goldeen, Dratini y Omanyte.

**Decisión recomendada:** completar las líneas de Kanto antes de añadir cientos de preguntas nuevas. Una línea completa debe incluir todos sus miembros y distinguir:

- forma básica;
- forma intermedia, si existe;
- forma final;
- Pokémon evolucionado desde otro;
- Pokémon que todavía puede evolucionar.

No se debe representar la línea como una lista de nombres que solo conoce la máquina: la pregunta debe ser natural para quien mira el retrato, por ejemplo “¿Es una evolución de Paras?” o “¿Pertenece a la familia de los Pokémon hongos de esta línea?”.

### 3. Hay rasgos de evolución que se contradicen o se solapan

Las preguntas `evolution.base`, `evolution.hasPrevious`, `evolution.canEvolve`, `evolution.final` y `evolution.hasMultipleStages` (`src/data/singlePlayerKnowledge.ts:333`) son útiles, pero no son cinco evidencias independientes.

Relaciones esperables:

- “forma básica” y “ha evolucionado desde otro” son casi complementarias;
- “puede evolucionar” y “es la última fase” son casi complementarias;
- “línea de tres fases” describe la familia, no la fase concreta;
- `stage` aparece como dato de catálogo y puede estar incompleto para Pokémon fuera de las líneas manuales.

**Prioridad:** mantener una pregunta de fase y una de potencial evolutivo, y reservar el resto para cuando realmente aporten una partición diferente. Si se conservan todas, el ranking debe deduplicar sus particiones antes de elegir la siguiente pregunta.

## Hallazgos P1: redundancias comprobadas

Se compararon las columnas de respuestas de las 151 entradas actuales. Las siguientes preguntas producen la misma partición sí/no en Kanto, aunque sus textos prometen información distinta.

### Redundancias derivadas de tipos

El origen principal está en `applyDerivedTraits` (`src/data/singlePlayerKnowledge.ts:623`), donde varios rasgos visuales se activan directamente por tipo.

| Partición actual | Preguntas que la comparten | Problema |
| --- | --- | --- |
| Tipo Fuego | “¿Es de tipo Fuego?” / “¿Te recuerda al calor o al fuego?” | La segunda no observa la imagen; repite el tipo |
| Tipo Agua | “¿Es de tipo Agua?” / “¿Tiene aspecto acuático?” / “¿Está inspirado en un animal acuático?” | Mezcla tipo, aspecto e inspiración |
| Tipo Eléctrico | “¿Es de tipo Eléctrico?” / “¿Tiene un aspecto mecánico?” | Un Pokémon eléctrico no tiene por qué ser mecánico |
| Tipo Planta | “¿Es de tipo Planta?” / “¿Tiene aspecto de planta?” / “¿Está inspirado en una planta?” | Tres conceptos distintos convertidos en uno |
| Tipo Bicho | “¿Es de tipo Bicho?” / “¿Tiene aspecto de insecto?” / “¿Está inspirado en un insecto?” | El tipo no equivale a la inspiración visual |
| Tipo Volador | “¿Es de tipo Volador?” / “¿Tiene aspecto de ave?” / “¿Está inspirado en un ave?” | Se pierde la diferencia entre alas, ave y tipo |
| Tipo Dragón | “¿Es de tipo Dragón?” / “¿Tiene aspecto de dragón?” | El diseño puede ser dracónico sin tener ese tipo |
| Tipo Hielo | “¿Es de tipo Hielo?” / “¿Te recuerda al frío o al hielo?” | La pregunta subjetiva es una copia del tipo |
| Tipo Veneno | “¿Es de tipo Veneno?” / “¿Tiene un aspecto inquietante?” | “Inquietante” no es equivalente a veneno |
| Tipo Fantasma | “¿Es de tipo Fantasma?” / “¿Daría miedo encontrarlo de noche?” | El ambiente nocturno no es un atributo visual fiable |

**Recomendación:** un rasgo visual solo debe ser positivo si se ha anotado observando el retrato o una referencia visual, nunca porque el tipo lo sugiera. Los tipos pueden permanecer como familia propia de conocimiento Pokémon.

### Redundancias anatómicas y de silueta

| Preguntas actuales | Observación |
| --- | --- |
| “¿Tiene manos visibles?” / “¿Tiene brazos visibles?” / “¿Tiene una silueta parecida a la humana?” | Las tres se alimentan de `hasArmsShape`; tener brazos no implica tener manos ni silueta humanoide |
| “¿Camina sobre cuatro patas?” / “¿Su silueta es de cuatro patas?” | Son la misma comprobación (`shape === quadruped`) |
| “¿Tiene aspecto de reptil?” / “¿Está inspirado en un reptil?” | En Kanto producen la misma partición; conviene conservar una sola y anotar la otra como evidencia separada solo si hay datos reales |
| “¿Tiene un aspecto tierno?” / “¿Te lo imaginarías como mascota?” | Ambas usan prácticamente la misma regla de tipos |
| “¿Tiene aspecto de planta?” / “¿Está inspirado en una planta?” | Son dos formulaciones de la misma columna actual |
| “¿Tiene aspecto de insecto?” / “¿Está inspirado en un insecto?” | Idénticas en la matriz actual |
| “¿Tiene aspecto de ave?” / “¿Está inspirado en un ave?” | Idénticas en la matriz actual |
| “¿Tiene aspecto acuático?” / “¿Está inspirado en un animal acuático?” | Idénticas en la matriz actual |

**Criterio de diseño:** diferenciar el objeto de la observación. Por ejemplo:

- “¿Tiene alas visibles?” es anatómica;
- “¿Está inspirado en un ave?” es de inspiración;
- “¿Es de tipo Volador?” es de conocimiento Pokémon.

Las tres pueden coexistir, pero sus datos no pueden generarse con la misma regla.

### Redundancias de colores y conceptos abstractos

Las preguntas de color (`src/data/singlePlayerKnowledge.ts:397`) son una buena familia para una tabla de retratos, pero actualmente algunos colores se amplían por tipo: rojo por Fuego, azul por Agua/Hielo, verde por Planta/Bicho, morado por Veneno/Fantasma/Psíquico, negro por Siniestro y gris por Acero/Roca (`src/data/singlePlayerKnowledge.ts:657`). Esto puede producir respuestas visualmente falsas.

Los rasgos `hot`, `cold`, `mechanical`, `armored`, `spiky`, `mystical`, `goodCompanion`, `cityFriendly` y `scaryAtNight` (`src/data/singlePlayerKnowledge.ts:638`) son heurísticas de ambientación, no observaciones consistentes. Deben tener una de estas tres condiciones:

1. anotación visual revisada;
2. evidencia Pokémon explícita y estable;
3. desaparecer del banco.

No conviene que “¿predomina el color rojo?” sea positivo solo porque el Pokémon es de tipo Fuego, ni que “¿tiene armadura?” sea positivo solo por ser de tipo Acero.

## Preguntas poco visuales o ambiguas

### Ambigüedad por subjetividad

Estas preguntas pueden ser divertidas como curiosidad, pero no deben cargar el peso principal del algoritmo:

- “¿Te lo imaginarías como mascota?”;
- “¿Te lo imaginarías viviendo en una ciudad?”;
- “¿Daría miedo encontrarlo de noche?”;
- “¿Tiene un aire místico o sobrenatural?”;
- “¿Tiene un aspecto tierno?”;
- “¿Tiene un aspecto inquietante?”;
- “¿Te recuerda al calor o al fuego?”;
- “¿Te recuerda al frío o al hielo?”.

Distintas personas responderán diferente y el jugador puede conocer una descripción distinta a la que usó el anotador. Si se mantienen, deben marcarse con baja confianza y ofrecerse después de las preguntas anatómicas, de tipo y de evolución.

### Ambigüedad anatómica

- “¿Tiene piernas o patas visibles?” mezcla dos conceptos y también puede ser difícil con una pose frontal.
- “¿Camina normalmente sobre dos patas?” depende de la animación o de la ilustración concreta.
- “¿Parece capaz de flotar?” confunde levitar, volar, nadar y estar suspendido.
- “¿Tiene brazos visibles?” no responde si son alas, pinzas o extremidades delanteras.
- “¿Su silueta destaca por tener patas?” puede contestarse sí para casi cualquier cuadrúpedo y para bípedos.

Versión más precisa y visual:

- “¿Se ve claramente erguido sobre dos extremidades?”;
- “¿Se distinguen cuatro apoyos o patas?”;
- “¿Tiene alas separadas del cuerpo?”;
- “¿Tiene tentáculos o apéndices flexibles?”;
- “¿Tiene una cola claramente visible?”;
- “¿Tiene pinzas, garras o cuernos reconocibles?”.

## Familias permitidas que mejorarían el banco

Las siguientes familias son compatibles con las restricciones del juego y no requieren número de Pokédex, peso ni región.

| Prioridad | Familia | Ejemplos de preguntas | Reglas de calidad |
| --- | --- | --- | --- |
| P0 | Evolución completa | “¿Es una evolución de Paras?”, “¿Es la forma final de su línea?” | Datos completos por línea; separar familia y fase |
| P0 | Rasgo distintivo de especie | “¿Tiene un hongo enorme sobre el cuerpo?”, “¿Tiene cañones visibles?”, “¿Lleva una flor grande en el lomo?” | Solo cuando el rasgo es reconocible en el retrato |
| P0 | Plan corporal | “¿Es alargado y serpenteante?”, “¿Tiene forma principalmente humanoide?”, “¿Es claramente cuadrúpedo?” | Una taxonomía mutuamente consistente; no usar solo el tipo |
| P1 | Apéndices | “¿Tiene alas?”, “¿Tiene antenas?”, “¿Tiene cola?”, “¿Tiene cuernos?”, “¿Tiene pinzas?” | Anotar cada elemento por separado |
| P1 | Superficie o cubierta | “¿Tiene pelaje visible?”, “¿Tiene caparazón?”, “¿Tiene escamas o placas?”, “¿Tiene una cubierta vegetal o fúngica?” | Describir lo que se ve, no el material supuesto |
| P1 | Cara y boca | “¿Tiene un pico?”, “¿Tiene colmillos visibles?”, “¿Tiene ojos muy grandes?”, “¿Tiene una boca claramente marcada?” | Evitar inferir personalidad o peligrosidad |
| P1 | Paleta visual | “¿Predomina el rojo?”, “¿Tiene una combinación azul y blanco?”, “¿Tiene manchas de color muy visibles?” | Permitir color principal y secundarios; no derivar desde el tipo |
| P2 | Entorno | “¿Se asocia con bosques?”, “¿Se relaciona con cuevas?”, “¿Se asocia con el mar?” | Usar como desempate; no equivale a región |
| P2 | Conducta básica | “¿Se desplaza volando?”, “¿Vive normalmente en el agua?”, “¿Parece que usa la cola para atacar?” | Solo con fuente clara; separar apariencia de comportamiento |
| P2 | Silueta compuesta | “¿La parte más llamativa es una gran flor, caparazón, hongo o armadura?” | Muy útil para distinguir diseños parecidos |

### Familias que no se deben añadir

- “¿Su número es mayor o menor que X?”;
- “¿Pesa más o menos que X?”;
- “¿Es de la región X?”;
- “¿Apareció en la generación X?” como atajo para identificarlo;
- preguntas cuyo texto mencione el ID interno del candidato;
- preguntas basadas en el nombre, por ejemplo “¿empieza por P?”;
- preguntas que exijan conocer una estadística, movimiento o habilidad concreta si no existe una fuente consistente;
- preguntas puramente subjetivas usadas como si fueran hechos (“¿es guay?”, “¿es simpático?”, “¿es peligroso?”).

La generación apareció en una versión histórica del banco, pero ya no se
incorpora al modo jugador. Se conserva como metadato de catálogo cuando hace
falta para organizar datos, no como pista de deducción.

## Priorización concreta para Parasect y Pokémon parecidos

### Fase 1 — Bloqueante

1. Corregir la línea evolutiva Paras → Parasect.
2. Marcar Parasect como forma evolucionada y no como `stage: 0` si el dato de catálogo es erróneo.
3. Añadir los rasgos `mushroomDominant` y `largeMushroomCap` mediante observación visual.
4. Auditar los retratos de Paras y Parasect en sus estados normal y triste para que el rasgo sea válido en ambas imágenes.
5. Recalcular colisiones después de estas anotaciones.

### Fase 2 — Familias cercanas

Aplicar el mismo patrón a:

- Paras / Parasect: hongo pequeño frente a hongo dominante;
- Bulbasaur / Ivysaur / Venusaur: bulbo, flor en apertura, flor plenamente desarrollada;
- Oddish / Gloom / Vileplume: planta en la cabeza, flor grande, pétalos;
- Bellsprout / Weepinbell / Victreebel: forma de planta, boca grande, hojas y liana;
- Omanyte / Omastar: concha espiral frente a concha desarrollada y tentáculos;
- Dratini / Dragonair: serpiente pequeña frente a cuerpo largo con orejas y joya;
- Magikarp / Gyarados: pez pequeño frente a serpiente marina enorme;
- Voltorb / Electrode: silueta esférica más patrón de color claramente anotado;
- Zubat / Golbat: alas y boca, diferenciando la boca dominante de Golbat;
- Geodude / Graveler / Golem: brazos, placas rocosas y cuerpo compuesto;
- Drowzee / Hypno: hocico, collar y silueta humanoide;
- Nidoran / Nidorina / Nidorino: orejas, cuernos y silueta corporal.

### Fase 3 — Cobertura general

Completar una matriz revisada para los 151 Pokémon con estos campos mínimos:

- `evolutionLine` y posición dentro de la línea;
- plan corporal principal;
- uno o dos apéndices visibles;
- rasgo distintivo de la especie;
- color principal y, cuando sea útil, color secundario;
- superficie dominante: piel, pelaje, placas, caparazón, planta u hongo;
- confianza de la anotación: alta, media o baja;
- fuente de la anotación: retrato, conocimiento Pokémon o ambos.

No todos los campos tienen que generar una pregunta. La confianza sirve para que el selector prefiera datos sólidos y no convierta una interpretación dudosa en una respuesta definitiva.

## Diseño Akinator recomendado

### 1. Elegir por partición, no por texto

Dos preguntas con textos diferentes pero la misma columna sí/no son una sola pregunta a efectos de información. Antes de puntuar, el motor debería agrupar por partición de candidatos y conservar solo la formulación más clara.

Ejemplo: “¿Es de tipo Bicho?” y “¿Tiene aspecto de insecto?” no deben competir como dos preguntas hasta que sus datos realmente difieran.

### 2. Separar evidencia y confianza

Cada rasgo debería poder clasificarse como:

- **alta:** visible y poco discutible;
- **media:** conocimiento Pokémon básico o una silueta razonable;
- **baja:** interpretación subjetiva o derivación aproximada.

El selector debe priorizar la ganancia de información de las preguntas de alta confianza, después las de media y dejar las de baja como desempate.

### 3. Cambiar de estrategia al reducirse el conjunto

- Más de 40 candidatos: tipos, plan corporal y grandes familias visuales.
- Entre 10 y 40: evolución, apéndices, colores y rasgos distintivos.
- Entre 2 y 10: preguntas que separen explícitamente el grupo restante.
- Dos candidatos: buscar primero una diferencia curada, como “¿es la forma evolucionada de Paras?”; no seguir preguntando tipos ya conocidos.

### 4. Controlar respuestas erróneas

Aunque la interfaz siga usando Sí/No, el sistema debe tolerar una respuesta incoherente sin destruir el conjunto de candidatos. La opción futura “No lo sé” sería preferible a convertir una duda del jugador en un “No” definitivo. Si la interfaz debe seguir siendo estrictamente binaria, conviene conservar un pequeño peso de probabilidad en la rama contraria en vez de filtrar a cero.

### 5. Medir calidad por candidato

No basta con medir el porcentaje global de aciertos. El informe del banco debería incluir, como mínimo:

- tasa de identificación por Pokémon;
- preguntas medias hasta acertar;
- porcentaje de partidas que llegan al límite;
- parejas con firma idéntica;
- preguntas que nunca resultan informativas;
- respuestas contradictorias necesarias para llegar a una conclusión.

Parasect debe tener un caso de prueba explícito: con respuestas coherentes, el bot debe diferenciarlo de Paras y acertar dentro del límite de 30 preguntas.

## Lista de acciones recomendada

| Orden | Acción | Resultado esperado |
| --- | --- | --- |
| 1 | Completar y corregir líneas evolutivas, empezando por Paras/Parasect | Desaparecen las colisiones de evoluciones conocidas |
| 2 | Sustituir heurísticas de tipo por anotaciones visuales reales | “Aspecto de insecto”, “color” y “armadura” dejan de ser atajos de tipo |
| 3 | Deduplicar particiones antes del ranking | Cada pregunta aporta información nueva |
| 4 | Añadir rasgos distintivos de las 30 colisiones actuales | Se reduce el número de firmas compartidas |
| 5 | Excluir generación del banco nacional normal | Se mantiene el modo semántico y no enciclopédico |
| 6 | Incorporar niveles de confianza y métricas por especie | El banco se puede mejorar con datos de partidas reales |
| 7 | Regenerar pruebas de 30 preguntas por Pokémon | Se comprueba que el algoritmo Akinator funciona de forma uniforme |

## Veredicto

El selector puede ser adaptativo, pero todavía no puede comportarse como Akinator de forma fiable mientras varias preguntas tengan la misma semántica y existan candidatos con la misma firma. La mejora más importante no es añadir más preguntas genéricas: es **mejorar la calidad y cobertura de los rasgos**, empezando por Parasect, completar la evolución y separar estrictamente tipo, aspecto, color, comportamiento y lore.

Una vez resueltos esos bloqueantes, el banco podrá crecer sin caer en una colección enorme de preguntas que solo repiten la misma partición.
