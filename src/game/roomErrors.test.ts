import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  RoomServerError,
  describeServerProblem,
  interpretHealth,
  isRoomServerError,
  normalizeRoomCodeInput,
  roomCodeFromUrl,
  validateRoomCode,
} from './roomErrors';

test('normalizeRoomCodeInput pasa a mayúsculas, quita lo no válido y corta a 8', () => {
  assert.equal(normalizeRoomCodeInput('k7xq-2mpa'), 'K7XQ2MPA');
  assert.equal(normalizeRoomCodeInput(' ab 01 cd '), 'ABCD');
  assert.equal(normalizeRoomCodeInput('abcdefghijk'), 'ABCDEFGH');
  assert.equal(normalizeRoomCodeInput(''), '');
});

test('validateRoomCode acepta 8 caracteres válidos', () => {
  assert.equal(validateRoomCode('K7XQ2MPA'), null);
  assert.equal(validateRoomCode('k7xq2mpa'), null);
});

test('validateRoomCode explica el código vacío, corto o con caracteres raros', () => {
  assert.match(validateRoomCode('') ?? '', /código de 8 caracteres/);
  assert.match(validateRoomCode('ABC') ?? '', /has escrito 3/);
  assert.match(validateRoomCode('ABCD1234') ?? '', /del 2 al 9/);
});

test('roomCodeFromUrl lee ?room= y &room= de un enlace de Pages', () => {
  assert.equal(roomCodeFromUrl('https://bertmarti.github.io/Adivina-pkm/?room=K7XQ2MPA'), 'K7XQ2MPA');
  assert.equal(roomCodeFromUrl('https://bertmarti.github.io/Adivina-pkm/?a=1&room=k7xq2mpa#x'), 'K7XQ2MPA');
  assert.equal(roomCodeFromUrl('pokequien://join?room=K7XQ2MPA'), 'K7XQ2MPA');
});

test('roomCodeFromUrl ignora enlaces sin código o con código no válido', () => {
  assert.equal(roomCodeFromUrl(null), '');
  assert.equal(roomCodeFromUrl('https://bertmarti.github.io/Adivina-pkm/'), '');
  assert.equal(roomCodeFromUrl('https://bertmarti.github.io/Adivina-pkm/?room=ABC'), '');
  assert.equal(roomCodeFromUrl('https://bertmarti.github.io/Adivina-pkm/?room=%E0%A4%A'), '');
});

test('describeServerProblem ofrece el Solitario y explica el origen rechazado', () => {
  assert.match(describeServerProblem('unreachable'), /Solitario/);
  assert.match(describeServerProblem('unreachable'), /REINTENTAR/);
  const origin = describeServerProblem('origin-rejected', 'https://bertmarti.github.io');
  assert.match(origin, /\(https:\/\/bertmarti\.github\.io\)/);
  assert.match(origin, /ROOM_SERVER_ALLOWED_ORIGINS/);
  assert.doesNotMatch(describeServerProblem('origin-rejected'), /\(/);
});

test('RoomServerError conserva el tipo y se reconoce', () => {
  const error = new RoomServerError('origin-rejected', 'https://example.org');
  assert.equal(error.kind, 'origin-rejected');
  assert.equal(error.name, 'RoomServerError');
  assert.ok(isRoomServerError(error));
  assert.ok(!isRoomServerError(new Error('otro')));
});

test('interpretHealth sigue el contrato de GET /', () => {
  assert.equal(interpretHealth({ ok: true, originAllowed: true }), 'ok');
  assert.equal(interpretHealth({ ok: true, originAllowed: null }), 'ok');
  assert.equal(interpretHealth({ ok: true }), 'ok');
  assert.equal(interpretHealth({ ok: true, originAllowed: false }), 'origin-rejected');
  assert.equal(interpretHealth(null), 'unknown');
  assert.equal(interpretHealth([]), 'unknown');
  assert.equal(interpretHealth({ ok: false }), 'unknown');
});
