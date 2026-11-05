// Aplicar una importación sobre un almacenamiento clave-valor (módulo puro: el almacenamiento se inyecta, así se
// prueba sin AsyncStorage). Todo o nada: si falla una escritura, se restauran las dos claves a su valor previo.
import { sanitizeDuelRecord } from './duelStats';
import type { DuelRecord } from './duelStats';
import { sanitizeSession } from './singlePlayerSanitize';
import type { SinglePlayerSessionRecord } from './singlePlayerStorage';
import { planImport } from './statsImport';
import type { ImportMode, ImportPlan, ParsedStatsFile } from './statsImport';

export type KeyValueStorage = Readonly<{
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}>;

export type StatsKeys = Readonly<{ solo: string; duel: string }>;

export const APPLY_ERRORS = {
  read: 'No se pudieron leer tus estadísticas actuales: no se ha importado nada.',
  write: 'No se pudo guardar la importación. Tus estadísticas no han cambiado.',
  writeAndRestore:
    'No se pudo guardar la importación y el almacenamiento del navegador no responde: puede que parte se haya guardado. Revisa tus estadísticas y vuelve a importar el archivo.',
} as const;

/** Lista guardada; [] si no hay nada. Si hay algo pero no se puede leer, lanza: importar encima lo borraría. */
function parseStored<T>(raw: string | null, sanitize: (value: unknown) => T | null): T[] {
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(APPLY_ERRORS.read);
  }
  if (!Array.isArray(parsed)) throw new Error(APPLY_ERRORS.read);
  return parsed.map(sanitize).filter((item): item is T => item !== null);
}

async function writeRaw(storage: KeyValueStorage, key: string, value: string | null): Promise<void> {
  if (value === null) await storage.removeItem(key);
  else await storage.setItem(key, value);
}

export async function applyStatsImportWith(
  storage: KeyValueStorage,
  keys: StatsKeys,
  file: ParsedStatsFile,
  mode: ImportMode,
): Promise<ImportPlan> {
  let previousSolo: string | null;
  let previousDuel: string | null;
  try {
    previousSolo = await storage.getItem(keys.solo);
    previousDuel = await storage.getItem(keys.duel);
  } catch {
    throw new Error(APPLY_ERRORS.read);
  }
  // Lo actual se lee del mismo valor que se guardará para restaurar (no de una lectura tolerante que daría []).
  const current = {
    solo: parseStored<SinglePlayerSessionRecord>(previousSolo, sanitizeSession),
    duel: parseStored<DuelRecord>(previousDuel, sanitizeDuelRecord),
  };
  const plan = planImport(current, file, mode);
  try {
    if (plan.solo !== null) await storage.setItem(keys.solo, JSON.stringify(plan.solo.next));
    if (plan.duel !== null) await storage.setItem(keys.duel, JSON.stringify(plan.duel.next));
    return plan;
  } catch {
    // Se restauran las dos claves tal como estaban (aunque solo se llegara a escribir una).
    const restored = await Promise.all([
      writeRaw(storage, keys.solo, previousSolo).then(() => true, () => false),
      writeRaw(storage, keys.duel, previousDuel).then(() => true, () => false),
    ]);
    // Sin almacenamiento disponible no se puede garantizar nada: se dice tal cual, sin prometer lo que no es.
    throw new Error(restored.every(Boolean) ? APPLY_ERRORS.write : APPLY_ERRORS.writeAndRestore);
  }
}
