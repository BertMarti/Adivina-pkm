// Códigos de sala, enlaces de invitación y qué pantalla toca según el estado de la sala.
import { Platform } from 'react-native';
import { PlayerId } from './engine';
import { RoomGameState } from './roomClient';

export type Screen = 'home' | 'room' | 'selection' | 'waiting' | 'game' | 'single-player';

export const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function createRoomCode() {
  const values = new Uint32Array(8);
  const hasCrypto = Boolean(globalThis.crypto?.getRandomValues);
  if (hasCrypto) globalThis.crypto.getRandomValues(values);
  return Array.from(
    values,
    (value) => ALPHABET[(hasCrypto ? value : Math.floor(Math.random() * 0xffffffff)) % ALPHABET.length],
  ).join('');
}

export function inviteLinkFor(roomCode: string) {
  const encodedCode = encodeURIComponent(roomCode);
  // En GitHub Pages la app vive en /Adivina-pkm/: se conserva la ruta para que el enlace no lleve a un 404.
  if (Platform.OS === 'web' && typeof window !== 'undefined')
    return `${window.location.origin}${window.location.pathname}?room=${encodedCode}`;
  return `pokequien://join?room=${encodedCode}`;
}

export function getScreenForState(state: RoomGameState, player: PlayerId): Screen {
  if (state.phase === 'abandoned') return 'home';
  if (state.phase === 'waiting-for-player') return 'room';
  if (state.phase === 'selecting') return 'selection';
  if (state.phase === 'waiting-for-selection') return state.players[player].secretId === null ? 'selection' : 'waiting';
  return 'game';
}
