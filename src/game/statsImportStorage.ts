// Aplica una importación de estadísticas en AsyncStorage, dentro de las colas de escritura del Solitario y del
// Duelo (para que no se cuele ninguna escritura a medias). La lógica todo o nada está en statsImportApply.ts.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DUEL_LOG_STORAGE_KEY, runDuelLogExclusive } from './duelStorage';
import { runSinglePlayerLogExclusive, SINGLE_PLAYER_LOG_STORAGE_KEY } from './singlePlayerStorage';
import type { ImportMode, ImportPlan, ParsedStatsFile } from './statsImport';
import { applyStatsImportWith } from './statsImportApply';

export function applyStatsImport(file: ParsedStatsFile, mode: ImportMode): Promise<ImportPlan> {
  return runSinglePlayerLogExclusive(() =>
    runDuelLogExclusive(() =>
      applyStatsImportWith(AsyncStorage, { solo: SINGLE_PLAYER_LOG_STORAGE_KEY, duel: DUEL_LOG_STORAGE_KEY }, file, mode),
    ),
  );
}
