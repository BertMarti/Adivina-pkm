# Revisión UX/UI · Modo solitario de PokéQuién

**Fecha de revisión:** 15/09/2026  
**Rol:** especialista UX/UI móvil con dirección pixel-art/arcade  
**Alcance:** análisis y propuestas. En esta revisión solo se ha creado este documento; no se han modificado código ni otros archivos.

## 1. Resumen ejecutivo

El modo solitario ya tiene una base sólida y reconocible:

- selección secreta con búsqueda y catálogo de Kanto o nacional;
- preguntas binarias SÍ/NO;
- contador visible de `PREGUNTA X / 30`;
- tarjeta que recuerda al jugador qué Pokémon eligió;
- registro local de preguntas, respuestas y resultados;
- motor puro separado de React Native;
- retratos con fallback y una estética coherente de consola portátil.

Las mejoras prioritarias no son un rediseño completo. Hay que reforzar tres cosas:

1. **La sensación de inteligencia:** que el jugador perciba que cada pregunta responde a lo que acaba de contestar y no a un guion fijo.
2. **La confianza en las respuestas:** varias preguntas de silueta, color o comportamiento se calculan mediante aproximaciones a partir de tipo y forma. Si la pregunta resulta subjetiva, una respuesta honesta puede eliminar el Pokémon correcto.
3. **La legibilidad en móvil:** el flujo funciona, pero la cuadrícula nacional, los textos de las casillas, los estados de carga y el resultado necesitan una jerarquía más clara para pantallas pequeñas y tablets.

### Prioridad recomendada

| Prioridad | Objetivo | Resultado esperado |
|---|---|---|
| P0 | Deducción fiable | Menos partidas que terminan en `no-match` por una interpretación ambigua y más aperturas variables. |
| P0 | Feedback de partida | El jugador sabe qué pregunta está respondiendo, cuánto le queda y por qué ha terminado la sesión. |
| P1 | Carga y errores | La carga de la Pokédex nacional se percibe como un estado intencionado, no como un botón que se queda cambiado. |
| P1 | Resultado | Victoria, derrota, empate técnico y límite de 30 se distinguen de un vistazo y funcionan como cierre de partida. |
| P2 | Catálogo | La lista nacional conserva la cuadrícula de cinco columnas sin renderizar 1.025 casillas a la vez. |
| P2 | Accesibilidad | Tipografía, foco, lector de pantalla, movimiento reducido y escalado quedan cubiertos en móvil y tablet. |
| P3 | Acabado artístico | Más microanimaciones, marcos y sonido de consola sin perjudicar la claridad ni la batería. |

## 2. Criterios de dirección visual

La referencia debe seguir siendo una consola Pokémon/arcade de 16 bits, no una interfaz genérica de formulario.

- **Fondo:** mapa PMD oscurecido, scanlines discretas y una capa de contraste estable detrás de cada tarjeta.
- **Paleta:** amarillo eléctrico para foco y secretos, verde para estados positivos, coral/rojo para respuestas negativas o derrota, azul para acciones secundarias y naranja para acciones destacadas.
- **Superficies:** paneles azul-negro translúcidos, bisel metálico y una sombra corta desplazada como si cada botón fuera físico.
- **Tipografía:** fuente pixel para títulos, estados y etiquetas; texto de lectura normal para instrucciones, curiosidades y mensajes largos.
- **Pixel-art real:** las imágenes y marcos no deben suavizarse hasta parecer ilustraciones borrosas. En retratos pixelados conviene probar `resizeMode="contain"`, escalas enteras cuando sea posible y un fallback de baja resolución bien definido.
- **Movimiento:** corto, con aceleración suave y propósito. El movimiento debe comunicar “cargando”, “seleccionado” o “resultado”, nunca competir con la pregunta.

La estética puede ser llamativa sin sacrificar la jerarquía: en cada vista debe existir un único elemento dominante, que es la pregunta en la fase de juego y el resultado en la fase final.

## 3. Flujo actual y revisión por pantalla

### 3.1 Pantalla de selección

#### Lo que existe

La pantalla muestra:

- botón de volver;
- título `MODO 1 JUGADOR` y subtítulo de selección secreta;
- explicación de que la máquina solo recibe respuestas SÍ/NO;
- aviso de que no ve el identificador elegido;
- buscador de Pokémon;
- etiqueta con catálogo, número de candidatos y preguntas;
- botón para cargar los 1.025 Pokémon nacionales;
- cuadrícula de cinco columnas;
- historial local al final de la vista.

Cada casilla anuncia el nombre y el estado disponible mediante accesibilidad. El retrato intenta una cadena de fuentes alternativas cuando una imagen falla.

#### Fortalezas

- La intención está clara desde el primer vistazo: elegir un Pokémon en secreto.
- El buscador permite evitar una lista interminable en el catálogo nacional.
- La cuadrícula conserva el lenguaje visual del modo multijugador.
- El mensaje de privacidad es útil: evita que el jugador piense que la máquina recibe el Pokémon directamente.
- Las casillas tienen una altura mínima aproximada de 58 px y, por tanto, superan el área táctil mínima de 44 px en la mayoría de tamaños.

#### Riesgos UX/UI

1. En un móvil de 360 px, el nombre de la casilla usa un tamaño muy pequeño y queda limitado a una línea. El retrato se entiende, pero algunos nombres largos pueden ser ilegibles o indistinguibles.
2. El catálogo nacional se pinta dentro de un `ScrollView` como una lista completa. Es una experiencia lenta en dispositivos modestos y obliga a descargar o resolver demasiadas imágenes aunque el jugador solo vaya a tocar una.
3. El cambio de `USAR POKÉDEX NACIONAL` a `PREPARANDO 1.025 POKÉMON…` es correcto como texto, pero no transmite claramente si el botón está ocupado, cuánto falta o si la operación sigue viva.
4. El error del catálogo se muestra separado del botón que lo provoca. En una pantalla larga puede parecer un error de otra sección.
5. No hay un contador de resultados del buscador ni una acción visible para limpiar el texto. Esto aumenta la fricción cuando se prueba más de un nombre.
6. La elección empieza inmediatamente. Es rápido, pero falta un microfeedback que confirme `HAS ELEGIDO A ...` antes de presentar la primera pregunta.
7. La tarjeta de historial local aparece al pie. Es útil para el producto, pero no debe competir con la selección ni parecer un requisito para empezar.

#### Mejoras concretas

- Mantener las cinco columnas, pero colocar la cuadrícula dentro de un contenedor con ancho máximo y usar una lista virtualizada con `numColumns={5}`. En móvil se conserva la apariencia de tablero; técnicamente solo se montan las filas cercanas al viewport.
- Fijar un tamaño táctil mínimo de 48 px para la casilla completa. Si una tablet amplía el tablero, aumentar el retrato y el texto sin estirar indefinidamente el marco.
- Subir el nombre visible a un tamaño cómodo, idealmente entre 10 y 12 px físicos equivalentes, y permitir una segunda línea solo para nombres excepcionales. El `accessibilityLabel` debe seguir anunciando el nombre completo.
- Añadir bajo el buscador una línea como `25 resultados · toca uno para elegir` y un botón `LIMPIAR` con área táctil de al menos 44 px cuando haya texto.
- Convertir la carga nacional en un estado de tarjeta:

  ```text
  ┌────────────────────────────────┐
  │        [POKÉ BALL pixel]       │
  │  PREPARANDO EL CATÁLOGO...     │
  │  1.025 retratos · un momento   │
  └────────────────────────────────┘
  ```

  La Poké Ball debe tener dos o tres fotogramas pixelados o un desplazamiento corto y constante. Con movimiento reducido se deja un fotograma estático y se conserva el texto.
- Colocar el error justo debajo de esa tarjeta, con icono y texto accionable: `No se pudo preparar el catálogo. Reintentar`.
- Tras tocar una casilla, mantener una transición breve de 200–350 ms: borde amarillo, pequeño destello y anuncio accesible `Has elegido a X. Comienza la primera pregunta.`. No conviene introducir una pantalla intermedia.
- Ofrecer una opción local `OCULTAR MI ELECCIÓN` durante la partida. La tarjeta del secreto es útil y debe seguir visible por defecto, pero el modo de ocultación protege al jugador si comparte pantalla o dispositivo.
- Mantener el historial en un acordeón o bloque secundario: `HISTORIAL LOCAL · N sesiones`. Exportar y borrar deben conservar una confirmación accesible antes de borrar datos.

### 3.2 Pantalla de preguntas

#### Lo que existe

La vista contiene, en este orden:

1. salir;
2. título `PIENSO Y ADIVINO`;
3. subtítulo `RESPONDE SOLO SÍ O NO`;
4. tarjeta de progreso `PREGUNTA X / 30` y número de candidatos restantes;
5. tarjeta `TU POKÉMON SECRETO` con sprite, nombre y número de Pokédex;
6. tarjeta grande con la pregunta;
7. botones SÍ y NO;
8. ayuda de juego;
9. última respuesta;
10. abandonar y empezar otra.

Los botones de respuesta tienen una altura mínima de 62 px, el progreso y la pregunta usan regiones vivas y la tarjeta del secreto tiene una etiqueta accesible.

#### Hallazgo principal: no es solo un problema de orden

El motor actual ya calcula la ganancia de información sobre el conjunto de candidatos restantes, evita repetir el mismo rasgo y permite explorar preguntas casi igual de buenas mediante una semilla por partida. En una comprobación del motor con dos semillas fijas, tanto para Kanto como para el catálogo nacional, las aperturas fueron distintas:

- semilla `123`: `type.dual` → `¿Tiene dos tipos?`;
- semilla `456`: `appearance.biped` → `¿Camina normalmente sobre dos patas?`.

Esto significa que el flujo no está completamente fijado a una única pregunta. Sin embargo, `appearance.biped`, colores, flotación y varios rasgos visuales se calculan como aproximaciones derivadas de forma, tipo o nombre. Por ejemplo, asociar un tipo a “camina sobre dos patas” puede ser útil como pista, pero no siempre es una afirmación que el jugador pueda responder con seguridad mirando un retrato. Una respuesta razonable puede descartar al Pokémon correcto.

#### Recomendación de algoritmo presentada como experiencia

La interfaz no debe mostrar “ganancia de información”, puntuaciones ni detalles internos. Debe hacer que el jugador perciba tres comportamientos:

- la primera pregunta es amplia y fácil;
- después de cada respuesta, la siguiente pregunta cambia de verdad según lo contestado;
- cuando quedan pocos candidatos, la máquina pasa a preguntas muy concretas o formula una propuesta.

Para conseguirlo sin romper el requisito de solo SÍ/NO:

1. Mantener el cálculo de entropía/ganancia de información y la semilla por partida.
2. Separar las preguntas en niveles de confianza:
   - **alta:** tipo, forma registrada, evolución o atributo factual claro;
   - **media:** color dominante, alas, cola, patas o silueta visible;
   - **baja:** “¿te parece una buena mascota?”, “¿daría miedo de noche?” y otras interpretaciones subjetivas.
3. No usar preguntas de confianza baja para abrir la partida. Pueden servir como desempate cuando quedan suficientes candidatos y el texto deja claro que se trata de una impresión visual.
4. Registrar qué preguntas dividen bien sin producir contradicciones. Una pregunta que suele recibir respuestas diferentes entre usuarios debe bajar de prioridad o reescribirse.
5. Evitar el filtrado binario irreversible como única fuente de verdad. La mejora de mayor impacto sería mantener una puntuación de compatibilidad: una respuesta dudosa penaliza candidatos, pero no borra automáticamente al correcto. El motor podría seguir mostrando solo SÍ/NO y conservar el historial de la respuesta.
6. Proteger la diversidad de apertura con una regla UX, no con aleatoriedad total: elegir entre las mejores preguntas sencillas y no permitir que una misma pregunta ocupe la primera posición en casi todas las sesiones.
7. Cuando haya candidatos indistinguibles, comunicarlo como `EMPATE TÉCNICO` y ofrecer `SEGUIR CON PREGUNTAS` si queda presupuesto o `EMPEZAR OTRA` si no queda una separación fiable.

#### Mejoras de layout y feedback

- Convertir el progreso en una barra segmentada de 30 unidades o en tres bloques de diez. Debe acompañar al texto `7 / 30`, nunca sustituirlo.
- En las preguntas 25–29, mostrar un aviso breve y no alarmista: `Quedan 5 preguntas para que la máquina acierte`.
- En la pregunta 30, cambiar el texto secundario a `Última oportunidad de la máquina`.
- Mantener la tarjeta del secreto compacta. El nombre y el sprite ayudan a contestar; el número nacional es información secundaria y no debe parecer una pregunta del juego. Si se quiere una experiencia totalmente libre de referencias numéricas, el número puede quedar detrás de un modo de ocultación.
- Dejar la tarjeta de pregunta y los dos botones dentro del primer viewport de un móvil de 5 pulgadas. La ayuda y la última respuesta deben poder plegarse para no obligar a desplazar antes de responder.
- Tras cada respuesta, hacer una transición de estado breve: el botón pulsado baja como tecla física, aparece `REGISTRADO: SÍ` o `REGISTRADO: NO`, y se actualizan candidatos/progreso. La animación debe durar menos de 250 ms.
- Bloquear la doble respuesta durante la transición. Es importante tanto para la percepción de calidad como para evitar que dos pulsaciones rápidas creen dos eventos consecutivos antes de que el estado visual se actualice.
- Añadir foco visible para teclado, mando, switch control y tablet con teclado. El estado `pressed` no sustituye al foco persistente.
- Anunciar por lector de pantalla la respuesta registrada y el nuevo progreso, por ejemplo: `Respuesta sí registrada. Pregunta 8 de 30. Quedan 42 candidatos.`

### 3.3 Contador de 30 preguntas

#### Estado actual

El motor define `SINGLE_PLAYER_MAX_QUESTIONS = 30`, conserva `maxQuestions` en el estado y pasa a `limit-reached` cuando se agota el presupuesto sin identificar el Pokémon. La UI presenta `PREGUNTA X / 30` y el resultado de límite se interpreta como victoria del jugador.

La regla es comprensible, pero el contador debe ser más que un número decorativo: tiene que ayudar a tomar decisiones y cerrar la partida sin ambigüedad.

#### Recomendaciones

- Mostrar siempre ambas unidades: `PREGUNTA 12 / 30` y `18 RESTANTES` cuando el ancho lo permita.
- Usar una barra con texto alternativo accesible `40 por ciento del límite utilizado`.
- No saltar de `29 / 30` a un resultado sin una explicación. El resultado debe decir: `La máquina no lo ha descubierto en 30 preguntas. Ganas tú.`
- Diferenciar claramente estos estados:

  | Estado | Mensaje visual recomendado | Acción principal |
  |---|---|---|
  | Propuesta correcta | `LA MÁQUINA HA GANADO` | Ver el Pokémon y jugar de nuevo |
  | 30 preguntas agotadas | `¡HAS GANADO!` | Ver el Pokémon y jugar de nuevo |
  | Cero candidatos | `RESPUESTAS INCOMPATIBLES` | Revisar o empezar otra |
  | Perfiles indistinguibles | `EMPATE TÉCNICO` | Empezar otra o seguir si procede |

- El sonido y el color deben complementar el texto, no ser la única señal. La victoria necesita texto, icono/estrella y anuncio accesible; la derrota necesita texto e icono diferente.

### 3.4 Feedback de carga e imágenes

#### Estado actual

El catálogo Kanto está disponible de inmediato. El catálogo nacional se prepara bajo demanda y el botón cambia su etiqueta mientras carga. Los retratos prueban URLs alternativas si falla la fuente principal.

#### Mejoras recomendadas

- Usar un componente de carga estable que reserve el mismo espacio que tendrá la cuadrícula. Así se evita que el contenido salte cuando llegan los retratos.
- Mostrar una Poké Ball pixel-art en un contenedor pequeño, con un movimiento de balanceo/rotación muy corto y un brillo en el botón central. La pelota no debe recorrer toda la pantalla: el movimiento debe parecer una captura y no un spinner web.
- Añadir `accessibilityLiveRegion="polite"` al texto de carga y anunciar el final: `Catálogo nacional listo. 1.025 Pokémon disponibles.`
- En cada casilla remota, usar primero un fondo crema y una silueta pixelada de reserva. Si la imagen falla, conservar la casilla, mostrar el fallback y etiquetar el problema sin romper el tablero.
- No descargar las 1.025 imágenes al abrir el catálogo. Priorizar las filas visibles, precargar la siguiente pantalla y cancelar cargas fuera de ventana cuando sea posible.
- Si se juega sin red, mostrar `CATÁLOGO LOCAL` como estado positivo. La partida no debe depender de que una URL externa responda.
- Con movimiento reducido, congelar la Poké Ball, quitar destellos y usar únicamente cambios de opacidad o un estado estático.

## 4. Pantalla de resultado

### Lo que existe

`ResultView` muestra un bloque de resultado dentro de un `ScrollView`, con título, sprite, nombre, explicación, hasta tres curiosidades, indicación de que la sesión se guardó y botón `JUGAR OTRA VEZ`. El Pokémon elegido se conserva para el resultado de límite, y la selección del jugador es local.

### Riesgos

- Al estar dentro del flujo desplazable, el resultado puede sentirse como otro bloque de contenido y no como el cierre de una partida.
- `LA MÁQUINA HA GANADO`, `¡HAS GANADO!`, `RESPUESTAS INCOMPATIBLES` y `NO PUEDO DECIDIRLO` tienen distinta semántica, pero actualmente comparten una estructura muy parecida.
- Las curiosidades pueden tener longitudes distintas y empujar el botón fuera del viewport en móviles pequeños.
- Si el usuario llega con movimiento reducido o sonido desactivado, el cierre necesita una señal visual y accesible suficientemente fuerte.

### Propuesta de composición

Usar una pantalla de cierre con un panel modal o una tarjeta de resultado fijada visualmente sobre el fondo, siempre desplazable internamente si el texto es largo:

```text
┌────────────────────────────────┐
│        ★ ¡HAS GANADO! ★        │
│                                │
│        [sprite grande]          │
│             PARASECT            │
│  La máquina agotó sus 30        │
│  preguntas sin descubrirlo.     │
│                                │
│  DATO CURIOSO                  │
│  • ...                         │
│                                │
│       [ JUGAR DE NUEVO ]       │
│          [ VOLVER ]             │
└────────────────────────────────┘
```

Reglas de contenido:

- En victoria del jugador, revelar su propio Pokémon y sus curiosidades.
- En victoria de la máquina, explicar qué propuesta fue confirmada y mostrar el resultado desde la perspectiva del jugador.
- En modo solitario no existe un “rival” cuya información deba mostrarse: el único Pokémon secreto es el del jugador.
- El botón principal debe tener mínimo 48–54 px de alto y aparecer después de la curiosidad principal, no perdido tras texto secundario.
- Añadir un icono textual o una insignia (`30/30`, `ACERTÉ`, `SIN CANDIDATO`) para que el estado no dependa del color.
- Anunciar el cierre una sola vez: `Partida terminada. Has ganado` o `Partida terminada. La máquina ha ganado`.
- El audio de victoria o derrota debe ejecutarse una sola vez por transición terminal. Si existe una preferencia de sonido, debe poder silenciarse sin perder el texto ni la animación visual.

## 5. Accesibilidad móvil

### Puntos ya bien encaminados

- Las casillas y acciones principales usan roles de botón.
- Hay etiquetas específicas para buscar y para el secreto.
- El progreso y la pregunta están pensados como regiones vivas.
- SÍ y NO están escritos en texto, no solo codificados por verde y rojo.
- El diseño usa contraste fuerte entre paneles oscuros, amarillo y blanco.

### Gaps a cerrar

| Área | Riesgo | Mejora concreta |
|---|---|---|
| Tipografía de casillas | Los nombres de 6 px no son cómodos en un móvil real. | Subir tamaño visible, permitir dos líneas controladas y mantener nombre completo para lector de pantalla. |
| Movimiento reducido | `SinglePlayerScreen` recibe `reduceMotion`, pero actualmente lo renombra y no lo propaga a sus componentes visuales. | Hacer que todas las transiciones, presses y Poké Ball consulten la preferencia. |
| Foco | El estado pulsado no es un foco usable para teclado o switch. | Añadir un estilo de foco persistente de alto contraste. |
| Mensajes dinámicos | Se anuncia pregunta/progreso, pero no necesariamente la respuesta y el resultado completo. | Anunciar respuesta, preguntas restantes y cierre. |
| Imágenes | El fallback resuelve errores, pero una imagen sin cargar puede quedar sin contexto visual. | Placeholder estable, etiqueta del Pokémon y estado de fallback no destructivo. |
| Escalado | Un texto grande puede romper la fila del progreso o el nombre de la casilla. | Probar escalado del sistema al 200% y permitir que las filas crezcan. |
| Búsqueda | Falta una acción evidente para limpiar y feedback de resultados. | Botón limpiar, contador y mensaje accesible de cero resultados. |
| Sonido | Un efecto no puede ser la única confirmación de una respuesta. | Mantener cambio visual, texto y anuncio aunque el sonido esté silenciado. |
| Color | Verde/rojo/amarillo pueden confundirse. | Usar texto, iconos, borde y patrones; no retirar la X o el texto de estado. |

### Tamaños mínimos de referencia

- controles táctiles: **44 px mínimo**, preferible **48 px**;
- separación entre controles: **8 px** como base, mayor cuando la acción sea destructiva o final;
- respuesta SÍ/NO: mantener el mínimo actual de 62 px;
- botón de volver, limpiar y buscar: 44–48 px de alto;
- texto de lectura: no bajar de aproximadamente 14–16 px equivalentes salvo etiquetas puramente decorativas;
- títulos pixel: pueden ser menores si no contienen instrucciones críticas y tienen una alternativa textual clara.

## 6. Checklist responsive

La validación debe hacerse como mínimo en estas cajas:

| Viewport | Qué revisar |
|---|---|
| 360 × 800 | Pregunta completa y botones en el primer viewport; progreso sin solapamiento; nombres legibles. |
| 390 × 844 | Selección y resultado con respiración; secreto compacto; curiosidades sin cortar. |
| 430 × 932 | Aprovechamiento del ancho sin casillas gigantes; no aumentar el texto pixel hasta perder jerarquía. |
| 768 × 1024 | Cuadrícula centrada, ancho máximo, foco visible y lectura cómoda a distancia. |
| Tablet horizontal | Evitar que el panel se estire a toda la pantalla; limitar línea de lectura y mantener el tablero visualmente dominante. |

En todas las cajas:

- no debe existir scroll horizontal;
- la cuadrícula debe conservar cinco columnas;
- ninguna etiqueta crítica debe quedar fuera de pantalla sin poder desplazarse;
- el botón de resultado debe ser alcanzable con una mano o lector de pantalla;
- la imagen debe mantener proporción y no deformarse;
- el teclado virtual no debe tapar la pregunta ni el botón de búsqueda.

## 7. Pruebas de usabilidad recomendadas

### Prueba rápida con jugadores

1. Elegir tres Pokémon visualmente parecidos y tres muy distintos.
2. Jugar tres sesiones con cada grupo y anotar la primera pregunta.
3. Pedir al jugador que diga en voz alta por qué responde SÍ o NO.
4. Registrar preguntas que provoquen dudas, especialmente “bípeda”, “flota”, “animal” y colores.
5. Medir cuántas sesiones llegan a `no-match`, `tie`, `won` y `limit-reached`.
6. Preguntar al final: `¿Sentiste que la siguiente pregunta dependía de tu respuesta anterior?`.

### Criterios de aceptación del algoritmo desde UX

- Dos sesiones con distinta semilla no deben presentar sistemáticamente la misma apertura cuando hay varias preguntas de calidad equivalente.
- Una pregunta no debe repetirse ni reformular el mismo rasgo en una sesión.
- El jugador debe poder entender cada pregunta a partir del retrato o de conocimiento Pokémon muy básico.
- Una respuesta dudosa no debería convertir inmediatamente una partida razonable en `RESPUESTAS INCOMPATIBLES`.
- Ninguna pregunta debe pedir número de Pokédex, peso, región o dato equivalente si esas familias están fuera de producto.
- Antes de la pregunta 30, el jugador debe saber cuántas oportunidades le quedan.
- Después de la pregunta 30, el resultado debe declarar explícitamente quién ha ganado y por qué.

## 8. Backlog UX/UI propuesto

### P0 · Antes de seguir ampliando el banco

- Auditar los rasgos derivados y etiquetar el nivel de confianza de cada pregunta.
- Medir aperturas reales y ajustar la exploración para que “dos patas” no domine la percepción.
- Añadir protección contra doble pulsación de SÍ/NO.
- Redactar estados terminales diferenciados y anunciar el resultado.
- Asegurar que `reduceMotion` llegue a todas las animaciones del modo solitario.

### P1 · Claridad de la partida

- Barra de progreso segmentada de 30.
- Avisos de preguntas 25–30.
- Tarjeta de carga con Poké Ball pixel-art, estado `busy` y reintento.
- Resultado modal/tarjeta de cierre con sprite, curiosidad y `JUGAR DE NUEVO`.
- Placeholder visual y semántico para retratos remotos.

### P2 · Rendimiento y accesibilidad

- Virtualizar el catálogo nacional manteniendo cinco columnas.
- Contador y limpieza del buscador.
- Foco visible y pruebas con escalado de texto.
- Opción local de ocultar la elección.
- Confirmación accesible para borrar historial.

### P3 · Dirección artística

- Marcos de pregunta con pequeñas variantes por fase: exploración, acotación y propuesta.
- Sonido corto de respuesta registrada, con volumen moderado y preferencia de mute.
- Poké Ball de carga con animación de captura limitada a un área pequeña.
- Destello de victoria y partículas pixeladas solo en el cierre, nunca durante la lectura de la pregunta.

## 9. Definición de “listo” para esta experiencia

El modo solitario puede considerarse UX-ready cuando:

- la primera pregunta no se percibe como un guion fijo en una muestra de partidas;
- las preguntas se entienden sin conocimientos numéricos ni datos técnicos del Pokémon;
- el jugador siempre sabe su Pokémon secreto, la pregunta actual y el presupuesto restante;
- la carga nacional tiene feedback visible, accesible y compatible con movimiento reducido;
- la cuadrícula funciona con cinco columnas desde 360 px hasta tablet sin nombres microscópicos;
- una imagen fallida conserva la casilla y no rompe la partida;
- la victoria por límite de 30 se diferencia claramente de derrota, empate y contradicción;
- el resultado revela el sprite y las curiosidades correctas, ofrece `JUGAR DE NUEVO` y anuncia el estado sin depender del sonido;
- se han probado lector de pantalla, escalado de texto, foco de teclado/switch control, modo sin sonido y `prefers-reduced-motion`.

La dirección recomendada es iterativa: primero fiabilidad de las preguntas y feedback de estado, después rendimiento del catálogo y accesibilidad, y por último las capas artísticas. Así el pixel-art refuerza el juego en vez de ocultar sus reglas.
