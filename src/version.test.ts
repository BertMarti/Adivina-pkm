import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { APP_VERSION } from './version';

const readJson = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

test('la versión visible coincide con package.json, app.json y el servidor de salas', () => {
  assert.match(APP_VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(readJson('../package.json').version, APP_VERSION);
  assert.equal(readJson('../package-lock.json').version, APP_VERSION);
  assert.equal(readJson('../app.json').expo.version, APP_VERSION);
  assert.equal(readJson('../server/package.json').version, APP_VERSION);
  assert.equal(readJson('../server/package-lock.json').version, APP_VERSION);
});
