import { PokemonCandidate } from '../data/pokemon';

export type PlayerId = 'p1' | 'p2';
export type LocalPhase = 'waiting-for-player' | 'selecting' | 'waiting-for-selection' | 'playing' | 'finished' | 'abandoned';

export type PlayerState = {
  secretId: number | null;
  crossedIds: number[];
};

export type LocalGameState = {
  phase: LocalPhase;
  roomCode: string;
  board: PokemonCandidate[];
  players: Record<PlayerId, PlayerState>;
  winner: PlayerId | null;
  playerCount: 1 | 2;
};

export function createLocalGame(board: PokemonCandidate[], roomCode: string): LocalGameState {
  return {
    phase: 'waiting-for-player',
    roomCode,
    board,
    players: {
      p1: { secretId: null, crossedIds: [] },
      p2: { secretId: null, crossedIds: [] },
    },
    winner: null,
    playerCount: 1,
  };
}

export function selectSecret(state: LocalGameState, player: PlayerId, id: number): LocalGameState {
  if ((state.phase !== 'selecting' && state.phase !== 'waiting-for-selection') || !state.board.some((pokemon) => pokemon.id === id) || state.players[player].secretId !== null) return state;
  const players = {
    ...state.players,
    [player]: { ...state.players[player], secretId: id },
  };
  const bothSelected = players.p1.secretId !== null && players.p2.secretId !== null;
  return {
    ...state,
    players,
    phase: bothSelected ? 'playing' : 'waiting-for-selection',
    playerCount: bothSelected ? 2 : state.playerCount,
  };
}

export function beginPlayerTwoSelection(state: LocalGameState): LocalGameState {
  return state.phase === 'waiting-for-player' ? { ...state, phase: 'selecting', playerCount: 2 } : state;
}

export function beginPlaying(state: LocalGameState): LocalGameState {
  if (state.phase !== 'waiting-for-selection' || state.players.p1.secretId === null || state.players.p2.secretId === null) return state;
  return { ...state, phase: 'playing', playerCount: 2 };
}

function opponentOf(player: PlayerId): PlayerId {
  return player === 'p1' ? 'p2' : 'p1';
}

export function toggleCandidate(state: LocalGameState, player: PlayerId, id: number): LocalGameState {
  if (state.phase !== 'playing' || !state.board.some((pokemon) => pokemon.id === id)) return state;
  const current = state.players[player];
  const crossed = current.crossedIds.includes(id);
  const nextCrossedIds = crossed ? current.crossedIds.filter((candidateId) => candidateId !== id) : [...current.crossedIds, id];
  const remaining = state.board.filter((pokemon) => !nextCrossedIds.includes(pokemon.id));

  // Never let a local mistake create an empty board. A single remaining candidate
  // wins only when it is the opponent's private secret.
  if (remaining.length === 0) return state;
  const nextPlayer = { ...current, crossedIds: nextCrossedIds };
  const nextState = { ...state, players: { ...state.players, [player]: nextPlayer } };
  const opponent = state.players[opponentOf(player)];
  if (remaining.length === 1 && remaining[0].id === opponent.secretId) {
    return { ...nextState, phase: 'finished', winner: player };
  }
  return nextState;
}

export function getRemainingCount(state: LocalGameState, player: PlayerId) {
  return state.board.length - new Set(state.players[player].crossedIds).size;
}

export function getPokemon(state: LocalGameState, id: number | null) {
  return state.board.find((pokemon) => pokemon.id === id);
}
