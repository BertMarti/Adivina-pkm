// Importar estadísticas exportadas en otro dispositivo (módulo puro: sin React ni almacenamiento).
// Validación ESTRICTA: se comprueba todo el archivo antes de tocar nada y, si una sola partida no cuadra, no se importa
// nada. Los objetos se construyen campo a campo (nunca se copian objetos del archivo) y todo se acota en tamaño, porque
// el JSON puede venir de cualquier sitio.
import { isPokemonId, sanitizeSession, SINGLE_PLAYER_KNOWLEDGE_VERSION, SINGLE_PLAYER_LOG_VERSION } from './singlePlayerSanitize';
import type { SoloStatsExport } from './singlePlayerStats';
import type { SinglePlayerSessionRecord, SinglePlayerStoredResult } from './singlePlayerStorage';
import { duelRecordProblem, sanitizeDuelRecord, shortHash } from './duelStats';
import type { DuelRecord, DuelStatsExport } from './duelStats';

export const MAX_IMPORT_BYTES = 2_000_000;
export const MAX_IMPORT_SOLO = 5000; // igual que el historial del Solitario (MAX_STORED_SESSIONS)
export const MAX_IMPORT_DUEL = 2000; // igual que MAX_DUEL_RECORDS
const MAX_QUESTIONS = 200;

const BACKUP_FORMAT = 'adivina-pkm-stats-backup';
const SOLO_STATS_FORMAT = 'adivina-pkm-single-player-stats';
const SOLO_LOG_FORMAT = 'adivina-pkm-single-player-log';
const DUEL_STATS_FORMAT = 'adivina-pkm-duel-stats';

export const IMPORT_ERRORS = {
  empty: 'El archivo está vacío.',
  tooBig: 'El archivo es demasiado grande (más de 2 MB). Usa un JSON exportado desde PokéQuién.',
  notJson: 'No es un JSON válido. Puede que el archivo esté incompleto o no sea una exportación de PokéQuién.',
  foreign: 'Este JSON no es una exportación de estadísticas de PokéQuién. Usa EXPORTAR TODO (JSON) o DESCARGAR JSON en Ajustes.',
  badVersion: 'El archivo no indica una versión válida.',
  newerVersion: 'Este archivo viene de una versión más nueva de PokéQuién. Actualiza la app y vuelve a intentarlo.',
  noList: 'Al archivo le falta la lista de partidas.',
  noGames: 'El archivo no contiene ninguna partida.',
  unreadable: 'No se pudo leer el archivo.',
} as const;

export type StatsFileKind = 'solo-stats' | 'solo-log' | 'duel-stats' | 'backup';

/** solo/duel null: el archivo no trae esa sección (y al importar no se toca). */
export type ParsedStatsFile = Readonly<{
  kind: StatsFileKind;
  exportedAt: string | null;
  solo: readonly SinglePlayerSessionRecord[] | null;
  duel: readonly DuelRecord[] | null;
}>;

export type ParseResult = Readonly<{ ok: true; file: ParsedStatsFile }> | Readonly<{ ok: false; error: string }>;

export type StatsBackupExport = Readonly<{
  format: 'adivina-pkm-stats-backup';
  formatVersion: 1;
  exportedAt: string;
  solitario: SoloStatsExport;
  duelo: DuelStatsExport;
}>;

/** Copia de todo (Solitario + Duelo) para pasarla a otro dispositivo: EXPORTAR TODO (JSON). */
export function buildStatsBackup(solo: SoloStatsExport, duel: DuelStatsExport, now: Date = new Date()): StatsBackupExport {
  return { format: BACKUP_FORMAT, formatVersion: 1, exportedAt: now.toISOString(), solitario: solo, duelo: duel };
}

type Section<T> = Readonly<{ ok: true; items: T[] }> | Readonly<{ ok: false; error: string }>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= 64 && Number.isFinite(Date.parse(value));
}

function isShortString(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= 64;
}

function isIntegerIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

const STORED_RESULTS: readonly SinglePlayerStoredResult[] = [
  'in-progress', 'won', 'player-won', 'rejected', 'ambiguous', 'inconsistent', 'limit-reached', 'abandoned',
];

function isStoredResult(value: unknown): value is SinglePlayerStoredResult {
  return typeof value === 'string' && (STORED_RESULTS as readonly string[]).includes(value);
}

const OUTCOME_RESULTS: Readonly<Record<string, SinglePlayerStoredResult>> = {
  machine: 'won',
  player: 'player-won',
  unresolved: 'ambiguous',
  abandoned: 'abandoned',
  'in-progress': 'abandoned',
};

function outcomeResult(value: unknown): SinglePlayerStoredResult | null {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(OUTCOME_RESULTS, value) ? OUTCOME_RESULTS[value] ?? null : null;
}

/** Comprueba formatVersion: null si vale, o el mensaje de error. */
function versionProblem(root: Record<string, unknown>, supported: number): string | null {
  if (!isIntegerIn(root.formatVersion, 1, Number.MAX_SAFE_INTEGER)) return IMPORT_ERRORS.badVersion;
  if (root.formatVersion > supported) return IMPORT_ERRORS.newerVersion;
  return null;
}

function readList(root: Record<string, unknown>, name: 'games' | 'sessions', max: number, label: string): Section<unknown> {
  const list = root[name];
  if (!Array.isArray(list)) return { ok: false, error: IMPORT_ERRORS.noList };
  if (list.length > max) return { ok: false, error: `El archivo tiene más de ${max} partidas ${label}: no se puede importar.` };
  return { ok: true, items: list };
}

function badGame(index: number, label: string, reason: string): Readonly<{ ok: false; error: string }> {
  return { ok: false, error: `La partida n.º ${index + 1} ${label} no es válida (${reason}). No se ha importado nada.` };
}

/** Una partida importada sin terminar no se puede continuar aquí: cuenta como abandonada. */
function closeInProgress(session: SinglePlayerSessionRecord): SinglePlayerSessionRecord {
  return session.result === 'in-progress' ? { ...session, result: 'abandoned' } : session;
}

/** Partida de DESCARGAR JSON del Solitario (formatVersion 1 o 2) → sesión del historial, o el motivo del rechazo. */
function soloGameToSession(game: unknown, version: number): SinglePlayerSessionRecord | string {
  if (!isPlainObject(game)) return 'no es una partida';
  if (!isDate(game.startedAt)) return 'falta la fecha de inicio';
  if (game.finishedAt !== null && !isDate(game.finishedAt)) return 'fecha de fin no válida';
  if (!isShortString(game.catalogId)) return 'catálogo no válido';
  if (game.pokemonId !== null && !isPokemonId(game.pokemonId)) return 'Pokémon no válido';
  const fromOutcome = outcomeResult(game.outcome);
  if (fromOutcome === null) return 'resultado desconocido';
  if (!isIntegerIn(game.questions, 0, MAX_QUESTIONS)) return 'número de preguntas no válido';

  let sessionId: string;
  let result: SinglePlayerStoredResult;
  let maxQuestions: number;
  let guessedPokemonId: number | null = null;
  let rejectedGuessIds: number[] = [];
  if (version >= 2) {
    if (!isShortString(game.sessionId)) return 'identificador no válido';
    if (!isStoredResult(game.result)) return 'resultado desconocido';
    if (!isIntegerIn(game.maxQuestions, 1, MAX_QUESTIONS)) return 'límite de preguntas no válido';
    if (game.guessedPokemonId !== null && !isPokemonId(game.guessedPokemonId)) return 'Pokémon no válido';
    if (!Array.isArray(game.rejectedGuessIds) || game.rejectedGuessIds.length > MAX_QUESTIONS || !game.rejectedGuessIds.every(isPokemonId)) {
      return 'propuestas rechazadas no válidas';
    }
    sessionId = game.sessionId;
    result = game.result;
    maxQuestions = game.maxQuestions;
    guessedPokemonId = game.guessedPokemonId;
    rejectedGuessIds = game.rejectedGuessIds.slice();
  } else {
    // La versión 1 no guardaba el id de la sesión: se deriva de sus datos (importar dos veces no duplica).
    sessionId = `import-${shortHash([game.startedAt, game.catalogId, game.pokemonId, game.outcome, game.questions].join('|'))}`;
    result = fromOutcome;
    maxQuestions = Math.min(MAX_QUESTIONS, Math.max(30, game.questions));
  }
  if (game.questions > maxQuestions) return 'número de preguntas no válido';

  const session = sanitizeSession({
    sessionId,
    schemaVersion: SINGLE_PLAYER_LOG_VERSION,
    knowledgeVersion: SINGLE_PLAYER_KNOWLEDGE_VERSION,
    catalogId: game.catalogId,
    startedAt: game.startedAt,
    finishedAt: game.finishedAt ?? undefined,
    result,
    maxQuestions,
    questionSelectionSeed: 0,
    selectedPokemonId: game.pokemonId ?? undefined,
    guessedPokemonId: guessedPokemonId ?? undefined,
    rejectedGuessIds,
    questionsAsked: game.questions,
    events: [],
  });
  return session === null ? 'datos incompletos' : closeInProgress(session);
}

function parseSoloStats(root: Record<string, unknown>): Section<SinglePlayerSessionRecord> {
  const problem = versionProblem(root, 2);
  if (problem) return { ok: false, error: problem };
  const list = readList(root, 'games', MAX_IMPORT_SOLO, 'del Solitario');
  if (!list.ok) return list;
  const items: SinglePlayerSessionRecord[] = [];
  for (const [index, game] of list.items.entries()) {
    const session = soloGameToSession(game, root.formatVersion as number);
    if (typeof session === 'string') return badGame(index, 'del Solitario', session);
    items.push(session);
  }
  return { ok: true, items };
}

/** COPIAR JSON del historial del Solitario: sesiones completas. */
function parseSoloLog(root: Record<string, unknown>): Section<SinglePlayerSessionRecord> {
  const problem = versionProblem(root, SINGLE_PLAYER_LOG_VERSION);
  if (problem) return { ok: false, error: problem };
  const list = readList(root, 'sessions', MAX_IMPORT_SOLO, 'del Solitario');
  if (!list.ok) return list;
  const items: SinglePlayerSessionRecord[] = [];
  for (const [index, raw] of list.items.entries()) {
    if (!isPlainObject(raw)) return badGame(index, 'del Solitario', 'no es una partida');
    if (!isShortString(raw.sessionId)) return badGame(index, 'del Solitario', 'identificador no válido');
    if (!isDate(raw.startedAt)) return badGame(index, 'del Solitario', 'falta la fecha de inicio');
    if (!isStoredResult(raw.result)) return badGame(index, 'del Solitario', 'resultado desconocido');
    const session = sanitizeSession(raw);
    if (session === null) return badGame(index, 'del Solitario', 'datos incompletos');
    items.push(closeInProgress(session));
  }
  return { ok: true, items };
}

function parseDuelStats(root: Record<string, unknown>): Section<DuelRecord> {
  const problem = versionProblem(root, 1);
  if (problem) return { ok: false, error: problem };
  const list = readList(root, 'games', MAX_IMPORT_DUEL, 'de Duelo');
  if (!list.ok) return list;
  const items: DuelRecord[] = [];
  for (const [index, game] of list.items.entries()) {
    const record = sanitizeDuelRecord(game);
    if (record === null) return badGame(index, 'del Duelo', duelRecordProblem(game) ?? 'datos incompletos');
    items.push(record);
  }
  return { ok: true, items };
}

/** Quita duplicados dentro del propio archivo: se queda el primero. */
function firstOfEach<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function finish(kind: StatsFileKind, root: Record<string, unknown>, solo: SinglePlayerSessionRecord[] | null, duel: DuelRecord[] | null): ParseResult {
  if ((solo?.length ?? 0) + (duel?.length ?? 0) === 0) return { ok: false, error: IMPORT_ERRORS.noGames };
  return {
    ok: true,
    file: {
      kind,
      exportedAt: isDate(root.exportedAt) ? root.exportedAt : null,
      solo: solo === null ? null : firstOfEach(solo, (session) => session.sessionId),
      duel: duel === null ? null : firstOfEach(duel, (record) => record.id),
    },
  };
}

function parseRoot(root: Record<string, unknown>): ParseResult {
  if (root.format === SOLO_STATS_FORMAT) {
    const solo = parseSoloStats(root);
    return solo.ok ? finish('solo-stats', root, solo.items, null) : solo;
  }
  if (root.format === SOLO_LOG_FORMAT) {
    const solo = parseSoloLog(root);
    return solo.ok ? finish('solo-log', root, solo.items, null) : solo;
  }
  if (root.format === DUEL_STATS_FORMAT) {
    const duel = parseDuelStats(root);
    return duel.ok ? finish('duel-stats', root, null, duel.items) : duel;
  }
  if (root.format === BACKUP_FORMAT) {
    const problem = versionProblem(root, 1);
    if (problem) return { ok: false, error: problem };
    const hasSolo = root.solitario !== undefined && root.solitario !== null;
    const hasDuel = root.duelo !== undefined && root.duelo !== null;
    if (!hasSolo && !hasDuel) return { ok: false, error: IMPORT_ERRORS.noList };
    // Cada sección de la copia es una exportación completa, con su propio formato y versión.
    if (hasSolo && (!isPlainObject(root.solitario) || root.solitario.format !== SOLO_STATS_FORMAT)) return { ok: false, error: IMPORT_ERRORS.foreign };
    if (hasDuel && (!isPlainObject(root.duelo) || root.duelo.format !== DUEL_STATS_FORMAT)) return { ok: false, error: IMPORT_ERRORS.foreign };
    const solo = hasSolo ? parseSoloStats(root.solitario as Record<string, unknown>) : null;
    if (solo && !solo.ok) return solo;
    const duel = hasDuel ? parseDuelStats(root.duelo as Record<string, unknown>) : null;
    if (duel && !duel.ok) return duel;
    return finish('backup', root, solo ? solo.items : null, duel ? duel.items : null);
  }
  return { ok: false, error: IMPORT_ERRORS.foreign };
}

/** Lee y valida el texto de un JSON de estadísticas. Nunca lanza: los errores vuelven en español, listos para mostrar. */
export function parseStatsFile(text: string): ParseResult {
  try {
    if (typeof text !== 'string' || text.trim().length === 0) return { ok: false, error: IMPORT_ERRORS.empty };
    if (text.length > MAX_IMPORT_BYTES) return { ok: false, error: IMPORT_ERRORS.tooBig };
    let parsed: unknown;
    try {
      // Sin el BOM que añaden algunos editores al guardar.
      parsed = JSON.parse(text.replace(/^﻿/, ''));
    } catch {
      return { ok: false, error: IMPORT_ERRORS.notJson };
    }
    if (!isPlainObject(parsed)) return { ok: false, error: IMPORT_ERRORS.foreign };
    return parseRoot(parsed);
  } catch {
    return { ok: false, error: IMPORT_ERRORS.unreadable };
  }
}

export type ImportMode = 'merge' | 'replace';

export type SectionPlan<T> = Readonly<{
  /** Cuántas había en este dispositivo. */
  before: number;
  /** Cuántas trae el archivo. */
  incoming: number;
  /** Cuántas del archivo entran (en reemplazo, todas las que quedan). */
  added: number;
  /** Cuántas del archivo ya estaban (solo al fusionar). */
  duplicates: number;
  /** Cuántas de las más antiguas se quitan para no pasar del límite. */
  dropped: number;
  next: readonly T[];
}>;

export type ImportPlan = Readonly<{
  mode: ImportMode;
  solo: SectionPlan<SinglePlayerSessionRecord> | null;
  duel: SectionPlan<DuelRecord> | null;
}>;

function byDate<T>(items: readonly T[], date: (item: T) => string): T[] {
  // Array.prototype.sort es estable: con la misma fecha se respeta el orden previo.
  return [...items].sort((a, b) => (date(a) < date(b) ? -1 : date(a) > date(b) ? 1 : 0));
}

function planSection<T>(
  current: readonly T[],
  incoming: readonly T[],
  mode: ImportMode,
  max: number,
  date: (item: T) => string,
  keys: readonly ((item: T) => string)[],
): SectionPlan<T> {
  const known = keys.map((key) => new Set(current.map(key)));
  const fresh = mode === 'replace' ? [...incoming] : incoming.filter((item) => keys.every((key, index) => !known[index]?.has(key(item))));
  const combined = byDate(mode === 'replace' ? fresh : [...current, ...fresh], date);
  const next = combined.slice(Math.max(0, combined.length - max));
  const dropped = combined.length - next.length;
  return {
    before: current.length,
    incoming: incoming.length,
    added: mode === 'replace' ? next.length : fresh.length,
    duplicates: mode === 'replace' ? 0 : incoming.length - fresh.length,
    dropped,
    next,
  };
}

/** Qué quedará guardado. Fusionar: lo de aquí + lo nuevo del archivo. Reemplazar: solo lo del archivo (por sección). */
export function planImport(
  current: Readonly<{ solo: readonly SinglePlayerSessionRecord[]; duel: readonly DuelRecord[] }>,
  file: ParsedStatsFile,
  mode: ImportMode,
): ImportPlan {
  return {
    mode,
    solo: file.solo === null
      ? null
      : planSection(current.solo, file.solo, mode, MAX_IMPORT_SOLO, (session) => session.startedAt, [(session) => session.sessionId]),
    duel: file.duel === null
      ? null
      : planSection(current.duel, file.duel, mode, MAX_IMPORT_DUEL, (record) => record.finishedAt, [(record) => record.id, (record) => record.matchKey]),
  };
}

/** «1 partida del Solitario», «3 partidas del Solitario», «1 duelo», «4 duelos». */
export function countLabel(count: number, section: 'solo' | 'duel'): string {
  return section === 'solo'
    ? `${count} ${count === 1 ? 'partida' : 'partidas'} del Solitario`
    : `${count} ${count === 1 ? 'duelo' : 'duelos'}`;
}

function joinParts(parts: readonly string[]): string {
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}

type NamedSection = Readonly<{ name: 'solo' | 'duel'; plan: SectionPlan<unknown> }>;

function sectionsOf(plan: ImportPlan): NamedSection[] {
  const sections: NamedSection[] = [];
  if (plan.solo) sections.push({ name: 'solo', plan: plan.solo });
  if (plan.duel) sections.push({ name: 'duel', plan: plan.duel });
  return sections;
}

function droppedNote(sections: readonly NamedSection[]): string {
  const dropped = sections.reduce((sum, section) => sum + section.plan.dropped, 0);
  return dropped > 0 ? ` Se quitarán las ${dropped} más antiguas para no pasar del límite.` : '';
}

/** Texto de la confirmación, antes de importar. */
export function describeImportPlan(plan: ImportPlan): string {
  const sections = sectionsOf(plan);
  if (plan.mode === 'merge') {
    const adding = sections.filter((section) => section.plan.added > 0);
    if (adding.length === 0) return 'Todas las partidas del archivo ya estaban en este dispositivo: no cambiará nada.';
    const parts = adding.map(({ name, plan: section }) => {
      const repeated = section.duplicates > 0 ? ` (${section.duplicates} ya ${section.duplicates === 1 ? 'estaba' : 'estaban'})` : '';
      return `${countLabel(section.added, name)}${repeated}`;
    });
    const already = sections
      .filter((section) => section.plan.added === 0 && section.plan.incoming > 0)
      .map(({ name, plan: section }) => ` ${countLabel(section.incoming, name)} del archivo ya ${section.incoming === 1 ? 'estaba' : 'estaban'}.`)
      .join('');
    const plural = adding.length > 1 || (adding[0]?.plan.added ?? 0) > 1;
    return `Se ${plural ? 'añadirán' : 'añadirá'} ${joinParts(parts)}.${already} Lo que ya tienes se conserva.${droppedNote(sections)}`;
  }
  const removing = sections.filter((section) => section.plan.before > 0);
  const removed = removing.map(({ name, plan: section }) => countLabel(section.before, name));
  const put = sections.map(({ name, plan: section }) => countLabel(section.next.length, name));
  const putPlural = sections.length > 1 || (sections[0]?.plan.next.length ?? 0) !== 1;
  const putText = `${putPlural ? 'pondrán' : 'pondrá'} ${joinParts(put)} del archivo`;
  if (removing.length === 0) return `Se ${putText}.${droppedNote(sections)}`;
  const removePlural = removing.length > 1 || (removing[0]?.plan.before ?? 0) > 1;
  return `Se ${removePlural ? 'borrarán' : 'borrará'} ${joinParts(removed)} de este dispositivo y se ${putText}. No se puede deshacer.${droppedNote(sections)}`;
}

/** Texto tras importar con éxito. */
export function describeImportResult(plan: ImportPlan): string {
  const sections = sectionsOf(plan);
  if (plan.mode === 'merge') {
    const adding = sections.filter((section) => section.plan.added > 0);
    if (adding.length === 0) return 'Importación hecha. No había nada nuevo.';
    return `Importación hecha. Se han añadido: ${joinParts(adding.map(({ name, plan: section }) => countLabel(section.added, name)))}.`;
  }
  return `Importación hecha. Ahora tienes ${joinParts(sections.map(({ name, plan: section }) => countLabel(section.next.length, name)))} del archivo.`;
}

function localDate(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** «Archivo válido: 12 partidas del Solitario y 4 duelos (exportado el 01/11/2026).» */
export function describeParsedFile(file: ParsedStatsFile): string {
  const parts: string[] = [];
  if (file.solo !== null) parts.push(countLabel(file.solo.length, 'solo'));
  if (file.duel !== null) parts.push(countLabel(file.duel.length, 'duel'));
  const date = file.exportedAt === null ? '' : ` (exportado el ${localDate(file.exportedAt)})`;
  return `Archivo válido: ${joinParts(parts)}${date}.`;
}
