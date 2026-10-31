// Validación del historial del Solitario leído del almacenamiento (módulo puro, sin AsyncStorage).
// En la web el origen bertmarti.github.io es compartido: otra web del mismo origen podría escribir esta clave.
// Por eso todo se acota: enteros en rango, ids de la Pokédex Nacional, listas y cadenas con longitud máxima.
import type { SinglePlayerSessionRecord, SinglePlayerStoredEvent, SinglePlayerStoredResult } from './singlePlayerStorage';

export const SINGLE_PLAYER_LOG_VERSION = 2;
export const SINGLE_PLAYER_KNOWLEDGE_VERSION = 'kanto-151-v4';

export const MAX_POKEMON_ID = 1025;
export const MAX_ID_LENGTH = 64;
export const MAX_TEXT_LENGTH = 300;
export const DEFAULT_MAX_QUESTIONS = 30;
const MAX_ALLOWED_QUESTIONS = 200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isResult(value: unknown): value is SinglePlayerStoredResult {
  return value === 'in-progress' || value === 'won' || value === 'player-won' || value === 'rejected' || value === 'ambiguous' || value === 'inconsistent' || value === 'limit-reached' || value === 'abandoned';
}

/** Cadena no vacía de como mucho `max` caracteres. */
function shortString(value: unknown, max = MAX_ID_LENGTH): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

/** Id de Pokémon válido: entero entre 1 y 1025. */
export function isPokemonId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_POKEMON_ID;
}

/** Entero acotado a [min, max]; null si no es un número finito. */
function boundedInteger(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function sanitizeEvent(event: unknown): SinglePlayerStoredEvent | null {
  if (!isRecord(event)) return null;
  if (!shortString(event.eventId) || !shortString(event.questionId) || !shortString(event.question, MAX_TEXT_LENGTH) || !shortString(event.recordedAt)) return null;
  if (event.answer !== 'yes' && event.answer !== 'no') return null;
  const before = boundedInteger(event.candidatesBefore, 0, MAX_POKEMON_ID);
  const after = boundedInteger(event.candidatesAfter, 0, MAX_POKEMON_ID);
  if (before === null || after === null || !Array.isArray(event.remainingCandidateIds)) return null;
  return {
    eventId: event.eventId,
    questionId: event.questionId,
    question: event.question,
    answer: event.answer,
    candidatesBefore: before,
    candidatesAfter: after,
    remainingCandidateIds: event.remainingCandidateIds.slice(0, MAX_POKEMON_ID).filter(isPokemonId),
    recordedAt: event.recordedAt,
  };
}

/** Devuelve la sesión acotada, o null si le falta algo imprescindible (id, inicio o resultado). */
export function sanitizeSession(value: unknown): SinglePlayerSessionRecord | null {
  if (!isRecord(value) || !shortString(value.sessionId) || !shortString(value.startedAt) || !isResult(value.result)) return null;
  const maxQuestions = boundedInteger(value.maxQuestions, 1, MAX_ALLOWED_QUESTIONS) ?? DEFAULT_MAX_QUESTIONS;
  const events = (Array.isArray(value.events) ? value.events.slice(0, maxQuestions) : [])
    .map(sanitizeEvent)
    .filter((event): event is SinglePlayerStoredEvent => event !== null);
  return {
    sessionId: value.sessionId,
    schemaVersion: boundedInteger(value.schemaVersion, 1, 1000) ?? SINGLE_PLAYER_LOG_VERSION,
    knowledgeVersion: shortString(value.knowledgeVersion) ? value.knowledgeVersion : SINGLE_PLAYER_KNOWLEDGE_VERSION,
    catalogId: shortString(value.catalogId) ? value.catalogId : 'kanto',
    startedAt: value.startedAt,
    ...(shortString(value.finishedAt) ? { finishedAt: value.finishedAt } : {}),
    result: value.result,
    maxQuestions,
    questionSelectionSeed: typeof value.questionSelectionSeed === 'number' && Number.isFinite(value.questionSelectionSeed) ? value.questionSelectionSeed >>> 0 : 0,
    ...(isPokemonId(value.selectedPokemonId) ? { selectedPokemonId: value.selectedPokemonId } : {}),
    ...(isPokemonId(value.guessedPokemonId) ? { guessedPokemonId: value.guessedPokemonId } : {}),
    rejectedGuessIds: Array.isArray(value.rejectedGuessIds) ? value.rejectedGuessIds.slice(0, maxQuestions).filter(isPokemonId) : [],
    questionsAsked: boundedInteger(value.questionsAsked, 0, maxQuestions) ?? Math.min(events.length, maxQuestions),
    events,
  };
}
