import AsyncStorage from '@react-native-async-storage/async-storage';
import { readSinglePlayerLog, runSinglePlayerLogExclusive, SINGLE_PLAYER_LOG_STORAGE_KEY } from './singlePlayerStorage';
import { readDuelLog, runDuelLogExclusive, DUEL_LOG_STORAGE_KEY } from './duelStorage';
import { planImport } from './statsImport';
import type { ImportMode, ImportPlan, ParsedStatsFile } from './statsImport';

export async function readRawStatsValue(key: string): Promise<string | null> {
  return AsyncStorage.getItem(key);
}
export async function writeRawStatsValue(key: string, value: string | null): Promise<void> {
  if (value === null) await AsyncStorage.removeItem(key);
  else await AsyncStorage.setItem(key, value);
}
export async function applyStatsImport(file: ParsedStatsFile, mode: ImportMode): Promise<ImportPlan> {
  return runSinglePlayerLogExclusive(() =>
    runDuelLogExclusive(async () => {
      const previousSolo = await readRawStatsValue(SINGLE_PLAYER_LOG_STORAGE_KEY);
      const previousDuel = await readRawStatsValue(DUEL_LOG_STORAGE_KEY);
      const plan = planImport({ solo: await readSinglePlayerLog(), duel: await readDuelLog() }, file, mode);
      try {
        if (plan.solo !== null) await writeRawStatsValue(SINGLE_PLAYER_LOG_STORAGE_KEY, JSON.stringify(plan.solo.next));
        if (plan.duel !== null) await writeRawStatsValue(DUEL_LOG_STORAGE_KEY, JSON.stringify(plan.duel.next));
        return plan;
      } catch {
        try {
          await writeRawStatsValue(SINGLE_PLAYER_LOG_STORAGE_KEY, previousSolo);
          await writeRawStatsValue(DUEL_LOG_STORAGE_KEY, previousDuel);
        } catch {
          /* Se conserva el error de importación para no filtrar detalles del almacenamiento. */
        }
        throw new Error('No se pudo guardar la importación. Tus estadísticas no han cambiado.');
      }
    }),
  );
}
