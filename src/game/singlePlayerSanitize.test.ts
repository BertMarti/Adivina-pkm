import assert from 'node:assert/strict';
import { test } from 'node:test';

import { computeSoloStats } from './singlePlayerStats';
import { sanitizeSession } from './singlePlayerSanitize';

function raw(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'solo-1',
    schemaVersion: 2,
    knowledgeVersion: 'kanto-151-v4',
    catalogId: 'kanto',
    startedAt: '2026-10-31T10:00:00.000Z',
    finishedAt: '2026-10-31T10:05:00.000Z',
    result: 'won',
    maxQuestions: 30,
    questionSelectionSeed: 7,
    selectedPokemonId: 25,
    guessedPokemonId: 25,
    rejectedGuessIds: [],
    questionsAsked: 2,
    events: [],
    ...overrides,
  };
}

const event = (index: number, overrides: Record<string, unknown> = {}) => ({
  eventId: `solo-1-q${index}`,
  questionId: 'water',
  question: '¿Es de tipo Agua?',
  answer: 'no',
  candidatesBefore: 151,
  candidatesAfter: 120,
  remainingCandidateIds: [1, 2, 3],
  recordedAt: '2026-10-31T10:01:00.000Z',
  ...overrides,
});

test('una sesión válida se conserva tal cual', () => {
  const session = sanitizeSession(raw({ events: [event(1), event(2)] }));
  assert.ok(session);
  assert.equal(session.questionsAsked, 2);
  assert.equal(session.selectedPokemonId, 25);
  assert.equal(session.events.length, 2);
});

test('questionsAsked se acota a un entero en [0, maxQuestions]', () => {
  assert.equal(sanitizeSession(raw({ questionsAsked: 1e308 }))?.questionsAsked, 30);
  assert.equal(sanitizeSession(raw({ questionsAsked: -7 }))?.questionsAsked, 0);
  assert.equal(sanitizeSession(raw({ questionsAsked: 4.9 }))?.questionsAsked, 4);
  assert.equal(sanitizeSession(raw({ questionsAsked: Number.NaN, events: [event(1)] }))?.questionsAsked, 1);
  assert.equal(sanitizeSession(raw({ maxQuestions: 1e9 }))?.maxQuestions, 200);
  // Con valores manipulados la media ya no puede salir «1e+307».
  const stats = computeSoloStats([sanitizeSession(raw({ questionsAsked: 1e308 }))!], () => 'Pikachu');
  assert.equal(stats.averageQuestions, 30);
});

test('los ids de Pokémon deben ser enteros entre 1 y 1025', () => {
  for (const bad of [-1, 0, 2.5, 1e9, 1026, '25']) {
    const session = sanitizeSession(raw({ selectedPokemonId: bad, guessedPokemonId: bad, rejectedGuessIds: [bad, 4] }));
    assert.equal(session?.selectedPokemonId, undefined);
    assert.equal(session?.guessedPokemonId, undefined);
    assert.deepEqual(session?.rejectedGuessIds, [4]);
  }
  assert.equal(sanitizeSession(raw({ selectedPokemonId: 1025 }))?.selectedPokemonId, 1025);
});

test('listas recortadas a maxQuestions y cadenas largas descartadas', () => {
  const many = Array.from({ length: 500 }, (_, index) => event(index));
  const session = sanitizeSession(raw({ maxQuestions: 30, events: many, rejectedGuessIds: Array.from({ length: 100 }, () => 7) }));
  assert.equal(session?.events.length, 30);
  assert.equal(session?.rejectedGuessIds.length, 30);
  const long = 'x'.repeat(65);
  assert.equal(sanitizeSession(raw({ sessionId: long })), null);
  assert.equal(sanitizeSession(raw({ startedAt: long })), null);
  assert.equal(sanitizeSession(raw({ catalogId: long }))?.catalogId, 'kanto');
  assert.deepEqual(sanitizeSession(raw({ events: [event(1, { question: 'x'.repeat(301) }), event(2, { remainingCandidateIds: [1, -3, 2000, 9] })] }))?.events.map((item) => item.remainingCandidateIds), [[1, 9]]);
});

test('sin id, inicio o resultado válidos la sesión se descarta', () => {
  assert.equal(sanitizeSession(null), null);
  assert.equal(sanitizeSession([]), null);
  assert.equal(sanitizeSession(raw({ sessionId: '' })), null);
  assert.equal(sanitizeSession(raw({ result: 'hackeado' })), null);
});
