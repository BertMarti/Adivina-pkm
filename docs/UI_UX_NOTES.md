# Notas de UI/UX

## Dirección visual

La referencia es una interfaz de videojuego portátil de estética pixel/arcade:

- fondo PMD oscurecido y con scanlines CRT;
- tipografía pixel para titulares y etiquetas de sistema;
- tarjetas azul-negro translúcidas con bordes metálicos;
- amarillo eléctrico para selección y foco;
- verde para estados conectados/listos;
- rojo coral para tachados y estados de derrota;
- naranja para acciones destacadas y final de partida.

La interfaz debe sentirse jugable a 360 px de ancho y no depender de una captura con tamaño fijo.

## Composición responsive

```text
┌──────────────────────────────┐
│ título / estado / sala       │  ancho flexible
├──────────────────────────────┤
│  [01] [02] [03] [04] [05]    │
│  [06] [07] [08] [09] [10]    │  5 × 5 siempre
│  [11] [12] [13] [14] [15]    │
│  [16] [17] [18] [19] [20]    │
│  [21] [22] [23] [24] [25]    │
├──────────────────────────────┤
│             VS               │
└──────────────────────────────┘
```

Las casillas usan porcentajes del ancho disponible. El sprite se contiene dentro de la casilla, el nombre se limita a una línea y el número Dex funciona como apoyo visual y textual.

## Estados de una casilla

| Estado | Visual | Acción |
|---|---|---|
| Disponible | Retrato normal, borde neutro | Seleccionar o tachar si es el tablero propio. |
| Secreto elegido | Borde amarillo y leve escala | No se vuelve a elegir. |
| Tachado | Retrato triste, oscurecido y X roja animada | Volver a pulsar destacha. |
| Rival | Igual aspecto, pero control deshabilitado | Solo consulta. |

La X ocupa todo el recuadro, tiene dos diagonales rojas gruesas y una entrada breve con escala/opacidad. El tachado nunca debe ocultar por completo el significado de “qué había en la casilla”.

## Espera y victoria

- Si solo un jugador ha elegido: mostrar su secreto, texto de espera y una Poké Ball que se desplaza y rota suavemente.
- Si ambos han elegido: iniciar automáticamente.
- Al ganar: abrir un modal real sobre la partida, no un bloque perdido al final del scroll.
- El modal revela el Pokémon propio, sus curiosidades privadas y ofrece `JUGAR DE NUEVO`; no muestra las curiosidades del rival.

## Modo solitario

- Después de elegir, la vista de preguntas mantiene visible una tarjeta `TU POKÉMON SECRETO` con sprite, nombre y número de Pokédex.
- Esta tarjeta sirve como recordatorio para responder sin volver atrás; la máquina solo recibe el SÍ/NO pulsado y no el identificador elegido.

## Accesibilidad

- Cada casilla anuncia nombre y estado: disponible, seleccionado o tachado.
- `prefers-reduced-motion` elimina los bucles y deja los estados estáticos.
- El color no es la única señal: se combinan texto, X, número Dex y etiquetas.
- Botones con área táctil generosa, contraste alto y foco visible.
- Los mensajes de reconexión usan `accessibilityLiveRegion="polite"`.
