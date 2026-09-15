# Contrato de sala, reconexión y rematch

## Ciclo de vida

```text
waiting-for-player
        ↓ entra J2
selecting
        ↓ elige uno / ambos
waiting-for-selection → playing
        ↓ queda solo el secreto rival
finished
        ↓ JUGAR DE NUEVO
selecting
```

Un cierre inesperado desde `selecting`, `waiting-for-selection` o `playing` no destruye la sala inmediatamente.

## Ventana de reconexión

- El servidor conserva el rol, secreto y tachados.
- Genera un token de sesión distinto del código visible.
- Marca `presence[player] = false`.
- Publica `disconnectedPlayer` y `reconnectDeadline`.
- Espera 60 segundos.
- Si el mismo token vuelve, reasigna el socket al mismo jugador y conserva el estado.
- Si no vuelve, cambia la sala a `abandoned`, avisa al jugador conectado y la aplicación vuelve al menú.

El código de sala no sirve como token de reconexión.

## Privacidad

`publicState` solo incluye `secretId` propio antes de terminar. El estado final mantiene la resolución de la partida, pero la interfaz muestra las curiosidades únicamente del Pokémon que eligió el jugador local. El servidor valida que cada selección pertenece al tablero, que hay 25 IDs distintos y que nunca se tachan las 25 casillas.

## Victoria

Para cada jugador se calcula:

```text
restantes = tablero - tachados
victoria si restantes.length === 1
           y restantes[0] === secreto del rival
```

La condición se evalúa en servidor después de cada `toggle`, por lo que el cliente no puede proclamarse ganador manipulando la interfaz.

## Rematch

`rematch` solo se acepta en `finished` o `selecting`. Limpia ambos secretos, tachados, ganador y estados de desconexión, y mantiene el mismo código y tablero para que ambos jugadores vuelvan a elegir.
