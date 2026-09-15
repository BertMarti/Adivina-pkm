# Plan técnico de pruebas — modo 1 jugador

**Proyecto:** PokéQuién · Duelo Pixel
**Fecha de referencia:** 14/09/2026  
**Estado:** plan de regresión para la implementación actual del modo 1 jugador  
**Alcance:** motor de inferencia, catálogo grande de Pokémon, flujo de preguntas binarias, persistencia local, reinicio y exportación del registro.

## 1. Propósito

Este documento define cómo validar el modo 1 jugador en el que el usuario piensa o selecciona un Pokémon y la aplicación formula preguntas con respuesta exclusiva **SÍ** o **NO** hasta identificarlo.

El objetivo no es comprobar únicamente que la interfaz avance de pregunta en pregunta. El sistema debe demostrar que:

- cada respuesta modifica correctamente el conjunto de candidatos;
- ninguna pregunta presupone información que la base de datos no tenga;
- un Pokémon ambiguo no se presenta como una adivinanza inequívoca;
- el algoritmo no repite preguntas ni se queda en un bucle;
- el resultado y todas las respuestas quedan registrados sin corromperse;
- reiniciar la partida no borra el historial anterior;
- el registro se puede exportar con un formato estable y verificable;
- la experiencia sigue siendo usable en móvil y con tecnologías de asistencia.

## 2. Estado actual del repositorio

La revisión se ha hecho sobre `D:\Desarrollos\Adivina-pkm` y sobre sus instrucciones de `AGENTS.md`.

### Ya disponible

- `src/game/engine.ts`: máquina de estados pura del modo de dos jugadores.
- `src/data/pokemon.ts`: tipo `PokemonCandidate`, roster local de 25 Pokémon de Kanto y carga remota de hasta 25 Pokémon desde PokéAPI.
- `App.tsx`: flujo visual multijugador, selección, tachado, resultado y accesibilidad básica.
- `server/room-server.js` y `src/game/roomClient.ts`: transporte WebSocket local para salas.
- Retratos SpriteCollab con fallback de PokeAPI.

### Implementado en esta versión

- `src/game/singlePlayerEngine.ts`: estado puro, selección por ganancia de información, contradicciones, empates y descarte de propuestas incorrectas;
- `src/data/singlePlayerKnowledge.ts`: banco Kanto local y banco Nacional cargable bajo demanda;
- `src/game/singlePlayerStorage.ts`: persistencia local versionada, límite de historial y exportación JSON;
- `src/singlePlayer/SinglePlayerScreen.tsx`: selección, preguntas exclusivas SÍ/NO, resultado, búsqueda y accesibilidad;
- `scripts/single-player-soak-test.ts`: campaña reproducible de 10.000 partidas con registro de cada pregunta y respuesta.

Los casos de este documento se pueden ejecutar contra la aplicación actual. La cobertura pendiente es integrar estas comprobaciones en un framework formal de tests E2E/CI.

## 3. Decisiones de producto verificadas para esta versión

Las pruebas necesitan una semántica estable. La implementación no debe dejar estas decisiones implícitas:

1. **Unidad de catálogo:** por defecto, una entrada por especie de la Pokédex Nacional. Las formas regionales, megaevoluciones, formas alternativas y variantes de género quedan fuera de la primera versión, salvo que tengan un identificador único explícito.
2. **Selección secreta:** el usuario selecciona un Pokémon del catálogo o de un tablero generado. El Pokémon se muestra como recordatorio únicamente en la pantalla local del jugador; la máquina no recibe su id.
3. **Tipo dual:** “¿Es de tipo Agua?” responde SÍ si Agua es cualquiera de sus tipos.
4. **Evolución:** “¿Tiene evolución?” responde SÍ si existe al menos una evolución oficial en el grafo de especies; no se debe inferir solo desde `stage` si el dato no está confirmado.
5. **Legendario y singular:** legendario, singular/mítico y paradoja son atributos independientes. Una pregunta no debe mezclar categorías.
6. **Generación:** la generación debe ser un atributo versionado de la especie, no una inferencia basada únicamente en el número de Pokédex.
7. **Datos desconocidos:** una pregunta solo se puede mostrar si el atributo necesario está completo y normalizado para todos los candidatos activos. No se puede obligar al usuario a responder “sí” o “no” cuando la aplicación no conoce el dato.
8. **Final de partida:** si queda un solo candidato compatible, la aplicación puede proponerlo. La victoria lógica solo se registra después de que el usuario confirme que la propuesta coincide con su Pokémon; si el producto decide adivinar automáticamente, debe registrarse como una decisión distinta.
9. **Empate:** si quedan dos o más candidatos y no existe una pregunta válida que los separe, el resultado es `ambiguous`, no una adivinanza arbitraria.
10. **Solo SÍ/NO:** la UI no tendrá texto libre ni una tercera opción en la primera versión. Los errores de datos deben resolverse internamente o terminar con un estado de revisión, nunca con una respuesta inventada.

## 4. Arquitectura que se debe probar

Se recomienda mantener la lógica en capas, sin mezclarla con `App.tsx`:

```text
Base de conocimiento versionada
        ↓
Normalizador de atributos y preguntas
        ↓
Motor puro de inferencia
        ↓
Adaptador de persistencia local ──→ registro de eventos
        ↓                                      ↓
UI de preguntas SÍ/NO                 exportador JSON/CSV
```

La futura lógica de dominio debe ser pura, igual que exige `AGENTS.md` para `src/game/engine.ts`. La UI, el almacenamiento, el audio y el tiempo no deben formar parte del resultado de una transición del motor.

### Contrato mínimo recomendado del motor

El plan asume operaciones equivalentes a estas, aunque los nombres finales pueden cambiar:

- `startSinglePlayer(catalogue, sessionId, seed)`;
- `answerQuestion(state, questionId, answer)`;
- `getNextQuestion(state)`;
- `confirmGuess(state, pokemonId, correct)`;
- `restartSinglePlayer(state, seed)`;
- `getResult(state)`.

Cada transición debe ser determinista si recibe el mismo catálogo, semilla y secuencia de respuestas.

## 5. Datos de prueba y fixtures

La suite debe incluir un snapshot local congelado para no depender de PokéAPI durante las pruebas. Las imágenes no forman parte del oráculo del motor: se validan por separado con fallback.

### Fixtures mínimos

| Fixture | Contenido | Propósito |
|---|---|---|
| `kanto-25` | Los 25 Pokémon locales actuales | Regresión rápida y pruebas de UI. |
| `national-small` | Al menos 151 especies de Kanto con atributos completos | Cobertura de preguntas y evolución. |
| `national-full` | Snapshot de todas las especies soportadas por la versión | Pruebas de volumen, rendimiento y cobertura. |
| `dual-types` | Bulbasaur, Charizard, Butterfree, etc. | Verificar semántica de tipo dual. |
| `no-evolution` | Pokémon sin evolución | Límites de evolución. |
| `branching-evolution` | Eevee y familias con varias ramas | No confundir “tiene evolución” con “evoluciona a una única especie”. |
| `legendary-mythical` | Legendarios y singulares separados | Preguntas independientes. |
| `ambiguous-forms` | Rotom, Meowth, formas regionales y nombres homónimos | Política de especie frente a forma. |
| `missing-attributes` | Registros con un atributo `unknown` | No generar preguntas no respondibles. |
| `duplicate-ids` | Dos filas con el mismo id | Rechazo de catálogo inválido. |
| `empty-catalogue` | Cero candidatos | Error controlado. |
| `two-candidates-indistinguishable` | Dos candidatos con idéntico vector de atributos | Resultado `ambiguous`. |
| `contradictory-answers` | Secuencia que elimina todos los candidatos | Recuperación sin crash ni falsa adivinanza. |

Cada registro del catálogo debe tener, como mínimo:

- `id` estable;
- nombre de especie;
- tipos;
- generación;
- estado evolutivo y grafo de evolución, si se usa;
- clasificaciones legendario/mítico, si se usan;
- fuente, versión de snapshot y fecha de actualización;
- indicadores de completitud por atributo.

## 6. Estrategia de preguntas

La aplicación debe construir preguntas a partir de predicados binarios versionados. Cada pregunta debe tener `id`, texto, atributo consultado, versión semántica y función que devuelve `true` o `false` para cada candidato válido.

La selección recomendada maximiza la separación del conjunto actual y mantiene una semilla por ronda para variar los desempates, con este orden:

1. descartar preguntas ya respondidas;
2. descartar preguntas que no separen candidatos;
3. priorizar el reparto más cercano a 50/50;
4. desempatar por cobertura del atributo;
5. conservar las preguntas a menos de 0,08 puntos de la mejor;
6. escoger una de esas preguntas con la semilla de la ronda; si no hay semilla, desempatar por `questionId` estable.

No se debe seleccionar una pregunta que deje el mismo conjunto de candidatos tanto para SÍ como para NO. El motor debe incluir un límite de seguridad de preguntas para evitar bucles causados por datos defectuosos.

## 7. Casos de prueba funcionales: respuestas SÍ/NO

Los siguientes casos deben existir como tests unitarios del motor y, en los flujos principales, como tests E2E.

| ID | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| SP-YN-001 | Respuesta SÍ básica | Iniciar con `national-small`, contestar SÍ a una pregunta conocida | El conjunto se reduce exactamente a los registros cuyo predicado es `true`. Se guarda un evento. |
| SP-YN-002 | Respuesta NO básica | Repetir con NO | Solo sobreviven los registros cuyo predicado es `false`. |
| SP-YN-003 | Secuencia mixta | Contestar SÍ, NO, SÍ, NO | La intersección de todos los filtros coincide con el oráculo calculado desde el fixture. |
| SP-YN-004 | SÍ sobre tipo dual | Preguntar por Agua a un Pokémon Agua/Tierra | La respuesta esperada es SÍ; no se exige que sea monotipo. |
| SP-YN-005 | NO sobre tipo ausente | Preguntar por Fuego a un Pokémon sin Fuego | El candidato se elimina correctamente tras NO en la rama contraria. |
| SP-YN-006 | Pulsación doble | Pulsar dos veces rápidamente el mismo botón | Solo se registra una respuesta y se avanza una pregunta. No hay doble evento ni salto de estado. |
| SP-YN-007 | Botones exclusivos | Inspeccionar la pantalla tras responder | SÍ y NO son controles de acción clara; no existe un campo de texto que permita valores fuera de `{yes,no}`. |
| SP-YN-008 | Respuesta tardía | Responder después de una transición o de un reinicio | La respuesta antigua se ignora o se asocia a su `sessionId`; nunca modifica la partida nueva. |
| SP-YN-009 | Pregunta repetida | Forzar desde el adaptador la repetición de una pregunta | El motor la rechaza o la marca como error de integridad; no reduce dos veces ni crea un bucle. |
| SP-YN-010 | Predicado constante | Inyectar una pregunta que produce SÍ para todos | No se muestra al usuario; el selector la descarta por no aportar información. |
| SP-YN-011 | Candidato único | Responder hasta que queda uno | Se muestra una propuesta de adivinanza y se detienen nuevas preguntas. |
| SP-YN-012 | Confirmación correcta | Confirmar que la propuesta coincide | Resultado `guessed`, Pokémon correcto, número de preguntas y respuestas completos. |
| SP-YN-013 | Rechazo de propuesta | Indicar que la propuesta no coincide | No se registra una victoria falsa; pasa a `ambiguous` o a flujo de revisión definido por producto. |
| SP-YN-014 | Catálogo vacío | Iniciar sin candidatos | Error controlado y accionable; no se renderiza una pregunta ni se bloquea la UI. |
| SP-YN-015 | Sin pregunta útil | Dejar dos candidatos sin ningún predicado separador | Resultado `ambiguous`; se muestran los candidatos restantes y se ofrece reiniciar. |
| SP-YN-016 | Contradicción | Responder una secuencia que elimina todos los candidatos | Resultado `inconsistent`; se conserva el registro, se explica que las respuestas no son compatibles y no se adivina. |
| SP-YN-017 | Límite de preguntas | Alcanzar `maxQuestions` con más de un candidato | Final controlado `limit-reached`, sin recursión ni spinner infinito. |
| SP-YN-018 | Orden determinista | Ejecutar dos veces el mismo fixture, semilla y respuestas | Misma pregunta siguiente, mismo conjunto y mismo resultado. |
| SP-YN-019 | Reinicio durante pregunta | Pulsar “Nueva partida” antes de responder | Se crea `sessionId` nuevo y ninguna respuesta de la partida anterior aparece en la nueva. |
| SP-YN-020 | Reinicio desde resultado | Pulsar “Jugar de nuevo” | Se conserva el historial terminado y se inicia una sesión vacía. |
| SP-YN-021 | Límite de producto | Contestar 30 veces manteniendo al menos dos candidatos | La fase pasa a `limit-reached`, se registra `player-won`, suena la victoria del jugador y se muestra el Pokémon elegido con sus curiosidades. |
| SP-YN-022 | Orden entre rondas | Crear dos partidas con semillas distintas y respuestas equivalentes | Las preguntas casi equivalentes pueden aparecer en orden distinto; ninguna se repite dentro de una partida. |

## 8. Casos de Pokémon ambiguo

La ambigüedad debe resolverse en los datos, no mediante una adivinanza arbitraria. Se distinguen tres situaciones:

### 8.1 Ambigüedad de identidad

Dos filas representan la misma especie o el mismo id. El catálogo debe rechazarse antes de empezar. El error debe identificar el id duplicado y no exponer una partida parcialmente inicializada.

### 8.2 Ambigüedad de forma

Si la primera versión es por especie, una pregunta sobre forma regional no debe aparecer. Si el producto decide incluir formas, cada forma necesita un id, imagen, atributos y registro propio. Las pruebas deben comprobar que no se mezclan, por ejemplo, especie base y forma regional en un único candidato.

### 8.3 Ambigüedad semántica

Casos obligatorios:

- “¿Es de tipo X?” con tipos dobles: SÍ si contiene X.
- “¿Tiene evolución?” para especies con evolución ramificada: SÍ, aunque tenga varias posibles.
- Pokémon sin evolución: NO.
- Legendario frente a mítico: no intercambiar categorías.
- Evoluciones regionales o familias con datos incompletos: no preguntar por etapa si `stageKnown` es falso.
- Nombre traducido frente a nombre canónico: el id es el oráculo; el texto nunca debe causar dos registros para la misma especie.
- Color, silueta y hábitat: usar atributos locales completos y formular pistas amplias que una persona pueda contestar mirando el retrato.

### 8.4 Preguntas deliberadamente excluidas

El banco actual no contiene preguntas sobre número de Pokédex Nacional, rangos
numéricos, kilogramos, peso, altura ni el nombre exacto del Pokémon. Estas
familias no deben volver a introducirse al ampliar el catálogo.

### Oráculo de ambigüedad

Para cada estado se debe calcular el vector de atributos de los candidatos restantes. Si todos los predicados disponibles producen el mismo resultado para dos o más candidatos, el motor no puede separarlos. Debe devolver:

```text
status: "ambiguous"
candidates: [ids restantes]
reason: "no-discriminating-question"
```

No se debe usar el orden de la Pokédex, una elección aleatoria ni la imagen como criterio secreto de desempate.

## 9. Casos de empate y contradicción

En modo 1 jugador “empate” no significa empate entre dos jugadores. Deben probarse estos tres niveles:

| ID | Situación | Resultado esperado |
|---|---|---|
| SP-TIE-001 | Dos preguntas separan 12/13 candidatos de forma idéntica | Se elige siempre la misma pregunta por el desempate estable; el resultado no depende del orden de un `Map`. |
| SP-TIE-002 | Dos Pokémon quedan indistinguibles | Resultado `ambiguous`, ambos ids visibles en la pantalla de revisión y en el registro. |
| SP-TIE-003 | Varias propuestas comparten la misma puntuación | No se proclama un ganador automático; se aplica el orden determinista documentado. |
| SP-TIE-004 | Respuestas contradictorias dejan cero candidatos | Resultado `inconsistent`, con recuperación y sin excepción no controlada. |
| SP-TIE-005 | Respuesta incompatible tras guardar | El repositorio conserva el evento recibido y el estado calculado; no se reescribe silenciosamente el historial. |
| SP-TIE-006 | El usuario confirma una propuesta incorrecta | Se registra `guessRejected`; no se presenta `Victoria` ni se marca el Pokémon como acertado. |

## 10. Persistencia local de partidas y resultados

El repositorio actual no incluye `AsyncStorage`, SQLite ni otro almacenamiento persistente. Antes de implementar, se debe elegir un adaptador. Para una base de conocimiento grande y registros de una hora, SQLite o un repositorio equivalente es más apropiado que guardar un único JSON grande en preferencias.

### Modelo lógico mínimo

Una sesión debe conservar:

- `sessionId` y `schemaVersion`;
- fecha/hora de inicio y fin;
- versión del catálogo y de las preguntas;
- `maxQuestions` y semilla de selección, si se usa aleatoriedad reproducible;
- Pokémon elegido, visible solo en el dispositivo del jugador;
- secuencia ordenada de preguntas y respuestas `yes`/`no`;
- candidatos antes y después de cada respuesta;
- propuesta(s) del motor y confirmación del usuario;
- resultado (`guessed`, `ambiguous`, `inconsistent`, `limit-reached`, `abandoned`);
- duración, número de preguntas y versión de aplicación.

Se deben almacenar ids y metadatos compactos, no copias de imágenes remotas. El registro de una partida activa puede quedar en estado `in-progress` y cerrarse como `abandoned` si la aplicación se termina sin reinicio explícito.

### Casos de persistencia

| ID | Caso | Resultado esperado |
|---|---|---|
| SP-PERSIST-001 | Guardar después de cada respuesta | Al cerrar la app tras cualquier pregunta, se recupera el último estado confirmado, no uno anterior ni parcialmente mutado. |
| SP-PERSIST-002 | Recuperar partida activa | Tras relanzar la app, la UI muestra la misma pregunta, candidatos y contador; el secreto no se muestra antes del final. |
| SP-PERSIST-003 | Guardar resultado final | Una victoria, ambigüedad, contradicción y abandono quedan como registros independientes. |
| SP-PERSIST-004 | Dos partidas consecutivas | Cada partida tiene `sessionId` distinto y sus respuestas no se mezclan. |
| SP-PERSIST-005 | Reinicio de partida | “Nueva partida” limpia solo el estado activo; no elimina resultados anteriores. |
| SP-PERSIST-006 | Borrado explícito del historial | Solo una acción confirmada de “Borrar historial” elimina registros; no debe ser un efecto colateral de reiniciar. |
| SP-PERSIST-007 | Escritura repetida | Reintentar una escritura con el mismo `eventId` es idempotente y no duplica respuestas. |
| SP-PERSIST-008 | Corte durante escritura | Una terminación simulada no deja JSON truncado ni una fila imposible de leer. |
| SP-PERSIST-009 | Datos corruptos | Un registro inválido se aísla, se informa y permite seguir usando partidas sanas. |
| SP-PERSIST-010 | Migración de esquema | Una versión antigua se migra una sola vez y mantiene respuestas, resultado y timestamps. |
| SP-PERSIST-011 | Almacenamiento lleno | Se muestra un error recuperable; no se proclama un resultado persistido si la escritura falló. |
| SP-PERSIST-012 | Historial grande | Con miles de sesiones y al menos una hora de eventos, las consultas de listado siguen siendo paginadas y la UI no se bloquea. |
| SP-PERSIST-013 | Privacidad en progreso | El secreto no aparece en una pantalla, log de depuración ni exportación de partida activa si la política de privacidad lo prohíbe. |
| SP-PERSIST-014 | Reinstalación | Se documenta y prueba la política: el almacenamiento local puede perderse; nunca se presenta como sincronización en la nube. |

## 11. Exportación del registro

La exportación debe ser reproducible y verificable. JSON será el formato canónico; CSV puede añadirse como formato de análisis.

### Contrato JSON recomendado

```json
{
  "format": "adivina-pkm-single-player-log",
  "formatVersion": 2,
  "exportedAt": "2026-09-14T17:00:00.000Z",
  "catalogueVersion": "national-2026-09-14",
  "sessions": []
}
```

El formato debe documentar que `answer` solo admite `yes` o `no`, que los ids son numéricos y que el secreto se incluye únicamente en una sesión terminada o cuando el usuario autoriza la exportación de una sesión activa.

### Casos de exportación

| ID | Caso | Resultado esperado |
|---|---|---|
| SP-EXPORT-001 | Exportar una sesión terminada | El archivo contiene resultado, Pokémon propuesto, confirmación, preguntas, respuestas y versión del catálogo. |
| SP-EXPORT-002 | Exportar varias sesiones | Todas aparecen una vez, ordenadas por `startedAt` o por el orden documentado. |
| SP-EXPORT-003 | Exportar historial vacío | Se genera un documento válido con `sessions: []`; no se produce un archivo ilegible. |
| SP-EXPORT-004 | Exportar partida activa | Se aplica la política de privacidad: respuestas parciales sí; secreto oculto salvo autorización explícita. |
| SP-EXPORT-005 | Caracteres especiales | Nombres con tildes, ñ, comillas y saltos de línea sobreviven en UTF-8 y CSV correctamente escapado. |
| SP-EXPORT-006 | Registro de una hora | El exportador termina sin bloquear la UI y el JSON vuelve a parsear con el mismo número de eventos. |
| SP-EXPORT-007 | Reimportación | Importar el JSON exportado reconstruye estadísticas, pero no debe reactivar automáticamente una partida terminada. |
| SP-EXPORT-008 | Esquema desconocido | Un archivo de versión superior se rechaza con mensaje claro y no altera el historial local. |
| SP-EXPORT-009 | Fallo de compartir/guardar | El registro queda intacto y se ofrece reintentar; no se borra tras un fallo del sistema operativo. |
| SP-EXPORT-010 | Sin datos sensibles | El archivo no incluye tokens, URLs de sesión, secretos de backend ni contenido binario innecesario. |

## 12. Reinicio y ciclo de vida

Se deben distinguir tres acciones distintas:

1. **Continuar:** relanzar la aplicación y recuperar una sesión activa.
2. **Nueva partida:** cerrar la sesión activa como reiniciada/abandonada y crear una nueva.
3. **Borrar historial:** eliminar datos únicamente tras confirmación explícita.

Casos adicionales:

- pulsar reinicio varias veces no crea sesiones duplicadas por una misma pulsación;
- un reinicio durante la animación o sonido no deja callbacks aplicados a la partida nueva;
- volver de segundo plano conserva el estado;
- cambiar orientación o tamaño entre preguntas no modifica candidatos;
- cerrar y abrir la aplicación con una respuesta pendiente no registra una respuesta fantasma;
- el botón de Android/iOS “atrás” pide confirmación si hay una partida activa;
- el resultado terminado permanece consultable después de crear una nueva partida.

## 13. Pruebas de rendimiento, volumen y resistencia

El objetivo de la campaña es aproximarse a una hora de uso continuo para descubrir fugas, duplicados y degradación, no generar datos de producción.

### Campaña de una hora

Preparar un runner determinista que simule muchos jugadores virtuales con el motor puro y una pequeña proporción de pruebas UI/manuales:

- duración: 60 minutos;
- al menos 1.000 sesiones sintéticas o la capacidad máxima alcanzable en ese tiempo;
- catálogo completo congelado;
- distribución de secretos uniforme y otra ponderada hacia Pokémon populares;
- respuestas SÍ/NO generadas siempre desde el atributo real del secreto;
- 10% de partidas con respuestas contradictorias inyectadas;
- 10% con reinicio a mitad de partida;
- 10% con cierre/relanzamiento entre respuestas;
- sesiones ambiguas forzadas con el fixture de empate;
- exportación cada 100 sesiones y al finalizar;
- muestreo del uso de memoria, tiempo de pregunta, tiempo de guardado y tamaño del registro.

### Invariantes durante la resistencia

- nunca aparece un id fuera del catálogo;
- `candidateIds` siempre es un subconjunto del catálogo;
- una respuesta no cambia preguntas anteriores;
- no hay preguntas repetidas dentro de una sesión;
- un evento tiene `eventId` único;
- el número de respuestas es igual al número de preguntas contestadas;
- un resultado terminal no vuelve a `in-progress`;
- el tamaño del registro crece linealmente con los eventos;
- el tiempo de `getNextQuestion` no crece de forma superlineal con el historial;
- no hay excepciones no controladas, fugas de listeners ni timers activos después del reinicio.

### Umbrales iniciales sugeridos

Son valores de aceptación preliminares y deben medirse en el dispositivo objetivo:

- respuesta visual de SÍ/NO: menos de 100 ms después de la pulsación local;
- cálculo de la siguiente pregunta para el catálogo completo: menos de 250 ms en dispositivo medio;
- guardado de un evento: menos de 100 ms en p95;
- abrir el historial: menos de 500 ms para 1.000 sesiones paginadas;
- exportar 1.000 sesiones: menos de 2 s sin congelar la interacción;
- crecimiento de memoria estable durante 60 minutos, sin tendencia continua al alza.

## 14. Pruebas de UI, accesibilidad y recursos

Aplicar las reglas de `AGENTS.md` también al nuevo flujo:

- botones SÍ y NO con área táctil mínima de 44 px;
- foco y orden de lectura coherentes;
- `accessibilityLabel` que indique la pregunta actual y el estado;
- no depender solo de verde/rojo para diferenciar respuesta o resultado;
- contraste medido para texto, botones, estados y error;
- movimiento reducido respeta la preferencia del sistema;
- el lector de pantalla anuncia “pregunta X de Y”, no solo el texto del botón;
- la respuesta confirmada se comunica sin obligar al usuario a interpretar una animación;
- el teclado no aparece porque no existe entrada de texto;
- el flujo funciona desde 320 px de ancho hasta tablet;
- las imágenes del Pokémon tienen fallback y no bloquean la pregunta si fallan;
- no se filtra el Pokémon secreto mediante `accessibilityLabel`, analytics o texto alternativo antes del resultado;
- exportar y borrar historial son acciones claramente etiquetadas y confirmables.

## 15. Seguridad, privacidad y robustez

Aunque el modo sea local, la suite debe comprobar:

- no ejecutar JSON almacenado como código;
- limitar tamaño de catálogo, pregunta y registro antes de procesarlo;
- validar `id`, `answer`, `questionId` y versiones al leer almacenamiento;
- no incluir tokens ni datos de salas multijugador en el registro individual;
- no enviar respuestas ni Pokémon elegido a un backend sin una decisión explícita de producto;
- no escribir el Pokémon secreto en logs de depuración de producción;
- tratar las URLs de imágenes como datos externos, con fallback y sin asumir que la red está disponible;
- mantener la atribución de SpriteCollab y las restricciones de licencia en la distribución.

## 16. Niveles y herramientas recomendados

La base actual no tiene framework de tests. Antes de automatizar debe añadirse una infraestructura separada del producto:

| Nivel | Cobertura | Herramienta candidata |
|---|---|---|
| Unitario | Predicados, filtros, selección de pregunta, resultados | Vitest o Jest. |
| Propiedad | Invariantes con catálogos y respuestas aleatorias | fast-check o generador propio determinista. |
| Integración | Motor + repositorio local + migraciones | Vitest/Jest con almacenamiento temporal. |
| Componente | Botones SÍ/NO, resultado, reinicio, errores | React Native Testing Library. |
| E2E web | Flujo completo y responsive | Playwright. |
| E2E móvil | Persistencia, segundo plano y accesibilidad | Maestro o Detox, según la infraestructura Expo elegida. |
| Resistencia | Una hora, exportaciones y relanzamientos | Runner Node separado, con artefactos JSON de diagnóstico. |

El runner de resistencia no debe escribir en el historial real del usuario. Usará un directorio temporal o un adaptador en memoria y conservará únicamente los artefactos de la ejecución.

## 17. Matriz de trazabilidad

| Requisito | Casos principales | Criterio de salida |
|---|---|---|
| Solo SÍ/NO | SP-YN-001…008 | No hay valores fuera de `yes/no`; doble pulsación idempotente. |
| Adivinanza correcta | SP-YN-011…013 | Nunca se declara acierto sin confirmación o regla automática explícita. |
| Pokémon ambiguo | SP-TIE-002, SP-AMB-* | Resultado `ambiguous`, sin elección arbitraria. |
| Empate de algoritmo | SP-TIE-001, SP-TIE-003 | Desempate reproducible. |
| Contradicción | SP-YN-016, SP-TIE-004…006 | Resultado recuperable y registro íntegro. |
| Reinicio | SP-YN-019…020, SP-PERSIST-005 | Nueva sesión aislada; historial conservado. |
| Persistencia | SP-PERSIST-001…014 | Recuperación, migración y fallos cubiertos. |
| Exportación | SP-EXPORT-001…010 | JSON válido, estable, UTF-8 y sin datos indebidos. |
| Catálogo grande | campaña de resistencia | Sin degradación no acotada ni corrupción. |
| Accesibilidad móvil | sección 14 | Auditoría manual y automatizada aprobadas. |

## 18. Criterios de aceptación y salida

El modo 1 jugador no debería considerarse listo para una primera beta hasta cumplir:

- 100% de los tests unitarios de reglas y predicados críticos;
- 100% de los casos `SP-YN`, `SP-TIE`, `SP-PERSIST` y `SP-EXPORT` de prioridad alta;
- cobertura de catálogo completa para todos los atributos que generan preguntas;
- cero preguntas no discriminantes en una sesión válida;
- cero resultados `guessed` falsos en la suite de respuestas generadas desde el secreto;
- recuperación correcta tras cerrar y abrir durante una partida;
- exportaciones que se puedan parsear y validar con el esquema publicado;
- campaña de resistencia de 60 minutos sin corrupción, fuga de memoria ni duplicación de eventos;
- controles de 44 px o más, contraste comprobado y estado anunciado por accesibilidad;
- documentación de las limitaciones del catálogo, las formas y la privacidad.

## 19. Evidencias que debe dejar cada ejecución

Cada pipeline o ejecución manual importante debe guardar:

- versión de aplicación, catálogo y preguntas;
- semilla de aleatoriedad;
- resultado resumido por caso;
- tiempos p50/p95/p99;
- tamaño de catálogo e historial;
- número de sesiones, preguntas y eventos;
- errores con `sessionId` anonimizado;
- hash del export JSON generado;
- capturas de las pantallas de selección, pregunta, ambigüedad, resultado y reinicio en móvil pequeño y tablet.

No se deben guardar en los artefactos compartidos los Pokémon secretos de sesiones reales ni datos personales.

## 20. Orden recomendado de ejecución

1. Congelar el contrato semántico de especie, forma, evolución y categorías.
2. Validar el snapshot del catálogo y rechazar registros incompletos o duplicados.
3. Implementar y probar predicados puros.
4. Implementar el selector determinista de preguntas.
5. Cubrir adivinanza, ambigüedad, contradicción y límite.
6. Añadir repositorio local, escrituras atómicas y migraciones.
7. Probar reinicio, relanzamiento y aislamiento entre sesiones.
8. Añadir exportación JSON y después CSV si se mantiene la necesidad.
9. Integrar la UI SÍ/NO y las pruebas E2E responsive/accesibles.
10. Ejecutar la campaña de resistencia de una hora y revisar sus artefactos.

## 21. Archivos que probablemente necesitarán pruebas cuando se implemente

Esta lista no implica que deban crearse ahora:

- `src/game/singlePlayerEngine.ts` o extensión aislada del dominio existente;
- `src/data/pokemonKnowledgeBase.ts`;
- `src/data/questionCatalog.ts`;
- `src/storage/singlePlayerRepository.ts`;
- `src/storage/migrations.ts`;
- `src/export/singlePlayerLog.ts`;
- `src/single-player/SinglePlayerScreen.tsx`;
- `tests/singlePlayerEngine.test.ts`;
- `tests/questionCatalog.test.ts`;
- `tests/persistence.test.ts`;
- `tests/export.test.ts`;
- `tests/e2e/single-player.spec.ts`;
- `scripts/single-player-soak-test.ts`.

La máquina multijugador de `src/game/engine.ts` debe permanecer pura y sus reglas no deben mezclarse con el estado del modo individual sin una razón de dominio clara. Si ambos modos comparten conceptos, conviene extraer funciones puras comunes y probar contratos entre ellas.
