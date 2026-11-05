// Aplica una importación de estadísticas: dentro de las colas de escritura del Solitario y del Duelo, con
// restauración de los valores previos si falla alguna escritura.
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
        // Se restauran las dos claves tal como estaban (aunque solo se llegara a escribir una).
        const restored = await Promise.all([
          writeRawStatsValue(SINGLE_PLAYER_LOG_STORAGE_KEY, previousSolo).then(() => true, () => false),
          writeRawStatsValue(DUEL_LOG_STORAGE_KEY, previousDuel).then(() => true, () => false),
        ]);
        if (restored.every(Boolean)) throw new Error('No se pudo guardar la importación. Tus estadísticas no han cambiado.');
        // Sin almacenamiento disponible no se puede garantizar nada: se dice tal cual, sin prometer lo que no es.
        throw new Error(
          'No se pudo guardar la importación y el almacenamiento del navegador no responde: puede que parte se haya guardado. Revisa tus estadísticas y vuelve a importar el archivo.',
        );
      }
    }),
  );
}
