import AsyncStorage from '@react-native-async-storage/async-storage';

export const SINGLE_PLAYER_LOG_VERSION = 2;
export const SINGLE_PLAYER_KNOWLEDGE_VERSION = 'kanto-151-v4';
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isResult(value: unknown): value is SinglePlayerStoredResult {
  return value === 'in-progress' || value === 'won' || value === 'player-won' || value === 'rejected' || value === 'ambiguous' || value === 'inconsistent' || value === 'limit-reached' || value === 'abandoned';
}

function sanitizeSession(value: unknown): SinglePlayerSessionRecord | null {
  if (!isRecord(value) || typeof value.sessionId !== 'string' || typeof value.startedAt !== 'string' || !isResult(value.result)) return null;
  const events = Array.isArray(value.events) ? value.events.filter((event): event is SinglePlayerStoredEvent => (
    isRecord(event)
    && typeof event.eventId === 'string'
    && typeof event.questionId === 'string'
    && typeof event.question === 'string'
    && (event.answer === 'yes' || event.answer === 'no')
    && typeof event.candidatesBefore === 'number'
    && Number.isFinite(event.candidatesBefore)
    && typeof event.candidatesAfter === 'number'
    && Number.isFinite(event.candidatesAfter)
    && Array.isArray(event.remainingCandidateIds)
    && event.remainingCandidateIds.every((id) => typeof id === 'number' && Number.isInteger(id))
    && typeof event.recordedAt === 'string'
  )) : [];
  return {
    sessionId: value.sessionId,
    schemaVersion: typeof value.schemaVersion === 'number' ? value.schemaVersion : SINGLE_PLAYER_LOG_VERSION,
    knowledgeVersion: typeof value.knowledgeVersion === 'string' ? value.knowledgeVersion : SINGLE_PLAYER_KNOWLEDGE_VERSION,
    catalogId: typeof value.catalogId === 'string' ? value.catalogId : 'kanto',
    startedAt: value.startedAt,
    ...(typeof value.finishedAt === 'string' ? { finishedAt: value.finishedAt } : {}),
    result: value.result,
    maxQuestions: typeof value.maxQuestions === 'number' && Number.isInteger(value.maxQuestions) && value.maxQuestions > 0 ? value.maxQuestions : 30,
    questionSelectionSeed: typeof value.questionSelectionSeed === 'number' && Number.isFinite(value.questionSelectionSeed) ? value.questionSelectionSeed >>> 0 : 0,
    ...(typeof value.selectedPokemonId === 'number' ? { selectedPokemonId: value.selectedPokemonId } : {}),
    ...(typeof value.guessedPokemonId === 'number' ? { guessedPokemonId: value.guessedPokemonId } : {}),
    rejectedGuessIds: Array.isArray(value.rejectedGuessIds) ? value.rejectedGuessIds.filter((id): id is number => typeof id === 'number') : [],
    questionsAsked: typeof value.questionsAsked === 'number' ? value.questionsAsked : events.length,
    events: events.map((event) => ({
      ...event,
      candidatesBefore: Math.max(0, Math.floor(event.candidatesBefore)),
      candidatesAfter: Math.max(0, Math.floor(event.candidatesAfter)),
      remainingCandidateIds: event.remainingCandidateIds.filter((id): id is number => Number.isInteger(id)),
    })),
  };
}

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
