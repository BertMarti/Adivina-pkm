import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  appendDuelRecord,
  buildDuelStatsExport,
  computeDuelStats,
  duelMatchKey,
  duelRecordFromState,
  duelRecordProblem,
  duelRecordsToCsv,
  generationLabel,
  MAX_DUEL_RECORDS,
  sanitizeDuelRecord,
} from './duelStats';
import type { DuelRecord, DuelStateLike } from './duelStats';

const state: DuelStateLike = {
  roomCode: 'ABCD2345',
  generation: 1,
  board: [{ id: 1 }, { id: 4 }, { id: 25 }],
  players: { p1: { secretId: 25, crossedIds: [4, 4, 1] }, p2: { secretId: 4, crossedIds: [1] } },
  winner: 'p1',
};

function record(id: string, outcome: DuelRecord['outcome'], finishedAt: string, overrides: Partial<DuelRecord> = {}): DuelRecord {
  return {
    id, matchKey: `m-${id}`, finishedAt, generation: 1, boardSize: 24, outcome,
    mySecretId: 25, rivalSecretId: 4, crossedCount: 3, ...overrides,
  };
}

test('sin duelos, estadísticas vacías', () => {
  const stats = computeDuelStats([]);
  assert.deepEqual([stats.played, stats.wins, stats.losses, stats.winRate, stats.bestWinStreak], [0, 0, 0, null, 0]);
  assert.deepEqual(stats.byGeneration, []);
});

test('el registro de una victoria revela el Pokémon rival y cuenta descartes sin repetir', () => {
  const item = duelRecordFromState(state, 'p1', 'win', new Date('2026-11-02T10:00:00.000Z'), () => 0.5);
  assert.equal(item.finishedAt, '2026-11-02T10:00:00.000Z');
  assert.equal(item.mySecretId, 25);
  assert.equal(item.rivalSecretId, 4);
  assert.equal(item.crossedCount, 2);
  assert.equal(item.boardSize, 3);
  assert.equal(item.generation, 1);
  assert.match(item.id, /^duel-/);
  assert.equal(sanitizeDuelRecord(item)?.id, item.id);
});

test('al ganar, el Pokémon del rival es la única carta sin tachar (el servidor no lo envía)', () => {
  const fromServer: DuelStateLike = {
    ...state,
    players: { p1: { secretId: 25, crossedIds: [1, 25] }, p2: { secretId: null, crossedIds: [] } },
  };
  assert.equal(duelRecordFromState(fromServer, 'p1', 'win').rivalSecretId, 4);
  assert.equal(duelRecordFromState({ ...fromServer, winner: 'p2' }, 'p1', 'loss').rivalSecretId, null);
});

test('al abandonar no se guarda el Pokémon del rival', () => {
  assert.equal(duelRecordFromState(state, 'p2', 'left').rivalSecretId, null);
  assert.equal(duelRecordFromState(state, 'p2', 'rival-left').mySecretId, 4);
});

test('la clave de partida no depende del orden de los descartes y cambia con el ganador', () => {
  const reordered: DuelStateLike = { ...state, players: { ...state.players, p1: { secretId: 25, crossedIds: [1, 4] } } };
  assert.equal(duelMatchKey(state, 'p1', 'win'), duelMatchKey(reordered, 'p1', 'win'));
  assert.notEqual(duelMatchKey(state, 'p1', 'win'), duelMatchKey({ ...state, winner: 'p2' }, 'p1', 'win'));
  assert.ok(duelMatchKey(state, 'p1', 'win').startsWith('ABCD2345-'));
});

test('añadir no duplica por id ni por partida y se queda con los 2000 más recientes', () => {
  const first = record('a', 'win', '2026-11-01T00:00:00.000Z');
  const list = [first];
  assert.equal(appendDuelRecord(list, { ...first, matchKey: 'otra' }), list);
  assert.equal(appendDuelRecord(list, { ...first, id: 'b' }), list);
  assert.equal(appendDuelRecord(list, record('b', 'loss', '2026-11-01T01:00:00.000Z')).length, 2);
  const full = Array.from({ length: MAX_DUEL_RECORDS }, (_, index) => record(`r${index}`, 'win', '2026-11-01T00:00:00.000Z'));
  const next = appendDuelRecord(full, record('nuevo', 'loss', '2026-11-02T00:00:00.000Z'));
  assert.equal(next.length, MAX_DUEL_RECORDS);
  assert.equal(next[0]?.id, 'r1');
  assert.equal(next[next.length - 1]?.id, 'nuevo');
});

test('victorias, porcentaje, mejor racha y desglose por generación en orden', () => {
  const stats = computeDuelStats([
    record('4', 'win', '2026-11-04T00:00:00.000Z', { generation: 'all' }),
    record('1', 'win', '2026-11-01T00:00:00.000Z', { generation: 3 }),
    record('2', 'rival-left', '2026-11-02T00:00:00.000Z', { generation: 3 }),
    record('3', 'win', '2026-11-03T00:00:00.000Z'),
    record('5', 'loss', '2026-11-05T00:00:00.000Z'),
    record('6', 'left', '2026-11-06T00:00:00.000Z'),
  ]);
  assert.deepEqual([stats.played, stats.wins, stats.losses, stats.rivalLeft, stats.left], [4, 3, 1, 1, 1]);
  assert.equal(stats.winRate, 75);
  // «El rival se fue» entre dos victorias no corta la racha.
  assert.equal(stats.bestWinStreak, 3);
  assert.deepEqual(stats.byGeneration.map((item) => [item.label, item.played, item.wins, item.losses, item.unfinished]), [
    ['Todas', 1, 1, 0, 0],
    ['1ª · Kanto', 2, 1, 1, 1],
    ['3ª · Hoenn', 1, 1, 0, 1],
  ]);
});

test('la validación es estricta y explica el motivo en español', () => {
  const good = record('a', 'win', '2026-11-01T00:00:00.000Z');
  assert.deepEqual(sanitizeDuelRecord({ ...good, extra: 'x' }), good);
  assert.equal(duelRecordProblem({ ...good, generation: 10 }), 'generación no válida');
  assert.equal(duelRecordProblem({ ...good, boardSize: 0 }), 'tamaño de tablero no válido');
  assert.equal(duelRecordProblem({ ...good, outcome: 'empate' }), 'resultado desconocido');
  assert.equal(duelRecordProblem({ ...good, finishedAt: 'ayer' }), 'falta la fecha');
  assert.equal(duelRecordProblem({ ...good, mySecretId: 2000 }), 'Pokémon no válido');
  assert.equal(duelRecordProblem({ ...good, crossedCount: 1.5 }), 'descartes no válidos');
  assert.equal(duelRecordProblem({ ...good, id: 'x'.repeat(65) }), 'identificador no válido');
  assert.equal(duelRecordProblem([good]), 'no es una partida');
  assert.equal(sanitizeDuelRecord(null), null);
});

test('CSV con BOM, cabecera exacta, etiquetas en español y celdas protegidas', () => {
  const csv = duelRecordsToCsv(
    [record('b', 'loss', '2026-11-02T00:00:00.000Z', { rivalSecretId: null }), record('a', 'win', '2026-11-01T00:00:00.000Z')],
    (id) => (id === 25 ? '=Pikachu' : undefined),
  );
  const lines = csv.slice(1).split('\r\n');
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.equal(lines[0], 'fecha;generacion;tablero;resultado;tu_pokemon_id;tu_pokemon;pokemon_rival_id;pokemon_rival;descartes');
  assert.equal(lines[1], "2026-11-01T00:00:00.000Z;1ª · Kanto;24;Victoria;25;'=Pikachu;4;#004;3");
  assert.equal(lines[2], "2026-11-02T00:00:00.000Z;1ª · Kanto;24;Derrota;25;'=Pikachu;;;3");
  assert.ok(csv.endsWith('\r\n'));
});

test('exportación JSON estable con nombres y orden cronológico', () => {
  const exported = buildDuelStatsExport(
    [record('b', 'loss', '2026-11-02T00:00:00.000Z'), record('a', 'win', '2026-11-01T00:00:00.000Z')],
    () => 'Pikachu',
    new Date('2026-11-03T00:00:00.000Z'),
  );
  assert.equal(exported.format, 'adivina-pkm-duel-stats');
  assert.equal(exported.formatVersion, 1);
  assert.equal(exported.exportedAt, '2026-11-03T00:00:00.000Z');
  assert.deepEqual(exported.games.map((game) => game.id), ['a', 'b']);
  assert.equal(exported.games[0]?.myPokemon, 'Pikachu');
  assert.equal(exported.summary.played, 2);
});

test('etiquetas de generación', () => {
  assert.equal(generationLabel('all'), 'Todas');
  assert.equal(generationLabel(9), '9ª · Paldea');
});
