import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildSoloStatsExport,
  computeSoloStats,
  outcomeOf,
  soloSessionsToCsv,
  statsFileName,
} from './singlePlayerStats';
import type { SinglePlayerSessionRecord } from './singlePlayerStorage';

function make(overrides: Partial<SinglePlayerSessionRecord> = {}): SinglePlayerSessionRecord {
  return {
    sessionId: 'session-1', schemaVersion: 2, knowledgeVersion: 'kanto-151-v4', catalogId: 'kanto',
    startedAt: '2026-10-31T10:00:00.000Z', finishedAt: '2026-10-31T10:05:00.000Z', result: 'won',
    maxQuestions: 30, questionSelectionSeed: 1, selectedPokemonId: 25, guessedPokemonId: 25,
    rejectedGuessIds: [], questionsAsked: 5, events: [], ...overrides,
  };
}

test('historial vacío devuelve estadísticas vacías', () => {
  const stats = computeSoloStats([], () => undefined);
  assert.equal(stats.played, 0);
  assert.equal(stats.averageQuestions, null);
  assert.equal(stats.averageQuestionsToGuess, null);
  assert.deepEqual(stats.hardest, []);
});

test('outcomeOf traduce los ocho resultados almacenados', () => {
  assert.deepEqual([
    outcomeOf('won'), outcomeOf('player-won'), outcomeOf('limit-reached'), outcomeOf('rejected'),
    outcomeOf('ambiguous'), outcomeOf('inconsistent'), outcomeOf('abandoned'), outcomeOf('in-progress'),
  ], ['machine', 'player', 'player', 'unresolved', 'unresolved', 'unresolved', 'abandoned', 'in-progress']);
});

test('cuenta resultados y redondea medias', () => {
  const sessions = [
    make({ sessionId: 'a', questionsAsked: 1 }), make({ sessionId: 'b', result: 'player-won', questionsAsked: 2 }),
    make({ sessionId: 'c', result: 'ambiguous', questionsAsked: 4 }), make({ sessionId: 'd', result: 'abandoned', questionsAsked: 99 }),
    make({ sessionId: 'e', result: 'in-progress', questionsAsked: -2 }),
  ];
  const stats = computeSoloStats(sessions, () => undefined);
  assert.deepEqual([stats.played, stats.machineWins, stats.playerWins, stats.unresolved, stats.abandoned, stats.inProgress], [3, 1, 1, 1, 1, 1]);
  assert.equal(stats.averageQuestions, 2.3);
  assert.equal(stats.averageQuestionsToGuess, 1);
});

test('usa la última aparición de una sesión repetida', () => {
  const stats = computeSoloStats([make({ result: 'won' }), make({ result: 'abandoned', questionsAsked: 20 })], () => undefined);
  assert.equal(stats.abandoned, 1);
  assert.equal(stats.played, 0);
});

test('ordena hardest con desempates y nombre de reserva', () => {
  const sessions = [
    make({ sessionId: '1', selectedPokemonId: 25, result: 'player-won', questionsAsked: 5 }),
    make({ sessionId: '2', selectedPokemonId: 25, result: 'won', questionsAsked: 9 }),
    make({ sessionId: '3', selectedPokemonId: 4, result: 'player-won', questionsAsked: 8 }),
    make({ sessionId: '4', selectedPokemonId: 4, result: 'won', questionsAsked: 8 }),
    make({ sessionId: '5', selectedPokemonId: 7, result: 'won', questionsAsked: 8 }),
  ];
  const hardest = computeSoloStats(sessions, (id) => id === 25 ? 'Pikachu' : undefined).hardest;
  assert.deepEqual(hardest.map((item) => [item.pokemonId, item.name, item.machineMisses, item.averageQuestions]), [[4, '#004', 1, 8], [25, 'Pikachu', 1, 7], [7, '#007', 0, 8]]);
});

test('aplica limit al listado hardest', () => {
  assert.equal(computeSoloStats([make({ selectedPokemonId: 1 }), make({ sessionId: '2', selectedPokemonId: 2 })], () => undefined, 1).hardest.length, 1);
  assert.deepEqual(computeSoloStats([make()], () => undefined, 0).hardest, []);
});

test('genera CSV con orden, BOM, CRLF y escape de celdas', () => {
  const csv = soloSessionsToCsv([
    make({ sessionId: 'late', startedAt: '2026-10-31T12:00:00Z', catalogId: 'uno;dos', result: 'player-won' }),
    make({ sessionId: 'early', startedAt: '2026-10-31T09:00:00Z', catalogId: '=cmd', selectedPokemonId: 4 }),
    make({ sessionId: 'dash', startedAt: '2026-10-31T13:00:00Z', catalogId: '-1', selectedPokemonId: undefined }),
  ], () => 'Nombre "raro"');
  assert.ok(csv.startsWith('\uFEFFinicio;fin;catalogo;'));
  assert.ok(csv.endsWith('\r\n'));
  assert.ok(csv.indexOf('2026-10-31T09:00:00Z') < csv.indexOf('2026-10-31T12:00:00Z'));
  assert.match(csv, /'=cmd/);
  assert.match(csv, /'-1/);
  assert.match(csv, /"uno;dos"/);
  assert.match(csv, /"Nombre ""raro"""/);
});

test('genera exportación JSON con formato, fecha y partidas', () => {
  const exported = buildSoloStatsExport([make()], () => 'Pikachu', new Date('2026-10-31T00:00:00.000Z'));
  assert.equal(exported.format, 'adivina-pkm-single-player-stats');
  assert.equal(exported.formatVersion, 1);
  assert.equal(exported.exportedAt, '2026-10-31T00:00:00.000Z');
  assert.equal(exported.games[0].pokemon, 'Pikachu');
  assert.equal(exported.games[0].outcome, 'machine');
});

test('construye el nombre de archivo con fecha local', () => {
  assert.equal(statsFileName('csv', new Date(2026, 9, 31)), 'pokequien-estadisticas-2026-10-31.csv');
});
