import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ConnectionAttempts, isRoomCodeTaken, ownReconnectDeadline } from './roomSession';

test('ownReconnectDeadline solo guarda el plazo si el desconectado es este jugador', () => {
  const deadline = Date.now() + 60_000;
  assert.equal(ownReconnectDeadline({ disconnectedPlayer: 'p1', reconnectDeadline: deadline }, 'p1'), deadline);
  // El plazo del rival no es el nuestro: si se guardara, un corte propio posterior acabaría la partida al instante.
  assert.equal(ownReconnectDeadline({ disconnectedPlayer: 'p2', reconnectDeadline: deadline }, 'p1'), 0);
  assert.equal(ownReconnectDeadline({ disconnectedPlayer: null, reconnectDeadline: null }, 'p1'), 0);
  assert.equal(ownReconnectDeadline({ disconnectedPlayer: 'p1', reconnectDeadline: null }, 'p1'), 0);
});

test('isRoomCodeTaken reconoce el error de código ocupado del servidor', () => {
  assert.equal(isRoomCodeTaken(new Error('Ese código de sala ya está ocupado.')), true);
  assert.equal(isRoomCodeTaken(new Error('No hay ninguna sala con ese código.')), false);
  assert.equal(isRoomCodeTaken('ya está ocupado'), false);
});

test('ConnectionAttempts: cancelar o empezar otro intento invalida el anterior', () => {
  const attempts = new ConnectionAttempts();
  const first = attempts.start();
  assert.equal(attempts.isCurrent(first), true);
  attempts.cancel();
  assert.equal(attempts.isCurrent(first), false, 'una respuesta tardía tras CANCELAR se descarta');
  const second = attempts.start();
  const third = attempts.start();
  assert.equal(attempts.isCurrent(second), false);
  assert.equal(attempts.isCurrent(third), true);
});
