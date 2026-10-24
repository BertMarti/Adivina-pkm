// Utilidades puras del Duelo (sin React Native): códigos de sala, enlaces de invitación y
// diagnóstico del servidor de salas. Se prueban con `tsx --test src/game/roomErrors.test.ts`.

export const ROOM_CODE_LENGTH = 8;
const ROOM_CODE_PATTERN = /^[A-Z2-9]{8}$/;

/** Mayúsculas, solo letras y números del 2 al 9, como mucho 8 caracteres. */
export function normalizeRoomCodeInput(raw: string): string {
  return String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, '')
    .slice(0, ROOM_CODE_LENGTH);
}

/** Devuelve null si el código es válido o un mensaje que explica qué corregir. */
export function validateRoomCode(code: string): string | null {
  const value = String(code ?? '').trim().toUpperCase();
  if (ROOM_CODE_PATTERN.test(value)) return null;
  if (!value) return 'Escribe el código de 8 caracteres que te ha pasado tu rival (o abre su enlace de invitación).';
  if (value.length < ROOM_CODE_LENGTH)
    return `El código tiene 8 caracteres y has escrito ${value.length}. Revísalo o pide a tu rival el enlace de invitación.`;
  return 'El código solo lleva 8 letras o números del 2 al 9. Revísalo o pide a tu rival el enlace de invitación.';
}

/** Lee ?room= (o &room=) de un enlace de invitación. Devuelve '' si no hay un código válido. */
export function roomCodeFromUrl(url: string | null | undefined): string {
  if (!url) return '';
  const match = url.match(/[?&]room=([^&#]*)/i);
  if (!match) return '';
  let raw = match[1];
  try {
    raw = decodeURIComponent(raw);
  } catch {
    return '';
  }
  const code = normalizeRoomCodeInput(raw);
  return validateRoomCode(code) === null ? code : '';
}

export type RoomServerProblem = 'unreachable' | 'origin-rejected';

export function describeServerProblem(kind: RoomServerProblem, origin?: string): string {
  if (kind === 'origin-rejected') {
    const where = origin ? `desde esta web (${origin})` : 'desde esta web';
    return `El servidor de duelos no admite partidas ${where}. Quien lo administra debe añadir esta dirección en ROOM_SERVER_ALLOWED_ORIGINS. Mientras tanto puedes jugar al Solitario.`;
  }
  return 'No hemos podido contactar con el servidor de duelos. Puede que esté despertando (el plan gratuito tarda hasta 1 minuto la primera vez) o que no tengas conexión. Pulsa REINTENTAR en unos segundos o juega al Solitario, que no necesita servidor.';
}

export class RoomServerError extends Error {
  readonly kind: RoomServerProblem;

  constructor(kind: RoomServerProblem, origin?: string) {
    super(describeServerProblem(kind, origin));
    this.name = 'RoomServerError';
    this.kind = kind;
  }
}

export function isRoomServerError(value: unknown): value is RoomServerError {
  return value instanceof RoomServerError || (value instanceof Error && value.name === 'RoomServerError');
}

/**
 * Interpreta la respuesta de GET <servidor>/ :
 * { ok: true, rooms, transports, originAllowed: boolean | null } con CORS abierto.
 * Los servidores antiguos no traen originAllowed → 'ok' si ok === true.
 */
export function interpretHealth(json: unknown): 'ok' | 'origin-rejected' | 'unknown' {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return 'unknown';
  const body = json as { ok?: unknown; originAllowed?: unknown };
  if (body.originAllowed === false) return 'origin-rejected';
  if (body.ok === true) return 'ok';
  return 'unknown';
}
