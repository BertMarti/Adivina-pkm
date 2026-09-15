import { getPokemonFacts } from './pokemonFacts';
import { NATIONAL_POKEMON_CATALOG } from './pokemonNationalCatalog';

export type GenerationId = 'all' | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type PokemonCandidate = {
  id: number;
  name: string;
  types: string[];
  /** Dominant species colour from PokéAPI; used only for visual yes/no clues. */
  color?: string;
  /** PokéAPI silhouette category; used to phrase broad shape/body clues. */
  shape?: string;
  /** Generation in which the species first appeared; not a national number. */
  generation?: number;
  /** Public evolution-chain metadata used only for generic evolution clues. */
  evolutionStage?: number;
  evolutionStageCount?: number;
  /** Broad natural habitat from PokéAPI, translated for player-facing clues. */
  habitat?: string;
  stage: 0 | 1 | 2;
  stageKnown?: boolean;
  legendary: boolean;
  weightKg: number;
  portraitUrl: string;
  normalUrl: string;
  sadUrl: string;
  fallbackUrl: string;
  description?: string;
  funFact?: string;
  facts?: readonly string[];
};

export const BOARD_SIZE = 25;

export const GENERATIONS: Array<{ id: GenerationId; label: string; start: number; end: number }> = [
  { id: 'all', label: 'Todas', start: 1, end: 1025 },
  { id: 1, label: '1ª · Kanto', start: 1, end: 151 },
  { id: 2, label: '2ª · Johto', start: 152, end: 251 },
  { id: 3, label: '3ª · Hoenn', start: 252, end: 386 },
  { id: 4, label: '4ª · Sinnoh', start: 387, end: 493 },
  { id: 5, label: '5ª · Unova', start: 494, end: 649 },
  { id: 6, label: '6ª · Kalos', start: 650, end: 721 },
  { id: 7, label: '7ª · Alola', start: 722, end: 809 },
  { id: 8, label: '8ª · Galar', start: 810, end: 905 },
  { id: 9, label: '9ª · Paldea', start: 906, end: 1025 },
];

const PORTRAIT_BASE = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait';
const POKEAPI_SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';

const typeNames: Record<string, string> = {
  normal: 'Normal', fire: 'Fuego', water: 'Agua', electric: 'Eléctrico', grass: 'Planta', ice: 'Hielo',
  fighting: 'Lucha', poison: 'Veneno', ground: 'Tierra', flying: 'Volador', psychic: 'Psíquico', bug: 'Bicho',
  rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón', dark: 'Siniestro', steel: 'Acero', fairy: 'Hada',
};

const kantoSeed: Omit<PokemonCandidate, 'portraitUrl' | 'normalUrl' | 'sadUrl' | 'fallbackUrl'>[] = [
  { id: 1, name: 'Bulbasaur', types: ['Planta', 'Veneno'], stage: 0, legendary: false, weightKg: 6.9 },
  { id: 2, name: 'Ivysaur', types: ['Planta', 'Veneno'], stage: 1, legendary: false, weightKg: 13 },
  { id: 3, name: 'Venusaur', types: ['Planta', 'Veneno'], stage: 2, legendary: false, weightKg: 100 },
  { id: 4, name: 'Charmander', types: ['Fuego'], stage: 0, legendary: false, weightKg: 8.5 },
  { id: 5, name: 'Charmeleon', types: ['Fuego'], stage: 1, legendary: false, weightKg: 19 },
  { id: 6, name: 'Charizard', types: ['Fuego', 'Volador'], stage: 2, legendary: false, weightKg: 90.5 },
  { id: 7, name: 'Squirtle', types: ['Agua'], stage: 0, legendary: false, weightKg: 9 },
  { id: 8, name: 'Wartortle', types: ['Agua'], stage: 1, legendary: false, weightKg: 22.5 },
  { id: 9, name: 'Blastoise', types: ['Agua'], stage: 2, legendary: false, weightKg: 85.5 },
  { id: 10, name: 'Caterpie', types: ['Bicho'], stage: 0, legendary: false, weightKg: 2.9 },
  { id: 11, name: 'Metapod', types: ['Bicho'], stage: 1, legendary: false, weightKg: 9.9 },
  { id: 12, name: 'Butterfree', types: ['Bicho', 'Volador'], stage: 2, legendary: false, weightKg: 32 },
  { id: 13, name: 'Weedle', types: ['Bicho', 'Veneno'], stage: 0, legendary: false, weightKg: 3.2 },
  { id: 14, name: 'Kakuna', types: ['Bicho', 'Veneno'], stage: 1, legendary: false, weightKg: 10 },
  { id: 15, name: 'Beedrill', types: ['Bicho', 'Veneno'], stage: 2, legendary: false, weightKg: 29.5 },
  { id: 16, name: 'Pidgey', types: ['Normal', 'Volador'], stage: 0, legendary: false, weightKg: 1.8 },
  { id: 17, name: 'Pidgeotto', types: ['Normal', 'Volador'], stage: 1, legendary: false, weightKg: 30 },
  { id: 18, name: 'Pidgeot', types: ['Normal', 'Volador'], stage: 2, legendary: false, weightKg: 39.5 },
  { id: 19, name: 'Rattata', types: ['Normal'], stage: 0, legendary: false, weightKg: 3.5 },
  { id: 20, name: 'Raticate', types: ['Normal'], stage: 1, legendary: false, weightKg: 18.5 },
  { id: 21, name: 'Spearow', types: ['Normal', 'Volador'], stage: 0, legendary: false, weightKg: 2 },
  { id: 22, name: 'Fearow', types: ['Normal', 'Volador'], stage: 1, legendary: false, weightKg: 38 },
  { id: 23, name: 'Ekans', types: ['Veneno'], stage: 0, legendary: false, weightKg: 6.9 },
  { id: 24, name: 'Arbok', types: ['Veneno'], stage: 1, legendary: false, weightKg: 65 },
  { id: 25, name: 'Pikachu', types: ['Eléctrico'], stage: 1, stageKnown: true, legendary: false, weightKg: 6 },
];

const portraitUrl = (id: number) => `${PORTRAIT_BASE}/${String(id).padStart(4, '0')}/Happy.png`;
const normalUrl = (id: number) => `${PORTRAIT_BASE}/${String(id).padStart(4, '0')}/Normal.png`;
const sadUrl = (id: number) => `${PORTRAIT_BASE}/${String(id).padStart(4, '0')}/Sad.png`;
const fallbackUrl = (id: number) => `${POKEAPI_SPRITE_BASE}/${id}.png`;

function buildDescription(name: string, types: string[]) {
  return `${name} es un Pokémon de tipo ${types.join(' y ').toLowerCase()}.`;
}

function buildFunFact(id: number, weightKg: number) {
  return `Su peso registrado es de ${weightKg.toLocaleString('es-ES')} kg y ocupa el número ${id} de la Pokédex Nacional.`;
}

/**
 * The first generation is fully local (151 candidates), not just the small
 * starter slice used by the original prototype. Every other generation and
 * the national board use the same checked-in catalog below.
 */
export const LOCAL_KANTO_ROSTER: PokemonCandidate[] = NATIONAL_POKEMON_CATALOG
  .filter((pokemon) => pokemon.id <= 151)
  .map((pokemon) => ({ ...pokemon, types: [...pokemon.types] }));

export const LOCAL_NATIONAL_ROSTER: PokemonCandidate[] = NATIONAL_POKEMON_CATALOG
  .map((pokemon) => ({ ...pokemon, types: [...pokemon.types] }));

const rosterCache = new Map<GenerationId, PokemonCandidate[]>();
let nationalRosterCache: PokemonCandidate[] | null = null;

type PokemonApiDetail = {
  id: number;
  name: string;
  types: Array<{ type: { name: string } }>;
  weight: number;
  sprites?: { front_default?: string | null; other?: { 'official-artwork'?: { front_default?: string | null } } };
};

function generationConfig(generation: GenerationId) {
  return GENERATIONS.find((item) => item.id === generation) ?? GENERATIONS[0];
}

function titleCase(value: string) {
  return value.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

const legendaryIds = new Set([
  144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251, 377, 378, 379, 380, 381, 382, 383, 384, 385, 386,
  480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493, 638, 639, 640, 641, 642, 643, 644,
  645, 646, 647, 648, 649, 716, 717, 718, 785, 786, 787, 788, 791, 792, 800, 807, 808, 809, 888, 889, 890,
  891, 892, 894, 895, 896, 897, 898, 905, 1001, 1002, 1003, 1004, 1007, 1008, 1009, 1010, 1014, 1015,
  1016, 1020, 1021, 1022, 1023, 1024, 1025,
]);

export async function loadRoster(generation: GenerationId): Promise<PokemonCandidate[]> {
  const cached = rosterCache.get(generation);
  if (cached) return cached;

  const config = generationConfig(generation);
  const localPool = LOCAL_NATIONAL_ROSTER.filter((pokemon) => pokemon.id >= config.start && pokemon.id <= config.end);
  const roster = (generation === 'all' ? shuffle(localPool) : localPool).slice(0, BOARD_SIZE);
  rosterCache.set(generation, roster);
  return roster;
}

/**
 * Carga la Pokédex Nacional completa en lotes. El modo normal usa Kanto local
 * para arrancar al instante; esta función permite que el modo individual
 * disponga de los 1.025 candidatos sin inflar el bundle con datos duplicados.
 */
export async function loadNationalRoster(onProgress?: (loaded: number, total: number) => void): Promise<PokemonCandidate[]> {
  if (nationalRosterCache) return nationalRosterCache;
  const total = LOCAL_NATIONAL_ROSTER.length;
  for (let loaded = 40; loaded < total; loaded += 40) onProgress?.(loaded, total);
  onProgress?.(total, total);
  nationalRosterCache = LOCAL_NATIONAL_ROSTER;
  return nationalRosterCache;
}
