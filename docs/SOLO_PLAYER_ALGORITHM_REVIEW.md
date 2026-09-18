# 🧠 Revisión del modo solitario

## Objetivo

El modo **Pienso y adivino** debe jugar como una versión ligera de Akinator:
el jugador piensa en un Pokémon, solo responde **SÍ** o **NO**, y la máquina
elige la siguiente pregunta según la información que queda disponible. No se
usan número de Pokédex, peso, región ni generación como atajos.

## Alineación con la documentación técnica de Akinator

La documentación facilitada (`Akinator_funcionamiento_algoritmo_implementacion_tecnica.docx`)
confirma una limitación importante: el algoritmo comercial de Akinator/Limule no
es público. PokéQuién implementa por tanto un motor equivalente, auditable y
adaptado a respuestas binarias, no una copia del código propietario.

La adaptación sigue este flujo:

```text
catálogo Pokémon + rasgos booleanos
          ↓
posterior de candidatos plausibles
          ↓
pregunta con mayor ganancia de información esperada
          ↓
actualización Bayesiana tolerante a un SÍ/NO equivocado
          ↓
propuesta cuando la confianza y la separación son suficientes
```

El documento propone cinco respuestas (`SÍ`, `PROBABLEMENTE SÍ`, `NO SÉ`,
`PROBABLEMENTE NO`, `NO`). El producto actual mantiene deliberadamente solo
`SÍ` y `NO`, porque esa es la experiencia solicitada; la tolerancia se modela
internamente con probabilidades y nunca se muestra como una respuesta adicional.

## Cambios aplicados

- 🎯 **Selección por ganancia de información**: cada pregunta se valora por
  cómo divide el conjunto de candidatos que todavía son plausibles.
- 🧮 **Entropía posterior real**: la puntuación ya no es únicamente el tamaño
  del corte SÍ/NO. El motor calcula la entropía antes y después de cada respuesta
  hipotética usando las probabilidades de coincidencia (`0,9`) y discrepancia
  (`0,1`). Así una pregunta visual dudosa no parece perfecta solo porque divide
  el catálogo en dos mitades.
- 🎲 **Aperturas variables**: la partida usa una semilla para escoger entre
  preguntas casi igual de buenas; la misma semilla es reproducible para poder
  depurar una partida.
- 🔁 **Sin preguntas repetidas**: ya no basta con tener otro identificador o
  una redacción distinta. Si dos preguntas producen la misma separación SÍ/NO
  sobre los candidatos actuales, la segunda se descarta.
- 🛟 **Tolerancia a un error**: el modelo de creencia no elimina para siempre
  un candidato por una respuesta aislada; una respuesta posterior puede
  recuperar la hipótesis correcta.
- 🧩 **Rasgos visuales menos engañosos**: los colores se basan en el color
  dominante del catálogo y las preguntas de patas, manos y alas ya no se
  inventan simplemente por el tipo Lucha, Tierra o un tipo elemental.
- ✍️ **Datos manuales prioritarios**: una corrección explícita de Kanto no es
  sobrescrita por una inferencia automática.
- ⏱️ **Límite de 30 preguntas**: si la máquina no puede distinguir el Pokémon
  con los datos disponibles, gana el jugador al terminar el presupuesto.

La ganancia usada por el selector es, en forma resumida:

```text
IG(q) = H(posterior actual)
       - Σ respuesta P(respuesta | q) · H(posterior tras esa respuesta)
```

La función se recalcula en cada turno con los candidatos activos; no existe una
secuencia fija de preguntas y el Pokémon elegido nunca entra como entrada del
motor. Solo se usa después, en el dispositivo, para registrar el resultado y
mostrar la pantalla final al jugador.

## Banco actual

| Catálogo | Preguntas | Contenido |
|---|---:|---|
| Kanto | 126 | Tipos, evolución, líneas, rasgos visuales, silueta y hábitat |
| Nacional | 86 | Tipos, evolución y rasgos visuales comunes para los 1.025 candidatos |

El verificador automático confirma que no aparecen preguntas que contengan
Pokédex, número, peso, región o generación. También comprueba que las semillas
pueden variar la primera pregunta y que dos redacciones con la misma partición
no se presentan consecutivamente.

## Validación realizada

- ✅ `npm run typecheck`
- ✅ `npm run single-player:verify`
- ✅ 2.000 partidas simuladas de Kanto sin contradicciones del motor.
- ✅ 1.000 partidas simuladas del catálogo nacional sin contradicciones del
  motor.

Las partidas que terminan en empate no representan un fallo de la interfaz:
significan que dos Pokémon comparten exactamente los rasgos conocidos. En ese
caso se conserva la regla de juego: la máquina no hace trampas ni usa el nombre
secreto y, si se agotan las 30 preguntas, gana el jugador.

## Cómo ampliar el conocimiento correctamente

Cuando se añada una nueva pregunta:

1. Añade un rasgo booleano descriptivo, no una pista numérica.
2. Escribe una pregunta que el jugador pueda contestar mirando el retrato o
   con un conocimiento Pokémon básico.
3. Añade el rasgo a todos los candidatos; un dato ausente no debe convertirse
   accidentalmente en un “SÍ”.
4. Si existe una excepción conocida, añádela como dato manual antes de aplicar
   inferencias derivadas.
5. Ejecuta `npm run single-player:verify` y las simulaciones antes de publicar.

Ejemplos válidos: color predominante, alas, cola, forma de animal, tipo,
si flota, si tiene brazos, si es una forma básica o si pertenece a una línea
evolutiva. Ejemplos que permanecen excluidos: número nacional, peso, región y
generación.
