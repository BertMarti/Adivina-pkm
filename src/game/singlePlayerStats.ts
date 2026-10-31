// Estadísticas del Solitario calculadas a partir del historial local (módulo puro: sin React ni almacenamiento)
// y exportaciones en CSV (Excel en español) y JSON. Lo usa la sección «Estadísticas» de Ajustes.
import type { SinglePlayerSessionRecord, SinglePlayerStoredResult } from './singlePlayerStorage';

// Cómo acabó una partida, desde el punto de vista de quien juega.
export type SoloOutcome = 'machine' | 'player' | 'unresolved' | 'abandoned' | 'in-progress';

export function outcomeOf(result: SinglePlayerStoredResult): SoloOutcome {
  if (result === 'won') return 'machine';
  if (result === 'player-won' || result === 'limit-reached') return 'player';
  if (result === 'abandoned') return 'abandoned';
  if (result === 'in-progress') return 'in-progress';
  return 'unresolved';
}

export const SOLO_OUTCOME_LABELS: Readonly<Record<SoloOutcome, string>> = {
  machine: 'Acierto de la máquina',
  player: 'Victoria tuya',
  unresolved: 'Sin resolver',
  abandoned: 'Abandonada',
  'in-progress': 'Sin terminar',
};

export type HardPokemon = Readonly<{
  pokemonId: number;
  name: string;
  games: number;
  machineMisses: number;
  averageQuestions: number;
}>;

export type SoloStats = Readonly<{
  played: number;
  machineWins: number;
  playerWins: number;
  unresolved: number;
  abandoned: number;
  inProgress: number;
  averageQuestions: number | null;
  averageQuestionsToGuess: number | null;
  hardest: readonly HardPokemon[];
}>;

export type PokemonNameLookup = (pokemonId: number) => string | undefined;

export type SoloStatsExport = Readonly<{
  format: 'adivina-pkm-single-player-stats';
  formatVersion: 1;
  exportedAt: string;
  summary: SoloStats;
  games: readonly Readonly<{
    startedAt: string;
    finishedAt: string | null;
    catalogId: string;
    pokemonId: number | null;
    pokemon: string | null;
    outcome: SoloOutcome;
    questions: number;
    rejectedGuesses: number;
  }>[];
}>;

function uniqueSessions(sessions: readonly SinglePlayerSessionRecord[]): SinglePlayerSessionRecord[] {
  const latest = new Map<string, SinglePlayerSessionRecord>();
  for (const session of sessions) latest.set(session.sessionId, session);
  return [...latest.values()];
}

function questionsOf(session: SinglePlayerSessionRecord): number {
  return Number.isFinite(session.questionsAsked) && session.questionsAsked >= 0 ? session.questionsAsked : 0;
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function pokemonName(id: number, nameOf: PokemonNameLookup): string {
  return nameOf(id) ?? `#${String(id).padStart(3, '0')}`;
}

// Resumen: partidas, victorias, preguntas medias y los Pokémon que más le cuestan a la máquina.
export function computeSoloStats(
  sessions: readonly SinglePlayerSessionRecord[],
  nameOf: PokemonNameLookup,
  limit = 5,
): SoloStats {
  const games = uniqueSessions(sessions);
  let machineWins = 0;
  let playerWins = 0;
  let unresolved = 0;
  let abandoned = 0;
  let inProgress = 0;
  let finishedQuestions = 0;
  let guessedQuestions = 0;
  const hardest = new Map<number, { games: number; machineMisses: number; questions: number }>();

  for (const session of games) {
    const outcome = outcomeOf(session.result);
    const questions = questionsOf(session);
    if (outcome === 'machine') {
      machineWins += 1;
      guessedQuestions += questions;
    } else if (outcome === 'player') {
      playerWins += 1;
    } else if (outcome === 'unresolved') {
      unresolved += 1;
    } else if (outcome === 'abandoned') {
      abandoned += 1;
    } else {
      inProgress += 1;
    }

    if (outcome === 'machine' || outcome === 'player' || outcome === 'unresolved') {
      finishedQuestions += questions;
      const pokemonId = session.selectedPokemonId;
      if (typeof pokemonId === 'number' && Number.isInteger(pokemonId) && pokemonId > 0) {
        const current = hardest.get(pokemonId) ?? { games: 0, machineMisses: 0, questions: 0 };
        current.games += 1;
        if (outcome !== 'machine') current.machineMisses += 1;
        current.questions += questions;
        hardest.set(pokemonId, current);
      }
    }
  }

  const played = machineWins + playerWins + unresolved;
  const hardestList = [...hardest.entries()].map(([pokemonId, value]) => ({
    pokemonId,
    name: pokemonName(pokemonId, nameOf),
    games: value.games,
    machineMisses: value.machineMisses,
    averageQuestions: roundOne(value.questions / value.games),
  })).sort((a, b) => (
    b.machineMisses / b.games - a.machineMisses / a.games
    || b.averageQuestions - a.averageQuestions
    || b.games - a.games
    || a.pokemonId - b.pokemonId
  ));

  return {
    played,
    machineWins,
    playerWins,
    unresolved,
    abandoned,
    inProgress,
    averageQuestions: played === 0 ? null : roundOne(finishedQuestions / played),
    averageQuestionsToGuess: machineWins === 0 ? null : roundOne(guessedQuestions / machineWins),
    hardest: limit <= 0 ? [] : hardestList.slice(0, limit),
  };
}

function sortedSessions(sessions: readonly SinglePlayerSessionRecord[]): SinglePlayerSessionRecord[] {
  return uniqueSessions(sessions).sort((a, b) => a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : 0);
}

function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

// Exporta el historial resumido en CSV compatible con Excel en español.
export function soloSessionsToCsv(
  sessions: readonly SinglePlayerSessionRecord[],
  nameOf: PokemonNameLookup,
): string {
  const rows = [
    'inicio;fin;catalogo;pokemon_id;pokemon;resultado;preguntas;propuestas_rechazadas',
    ...sortedSessions(sessions).map((session) => {
      const hasPokemon = typeof session.selectedPokemonId === 'number';
      return [
        session.startedAt,
        session.finishedAt ?? '',
        session.catalogId,
        hasPokemon ? String(session.selectedPokemonId) : '',
        hasPokemon ? pokemonName(session.selectedPokemonId as number, nameOf) : '',
        SOLO_OUTCOME_LABELS[outcomeOf(session.result)],
        String(questionsOf(session)),
        String(session.rejectedGuessIds.length),
      ].map(csvCell).join(';');
    }),
  ];
  return `\uFEFF${rows.join('\r\n')}\r\n`;
}

// Construye la exportación JSON estable de las estadísticas y sus partidas.
export function buildSoloStatsExport(
  sessions: readonly SinglePlayerSessionRecord[],
  nameOf: PokemonNameLookup,
  now: Date = new Date(),
): SoloStatsExport {
  const games = sortedSessions(sessions).map((session) => {
    const hasPokemon = typeof session.selectedPokemonId === 'number';
    return {
      startedAt: session.startedAt,
      finishedAt: session.finishedAt ?? null,
      catalogId: session.catalogId,
      pokemonId: hasPokemon ? session.selectedPokemonId as number : null,
      pokemon: hasPokemon ? pokemonName(session.selectedPokemonId as number, nameOf) : null,
      outcome: outcomeOf(session.result),
      questions: questionsOf(session),
      rejectedGuesses: session.rejectedGuessIds.length,
    };
  });
  return {
    format: 'adivina-pkm-single-player-stats',
    formatVersion: 1,
    exportedAt: now.toISOString(),
    summary: computeSoloStats(sessions, nameOf),
    games,
  };
}

// Nombre del archivo descargado, con la fecha local: pokequien-estadisticas-AAAA-MM-DD.csv
export function statsFileName(extension: 'csv' | 'json', now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `pokequien-estadisticas-${date}.${extension}`;
}
