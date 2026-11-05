import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildDuelStatsExport } from './duelStats';
import type { DuelRecord } from './duelStats';
import { buildSoloStatsExport } from './singlePlayerStats';
import type { SinglePlayerSessionRecord } from './singlePlayerStorage';
import {
  buildStatsBackup,
  describeImportPlan,
  describeImportResult,
  describeParsedFile,
  IMPORT_ERRORS,
  MAX_IMPORT_BYTES,
  parseStatsFile,
  planImport,
} from './statsImport';
import type { ParsedStatsFile, ParseResult } from './statsImport';

function session(id: string, startedAt: string, overrides: Partial<SinglePlayerSessionRecord> = {}): SinglePlayerSessionRecord {
  return {
    sessionId: id, schemaVersion: 2, knowledgeVersion: 'kanto-151-v4', catalogId: 'kanto', startedAt,
    finishedAt: startedAt, result: 'won', maxQuestions: 30, questionSelectionSeed: 7, selectedPokemonId: 25,
    guessedPokemonId: 25, rejectedGuessIds: [4], questionsAsked: 6, events: [], ...overrides,
  };
}

function duel(id: string, finishedAt: string, overrides: Partial<DuelRecord> = {}): DuelRecord {
  return {
    id, matchKey: `m-${id}`, finishedAt, generation: 1, boardSize: 24, outcome: 'win',
    mySecretId: 25, rivalSecretId: 4, crossedCount: 3, ...overrides,
  };
}

const NOW = new Date('2026-11-02T12:00:00.000Z');
const soloJson = (sessions: SinglePlayerSessionRecord[]) => JSON.stringify(buildSoloStatsExport(sessions, () => 'Pikachu', NOW));

function errorOf(result: ParseResult): string {
  assert.equal(result.ok, false);
  return result.ok ? '' : result.error;
}

function fileOf(result: ParseResult): ParsedStatsFile {
  if (!result.ok) assert.fail(result.error);
  return result.file;
}

test('errores claros en español antes de mirar las partidas', () => {
  assert.equal(errorOf(parseStatsFile('   ')), IMPORT_ERRORS.empty);
  assert.equal(errorOf(parseStatsFile(' '.repeat(10) + 'x'.repeat(MAX_IMPORT_BYTES))), IMPORT_ERRORS.tooBig);
  assert.equal(errorOf(parseStatsFile('{"format":')), IMPORT_ERRORS.notJson);
  assert.equal(errorOf(parseStatsFile('[1, 2]')), IMPORT_ERRORS.foreign);
  assert.equal(errorOf(parseStatsFile('{"format":"otra-app","formatVersion":1}')), IMPORT_ERRORS.foreign);
  assert.equal(errorOf(parseStatsFile('{"format":"adivina-pkm-duel-stats","formatVersion":"1"}')), IMPORT_ERRORS.badVersion);
  assert.equal(errorOf(parseStatsFile('{"format":"adivina-pkm-duel-stats","formatVersion":2,"games":[]}')), IMPORT_ERRORS.newerVersion);
  assert.equal(errorOf(parseStatsFile('{"format":"adivina-pkm-duel-stats","formatVersion":1}')), IMPORT_ERRORS.noList);
  assert.equal(errorOf(parseStatsFile('{"format":"adivina-pkm-duel-stats","formatVersion":1,"games":[]}')), IMPORT_ERRORS.noGames);
});

test('una sola partida mala rechaza el archivo entero y dice cuál', () => {
  const games = [duel('a', '2026-11-01T00:00:00.000Z'), { ...duel('b', '2026-11-01T00:00:00.000Z'), generation: 12 }];
  assert.equal(
    errorOf(parseStatsFile(JSON.stringify({ format: 'adivina-pkm-duel-stats', formatVersion: 1, games }))),
    'La partida n.º 2 del Duelo no es válida (generación no válida). No se ha importado nada.',
  );
  const exported = JSON.parse(soloJson([session('s1', '2026-11-01T00:00:00.000Z')]));
  exported.games[0].questions = 999;
  assert.equal(
    errorOf(parseStatsFile(JSON.stringify(exported))),
    'La partida n.º 1 del Solitario no es válida (número de preguntas no válido). No se ha importado nada.',
  );
});

test('el JSON del Solitario de la 1.2 (versión 2) se importa sin perder datos', () => {
  const original = session('s1', '2026-11-01T00:00:00.000Z', { result: 'limit-reached', rejectedGuessIds: [4, 7], questionsAsked: 30 });
  const file = fileOf(parseStatsFile(soloJson([original])));
  assert.equal(file.kind, 'solo-stats');
  assert.equal(file.duel, null);
  const imported = file.solo?.[0];
  assert.equal(imported?.sessionId, 's1');
  assert.equal(imported?.result, 'limit-reached');
  assert.deepEqual(imported?.rejectedGuessIds, [4, 7]);
  assert.equal(imported?.questionsAsked, 30);
  assert.equal(imported?.selectedPokemonId, 25);
});

test('el JSON del Solitario de la 1.1 (versión 1) se importa con id derivado y estable', () => {
  const v1 = {
    format: 'adivina-pkm-single-player-stats', formatVersion: 1, exportedAt: '2026-10-31T10:00:00.000Z', summary: {},
    games: [
      { startedAt: '2026-10-31T09:00:00.000Z', finishedAt: '2026-10-31T09:05:00.000Z', catalogId: 'kanto', pokemonId: 25, pokemon: 'Pikachu', outcome: 'player', questions: 30, rejectedGuesses: 2 },
      { startedAt: '2026-10-31T09:10:00.000Z', finishedAt: null, catalogId: 'kanto', pokemonId: null, pokemon: null, outcome: 'in-progress', questions: 3, rejectedGuesses: 0 },
    ],
  };
  const first = fileOf(parseStatsFile(JSON.stringify(v1)));
  const second = fileOf(parseStatsFile(JSON.stringify(v1)));
  assert.deepEqual(first.solo?.map((item) => item.result), ['player-won', 'abandoned']);
  assert.equal(first.solo?.[0]?.sessionId, second.solo?.[0]?.sessionId);
  assert.match(first.solo?.[0]?.sessionId ?? '', /^import-/);
  assert.equal(first.exportedAt, '2026-10-31T10:00:00.000Z');
});

test('copia completa (EXPORTAR TODO) con las dos secciones, y con una vacía', () => {
  const solo = buildSoloStatsExport([session('s1', '2026-11-01T00:00:00.000Z')], () => undefined, NOW);
  const full = fileOf(parseStatsFile(JSON.stringify(buildStatsBackup(solo, buildDuelStatsExport([duel('d1', '2026-11-01T00:00:00.000Z')], () => undefined, NOW), NOW))));
  assert.equal(full.kind, 'backup');
  assert.equal(full.solo?.length, 1);
  assert.equal(full.duel?.length, 1);
  // Un dispositivo sin duelos también puede pasar sus estadísticas: la sección vacía es válida.
  const onlySolo = fileOf(parseStatsFile(JSON.stringify(buildStatsBackup(solo, buildDuelStatsExport([], () => undefined, NOW), NOW))));
  assert.equal(onlySolo.duel?.length, 0);
  const tampered = JSON.parse(JSON.stringify(buildStatsBackup(solo, buildDuelStatsExport([], () => undefined, NOW), NOW)));
  tampered.duelo.format = 'otra-cosa';
  assert.equal(errorOf(parseStatsFile(JSON.stringify(tampered))), IMPORT_ERRORS.foreign);
});

test('historial del Solitario (COPIAR JSON) y partidas sin terminar', () => {
  const file = fileOf(parseStatsFile(JSON.stringify({
    format: 'adivina-pkm-single-player-log', formatVersion: 2, exportedAt: '2026-11-01T00:00:00.000Z',
    sessions: [session('s1', '2026-11-01T00:00:00.000Z', { result: 'in-progress' })],
  })));
  assert.equal(file.kind, 'solo-log');
  assert.equal(file.solo?.[0]?.result, 'abandoned');
});

test('duplicados dentro del archivo: se queda el primero; BOM y claves raras no hacen daño', () => {
  const games = [duel('d1', '2026-11-01T00:00:00.000Z'), duel('d1', '2026-11-02T00:00:00.000Z')];
  const text = `\uFEFF${JSON.stringify({ format: 'adivina-pkm-duel-stats', formatVersion: 1, games })}`;
  const file = fileOf(parseStatsFile(text));
  assert.equal(file.duel?.length, 1);
  assert.equal(file.duel?.[0]?.finishedAt, '2026-11-01T00:00:00.000Z');
  const hostile = `{"format":"adivina-pkm-duel-stats","formatVersion":1,"games":[{"__proto__":{"contaminado":true},"id":"x","matchKey":"y","finishedAt":"2026-11-01T00:00:00.000Z","generation":1,"boardSize":24,"outcome":"win","mySecretId":null,"rivalSecretId":null,"crossedCount":0}]}`;
  const parsed = fileOf(parseStatsFile(hostile));
  assert.equal(({} as Record<string, unknown>).contaminado, undefined);
  assert.equal(Object.keys(parsed.duel?.[0] ?? {}).includes('__proto__'), false);
});

test('fusionar añade solo lo nuevo, en orden cronológico, y respeta el límite', () => {
  const current = { solo: [session('s2', '2026-11-02T00:00:00.000Z')], duel: [duel('d1', '2026-11-01T00:00:00.000Z')] };
  const file: ParsedStatsFile = {
    kind: 'backup', exportedAt: null,
    solo: [session('s1', '2026-11-01T00:00:00.000Z'), session('s2', '2026-11-02T00:00:00.000Z')],
    duel: [duel('d1', '2026-11-01T00:00:00.000Z'), duel('otro-id', '2026-11-03T00:00:00.000Z', { matchKey: 'm-d1' })],
  };
  const plan = planImport(current, file, 'merge');
  assert.deepEqual(plan.solo?.next.map((item) => item.sessionId), ['s1', 's2']);
  assert.deepEqual([plan.solo?.added, plan.solo?.duplicates, plan.solo?.dropped], [1, 1, 0]);
  // Mismo duelo con otro id (misma clave de partida): no se cuenta dos veces.
  assert.deepEqual([plan.duel?.added, plan.duel?.duplicates], [0, 2]);
  assert.equal(
    describeImportPlan(plan),
    'Se añadirá 1 partida del Solitario (1 ya estaba). 2 duelos del archivo ya estaban. Lo que ya tienes se conserva.',
  );
  assert.equal(describeImportResult(plan), 'Importación hecha: añadidas 1 partida del Solitario.');

  const many = Array.from({ length: 2000 }, (_, index) => duel(`n${index}`, `2026-11-04T00:00:${String(index % 60).padStart(2, '0')}.000Z`));
  const limited = planImport(current, { kind: 'duel-stats', exportedAt: null, solo: null, duel: many }, 'merge');
  assert.equal(limited.duel?.next.length, 2000);
  assert.equal(limited.duel?.dropped, 1);
  assert.equal(limited.solo, null);
  assert.match(describeImportPlan(limited), /Se quitarán las 1 más antiguas/);
});

test('reemplazar pone solo lo del archivo y avisa de lo que se borra', () => {
  const current = { solo: [session('a', '2026-11-01T00:00:00.000Z'), session('b', '2026-11-02T00:00:00.000Z')], duel: [duel('d', '2026-11-01T00:00:00.000Z')] };
  const file: ParsedStatsFile = { kind: 'solo-stats', exportedAt: null, solo: [session('z', '2026-11-03T00:00:00.000Z')], duel: null };
  const plan = planImport(current, file, 'replace');
  assert.deepEqual(plan.solo?.next.map((item) => item.sessionId), ['z']);
  assert.equal(plan.duel, null);
  assert.equal(
    describeImportPlan(plan),
    'Se borrarán 2 partidas del Solitario de este dispositivo y se pondrá 1 partida del Solitario del archivo. No se puede deshacer.',
  );
  const empty = planImport({ solo: [], duel: [] }, { ...file, duel: [duel('d', '2026-11-01T00:00:00.000Z')] }, 'replace');
  assert.equal(describeImportPlan(empty), 'Se pondrán 1 partida del Solitario y 1 duelo del archivo.');
});

test('fusionar lo que ya está no cambia nada', () => {
  const current = { solo: [session('a', '2026-11-01T00:00:00.000Z')], duel: [] };
  const plan = planImport(current, { kind: 'solo-stats', exportedAt: null, solo: current.solo, duel: null }, 'merge');
  assert.equal(describeImportPlan(plan), 'Todas las partidas del archivo ya estaban en este dispositivo: no cambiará nada.');
});

test('resumen del archivo revisado', () => {
  const file: ParsedStatsFile = { kind: 'backup', exportedAt: '2026-11-01T12:00:00.000Z', solo: [session('a', '2026-11-01T00:00:00.000Z')], duel: [] };
  assert.match(describeParsedFile(file), /^Archivo válido: 1 partida del Solitario y 0 duelos \(exportado el \d\d\/11\/2026\)\.$/);
  assert.equal(describeParsedFile({ ...file, exportedAt: null, solo: null }), 'Archivo válido: 0 duelos.');
});
