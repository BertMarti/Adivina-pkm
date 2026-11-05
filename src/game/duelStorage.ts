import AsyncStorage from '@react-native-async-storage/async-storage';
import { appendDuelRecord, sanitizeDuelRecord } from './duelStats';
import type { DuelRecord } from './duelStats';

export const DUEL_LOG_STORAGE_KEY = 'adivina-pkm:duel-log:v1';
let duelWriteQueue: Promise<boolean> = Promise.resolve(true);

export async function readDuelLog(): Promise<DuelRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(DUEL_LOG_STORAGE_KEY);
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeDuelRecord).filter((record): record is DuelRecord => record !== null);
  } catch {
    return [];
  }
}
export function runDuelLogExclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = duelWriteQueue.then(task);
  duelWriteQueue = run.then(
    () => true,
    () => false,
  );
  return run;
}
export async function recordDuelResult(record: DuelRecord): Promise<boolean> {
  return runDuelLogExclusive(async () => {
    try {
      const current = await readDuelLog();
      const next = appendDuelRecord(current, record);
      if (next !== current) await AsyncStorage.setItem(DUEL_LOG_STORAGE_KEY, JSON.stringify(next));
      return true;
    } catch {
      return false;
    }
  });
}
export async function clearDuelLog(): Promise<void> {
  await duelWriteQueue;
  await AsyncStorage.removeItem(DUEL_LOG_STORAGE_KEY);
}
