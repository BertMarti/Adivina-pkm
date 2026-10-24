import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { PokemonCandidate } from '../data/pokemon';
import type { LocalGameState } from './engine';
import {
  beginPlayerTwoSelection,
  beginPlaying,
  createLocalGame,
  getRemainingCount,
  getPokemon,
  selectSecret,
  toggleCandidate,
} from './engine';

function makeCandidate(id: number): PokemonCandidate {
  return {
    id,
    name: `Pokémon de prueba ${id}`,
    types: ['normal'],
    stage: 0,
    legendary: false,
    weightKg: 10,
    portraitUrl: 'https://example.com/portrait.png',
    normalUrl: 'https://example.com/normal.png',
    sadUrl: 'https://example.com/sad.png',
    fallbackUrl: 'https://example.com/fallback.png',
  };
}

function makeBoard(size = 25): PokemonCandidate[] {
  return Array.from({ length: size }, (_, index) => makeCandidate(index + 1));
}

// p1 elige el 1 y p2 el 2; la partida queda en 'playing' lista para tachar.
function playingGame(): LocalGameState {
  let state = createLocalGame(makeBoard(), 'MOTOR2345');
  state = beginPlayerTwoSelection(state);
  state = selectSecret(state, 'p1', 1);
  state = selectSecret(state, 'p2', 2);
  return state;
}

test('createLocalGame inicializa la partida esperando al segundo jugador', () => {
  const board = makeBoard();
  const state = createLocalGame(board, 'SAL23456');
  assert.equal(state.phase, 'waiting-for-player');
  assert.equal(state.roomCode, 'SAL23456');
  assert.equal(state.playerCount, 1);
  assert.equal(state.winner, null);
  assert.equal(state.board, board);
  assert.deepEqual(state.players.p1, { secretId: null, crossedIds: [] });
  assert.deepEqual(state.players.p2, { secretId: null, crossedIds: [] });
});

test('beginPlayerTwoSelection solo avanza desde waiting-for-player', () => {
  const initial = createLocalGame(makeBoard(), 'P2S23456');
  const selecting = beginPlayerTwoSelection(initial);
  assert.equal(selecting.phase, 'selecting');
  assert.equal(selecting.playerCount, 2);
  assert.equal(beginPlayerTwoSelection(selecting), selecting);
});

test('selectSecret no actúa fuera de la fase de selección', () => {
  const state = createLocalGame(makeBoard(), 'SEL23456');
  assert.equal(selectSecret(state, 'p1', 1), state);
});

test('selectSecret guarda el secreto y arranca el juego cuando ambos eligen', () => {
  const selecting = beginPlayerTwoSelection(createLocalGame(makeBoard(), 'SEL23457'));

  const unknown = selectSecret(selecting, 'p1', 999);
  assert.equal(unknown, selecting);

  const p1Selects = selectSecret(selecting, 'p1', 1);
  assert.equal(p1Selects.phase, 'waiting-for-selection');
  assert.equal(p1Selects.players.p1.secretId, 1);
  assert.equal(selecting.players.p1.secretId, null);

  const repeated = selectSecret(p1Selects, 'p1', 5);
  assert.equal(repeated, p1Selects);

  const both = selectSecret(p1Selects, 'p2', 2);
  assert.equal(both.phase, 'playing');
  assert.equal(both.playerCount, 2);
  assert.equal(both.players.p2.secretId, 2);
});

test('beginPlaying solo arranca la partida con ambos secretos elegidos', () => {
  const selecting = beginPlayerTwoSelection(createLocalGame(makeBoard(), 'JUE23456'));
  assert.equal(beginPlaying(selecting), selecting);

  const onlyP1 = selectSecret(selecting, 'p1', 1);
  assert.equal(beginPlaying(onlyP1), onlyP1);

  const bothSelected: LocalGameState = {
    ...onlyP1,
    players: { ...onlyP1.players, p2: { secretId: 2, crossedIds: [] } },
  };
  const playing = beginPlaying(bothSelected);
  assert.equal(playing.phase, 'playing');
  assert.equal(playing.playerCount, 2);
});

test('toggleCandidate tacha y destacha sin mutar el estado anterior', () => {
  const playing = playingGame();
  const crossed = toggleCandidate(playing, 'p1', 5);
  assert.deepEqual(crossed.players.p1.crossedIds, [5]);
  assert.deepEqual(playing.players.p1.crossedIds, []);

  const toggledBack = toggleCandidate(crossed, 'p1', 5);
  assert.deepEqual(toggledBack.players.p1.crossedIds, []);
  assert.equal(crossed.players.p1.crossedIds.length, 1);
});

test('toggleCandidate ignora fases previas y ids fuera del tablero', () => {
  const selecting = beginPlayerTwoSelection(createLocalGame(makeBoard(), 'TOG23456'));
  assert.equal(toggleCandidate(selecting, 'p1', 1), selecting);

  const onlyP1 = selectSecret(selecting, 'p1', 1);
  assert.equal(toggleCandidate(onlyP1, 'p1', 2), onlyP1);

  const playing = playingGame();
  assert.equal(toggleCandidate(playing, 'p1', 999), playing);
});

test('toggleCandidate no permite dejar el tablero sin candidatos', () => {
  let state = playingGame();
  for (let id = 2; id <= 24; id += 1) state = toggleCandidate(state, 'p1', id);
  state = toggleCandidate(state, 'p1', 25);
  assert.equal(getRemainingCount(state, 'p1'), 1);
  assert.equal(state.phase, 'playing');

  const blocked = toggleCandidate(state, 'p1', 1);
  assert.equal(blocked, state);
  assert.equal(getRemainingCount(blocked, 'p1'), 1);
});

test('toggleCandidate da la victoria a p1 al dejar solo el secreto de p2', () => {
  let state = playingGame();
  for (let id = 3; id <= 25; id += 1) state = toggleCandidate(state, 'p1', id);
  const winning = toggleCandidate(state, 'p1', 1);
  assert.equal(winning.phase, 'finished');
  assert.equal(winning.winner, 'p1');
  const remaining = winning.board.filter((pokemon) => !winning.players.p1.crossedIds.includes(pokemon.id));
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, 2);
});

test('toggleCandidate da la victoria a p2 al dejar solo el secreto de p1', () => {
  let state = playingGame();
  for (let id = 3; id <= 25; id += 1) state = toggleCandidate(state, 'p2', id);
  const winning = toggleCandidate(state, 'p2', 2);
  assert.equal(winning.phase, 'finished');
  assert.equal(winning.winner, 'p2');
  const remaining = winning.board.filter((pokemon) => !winning.players.p2.crossedIds.includes(pokemon.id));
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, 1);
});

test('getRemainingCount descuenta solo los tachados de cada jugador', () => {
  const playing = playingGame();
  assert.equal(getRemainingCount(playing, 'p1'), 25);
  assert.equal(getRemainingCount(playing, 'p2'), 25);

  const crossed = toggleCandidate(playing, 'p1', 10);
  assert.equal(getRemainingCount(crossed, 'p1'), 24);
  assert.equal(getRemainingCount(crossed, 'p2'), 25);
});

test('getPokemon devuelve el candidato por id o undefined', () => {
  const state = createLocalGame(makeBoard(5), 'PKM23456');
  assert.equal(getPokemon(state, 3)?.name, 'Pokémon de prueba 3');
  assert.equal(getPokemon(state, null), undefined);
  assert.equal(getPokemon(state, 99), undefined);
});
