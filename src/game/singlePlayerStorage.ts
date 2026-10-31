import AsyncStorage from '@react-native-async-storage/async-storage';

import { sanitizeSession, SINGLE_PLAYER_KNOWLEDGE_VERSION, SINGLE_PLAYER_LOG_VERSION } from './singlePlayerSanitize';

// Versiones del registro: viven en el módulo puro de validación (que no carga AsyncStorage) y se reexportan aquí.
export { SINGLE_PLAYER_KNOWLEDGE_VERSION, SINGLE_PLAYER_LOG_VERSION };
export const SINGLE_PLAYER_NATIONAL_KNOWLEDGE_VERSION = 'national-1025-v4';

export type SinglePlayerStoredResult = 'in-progress' | 'won' | 'player-won' | 'rejected' | 'ambiguous' | 'inconsistent' | 'limit-reached' | 'abandoned';

export type SinglePlayerStoredEvent = Readonly<{
  eventId: string;
  questionId: string;
  question: string;
  answer: 'yes' | 'no';
  candidatesBefore: number;
  candidatesAfter: number;
  remainingCandidateIds: readonly number[];
  recordedAt: string;
}>;

export type SinglePlayerSessionRecord = Readonly<{
  sessionId: string;
  schemaVersion: number;
  knowledgeVersion: string;
  catalogId: string;
  startedAt: string;
  finishedAt?: string;
  result: SinglePlayerStoredResult;
  maxQuestions: number;
  questionSelectionSeed: number;
  selectedPokemonId?: number;
  guessedPokemonId?: number;
  rejectedGuessIds: readonly number[];
  questionsAsked: number;
  events: readonly SinglePlayerStoredEvent[];
}>;

export type SinglePlayerLogExport = Readonly<{
  format: 'adivina-pkm-single-player-log';
  formatVersion: number;
  exportedAt: string;
  sessions: readonly SinglePlayerSessionRecord[];
}>;

const STORAGE_KEY = 'adivina-pkm:single-player-log:v1';
const MAX_STORED_SESSIONS = 5000;
let storageWriteQueue: Promise<boolean> = Promise.resolve(true);

export async function readSinglePlayerLog(): Promise<SinglePlayerSessionRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeSession).filter((session): session is SinglePlayerSessionRecord => session !== null);
  } catch {
    return [];
  }
}

/** Guarda de forma idempotente la sesión completa, incluida la partida activa. */
export async function upsertSinglePlayerSession(session: SinglePlayerSessionRecord): Promise<boolean> {
  const write = storageWriteQueue.then(async () => {
    try {
      const current = await readSinglePlayerLog();
      const withoutCurrent = current.filter((item) => item.sessionId !== session.sessionId);
      const next = [...withoutCurrent, session].slice(-MAX_STORED_SESSIONS);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return true;
    } catch {
      return false;
    }
  });
  storageWriteQueue = write.catch(() => false);
  return write;
}

export async function clearSinglePlayerLog(): Promise<void> {
  await storageWriteQueue;
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function exportSinglePlayerLog(): Promise<SinglePlayerLogExport> {
  return {
    format: 'adivina-pkm-single-player-log',
    formatVersion: SINGLE_PLAYER_LOG_VERSION,
    exportedAt: new Date().toISOString(),
    sessions: await readSinglePlayerLog(),
  };
}

export function createSinglePlayerSessionId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `solo-${Date.now().toString(36)}-${random}`;
}

export function createSinglePlayerEventId(sessionId: string, eventIndex: number) {
  return `${sessionId}-q${eventIndex + 1}`;
}
