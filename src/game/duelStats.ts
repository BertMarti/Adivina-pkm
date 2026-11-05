// Estadísticas del Duelo (partidas contra un amigo) a partir del registro local (módulo puro: sin React ni
// almacenamiento) y exportaciones en CSV (Excel en español) y JSON. Lo usa la sección «Estadísticas del Duelo» de Ajustes.
import { GENERATIONS } from '../data/pokemon';
import type { GenerationId } from '../data/pokemon';
import type { PlayerId } from './engine';
import { isPokemonId, MAX_ID_LENGTH } from './singlePlayerSanitize';
import { csvCell } from './singlePlayerStats';
import type { PokemonNameLookup } from './singlePlayerStats';

export type { PokemonNameLookup };

// Cómo acabó un duelo, desde el punto de vista de quien juega en este dispositivo.
export type DuelOutcome = 'win' | 'loss' | 'rival-left' | 'left';

export const DUEL_OUTCOME_LABELS: Readonly<Record<DuelOutcome, string>> = {
  win: 'Victoria',
  loss: 'Derrota',
  'rival-left': 'El rival se fue',
  left: 'Abandonaste',
};

export const DUEL_LOG_VERSION = 1;
export const MAX_DUEL_RECORDS = 2000;
export const MAX_BOARD_SIZE = 1025;
/** Cuántos registros recientes se miran para no apuntar dos veces la misma partida. */
const RECENT_MATCH_WINDOW = 20;

export type DuelRecord = Readonly<{
  /** Único, 1..64 caracteres. */
  id: string;
  /** Identifica la partida (sala, secretos, ganador y descartes) para no contarla dos veces al reconectar. */
  matchKey: string;
  finishedAt: string;
  generation: GenerationId;
  boardSize: number;
  outcome: DuelOutcome;
  mySecretId: number | null;
  /** El servidor nunca lo envía: se sabe al ganar (es la única carta que te queda sin tachar); si no, null. */
  rivalSecretId: number | null;
  /** Pokémon que tachaste. */
  crossedCount: number;
}>;

// Forma mínima del estado de la sala (estructural: así este módulo no depende del cliente de salas).
export type DuelStateLike = Readonly<{
  roomCode: string;
  generation: GenerationId;
  board: readonly Readonly<{ id: number }>[];
  players: Readonly<Record<PlayerId, Readonly<{ secretId: number | null; crossedIds: readonly number[] }>>>;
  winner: PlayerId | null;
}>;

export function isGenerationId(value: unknown): value is GenerationId {
  return value === 'all' || (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 9);
}

export function generationLabel(generation: GenerationId): string {
  return GENERATIONS.find((item) => item.id === generation)?.label ?? `${generation}ª`;
}

/** Hash FNV-1a de 32 bits en base 36 (determinista; no es criptográfico). */
export function shortHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

function opponentOf(player: PlayerId): PlayerId {
  return player === 'p1' ? 'p2' : 'p1';
}

function sortedIds(ids: readonly number[]): string {
  return [...new Set(ids)].sort((a, b) => a - b).join(',');
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

/** Clave de la partida: sala + hash de resultado, secretos, ganador y descartes (ordenados) de los dos jugadores. */
export function duelMatchKey(state: DuelStateLike, me: PlayerId, outcome: DuelOutcome): string {
  const { p1, p2 } = state.players;
  const value = [outcome, me, p1.secretId, p2.secretId, state.winner, sortedIds(p1.crossedIds), sortedIds(p2.crossedIds)].join('|');
  return `${state.roomCode}-${shortHash(value)}`.slice(0, MAX_ID_LENGTH);
}

export function duelRecordFromState(
  state: DuelStateLike,
  me: PlayerId,
  outcome: DuelOutcome,
  now: Date = new Date(),
  random: () => number = Math.random,
): DuelRecord {
  const mine = state.players[me];
  const rival = state.players[opponentOf(me)];
  // El servidor nunca revela el secreto del rival; al ganar es la única carta sin tachar de tu tablero.
  const crossed = new Set(mine.crossedIds);
  const remaining = state.board.filter((pokemon) => !crossed.has(pokemon.id));
  const deduced = outcome === 'win' && remaining.length === 1 ? remaining[0]?.id : undefined;
  const rivalSecretId = isPokemonId(rival.secretId) ? rival.secretId : isPokemonId(deduced) ? deduced : null;
  return {
    id: `duel-${now.getTime().toString(36)}-${random().toString(36).slice(2, 10)}`,
    matchKey: duelMatchKey(state, me, outcome),
    finishedAt: now.toISOString(),
    generation: state.generation,
    boardSize: clampInteger(state.board.length, 1, MAX_BOARD_SIZE),
    outcome,
    mySecretId: isPokemonId(mine.secretId) ? mine.secretId : null,
    rivalSecretId: outcome === 'win' || outcome === 'loss' ? rivalSecretId : null,
    crossedCount: clampInteger(crossed.size, 0, MAX_BOARD_SIZE),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOutcome(value: unknown): value is DuelOutcome {
  return value === 'win' || value === 'loss' || value === 'rival-left' || value === 'left';
}

function isShortString(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= MAX_ID_LENGTH;
}

function isIntegerIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function isOptionalPokemon(value: unknown): value is number | null {
  return value === null || isPokemonId(value);
}

/** Por qué un registro de duelo no vale (en español, corto), o null si es válido. Estricto: no corrige, rechaza. */
export function duelRecordProblem(value: unknown): string | null {
  if (!isRecord(value)) return 'no es una partida';
  if (!isShortString(value.id) || !isShortString(value.matchKey)) return 'identificador no válido';
  if (!isShortString(value.finishedAt) || !Number.isFinite(Date.parse(value.finishedAt))) return 'falta la fecha';
  if (!isGenerationId(value.generation)) return 'generación no válida';
  if (!isIntegerIn(value.boardSize, 1, MAX_BOARD_SIZE)) return 'tamaño de tablero no válido';
  if (!isOutcome(value.outcome)) return 'resultado desconocido';
  if (!isOptionalPokemon(value.mySecretId) || !isOptionalPokemon(value.rivalSecretId)) return 'Pokémon no válido';
  if (!isIntegerIn(value.crossedCount, 0, MAX_BOARD_SIZE)) return 'descartes no válidos';
  return null;
}

/** Registro válido construido campo a campo (sin copiar claves de más), o null si algo no cuadra. */
export function sanitizeDuelRecord(value: unknown): DuelRecord | null {
  if (duelRecordProblem(value) !== null || !isRecord(value)) return null;
  return {
    id: value.id as string,
    matchKey: value.matchKey as string,
    finishedAt: value.finishedAt as string,
    generation: value.generation as GenerationId,
    boardSize: value.boardSize as number,
    outcome: value.outcome as DuelOutcome,
    mySecretId: value.mySecretId as number | null,
    rivalSecretId: value.rivalSecretId as number | null,
    crossedCount: value.crossedCount as number,
  };
}

/** Añade sin duplicar (mismo id, o misma partida entre las últimas) y se queda con los MAX_DUEL_RECORDS más recientes. */
export function appendDuelRecord(records: readonly DuelRecord[], record: DuelRecord): readonly DuelRecord[] {
  if (records.some((item) => item.id === record.id)) return records;
  if (records.slice(-RECENT_MATCH_WINDOW).some((item) => item.matchKey === record.matchKey)) return records;
  return [...records, record].slice(-MAX_DUEL_RECORDS);
}

export type DuelGenerationStats = Readonly<{
  generation: GenerationId;
  label: string;
  /** Victorias + derrotas. */
  played: number;
  wins: number;
  losses: number;
  /** Se fue el rival o abandonaste: no cuentan como victoria ni derrota. */
  unfinished: number;
}>;

export type DuelStats = Readonly<{
  played: number;
  wins: number;
  losses: number;
  rivalLeft: number;
  left: number;
  /** Porcentaje entero de victorias, o null si no hay duelos terminados. */
  winRate: number | null;
  bestWinStreak: number;
  byGeneration: readonly DuelGenerationStats[];
}>;

function uniqueRecords(records: readonly DuelRecord[]): DuelRecord[] {
  const latest = new Map<string, DuelRecord>();
  for (const record of records) latest.set(record.id, record);
  return [...latest.values()];
}

function chronological(records: readonly DuelRecord[]): DuelRecord[] {
  return uniqueRecords(records).sort((a, b) => Date.parse(a.finishedAt) - Date.parse(b.finishedAt));
}

export function computeDuelStats(records: readonly DuelRecord[]): DuelStats {
  const games = chronological(records);
  let wins = 0;
  let losses = 0;
  let rivalLeft = 0;
  let left = 0;
  let streak = 0;
  let bestWinStreak = 0;
  const perGeneration = new Map<GenerationId, { wins: number; losses: number; unfinished: number }>();

  for (const game of games) {
    const current = perGeneration.get(game.generation) ?? { wins: 0, losses: 0, unfinished: 0 };
    if (game.outcome === 'win') {
      wins += 1;
      current.wins += 1;
      streak += 1;
      bestWinStreak = Math.max(bestWinStreak, streak);
    } else if (game.outcome === 'loss') {
      losses += 1;
      current.losses += 1;
      streak = 0;
    } else {
      // Un duelo sin terminar no corta la racha ni la alarga.
      if (game.outcome === 'rival-left') rivalLeft += 1;
      else left += 1;
      current.unfinished += 1;
    }
    perGeneration.set(game.generation, current);
  }

  const byGeneration: DuelGenerationStats[] = [];
  for (const generation of GENERATIONS) {
    const value = perGeneration.get(generation.id);
    if (!value) continue;
    byGeneration.push({
      generation: generation.id,
      label: generation.label,
      played: value.wins + value.losses,
      wins: value.wins,
      losses: value.losses,
      unfinished: value.unfinished,
    });
  }

  const played = wins + losses;
  return {
    played,
    wins,
    losses,
    rivalLeft,
    left,
    winRate: played === 0 ? null : Math.round((wins * 100) / played),
    bestWinStreak,
    byGeneration,
  };
}

function pokemonName(id: number, nameOf: PokemonNameLookup): string {
  return nameOf(id) ?? `#${String(id).padStart(3, '0')}`;
}

/** CSV para Excel en español (BOM, «;», CRLF y celdas protegidas contra fórmulas), en orden cronológico. */
export function duelRecordsToCsv(records: readonly DuelRecord[], nameOf: PokemonNameLookup): string {
  const rows = [
    'fecha;generacion;tablero;resultado;tu_pokemon_id;tu_pokemon;pokemon_rival_id;pokemon_rival;descartes',
    ...chronological(records).map((record) =>
      [
        record.finishedAt,
        generationLabel(record.generation),
        String(record.boardSize),
        DUEL_OUTCOME_LABELS[record.outcome],
        record.mySecretId === null ? '' : String(record.mySecretId),
        record.mySecretId === null ? '' : pokemonName(record.mySecretId, nameOf),
        record.rivalSecretId === null ? '' : String(record.rivalSecretId),
        record.rivalSecretId === null ? '' : pokemonName(record.rivalSecretId, nameOf),
        String(record.crossedCount),
      ]
        .map(csvCell)
        .join(';'),
    ),
  ];
  return `﻿${rows.join('\r\n')}\r\n`;
}

export type DuelStatsExport = Readonly<{
  format: 'adivina-pkm-duel-stats';
  formatVersion: 1;
  exportedAt: string;
  summary: DuelStats;
  games: readonly (DuelRecord & Readonly<{ myPokemon: string | null; rivalPokemon: string | null }>)[];
}>;

export function buildDuelStatsExport(
  records: readonly DuelRecord[],
  nameOf: PokemonNameLookup,
  now: Date = new Date(),
): DuelStatsExport {
  return {
    format: 'adivina-pkm-duel-stats',
    formatVersion: 1,
    exportedAt: now.toISOString(),
    summary: computeDuelStats(records),
    games: chronological(records).map((record) => ({
      ...record,
      myPokemon: record.mySecretId === null ? null : pokemonName(record.mySecretId, nameOf),
      rivalPokemon: record.rivalSecretId === null ? null : pokemonName(record.rivalSecretId, nameOf),
    })),
  };
}
