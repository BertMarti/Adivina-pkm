# Revisión de la adaptación tipo Akinator para PokéQuién

**Fecha:** 2026-09-15  
**Alcance:** revisión del modo solitario y propuesta de arquitectura  
**Restricción de esta revisión:** este trabajo documenta decisiones y riesgos. No modifica código ni otros archivos.

## Resumen ejecutivo

El modo solitario ya contiene la pieza fundamental de un juego de 20 preguntas:
evalúa qué pregunta divide mejor los candidatos que siguen vivos y limita la
partida a 30 respuestas. También conserva una semilla de ronda para explorar
preguntas casi equivalentes. Eso es mejor que una lista fija, pero no es todavía
un modelo completo de Akinator.

El problema de que la partida empiece siempre por “camina sobre dos patas” tiene
dos causas combinadas:

1. La selección actual asume que todos los candidatos son igualmente probables
   y calcula la entropía de un predicado booleano.
2. Cuando una pregunta domina claramente el corte, la semilla no debe sustituirla;
   solo explora dentro de un margen. Si `appearance.biped` es el único predicado
   casi óptimo con el catálogo actual, seguirá apareciendo primero.

La mejora recomendada es un selector probabilístico y consciente de la calidad
de los datos, no un orden aleatorio. Debe mantener una distribución de creencia
sobre los Pokémon, tolerar respuestas equivocadas sin eliminar inmediatamente
al Pokémon secreto y escoger la siguiente pregunta por **ganancia de información
esperada**. La semilla debe servir para romper empates y generar variedad, pero
no para degradar la capacidad de deducción.

La telemetría de partidas reales debe separarse del registro local de la partida.
El dispositivo puede guardar la sesión completa para que el jugador la consulte
o exporte, pero ningún evento que salga del dispositivo debe incluir
`selectedPokemonId`, nombres de candidatos, candidatos restantes, sprites, código
de sala ni una lista que permita reconstruir el secreto.

## 1. Diagnóstico del estado actual

### Lo que está bien encaminado

- `src/game/singlePlayerEngine.ts` es un motor puro y genérico: recibe candidatos,
  predicados y preguntas; no conoce React Native, audio ni red.
- El selector calcula entropía binaria, descarta preguntas constantes y evita
  repetir un rasgo ya preguntado.
- `SINGLE_PLAYER_QUESTION_EXPLORATION_MARGIN` permite escoger entre preguntas
  próximas a la mejor. La semilla queda en el estado para que una ronda sea
  reproducible durante QA, pero otra ronda pueda tener otra apertura.
- El estado distingue `playing`, `won`, `tie`, `no-match` y `limit-reached`.
  El límite de producto es 30 preguntas.
- La pantalla solo expone respuestas SÍ/NO y el historial local guarda las
  preguntas y respuestas del jugador.
- El banco de Pokémon separa preguntas por tipos, evolución, categoría,
  apariencia, cuerpo, silueta y hábitat, y excluye las familias de número de
  Pokédex y peso.

### Por qué el primer corte puede seguir siendo fijo

La ganancia de información de una pregunta binaria es:

```text
H(p) = -p log2(p) - (1-p) log2(1-p)
```

donde `p` es la proporción de candidatos que responderían SÍ. El máximo se
alcanza cerca de 50/50. Si una pregunta de bipedismo produce el corte más
equilibrado en la población inicial, la elección determinista es correcta según
esa métrica. Cambiar el orden del array o hacer un `shuffle` no arregla el
problema: solo oculta el criterio y puede empeorar la partida.

Además, los rasgos derivados actuales pueden hacer que una característica
semántica demasiado amplia parezca visualmente universal. Por ejemplo, inferir
“tiene piernas” o “camina sobre dos patas” a partir de tipos o siluetas públicas
puede producir una partición que estadísticamente funciona, pero que un jugador
no interpreta igual para todos los sprites.

### Riesgos que conviene resolver en la siguiente iteración

1. **Dos autoridades de selección.** El motor principal usa
   `chooseNextQuestion`, mientras que el módulo de conocimiento conserva una
   función auxiliar de selección basada en entropía y prioridad. Aunque la
   pantalla actual utiliza el motor, mantener dos algoritmos parecidos facilita
   que una futura integración vuelva a introducir órdenes distintos.
2. **Falso NO por dato ausente.** El adaptador de la pantalla convierte un rasgo
   en `false` cuando no es exactamente `true`. “Dato desconocido” no es lo mismo
   que “no”. Para preguntas confiables se necesita una representación triestado
   (`yes`, `no`, `unknown`) o una garantía de cobertura antes de activar el
   predicado.
3. **Predicados proxy demasiado fuertes.** “Tipo Agua” puede ser una buena pista
   de afinidad acuática, pero no demuestra que el retrato flote; “tipo Lucha” no
   demuestra que tenga manos. Los proxies deben tener menor confianza o quedar
   separados de los hechos visuales curados.
4. **Modelo equiprobable.** El motor actual trata a todos los Pokémon restantes
   por igual. Eso es un buen punto de partida, pero no permite modelar una
   respuesta dudosa, una contradicción o una pregunta que el jugador suele
   interpretar mal.
5. **Registro local y telemetría no son lo mismo.** El registro local actual
   puede contener el Pokémon elegido porque sirve para historial y recuperación.
   Esa estructura no se debe reutilizar como payload de analítica remota.

## 2. Arquitectura recomendada para Pokémon

### 2.1. Capas

```text
Catálogo versionado
  ├─ Pokémon y formas permitidas
  ├─ predicados atómicos + valor + confianza + procedencia
  └─ textos de pregunta + categoría + política de privacidad
                ↓
Motor puro de inferencia
  ├─ distribución de creencia sobre candidatos
  ├─ puntuación de preguntas
  ├─ actualización con SÍ/NO imperfecto
  ├─ detección de propuesta y contradicción
  └─ límite de 30 respuestas
                ↓
Adaptador de partida local
  ├─ elige el secreto únicamente en el dispositivo
  ├─ persiste el historial privado
  ├─ crea una proyección de telemetría sin secreto
  └─ presenta UI, sonido y accesibilidad
                ↓
Analítica opcional y consentida
  └─ solo eventos agregados o desidentificados
```

El motor debe seguir siendo una máquina de estados pura. El secreto no forma
parte de su entrada: para inferir, el motor necesita el catálogo y las
respuestas, no saber qué Pokémon escogió el usuario. La pantalla conoce el
secreto porque tiene que mostrarlo al jugador y comprobar localmente el resultado,
pero esa referencia debe quedarse en el límite de almacenamiento local.

### 2.2. Registro de conocimiento de un Pokémon

Cada especie o forma jugable debería tener un registro parecido a este modelo
lógico:

```text
PokemonKnowledge
  id interno estable
  nombre y alias de presentación
  retrato normal, triste y fallback
  tipos
  facts para el resultado final
  traits:
    traitId
    value: yes | no | unknown
    confidence: 0..1
    source: curated | api | derived
    version
```

El `id` puede existir dentro del catálogo local, pero no debe cruzar la frontera
de telemetría asociado a una sesión real. Los predicados que generan preguntas
deben ser atómicos y responder a una sola idea:

- `type.water`, `type.ghost`, `type.dual`;
- `appearance.colorRed`, `appearance.colorBlue`;
- `body.hasArms`, `body.hasLegs`, `body.hasWings`, `body.hasTail`;
- `movement.biped`, `movement.quadruped`, `movement.floats`;
- `inspiration.insect`, `inspiration.bird`, `inspiration.mammal`,
  `inspiration.plant`;
- `silhouette.humanoid`, `silhouette.round`, `silhouette.spiky`;
- `habitat.cave`, `habitat.forest`, `habitat.sea`;
- categorías sencillas como inicial, legendario o evolución final.

Las preguntas sobre número de Pokédex, rangos numéricos, peso, región de origen
o cualquier equivalente deben quedar fuera del catálogo habilitado para el modo
solitario. La generación puede conservarse como atributo opcional si se considera
conocimiento básico de Pokémon, pero no debería dominar la apertura y se puede
desactivar en el perfil “visual/básico”.

### 2.3. Hecho, proxy y desconocido

La base debe distinguir entre:

- **Hecho curado:** una persona ha validado que el rasgo es contestable mirando
  el retrato o con conocimiento básico.
- **Dato externo:** procede de PokéAPI u otra fuente pública y tiene una semántica
  clara para el juego.
- **Proxy:** se infiere de tipo, forma o nombre. Puede ayudar al algoritmo, pero
  tiene menor confianza.
- **Desconocido:** no hay evidencia suficiente.

Un `unknown` no debe transformarse silenciosamente en `false`. Hay tres políticas
válidas:

1. no publicar esa pregunta para ese catálogo;
2. puntuarla con un tratamiento explícito de desconocidos y mantener el candidato
   vivo en ambas ramas;
3. mostrar una tercera respuesta “no estoy seguro”.

Como el diseño actual exige solo SÍ o NO, la opción recomendada para la primera
versión es la primera: una pregunta se activa solo cuando todos los candidatos
activos tienen una etiqueta suficientemente fiable. Los proxies se pueden usar
como desempate interno, pero no como preguntas principales si no están curados.

## 3. Selector tipo Akinator

### 3.1. Distribución de creencia

En lugar de eliminar candidatos después de cada respuesta, el motor mantiene un
peso `w(c)` para cada Pokémon `c`. Al comenzar:

```text
w(c) = 1 / número de candidatos
```

Si el producto dispone de un modo o catálogo que haga razonable otra distribución,
debe versionarse y documentarse; no conviene introducir popularidad o frecuencia
de uso como sesgo oculto.

La probabilidad normalizada es:

```text
P(c) = w(c) / Σ w(c)
```

Para una pregunta `q` y un candidato `c`, el catálogo proporciona la respuesta
esperada `v(c,q)`. En el caso ideal, una respuesta SÍ conserva candidatos con
`v = yes` y una respuesta NO conserva los demás.

### 3.2. Tolerancia a respuestas imperfectas

El usuario puede equivocarse, interpretar una silueta de forma diferente o
responder demasiado rápido. En vez de asignar probabilidad cero, se usa un ruido
pequeño:

```text
P(respuesta | c, q) = 1 - ε   si coincide con v(c,q)
P(respuesta | c, q) = ε       si contradice v(c,q)
```

`ε` debe calibrarse con partidas reales y no fijarse por intuición. Como valores
iniciales de prueba se pueden comparar `0.05`, `0.10` y `0.15`; el valor final
debe escogerse por recuperación de contradicciones y precisión, no por una cifra
“mágica”. Un proxy con confianza baja puede usar un `ε` mayor que un hecho curado.

Actualización de Bayes:

```text
w_nuevo(c) = w_actual(c) × P(respuesta | c, q)
```

Después se normalizan los pesos. En producción conviene calcular en logaritmos
para evitar underflow en un catálogo de 1.025 Pokémon. La consecuencia de este
diseño es importante: una respuesta discordante baja la probabilidad del secreto,
pero no lo borra en la primera contradicción.

### 3.3. Ganancia de información esperada

La pregunta se elige por la reducción esperada de entropía de la distribución:

```text
IG(q) = H(C) - Σ respuesta P(respuesta | q) × H(C | respuesta, q)
```

La diferencia frente al corte binario actual es que `P(respuesta | q)` incorpora
el ruido y la confianza del dato. Si una pregunta parece un corte perfecto, pero
la mayoría de sus respuestas son ambiguas o poco fiables, su ganancia real será
menor.

La puntuación de producto puede incluir penalizaciones suaves:

```text
score(q) = IG(q)
           - λ × repetición semántica
           - μ × ambigüedad del texto
           - ν × coste de lectura
           + τ × diversidad de categoría
```

Estas penalizaciones no deben reemplazar la ganancia de información. Sirven para
evitar cinco preguntas visualmente casi idénticas seguidas y para que una partida
se sienta humana.

### 3.4. Cuándo proponer una adivinanza

No basta con que quede un único candidato por eliminación dura. El motor debería
proponer el primero cuando se cumplan condiciones calibrables como:

- probabilidad del candidato superior por encima de un umbral;
- diferencia suficiente respecto al segundo candidato;
- mínimo de preguntas, salvo que el resultado sea prácticamente concluyente;
- no haber recibido una contradicción reciente que aconseje confirmar.

Si el jugador responde NO a la propuesta, el candidato se penaliza como una
observación fuerte, pero no tiene por qué desaparecer para siempre. Esto permite
recuperarse de un NO accidental y evita que un solo clic convierta el resultado
en `no-match`. La propuesta rechazada no debe inventar una respuesta a una
pregunta que nunca se formuló.

### 3.5. Regla de las 30 preguntas

La regla de producto debe quedar inequívoca:

1. El contador mide respuestas SÍ/NO presentadas al jugador.
2. Se pueden hacer como máximo 30.
3. Tras la respuesta número 30, la máquina puede presentar su mejor propuesta
   final si supera el umbral; esa propuesta no es una pregunta adicional.
4. Si el jugador la rechaza, o si no existe una propuesta con confianza
   suficiente, gana el jugador.
5. Nunca se inicia una pregunta 31.

Esto conserva la emoción de una última adivinanza sin romper el límite anunciado
en la interfaz.

## 4. Cómo evitar una apertura guionizada

La solución no es barajar todas las preguntas, porque eso puede producir una
partida incoherente. Se recomienda un **top-K con exploración controlada**:

1. Calcular la puntuación completa para el estado actual.
2. Encontrar la mejor pregunta y formar un conjunto de candidatas cuya puntuación
   esté dentro de un margen relativo o absoluto razonable.
3. Escoger una de las mejores con una semilla de ronda estable.
4. Recalcular desde cero después de cada respuesta; no usar una secuencia
   pregrabada.
5. Excluir la misma semántica, no solo el mismo texto o `questionId`.

Para la primera pregunta se puede añadir una cartera de aperturas. Por ejemplo,
si varias preguntas quedan próximas, repartir entre tipo, color, cuerpo,
movimiento y silueta, siempre que la pérdida de ganancia sea pequeña. Se debe
evitar una cuota artificial si solo existe una pregunta claramente superior.

Una alternativa robusta es añadir ruido Gumbel pequeño a la puntuación:

```text
scoreExploration(q) = score(q) + τ × Gumbel(seed, q)
```

con `τ` decreciente cuando quedan pocos candidatos. Es una forma de explorar sin
convertir el algoritmo en un dado. Para una app pequeña, el top-K con semilla es
más fácil de auditar y suficiente.

### Criterios de aceptación de la apertura

- Dos partidas con el mismo catálogo y semillas distintas deben mostrar variedad
  de primera pregunta cuando existen varias preguntas casi óptimas.
- La misma semilla y las mismas respuestas deben ser reproducibles.
- La primera pregunta no puede ser siempre el primer elemento del banco.
- El 100 % de las preguntas debe cumplir la política de familias permitidas.
- Ninguna secuencia puede repetir el mismo rasgo semántico.
- La selección debe seguir siendo rápida con 1.025 candidatos.

El test no debe exigir que *cada* semilla produzca una pregunta distinta: si hay
un único corte realmente mejor, repetirlo es correcto. Debe medir la distribución
de aperturas y la pérdida media de información.

## 5. Aprender de partidas reales sin enviar el secreto

### 5.1. Separar dos productos de datos

**Registro privado local:** sirve para el jugador. Puede incluir el Pokémon
elegido, el resultado, preguntas, respuestas, propuestas rechazadas y
curiosidades. Vive en AsyncStorage o, cuando el volumen lo requiera, en una base
local. Se puede exportar y borrar bajo acción explícita.

**Telemetría de mejora:** sirve para evaluar el algoritmo. No debe incluir el
secreto ni datos que permitan inferirlo. Es una proyección distinta, creada antes
de cualquier envío.

Nunca se debe serializar la sesión privada y luego intentar “quitar” el secreto
como último paso sin una lista de campos permitidos. La proyección debe ser
allowlist-first.

### 5.2. Evento permitido para analítica

Un evento remoto puede contener:

```text
telemetrySessionId aleatorio, no reutilizable como identidad
catalogVersion
questionBankVersion
engineVersion
questionIndex: 1..30
questionId versionado
category
answer: yes | no
candidateCountBefore y candidateCountAfter
entropyBefore y entropyAfter, redondeadas o agrupadas
topConfidenceBucket, no el id del candidato
responseLatencyBucket opcional
eventType: answer | guess_accepted | guess_rejected | abandoned | finished
result: machine-won | player-won | ambiguous | inconsistent | abandoned
```

No debe contener:

- `selectedPokemonId` ni el nombre del secreto;
- `remainingCandidateIds`, `guessedPokemonId` o ids rechazados;
- nombre, alias o URL de los candidatos activos;
- sprite, imagen o descripción que identifique la elección;
- código de sala, token de reconexión, dirección IP almacenada por la app o
  identificadores publicitarios;
- texto libre introducido por el usuario.

Los conteos de candidatos y la entropía son útiles para medir la calidad del
selector, pero también pueden reducir el espacio de búsqueda si se combinan con
otros datos. Por ello deben agruparse o limitarse en sesiones individuales y no
publicarse junto con una secuencia completa identificable.

### 5.3. Qué se puede aprender sin el secreto

Sin conocer el Pokémon seleccionado, la aplicación puede aprender de forma
segura sobre:

- preguntas que provocan abandono o tardan más en responder;
- preguntas con distribuciones de SÍ/NO muy desequilibradas;
- categorías repetitivas o mal entendidas;
- frecuencia de contradicciones y correcciones;
- precisión del umbral de propuesta mediante `guess_accepted` y
  `guess_rejected` sin el id del candidato;
- rendimiento por versión de catálogo y banco;
- si el orden explorado reduce la mediana de preguntas.

Eso permite mejorar el selector y el texto. No permite descubrir directamente
que “Parasect suele responder SÍ a X” para actualizar el dato de Parasect, porque
esa conclusión requiere asociar respuestas con un candidato.

### 5.4. Cómo mejorar datos de un Pokémon sin exponerlo

Para aprender atributos específicos hay tres niveles, de menor a mayor
complejidad:

1. **Aprendizaje local:** el dispositivo sí conoce el secreto y puede actualizar
   una revisión pendiente del catálogo sin enviarla. El usuario decide si la
   exporta manualmente.
2. **Exportación consentida y explícita:** el jugador revisa un informe que dice
   qué datos propone corregir y lo comparte voluntariamente. No es telemetría
   silenciosa.
3. **Agregación privada:** muchos dispositivos aportan estadísticas mediante
   agregación segura o ruido diferencial. El servidor recibe un total de un
   grupo, no la pareja `(sesión, Pokémon secreto)`.

Una opción sencilla para una app fan y sin cuentas es la primera: guardar en
local una cola de “posibles datos dudosos” y permitir una exportación anónima
manual. No conviene montar aprendizaje federado hasta tener un volumen real que
lo justifique.

### 5.5. Consentimiento, retención y control del usuario

- La analítica debe estar desactivada por defecto si no es imprescindible para
  jugar.
- El modo local debe funcionar sin cuenta ni conexión.
- Mostrar una explicación corta y comprensible antes de activar compartir datos.
- Permitir exportar el registro privado y borrar todo el historial.
- Retener en el dispositivo solo el número de sesiones necesario para el producto.
- No subir automáticamente el secreto “para mejorar la IA”. Si algún día se
  necesita, debe ser una acción explícita, revisable y separada.

## 6. Esquema de evaluación y aprendizaje

### 6.1. Métricas de algoritmo

Registrar en pruebas, por versión:

- porcentaje de partidas resueltas por la máquina;
- mediana y p90 de preguntas hasta la primera propuesta correcta;
- porcentaje de victorias del jugador por límite de 30;
- porcentaje de `no-match` tras una sola contradicción;
- recuperación cuando una respuesta se altera artificialmente;
- entropía media antes y después de cada pregunta;
- diversidad de primera pregunta y de las cinco primeras;
- porcentaje de preguntas consideradas casi óptimas;
- preguntas que nunca separan candidatos;
- número de perfiles de Pokémon indistinguibles.

La tasa de acierto por sí sola no basta. Un selector que acierta rápido usando
preguntas poco contestables puede dar peores partidas reales que uno ligeramente
más lento y claro.

### 6.2. Banco de pruebas

Usar tres tipos de partidas:

1. **Verdaderas:** el oráculo responde según los rasgos del Pokémon secreto.
2. **Imperfectas:** se inyecta una respuesta contradictoria en posiciones y
   categorías controladas.
3. **Humanas revisadas:** un jugador responde según los retratos, y se registra
   qué preguntas necesitó releer o corrigió.

Las campañas sintéticas de 50.000 partidas son útiles para detectar regresiones y
medir rendimiento, pero no son evidencia de que los predicados derivados sean
correctos para una persona. Deben permanecer separadas de las métricas reales y
marcadas como simulación.

### 6.3. Tests de privacidad

Antes de enviar cualquier evento, ejecutar un test que falle si el JSON contiene
campos o patrones de secreto:

```text
selectedPokemonId
guessedPokemonId
remainingCandidateIds
nombre de una especie
sprite URL asociada a un candidato
room code o reconnect token
```

También debe verificarse que dos partidas con secretos distintos no produzcan una
telemetría identificable diferente salvo por las métricas agregadas esperadas.

## 7. Plan de implementación recomendado

Este es el orden de trabajo con menor riesgo:

### Fase A — consolidación

1. Declarar `singlePlayerEngine.ts` como única autoridad de selección.
2. Retirar o marcar como auxiliar la función de selección duplicada del módulo de
   conocimiento.
3. Versionar por separado catálogo, banco de preguntas y motor.
4. Añadir tests de invariantes: pureza, no repetición, máximo 30 y reproducibilidad
   por semilla.

### Fase B — calidad del conocimiento

1. Introducir valores `yes/no/unknown` o una validación de cobertura estricta.
2. Añadir procedencia y confianza a cada predicado.
3. Revisar manualmente primero las preguntas de bipedismo, flotación, manos,
   inspiración animal y color, porque son las más sensibles a interpretación.
4. Separar hechos del retrato, datos de PokéAPI y proxies derivados.
5. Crear un informe de perfiles idénticos para saber qué preguntas nuevas aportan
   realmente información.

### Fase C — inferencia tolerante

1. Mantener pesos o log-pesos en el motor.
2. Implementar actualización con `ε` configurable y tests de contradicción.
3. Sustituir la eliminación dura por probabilidad, conservando la regla de no
   repetir preguntas.
4. Calibrar el umbral de propuesta y la diferencia con el segundo candidato.
5. Aplicar top-K/semilla solo entre preguntas casi óptimas.

### Fase D — datos reales y UX

1. Persistir el registro local completo después de cada respuesta.
2. Crear una proyección de telemetría con lista blanca de campos.
3. Añadir pantalla de historial, exportación y borrado ya contemplados por el
   producto.
4. Mostrar un estado amable para una respuesta incoherente y permitir continuar
   sin revelar el secreto.
5. Auditar accesibilidad: botones de al menos 44 px, anuncios de “pregunta X de
   30”, foco visible, contraste y estado de selección no dependiente solo del
   color.

### Fase E — validación

1. Ejecutar fixtures pequeños con semillas fijas.
2. Ejecutar una campaña nacional reproducible y compararla con la versión
   anterior.
3. Hacer pruebas manuales en móvil pequeño y tablet.
4. Comparar la distribución de aperturas, las victorias y el tiempo de respuesta.
5. Revisar el documento de banco antes de activar nuevos predicados.

## 8. Ideas de producto compatibles con el diseño actual

- **Dificultad normal/pro:** normal usa más preguntas visuales; pro reduce el
  margen de exploración y aplica umbrales de propuesta más altos.
- **Perfil “solo retratos”:** desactiva generación, hábitat y cualquier dato que
  no sea razonable al mirar la imagen.
- **Explicación final:** al terminar, mostrar qué tres pistas separaron al
  Pokémon, pero solo después de revelar el resultado.
- **Repetición inteligente:** la siguiente partida evita comenzar con la misma
  categoría si hay alternativas con ganancia equivalente.
- **Informe de calidad:** mostrar cuántos perfiles siguen siendo indistinguibles
  y qué preguntas nuevas ayudarían a separarlos.
- **Modo sin conexión:** el catálogo, el motor y la cola de historial funcionan
  sin red; las imágenes remotas conservan cache y fallback.
- **Corrección revisable:** si el jugador marca que una pregunta era ambigua,
  guardar esa señal localmente sin alterar automáticamente la verdad del catálogo.

## 9. Criterios de salida de una versión “tipo Akinator”

La adaptación puede considerarse lista cuando cumpla todo lo siguiente:

- la primera pregunta no está fijada por la posición del banco;
- el orden cambia entre rondas cuando hay alternativas equivalentes;
- el orden sigue siendo reproducible con una semilla de QA;
- una respuesta imperfecta no provoca un `no-match` prematuro;
- la máquina no supera 30 respuestas SÍ/NO;
- la máquina propone solo cuando su confianza y margen están calibrados;
- el jugador gana de forma clara si no se identifica el Pokémon dentro del límite;
- no se utilizan número de Pokédex, peso ni región como preguntas;
- no se convierten datos desconocidos en NO silenciosamente;
- el secreto nunca aparece en telemetría ni en el estado de una sala;
- las partidas reales pueden guardarse localmente con preguntas, respuestas y
  resultado;
- existe una forma de exportar y borrar ese historial;
- el motor sigue siendo puro y la UI mantiene controles accesibles.

## Conclusión

El siguiente salto de calidad no consiste en añadir cientos de preguntas sin
orden. Consiste en mejorar la semántica de cada predicado, modelar la
incertidumbre y separar tres cosas que ahora pueden confundirse: la verdad del
catálogo, la creencia de la máquina y la respuesta imperfecta del jugador.

Con una distribución de creencia, ganancia de información esperada, exploración
controlada y registro local separado de telemetría, PokéQuién puede ofrecer una
experiencia con sensación de Akinator sin copiar una implementación propietaria,
sin usar preguntas excluidas y sin enviar el Pokémon secreto del jugador.

