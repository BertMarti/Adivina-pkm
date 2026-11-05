import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { DuelRecord } from './duelStats';
import type { SinglePlayerSessionRecord } from './singlePlayerStorage';
import type { ParsedStatsFile } from './statsImport';
import { APPLY_ERRORS, applyStatsImportWith } from './statsImportApply';
import type { KeyValueStorage } from './statsImportApply';

const KEYS = { solo: 'adivina-pkm:single-player-log:v1', duel: 'adivina-pkm:duel-log:v1' };

const session = (id: string, startedAt: string): SinglePlayerSessionRecord => ({
  sessionId: id, schemaVersion: 2, knowledgeVersion: 'kanto-151-v4', catalogId: 'kanto', startedAt, finishedAt: startedAt,
  result: 'won', maxQuestions: 30, questionSelectionSeed: 0, selectedPokemonId: 25, guessedPokemonId: 25,
  rejectedGuessIds: [], questionsAsked: 5, events: [],
});
const duel = (id: string, finishedAt: string): DuelRecord => ({
  id, matchKey: `m-${id}`, finishedAt, generation: 1, boardSize: 24, outcome: 'win', mySecretId: 25, rivalSecretId: 4, crossedCount: 3,
});

/** AsyncStorage falso: un Map y, si se pide, fallos en la n-ésima escritura o en cualquier lectura. */
function fakeStorage(initial: Record<string, string>, options: { failSetAt?: number; failSetsFrom?: number; failGet?: boolean } = {}) {
  const data = new Map(Object.entries(initial));
  let sets = 0;
  const storage: KeyValueStorage = {
    async getItem(key) {
      if (options.failGet) throw new Error('lectura rota');
      return data.get(key) ?? null;
    },
    async setItem(key, value) {
      sets += 1;
      if (sets === options.failSetAt || (options.failSetsFrom !== undefined && sets >= options.failSetsFrom)) throw new Error('cuota llena');
      data.set(key, value);
    },
    async removeItem(key) {
      data.delete(key);
    },
  };
  return { storage, data };
}

const backupFile: ParsedStatsFile = {
  kind: 'backup', exportedAt: null,
  solo: [session('nueva', '2026-11-03T00:00:00.000Z')],
  duel: [duel('nuevo', '2026-11-03T00:00:00.000Z')],
};

test('fusiona y guarda las dos secciones', async () => {
  const { storage, data } = fakeStorage({ [KEYS.solo]: JSON.stringify([session('vieja', '2026-11-01T00:00:00.000Z')]) });
  const plan = await applyStatsImportWith(storage, KEYS, backupFile, 'merge');
  assert.equal(plan.solo?.added, 1);
  assert.deepEqual(JSON.parse(data.get(KEYS.solo) ?? '[]').map((item: SinglePlayerSessionRecord) => item.sessionId), ['vieja', 'nueva']);
  assert.equal(JSON.parse(data.get(KEYS.duel) ?? '[]').length, 1);
});

test('si falla la segunda escritura, las dos claves vuelven a su valor previo', async () => {
  const soloBefore = JSON.stringify([session('vieja', '2026-11-01T00:00:00.000Z')]);
  const { storage, data } = fakeStorage({ [KEYS.solo]: soloBefore }, { failSetAt: 2 });
  await assert.rejects(applyStatsImportWith(storage, KEYS, backupFile, 'replace'), { message: APPLY_ERRORS.write });
  assert.equal(data.get(KEYS.solo), soloBefore);
  // El Duelo no tenía nada: sigue sin clave.
  assert.equal(data.has(KEYS.duel), false);
});

test('si tampoco se puede restaurar, el mensaje no promete que nada cambió', async () => {
  const { storage } = fakeStorage({ [KEYS.solo]: '[]', [KEYS.duel]: '[]' }, { failSetsFrom: 2 });
  await assert.rejects(applyStatsImportWith(storage, KEYS, backupFile, 'merge'), { message: APPLY_ERRORS.writeAndRestore });
});

test('si lo guardado no se puede leer, no se importa nada (no actúa como reemplazo)', async () => {
  const corrupt = fakeStorage({ [KEYS.solo]: '{roto', [KEYS.duel]: '[]' });
  await assert.rejects(applyStatsImportWith(corrupt.storage, KEYS, backupFile, 'merge'), { message: APPLY_ERRORS.read });
  assert.equal(corrupt.data.get(KEYS.solo), '{roto');
  assert.equal(corrupt.data.get(KEYS.duel), '[]');
  const notList = fakeStorage({ [KEYS.duel]: '{"a":1}' });
  await assert.rejects(applyStatsImportWith(notList.storage, KEYS, backupFile, 'merge'), { message: APPLY_ERRORS.read });
  assert.equal(notList.data.has(KEYS.solo), false);
  const unreadable = fakeStorage({}, { failGet: true });
  await assert.rejects(applyStatsImportWith(unreadable.storage, KEYS, backupFile, 'merge'), { message: APPLY_ERRORS.read });
});
