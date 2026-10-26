// Reglas puras de la conexión del Duelo (sin React Native), para poder probarlas con `tsx --test`:
// plazo de reconexión propio, código de sala ocupado y numeración de intentos cancelables.
import type { PlayerId } from './engine';

type DeadlineState = { disconnectedPlayer: PlayerId | null; reconnectDeadline: number | null };

/**
 * Plazo de reconexión que le toca a ESTE jugador: solo cuenta si el desconectado es él.
 * El plazo del rival (cuando el desconectado es el otro) no debe guardarse: si se guardara, un corte propio
 * posterior heredaría un plazo ya vencido y terminaría la partida al instante.
 */
export function ownReconnectDeadline(state: DeadlineState, player: PlayerId): number {
  return state.disconnectedPlayer === player && state.reconnectDeadline ? state.reconnectDeadline : 0;
}

/** El servidor rechazó crear la sala porque el código ya existe (p. ej. un «create» cancelado que sí llegó). */
export function isRoomCodeTaken(cause: unknown): boolean {
  return cause instanceof Error && /ya está ocupado/i.test(cause.message);
}

/**
 * Numeración de intentos de conexión: cada intento nuevo o cada cancelación invalida los anteriores,
 * y el resultado de un intento solo se aplica si sigue siendo el vigente.
 */
export class ConnectionAttempts {
  private current = 0;

  start(): number {
    this.current += 1;
    return this.current;
  }

  cancel(): void {
    this.current += 1;
  }

  isCurrent(attempt: number): boolean {
    return attempt === this.current;
  }
}
