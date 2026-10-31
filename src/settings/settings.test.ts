import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_VOLUME,
  defaultSettings,
  effectiveVolume,
  normalizeVolume,
  parseStoredSettings,
  resolveSettings,
  sanitizeStoredSettings,
  SETTINGS_STORAGE_KEY,
  stepVolume,
  volumePercent,
} from './settingsModel';
import { canVibrateWeb, vibrateWeb, WEB_VIBRATION_PATTERNS } from './vibration';

test('la clave de ajustes lleva el prefijo del proyecto (origen compartido de GitHub Pages)', () => {
  assert.match(SETTINGS_STORAGE_KEY, /^adivina-pkm:/);
});

test('valores por defecto: sonido al 80 % y vibración apagada si se pide reducir el movimiento', () => {
  assert.deepEqual(defaultSettings({ reduceMotion: false }), {
    soundEnabled: true,
    volume: DEFAULT_VOLUME,
    vibrationEnabled: true,
    colorblindMode: false,
  });
  assert.equal(defaultSettings({ reduceMotion: true }).vibrationEnabled, false);
  // Lo que la persona elige manda sobre la preferencia del sistema.
  assert.equal(resolveSettings({ vibrationEnabled: true }, { reduceMotion: true }).vibrationEnabled, true);
});

test('volumen: pasos de 0,1, límites y porcentaje', () => {
  assert.equal(stepVolume(0.7, 1), 0.8);
  assert.equal(stepVolume(0.8, 1), 0.9);
  assert.equal(stepVolume(1, 1), 1);
  assert.equal(stepVolume(0.1, -1), 0);
  assert.equal(stepVolume(0, -1), 0);
  assert.equal(normalizeVolume(0.84), 0.8);
  assert.equal(normalizeVolume(7), 1);
  assert.equal(normalizeVolume(-1), 0);
  assert.equal(normalizeVolume(Number.NaN), null);
  assert.equal(normalizeVolume('0.5'), null);
  assert.equal(volumePercent(0.3), 30);
  let volume = 0;
  for (let index = 0; index < 10; index += 1) volume = stepVolume(volume, 1);
  assert.equal(volume, 1, 'diez pasos llegan exactamente a 1');
});

test('volumen efectivo es 0 con el sonido desactivado', () => {
  const settings = defaultSettings({ reduceMotion: false });
  assert.equal(effectiveVolume(settings), DEFAULT_VOLUME);
  assert.equal(effectiveVolume({ ...settings, soundEnabled: false }), 0);
});

test('lo guardado se valida: campos desconocidos o de otro tipo se descartan', () => {
  assert.deepEqual(sanitizeStoredSettings({ soundEnabled: 'sí', volume: 0.55, vibrationEnabled: false, otro: 1 }), {
    volume: 0.6,
    vibrationEnabled: false,
  });
  assert.deepEqual(sanitizeStoredSettings(null), {});
  assert.deepEqual(sanitizeStoredSettings([true]), {});
  assert.deepEqual(parseStoredSettings('{no es json'), {});
  assert.deepEqual(parseStoredSettings(null), {});
  assert.deepEqual(parseStoredSettings('{"colorblindMode":true}'), { colorblindMode: true });
  assert.equal(resolveSettings(parseStoredSettings('{"volume":"alto"}'), { reduceMotion: false }).volume, DEFAULT_VOLUME);
});

test('vibración web: sin navigator.vibrate no vibra ni lanza', () => {
  assert.equal(canVibrateWeb(undefined), false);
  assert.equal(canVibrateWeb({}), false);
  assert.equal(vibrateWeb(20, undefined), false);
  assert.equal(vibrateWeb(20, {}), false);
  assert.equal(
    vibrateWeb(20, {
      vibrate: () => {
        throw new Error('bloqueado');
      },
    }),
    false,
  );
});

test('vibración web: vibra con el patrón y espera a la primera pulsación', () => {
  const calls: Array<number | number[]> = [];
  const nav = { vibrate: (pattern: number | number[]) => (calls.push(pattern), true), maxTouchPoints: 5, userActivation: { hasBeenActive: false } };
  assert.equal(canVibrateWeb(nav), true);
  // Chrome de escritorio tiene la API pero no es táctil: el ajuste se muestra como no disponible.
  assert.equal(canVibrateWeb({ vibrate: () => true, maxTouchPoints: 0 }), false);
  assert.equal(vibrateWeb(WEB_VIBRATION_PATTERNS.victory, nav), false, 'antes de pulsar nada no se intenta');
  nav.userActivation.hasBeenActive = true;
  assert.equal(vibrateWeb(WEB_VIBRATION_PATTERNS.victory, nav), true);
  assert.equal(vibrateWeb(WEB_VIBRATION_PATTERNS.cross, { vibrate: (pattern) => (calls.push(pattern), true) }), true);
  assert.deepEqual(calls, [[60, 40, 60], 30]);
});
