# Revisión QA del modo solitario

> **Actualización 15/09/2026:** la persistencia de sesiones ahora usa una cola
> de escrituras idempotentes; la nueva validación smoke está en
> `artifacts/single-player-national-fleet-smoke-v3/`. La suite automatizada
> formal y la curación de datos visuales siguen siendo trabajo recomendado.

**Fecha:** 15/09/2026  
**Alcance:** motor de inferencia, persistencia local, límite de 30 preguntas, orden adaptativo, respuestas contradictorias y campaña nacional de 50.000 partidas.  
**Resultado global:** **NO APTO todavía para cerrar QA de producción**. La idea del selector adaptativo funciona y el código actual pasa TypeScript, pero quedan riesgos funcionales y de datos que pueden hacer que una partida se clasifique mal o que el historial no sea fiable.

## Resumen ejecutivo

La aplicación ya no depende de una secuencia fija en la pantalla que usa `SinglePlayerScreen`. `createSinglePlayerGame` genera una semilla por partida y `chooseNextQuestion` selecciona preguntas con ganancia de información, explorando preguntas casi equivalentes. En una comprobación con diez semillas hubo siete primeras preguntas distintas y la misma semilla produjo la misma secuencia.

El motor también mantiene una puntuación tipo posterior: una coincidencia pesa `0.9`, un desacuerdo `0.1`, se conserva un conjunto activo de candidatos y se puede proponer un ganador cuando la confianza es suficiente. Esto es un algoritmo **inspirado en Akinator**, no una réplica del algoritmo propietario de Akinator ni un modelo que aprenda automáticamente de las partidas reales.

La campaña nacional existente es útil para comprobar rendimiento, integridad de shards y comportamiento habitual, pero no valida el final de 30 preguntas: las 50.000 sesiones terminaron como `won`, `ambiguous` o `inconsistent`; ninguna terminó como `limit-reached`.

## Evidencia ejecutada

### Comprobaciones positivas

| Comprobación | Resultado observado |
|---|---|
| `npm run typecheck` | Pasa sin errores en la revisión actual. |
| Catálogo Kanto | 151 candidatos y 126 preguntas. |
| Semillas 1–10 | 7 primeras preguntas distintas. |
| Misma semilla | Secuencia reproducible. |
| Fixture de límite | Con `maxQuestions: 1`, dos candidatos compatibles tras la respuesta producen `limit-reached` en la pregunta 1. |
| Kanto exhaustivo, respuestas generadas desde el propio catálogo | 94 victorias de la máquina, 57 empates, 0 límites, media 8,39 preguntas y máximo 12. |
| Nacional exhaustivo, una semilla, respuestas generadas desde el propio catálogo | 660 victorias de la máquina, 365 empates, 0 límites, media 12,04 preguntas y máximo 19. |
| Campaña nacional | 50 shards, 50.000 sesiones, 494.925 eventos, 50.000 `sessionId` únicos, máximo 16 eventos por sesión y contadores del manifiesto coherentes. |

Estos resultados son pruebas de consistencia con las etiquetas actuales de la base de datos. No demuestran que una persona pueda contestar correctamente preguntas como “parece tener pelo”, “tiene manos” o “es de color rojo”. Esas etiquetas deben validarse también con revisión humana.

### Auditoría de la campaña de 50.000

Manifiesto revisado: `artifacts/single-player-national-fleet-50000/manifest.json`.

```text
agentCount:    50
runsPerAgent:  1000
maxQuestions:  30
sessions:      50000
events:        494925
wins:          32004
inconsistent:  1748
ambiguous:     16248
limitReached:  0
maxEvents:     16
```

La suma de resultados coincide con las 50.000 sesiones y los eventos coinciden con el manifiesto. Esto es una señal positiva de integridad del artefacto, pero `limitReached: 0` significa que el camino de victoria del jugador por agotamiento de preguntas no está cubierto por esta campaña. La flota es además secuencial dentro de un único proceso; no prueba carreras de almacenamiento, concurrencia de dispositivos ni reconexión.

## Riesgos concretos

### R-01 — El límite de producto no está blindado en el motor

**Severidad:** alta.  
**Evidencia:** `src/game/singlePlayerEngine.ts:550-553` valida que `maxQuestions` sea entero positivo, pero acepta `31`, `100` o cualquier otro valor. La interfaz pasa 30, aunque una integración futura o una restauración manipulada puede saltarse la regla.

**Impacto:** una partida puede exceder las 30 preguntas y el registro puede afirmar un límite distinto del producto.

**Criterio de aceptación:** decidir si el motor debe rechazar cualquier valor distinto de 30 o permitir límites configurables fuera de producción. Si la regla es fija, la API pública debe impedir valores mayores que `SINGLE_PLAYER_MAX_QUESTIONS`.

### R-02 — La prueba nacional no cubre el estado `limit-reached`

**Severidad:** alta.  
**Evidencia:** el manifiesto registra 0 casos `limit-reached`; el máximo observado es 16 preguntas.

**Impacto:** no está demostrado que después de la respuesta 30 se detenga la UI, se guarde `player-won`, se muestre el Pokémon elegido y se reproduzca la victoria.

**Criterio de aceptación:** añadir un fixture determinista que mantenga al menos dos candidatos activos durante 30 respuestas y comprobar también una propuesta en la pregunta 30 que el jugador rechaza.

### R-03 — Las escrituras locales pueden perder actualizaciones

**Severidad:** alta.  
**Evidencia:** `src/singlePlayer/SinglePlayerScreen.tsx:240-246` llama a `upsertSinglePlayerSession` sin esperar ni encadenar la promesa. `src/game/singlePlayerStorage.ts:97-102` hace `read → modificar → set` sobre una única clave.

**Impacto:** dos respuestas rápidas, un cambio de pantalla o un cierre durante una escritura pueden dejar guardada una versión antigua. El método es idempotente por `sessionId`, pero no es transaccional.

**Criterio de aceptación:** simular dos `upsert` concurrentes y comprobar que el resultado final contiene la unión ordenada de todos los eventos y el estado terminal correcto. Una cola de escrituras o una base de datos transaccional sería la solución de producto.

### R-04 — El conjunto “restante” es un posterior activo, no una intersección exacta

**Severidad:** media-alta.  
**Evidencia:** `calculateCandidateScores` aplica probabilidades 0,9/0,1 y `selectActiveCandidateScores` conserva candidatos cuyo score sea al menos el 8 % del máximo (`src/game/singlePlayerEngine.ts:325-359`). `answerQuestion` guarda esos candidatos activos en `remainingCandidateIds` (`src/game/singlePlayerEngine.ts:611-620`).

**Impacto:** un candidato que contradice una respuesta puede seguir apareciendo como “restante”. Esto es válido para tolerancia al ruido, pero el nombre del campo y las métricas `candidatesAfter` pueden interpretarse como un filtrado lógico exacto. El historial no permite reconstruir una simple intersección de respuestas sin conocer la política de scores y sus constantes.

**Criterio de aceptación:** renombrar/documentar el concepto como `activePosteriorCandidateIds` o almacenar por separado el conjunto exacto y el conjunto activo.

### R-05 — Las contradicciones no producen `inconsistent` durante la respuesta normal

**Severidad:** alta.  
**Evidencia:** el motor aplica una probabilidad de desacuerdo de 0,1 en vez de filtrar el candidato (`src/game/singlePlayerEngine.ts:325-349`). Mientras exista al menos un candidato no rechazado, siempre hay una puntuación positiva y el conjunto activo no queda vacío.

**Impacto:** una secuencia de respuestas incoherentes puede terminar en `won`, `tie` o `limit-reached`; el resultado `no-match`/`inconsistent` queda reservado principalmente para rechazar propuestas hasta eliminar todos los candidatos. No hay una señal explícita de “el jugador ha dado respuestas contradictorias”.

**Criterio de aceptación:** definir la política: tolerancia a errores del jugador, tercera opción “no lo sé” o detección de inconsistencia. Si se mantiene la tolerancia, registrar cuántas respuestas contradicen al candidato de mayor probabilidad y no llamar `inconsistent` solo a un caso de candidatos vacíos.

### R-06 — La campaña simula contradicciones de forma sesgada

**Severidad:** media.  
**Evidencia:** `scripts/single-player-national-fleet.ts:119-121` solo inyecta una contradicción en `step === 0`. Además, después de que el secreto deje de estar entre los candidatos activos, la expresión que calcula la respuesta verdadera cae en `false` por defecto.

**Impacto:** el porcentaje de `inconsistent` no representa contradicciones distribuidas durante una partida y puede introducir respuestas artificiales adicionales. No debe usarse como tasa real de robustez del jugador.

**Criterio de aceptación:** separar campañas de respuestas perfectamente verdaderas, una contradicción única, contradicciones aleatorias y respuestas “no sé”. Reportar cada cohorte por separado.

### R-07 — Predicados visuales con falsos positivos sistemáticos

**Severidad:** alta para jugabilidad.  
**Evidencia:** `src/data/singlePlayerKnowledge.ts:637-688` infiere rasgos visuales desde el tipo, la forma o el nombre. Ejemplos: todo tipo Lucha implica brazos, manos y bipedismo; todo tipo Fuego puede activar rojo y reptil; todo tipo Eléctrico puede activar amarillo; todo tipo Agua puede activar acuático.

**Impacto:** la máquina puede formular una pregunta que la imagen contradice. El motor puede ser matemáticamente coherente y aun así fallar porque la etiqueta de origen es incorrecta.

**Criterio de aceptación:** crear un conjunto curado de Pokémon representativos —incluidos Parasect, Pikachu, Magikarp, Geodude, Ditto, Pokémon legendarios y formas de silueta atípica— y revisar cada predicado con una etiqueta humana `sí/no/no concluyente`.

### R-08 — Los datos desconocidos se convierten en `false`

**Severidad:** alta.  
**Evidencia:** `toEngineCandidate` en `src/singlePlayer/SinglePlayerScreen.tsx:53-58` convierte `entry.traits[trait] === true` en booleano. La ausencia de un rasgo y un “no confirmado” se vuelven indistinguibles.

**Impacto:** si falta color, forma, hábitat o cualquier dato, el motor puede hacer que el usuario conteste “NO” y eliminar o penalizar candidatos que en realidad deberían ser desconocidos.

**Criterio de aceptación:** usar un estado ternario (`true`, `false`, `unknown`) o no incluir una pregunta si su cobertura no es completa para todos los candidatos activos.

### R-09 — La semilla cambia el orden solo cuando hay preguntas casi equivalentes

**Severidad:** media.  
**Evidencia:** `chooseNextQuestion` solo explora preguntas dentro de `SINGLE_PLAYER_QUESTION_EXPLORATION_MARGIN = 0.08`. Si solo hay una candidata elegible, el orden permanece determinista.

**Impacto:** “orden variable” no significa que toda partida tenga una apertura diferente. En algunos subconjuntos se repetirá la primera pregunta, aunque el algoritmo siga siendo correcto.

**Criterio de aceptación:** medir diversidad de primeras preguntas y de secuencias por catálogo, semilla y subconjunto. Aceptar un umbral explícito, no una expectativa de variación absoluta.

### R-10 — Inconsistencia de versiones del historial

**Severidad:** media.  
**Evidencia:** `src/game/singlePlayerStorage.ts:3-4` define `SINGLE_PLAYER_LOG_VERSION = 2`, pero `makeSession` escribe `schemaVersion: 1` en `src/singlePlayer/SinglePlayerScreen.tsx:92-101`. La clave de almacenamiento continúa siendo `...:v1`.

**Impacto:** futuras migraciones pueden interpretar de forma distinta un registro exportado y uno guardado en el dispositivo.

**Criterio de aceptación:** distinguir explícitamente versión del contenedor, versión del registro y versión del conocimiento; añadir una migración probada de cada versión soportada.

### R-11 — El contador visible del historial no cuenta sesiones reales

**Severidad:** media.  
**Evidencia:** tras guardar, la pantalla ejecuta `setSessionCount((count) => Math.max(count, 1))` (`src/singlePlayer/SinglePlayerScreen.tsx:244-246`).

**Impacto:** después de jugar varias partidas la interfaz puede seguir mostrando `HISTORIAL LOCAL: 1`, aunque el almacenamiento contenga más registros. Esto dificulta verificar que “cada partida del usuario” se ha guardado.

**Criterio de aceptación:** recalcular el número desde `readSinglePlayerLog()` o incrementar solo cuando se crea una sesión nueva, no en cada actualización de la misma sesión.

### R-12 — Un único JSON puede crecer demasiado

**Severidad:** media-alta en uso prolongado.  
**Evidencia:** `MAX_STORED_SESSIONS = 5000` limita el número de sesiones, pero no el tamaño en bytes. Cada evento conserva ids de candidatos y el repositorio serializa todo el array en cada escritura.

**Impacto:** latencia creciente, errores de cuota, bloqueo de UI indirecto o pérdida de la escritura. La campaña nacional ocupa aproximadamente 295 MB en shards, aunque esos shards no se guardan en `AsyncStorage`.

**Criterio de aceptación:** probar 1.000 y 5.000 sesiones en Android e iOS reales, medir p50/p95 de escritura y exportación, y definir límite por bytes o migración a SQLite/almacenamiento estructurado.

### R-13 — Seleccionar un Pokémon y cerrar inmediatamente no queda registrado

**Severidad:** media.  
**Evidencia:** `startGame` crea el `sessionRef`, pero no llama a `persist`; el primer guardado sucede al contestar una pregunta (`src/singlePlayer/SinglePlayerScreen.tsx:266-275` y `277-288`).

**Impacto:** una partida iniciada por el usuario puede desaparecer si la aplicación se cierra antes de la primera respuesta.

**Criterio de aceptación:** decidir si seleccionar el Pokémon ya inicia una sesión auditable. Si sí, persistir un registro `in-progress` inmediatamente.

### R-14 — No hay suite automatizada en el repositorio

**Severidad:** media.  
**Evidencia:** no existen archivos `test`, `spec` ni directorio `tests`; `SINGLE_PLAYER_TEST_PLAN.md` describe casos, pero no los ejecuta en CI.

**Impacto:** los cambios de algoritmo pueden alterar precisión, persistencia o resultados sin una regresión automática.

**Criterio de aceptación:** incorporar pruebas unitarias del motor, pruebas de contrato del repositorio y al menos un flujo E2E de selección → respuestas → final → nueva partida.

## Casos reproducibles recomendados

Los siguientes casos no requieren red ni modificar archivos. Se pueden ejecutar desde `D:\Desarrollos\Adivina-pkm` con `npx tsx -e` o trasladar a una suite formal.

### QA-ENG-001 — Orden variable y reproducible

Construir candidatos desde `SINGLE_PLAYER_KANTO_KNOWLEDGE` y preguntas desde `SINGLE_PLAYER_QUESTION_BANK`, como hace la pantalla, y crear partidas con semillas `1`, `2`, `3`, …, `10`.

**Esperado:**

- La misma semilla, el mismo catálogo y las mismas respuestas producen la misma secuencia.
- Dos semillas pueden producir secuencias diferentes.
- No se repite el mismo `trait` durante una sesión.
- La primera pregunta no debe depender del orden de un `Map` ni de la posición de la Pokédex.

**Observado:** 7 primeras preguntas distintas entre 10 semillas y estabilidad con la misma semilla. Este caso pasa en la revisión actual.

### QA-ENG-002 — Límite controlado

Fixture mínimo:

```ts
const candidates = [
  { id: 1, name: 'A', answers: { r: true } },
  { id: 2, name: 'B', answers: { r: true } },
  { id: 3, name: 'C', answers: { r: false } },
];
const questions = [{ id: 'r', trait: 'r', text: '¿R?' }];

const initial = createSinglePlayerGame(candidates, {
  questions,
  maxQuestions: 1,
  questionSelectionSeed: 1,
});
const result = answerQuestion(initial, true);

console.log(result.phase, result.history.length, result.maxQuestions);
```

**Esperado:** `limit-reached`, `1`, `1`; no debe existir `currentQuestion` y el estado debe ser terminal.

Después repetir con `maxQuestions: 30` y un fixture que conserve al menos dos candidatos durante 30 respuestas. La sesión debe acabar como `limit-reached` exactamente en la respuesta 30.

### QA-ENG-003 — Blindaje del límite de producto

```ts
const result = createSinglePlayerGame(candidates, {
  questions,
  maxQuestions: 31,
  questionSelectionSeed: 1,
});
console.log(result.maxQuestions);
```

**Esperado si el producto fija 30:** error de validación o normalización explícita a 30.  
**Observado:** el motor acepta y conserva `31`. Debe resolverse la decisión antes de cerrar QA.

### QA-ENG-004 — Contradicción única y recuperación

Usar un secreto conocido, contestar una respuesta deliberadamente incorrecta y contestar correctamente las siguientes.

**Esperado de una política tolerante:** el Pokémon correcto conserva una puntuación recuperable, la partida no se rompe y el registro conserva la respuesta incorrecta.  
**Comprobación adicional:** registrar si termina `won`, `tie` o `limit-reached`; no etiquetarlo automáticamente como `inconsistent`.

**Riesgo observado:** actualmente no existe un contador de contradicciones ni un estado específico para distinguir error del usuario, dato incorrecto y empate real.

### QA-ENG-005 — Agotar propuestas rechazadas

Crear un fixture con cuatro preguntas discriminantes, responder para que aparezca una propuesta, rechazarla, repetir hasta rechazar todos los candidatos.

**Esperado:**

- Cada id rechazado aparece una sola vez en `rejectedCandidateIds`.
- El motor no vuelve a proponer un id rechazado.
- Al eliminar el último candidato se obtiene `no-match`/`inconsistent`, salvo que ya se haya agotado el límite y la regla de producto indique `limit-reached`.

Este caso es el camino real que actualmente puede vaciar el conjunto; una respuesta contradictoria por sí sola no lo vacía por el modelo 0,9/0,1.

### QA-ENG-006 — Precisión con respuestas perfectas

Ejecutar una partida por cada candidato de Kanto y otra muestra nacional, contestando cada pregunta con el atributo real del candidato secreto.

**Métricas obligatorias:** `wonCorrect`, `wonWrong`, `ambiguous`, `no-match`, `limit-reached`, media, p95 y máximo de preguntas.

**Resultado de referencia actual:** Kanto 94/151 aciertos y 57 empates; nacional 660/1025 aciertos y 365 empates. No hubo victorias equivocadas ni límites en estas ejecuciones. Estos valores deben guardarse como baseline, no como criterio universal de calidad, porque dependen de los predicados actuales.

### QA-STORE-001 — Guardado de cada respuesta

1. Seleccionar un Pokémon.
2. Contestar tres preguntas.
3. Exportar el JSON.
4. Comprobar que `questionsAsked === events.length === 3`.
5. Verificar ids, textos, respuestas, semilla, catálogo y `maxQuestions`.

**Esperado:** los tres eventos aparecen ordenados y sus `candidatesAfter` coincide con la longitud de `remainingCandidateIds`.

También verificar la semántica: esos ids son candidatos activos del posterior, no necesariamente todos los candidatos que satisfacen exactamente la conjunción de respuestas.

### QA-STORE-002 — Escrituras rápidas y cierre

Con una prueba de integración que sustituya `AsyncStorage` por un adaptador con latencia artificial:

1. Lanzar dos `upsertSinglePlayerSession` sin esperar el primero.
2. Resolver las promesas en orden inverso.
3. Leer el registro.
4. Repetir cerrando el proceso durante `setItem`.

**Esperado:** se conserva la versión más reciente y el historial no pierde eventos. Si no se puede garantizar, el estado debe quedar marcado como no confirmado y ofrecer recuperación.

### QA-STORE-003 — Varias partidas y contador

Jugar dos partidas completas y una abandonada. Comprobar:

- tres `sessionId` distintos;
- eventos aislados por sesión;
- dos resultados terminales y un `abandoned`;
- el contador visual muestra tres;
- “Jugar otra vez” no borra las anteriores.

El último punto y el aislamiento están diseñados en el repositorio, pero el contador visible actualmente solo se actualiza a un mínimo de 1 y debe verificarse como defecto conocido.

### QA-STORE-004 — Corrupción y migración

Probar un JSON con:

- un evento sin `remainingCandidateIds`;
- ids no numéricos;
- `candidatesAfter: -1`, `NaN` serializado como `null` y valores enormes;
- `schemaVersion` antigua y desconocida;
- una sesión válida junto a otra inválida.

**Esperado:** se rechazan o aíslan registros inválidos, se conserva la sesión sana y se muestra un error recuperable. En la implementación actual el saneador comprueba tipos básicos, pero no valida rangos, cardinalidad, ids existentes en el catálogo, fechas ni el tamaño total del documento.

### QA-FLEET-001 — Integridad de la campaña

Validar el manifiesto y todos los shards:

- 50 shards y 1.000 sesiones por shard;
- `sessionId` único global;
- suma de resultados igual a 50.000;
- suma de eventos igual a `totalQuestions`;
- `events.length <= maxQuestions`;
- `candidatesAfter === remainingCandidateIds.length`;
- ningún `candidatesAfter` mayor que `candidatesBefore`;
- ids dentro del catálogo 1–1025.

**Resultado actual:** las comprobaciones de conteo, unicidad, longitudes, monotonicidad y manifiesto pasan; el máximo es 16 y `limitReached` es 0.

### QA-FLEET-002 — Cobertura explícita del final en 30

No usar la selección aleatoria nacional. Crear un fixture con 31 preguntas discriminantes y varias respuestas que mantengan más de un candidato hasta la pregunta 30.

**Esperado:** exactamente 30 eventos, `limit-reached`, cero pregunta 31 y resultado de usuario `player-won` en el adaptador de pantalla.

Repetir rechazando una propuesta en la pregunta 30 y comprobar el mismo resultado.

### QA-FLEET-003 — Cohortes de contradicción

Ejecutar cuatro campañas pequeñas con la misma semilla:

1. respuestas siempre verdaderas;
2. una contradicción en la primera pregunta;
3. una contradicción aleatoria en cualquier pregunta;
4. varias contradicciones.

Comparar precisión, preguntas, empates, `no-match` y `limit-reached`. No mezclar las cohortes en un solo porcentaje.

## Observaciones sobre Akinator y la jugabilidad

La implementación actual tiene tres ideas apropiadas para el objetivo:

- ganancia de información para dividir el conjunto;
- exploración acotada para evitar una apertura siempre idéntica;
- actualización tolerante a ruido y propuesta por confianza.

No tiene todavía las propiedades que normalmente se esperan de un sistema Akinator maduro:

- no aprende pesos a partir de respuestas reales guardadas;
- no distingue de forma explícita `sí`, `no`, `probablemente`, `no sé` o dato desconocido;
- no calibra la confianza por pregunta ni por calidad del atributo;
- no tiene un conjunto humano de verdad-terreno para rasgos visuales;
- el helper `chooseBestSinglePlayerQuestion` de `src/data/singlePlayerKnowledge.ts:570-598` mantiene otra selección determinista y puede divergir del motor si vuelve a utilizarse.

La evolución recomendada es conservar el motor puro y versionar por separado:

1. catálogo y atributos;
2. banco de preguntas;
3. política de score;
4. semilla y replay;
5. formato de persistencia.

Así una partida antigua puede reproducirse con sus mismas respuestas sin recalcularla con un banco nuevo.

## Checklist de salida QA

- [ ] El motor rechaza o documenta claramente cualquier límite distinto de 30.
- [ ] Existe un test automatizado del camino `limit-reached` en la pregunta 30.
- [ ] La UI guarda una sesión `in-progress` al seleccionar el Pokémon si esa es la política acordada.
- [ ] Las escrituras locales están serializadas y tienen prueba de fallo/cierre.
- [ ] `schemaVersion` y `SINGLE_PLAYER_LOG_VERSION` siguen una política única.
- [ ] El contador de sesiones refleja el número real guardado.
- [ ] El historial diferencia candidatos activos de candidatos compatibles exactos.
- [ ] Hay una política explícita para contradicciones y datos desconocidos.
- [ ] Los predicados visuales han sido revisados con un fixture humano de Pokémon atípicos.
- [ ] La campaña nacional incluye una cohorte con `limit-reached` y otra con contradicciones distribuidas.
- [ ] Las pruebas unitarias y E2E se ejecutan en CI.

## Conclusión

El selector ya es variable y reproducible, y el motor no supera el límite cuando se configura con 30. La campaña de 50.000 demuestra que el flujo normal es estable y que sus artefactos son internamente coherentes. La aprobación queda bloqueada por la falta de cobertura del límite, la persistencia no serializada, la semántica ambigua del conjunto activo y la calidad heurística de varios atributos. Resolver esos puntos permitirá medir de verdad si la máquina acierta al Pokémon del jugador, en lugar de medir únicamente lo consistente que es con sus propias etiquetas.
