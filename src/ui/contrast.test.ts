import assert from 'node:assert/strict';
import { test } from 'node:test';

import { blend, contrastRatio, relativeLuminance } from './contrast';
import { COLORS, MARKED_CROSS } from './theme';

test('contrastRatio da los valores de referencia de WCAG', () => {
  assert.equal(Math.round(contrastRatio('#000000', '#FFFFFF') * 10) / 10, 21);
  assert.equal(contrastRatio('#777777', '#777777'), 1);
  assert.equal(relativeLuminance('#FFF'), 1);
  assert.throws(() => relativeLuminance('rojo'));
  assert.equal(blend('#000000', '#FFFFFF', 0.5), '#808080');
});

test('tachado visible: la etiqueta FUERA cumple AA para texto (≥ 4,5:1)', () => {
  assert.ok(contrastRatio(MARKED_CROSS.badgeText, MARKED_CROSS.badgeBackground) >= 4.5);
});

test('tachado visible: aspa y borde cumplen AA para elementos gráficos (≥ 3:1)', () => {
  // El aspa se ve sobre la carta, sobre el velo y sobre cualquier retrato gracias a su contorno oscuro.
  const veiled = blend(MARKED_CROSS.veil, MARKED_CROSS.tileBackground, MARKED_CROSS.veilOpacity);
  assert.ok(contrastRatio(MARKED_CROSS.line, MARKED_CROSS.tileBackground) >= 3);
  assert.ok(contrastRatio(MARKED_CROSS.line, veiled) >= 3);
  assert.ok(contrastRatio(MARKED_CROSS.line, MARKED_CROSS.lineEdge) >= 3, 'aspa frente a su contorno');
  // Un retrato blanco del todo: el contorno oscuro separa el aspa del fondo.
  assert.ok(contrastRatio(MARKED_CROSS.lineEdge, '#FFFFFF') >= 3);
  assert.ok(contrastRatio(MARKED_CROSS.border, MARKED_CROSS.boardBackground) >= 3, 'borde frente al tablero');
});

test('tachado visible: se distingue por luminosidad, no solo por el tono', () => {
  // Sin el modo, el aspa es roja: con daltonismo rojo-verde puede confundirse. Con el modo, el aspa blanca
  // se separa mucho más del fondo de la carta que la roja.
  const normal = contrastRatio(COLORS.danger, MARKED_CROSS.tileBackground);
  const marked = contrastRatio(MARKED_CROSS.line, MARKED_CROSS.tileBackground);
  assert.ok(marked > normal * 2, `${marked.toFixed(1)} frente a ${normal.toFixed(1)}`);
  // El velo oscurece el retrato de forma clara: un retrato blanco queda a menos de la mitad de luminancia.
  assert.ok(relativeLuminance(blend(MARKED_CROSS.veil, '#FFFFFF', MARKED_CROSS.veilOpacity)) < 0.5);
});
