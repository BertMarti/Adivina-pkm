import { LOCAL_KANTO_ROSTER, loadNationalRoster, PokemonCandidate } from './pokemon';

/**
 * Knowledge model for the single-player guessing mode.
 *
 * The multiplayer board only needs PokemonCandidate. This file deliberately
 * keeps the yes/no knowledge separate, so adding a new catalog does not
 * require changing the game engine or leaking any secret to a server.
 */

export type SinglePlayerAnswer = 'yes' | 'no';

export type SinglePlayerQuestionCategory =
  | 'type'
  | 'evolution'
  | 'appearance'
  | 'dex'
  | 'weight'
  | 'special';

/**
 * Traits are namespaced to keep the data readable and avoid collisions when
 * later generations or regional forms add more facts.
 */
type SinglePlayerTypeId =
  | 'normal'
  | 'fire'
  | 'water'
  | 'electric'
  | 'grass'
  | 'ice'
  | 'fighting'
  | 'poison'
  | 'ground'
  | 'flying'
  | 'psychic'
  | 'bug'
  | 'rock'
  | 'ghost'
  | 'dragon'
  | 'dark'
  | 'steel'
  | 'fairy';

type SinglePlayerAppearanceId =
  | 'plant'
  | 'reptile'
  | 'quadruped'
  | 'hasTail'
  | 'hasSpots'
  | 'hasBulb'
  | 'hasWings'
  | 'hasFlameTail'
  | 'hasClaws'
  | 'dragonLike'
  | 'turtle'
  | 'shell'
  | 'waterCannons'
  | 'insect'
  | 'caterpillar'
  | 'antennae'
  | 'cocoon'
  | 'butterfly'
  | 'bee'
  | 'stinger'
  | 'horn'
  | 'bird'
  | 'predatoryBird'
  | 'rodent'
  | 'fangs'
  | 'snake'
  | 'canCoil'
  | 'hood'
  | 'longEars'
  | 'cheekPouches';

export type SinglePlayerTraitKey =
  | `type.${SinglePlayerTypeId}`
  | 'type.dual'
  | 'evolution.base'
  | 'evolution.hasPrevious'
  | 'evolution.canEvolve'
  | 'evolution.final'
  | 'evolution.hasMultipleStages'
  | 'special.legendary'
  | 'special.starter'
  | 'special.mascot'
  | `appearance.${SinglePlayerAppearanceId}`
  | `dex.lte.${number}`
  | `dex.gte.${number}`
  | `weight.lte.${number}`
  | `weight.gte.${number}`
  | `line.${string}`;

export type SinglePlayerQuestion = Readonly<{
  id: string;
  trait: SinglePlayerTraitKey;
  prompt: string;
  category: SinglePlayerQuestionCategory;
  /** Used only as a deterministic tie-breaker after information gain. */
  priority: number;
  yesLabel: 'Sí';
  noLabel: 'No';
}>;

export type SinglePlayerPokemonKnowledge = Readonly<{
  candidate: PokemonCandidate;
  /** National generation; kept numeric so later catalogs can use the same model. */
  generation: number;
  dexNumber: number;
  traits: Readonly<Partial<Record<SinglePlayerTraitKey, boolean>>>;
  aliases: readonly string[];
  shortFacts: readonly string[];
}>;

export type SinglePlayerKnowledgeCatalog = Readonly<{
  id: string;
  label: string;
  candidates: readonly PokemonCandidate[];
  knowledge: readonly SinglePlayerPokemonKnowledge[];
}>;

const TYPE_TRAIT_BY_NAME: Readonly<Record<string, SinglePlayerTraitKey>> = {
  Normal: 'type.normal',
  Fuego: 'type.fire',
  Agua: 'type.water',
  Eléctrico: 'type.electric',
  Planta: 'type.grass',
  Hielo: 'type.ice',
  Lucha: 'type.fighting',
  Veneno: 'type.poison',
  Tierra: 'type.ground',
  Volador: 'type.flying',
  Psíquico: 'type.psychic',
  Bicho: 'type.bug',
  Roca: 'type.rock',
  Fantasma: 'type.ghost',
  Dragón: 'type.dragon',
  Siniestro: 'type.dark',
  Acero: 'type.steel',
  Hada: 'type.fairy',
};

export const SINGLE_PLAYER_KANTO_EVOLUTION_LINES = [
  { id: 'bulbasaur', label: 'Bulbasaur', memberIds: [1, 2, 3] },
  { id: 'charmander', label: 'Charmander', memberIds: [4, 5, 6] },
  { id: 'squirtle', label: 'Squirtle', memberIds: [7, 8, 9] },
  { id: 'caterpie', label: 'Caterpie', memberIds: [10, 11, 12] },
  { id: 'weedle', label: 'Weedle', memberIds: [13, 14, 15] },
  { id: 'pidgey', label: 'Pidgey', memberIds: [16, 17, 18] },
  { id: 'rattata', label: 'Rattata', memberIds: [19, 20] },
  { id: 'spearow', label: 'Spearow', memberIds: [21, 22] },
  { id: 'ekans', label: 'Ekans', memberIds: [23, 24] },
  { id: 'pikachu', label: 'Pikachu', memberIds: [25, 26] },
] as const;

type SinglePlayerLineId = typeof SINGLE_PLAYER_KANTO_EVOLUTION_LINES[number]['id'];

const KANTO_LINE_BY_ID: Readonly<Record<number, SinglePlayerLineId>> = {
  1: 'bulbasaur', 2: 'bulbasaur', 3: 'bulbasaur',
  4: 'charmander', 5: 'charmander', 6: 'charmander',
  7: 'squirtle', 8: 'squirtle', 9: 'squirtle',
  10: 'caterpie', 11: 'caterpie', 12: 'caterpie',
  13: 'weedle', 14: 'weedle', 15: 'weedle',
  16: 'pidgey', 17: 'pidgey', 18: 'pidgey',
  19: 'rattata', 20: 'rattata',
  21: 'spearow', 22: 'spearow',
  23: 'ekans', 24: 'ekans',
  25: 'pikachu',
};

const KANTO_FINAL_IDS = new Set([3, 6, 9, 12, 15, 18, 20, 22, 24]);
const KANTO_MULTI_STAGE_LINE_IDS = new Set<SinglePlayerLineId>([
  'bulbasaur', 'charmander', 'squirtle', 'caterpie', 'weedle', 'pidgey', 'pikachu',
]);

/**
 * Manual visual/species facts are kept in one table. A new Pokémon can be
 * added by supplying its candidate and a list of positive traits here; all
 * question filtering and ranking remains generic.
 */
const KANTO_SEMANTIC_TRAITS: Readonly<Record<number, readonly SinglePlayerTraitKey[]>> = {
  1: ['special.starter', 'appearance.plant', 'appearance.quadruped', 'appearance.hasTail', 'appearance.hasSpots', 'appearance.hasBulb', 'line.bulbasaur'],
  2: ['appearance.plant', 'appearance.quadruped', 'appearance.hasTail', 'appearance.hasSpots', 'appearance.hasBulb', 'line.bulbasaur'],
  3: ['appearance.plant', 'appearance.quadruped', 'appearance.hasTail', 'appearance.hasSpots', 'appearance.hasBulb', 'line.bulbasaur'],
  4: ['special.starter', 'appearance.reptile', 'appearance.quadruped', 'appearance.hasTail', 'appearance.hasFlameTail', 'appearance.hasClaws', 'line.charmander'],
  5: ['appearance.reptile', 'appearance.quadruped', 'appearance.hasTail', 'appearance.hasFlameTail', 'appearance.hasClaws', 'line.charmander'],
  6: ['appearance.reptile', 'appearance.quadruped', 'appearance.hasTail', 'appearance.hasFlameTail', 'appearance.hasClaws', 'appearance.hasWings', 'appearance.dragonLike', 'line.charmander'],
  7: ['special.starter', 'appearance.reptile', 'appearance.quadruped', 'appearance.turtle', 'appearance.shell', 'appearance.hasTail', 'line.squirtle'],
  8: ['appearance.reptile', 'appearance.quadruped', 'appearance.turtle', 'appearance.shell', 'appearance.hasTail', 'line.squirtle'],
  9: ['appearance.reptile', 'appearance.quadruped', 'appearance.turtle', 'appearance.shell', 'appearance.hasTail', 'appearance.waterCannons', 'line.squirtle'],
  10: ['appearance.insect', 'appearance.caterpillar', 'appearance.antennae', 'line.caterpie'],
  11: ['appearance.insect', 'appearance.cocoon', 'line.caterpie'],
  12: ['appearance.insect', 'appearance.butterfly', 'appearance.antennae', 'appearance.hasWings', 'line.caterpie'],
  13: ['appearance.insect', 'appearance.caterpillar', 'appearance.antennae', 'appearance.stinger', 'appearance.horn', 'line.weedle'],
  14: ['appearance.insect', 'appearance.cocoon', 'appearance.stinger', 'appearance.horn', 'line.weedle'],
  15: ['appearance.insect', 'appearance.bee', 'appearance.antennae', 'appearance.hasWings', 'appearance.stinger', 'appearance.horn', 'line.weedle'],
  16: ['appearance.bird', 'appearance.hasWings', 'appearance.hasTail', 'line.pidgey'],
  17: ['appearance.bird', 'appearance.hasWings', 'appearance.hasTail', 'line.pidgey'],
  18: ['appearance.bird', 'appearance.predatoryBird', 'appearance.hasWings', 'appearance.hasTail', 'line.pidgey'],
  19: ['appearance.rodent', 'appearance.hasTail', 'appearance.fangs', 'line.rattata'],
  20: ['appearance.rodent', 'appearance.hasTail', 'appearance.fangs', 'line.rattata'],
  21: ['appearance.bird', 'appearance.predatoryBird', 'appearance.hasWings', 'appearance.hasTail', 'line.spearow'],
  22: ['appearance.bird', 'appearance.predatoryBird', 'appearance.hasWings', 'appearance.hasTail', 'line.spearow'],
  23: ['appearance.reptile', 'appearance.snake', 'appearance.canCoil', 'appearance.fangs', 'line.ekans'],
  24: ['appearance.reptile', 'appearance.snake', 'appearance.canCoil', 'appearance.fangs', 'appearance.hood', 'line.ekans'],
  25: ['special.mascot', 'appearance.rodent', 'appearance.hasTail', 'appearance.longEars', 'appearance.cheekPouches', 'line.pikachu'],
};

const KANTO_SHORT_FACTS: Readonly<Record<number, readonly string[]>> = {
  1: ['Nace con una semilla plantada en el lomo.', 'La semilla crece junto a él durante toda su vida.'],
  2: ['La flor de su lomo se prepara para abrirse.', 'Necesita absorber luz solar para evolucionar.'],
  3: ['La flor gigante de su lomo absorbe energía solar.', 'Puede liberar un aroma que calma a otros Pokémon.'],
  4: ['La llama de su cola refleja su estado vital.', 'Prefiere los lugares cálidos.'],
  5: ['Su llama se vuelve más intensa al emocionarse.', 'Es más agresivo que Charmander.'],
  6: ['Sus alas le permiten surcar los cielos.', 'Expulsa llamas capaces de fundir grandes rocas.'],
  7: ['Puede ocultarse dentro de su caparazón.', 'Lanza agua a presión desde su boca.'],
  8: ['Sus orejas y su cola le ayudan a nadar.', 'Se protege cerrando su caparazón.'],
  9: ['Sus cañones de agua están integrados en el caparazón.', 'Puede disparar chorros muy potentes.'],
  10: ['Su antena libera un olor defensivo.', 'Come hojas de forma casi constante.'],
  11: ['Su caparazón es muy duro.', 'Mientras evoluciona apenas puede moverse.'],
  12: ['Sus alas están cubiertas de escamas.', 'Es un gran recolector de néctar y polen.'],
  13: ['Su cuerno contiene veneno.', 'Las antenas le ayudan a orientarse.'],
  14: ['Permanece casi inmóvil mientras cambia de forma.', 'Su caparazón se endurece durante la evolución.'],
  15: ['Sus aguijones de brazos y abdomen son venenosos.', 'Suele proteger su territorio en enjambre.'],
  16: ['Es un Pokémon ave muy común en Kanto.', 'Tiene un sentido de la orientación excepcional.'],
  17: ['Defiende con firmeza su territorio.', 'Sus garras son más fuertes que las de Pidgey.'],
  18: ['Puede volar a gran altura.', 'Sus plumas tienen colores muy llamativos.'],
  19: ['Sus incisivos crecen continuamente.', 'Necesita roer objetos para desgastarlos.'],
  20: ['Sus patas palmeadas le permiten nadar.', 'Sus bigotes le ayudan a orientarse en el agua.'],
  21: ['Es ruidoso y de temperamento agresivo.', 'Puede recorrer grandes distancias volando.'],
  22: ['Tiene un pico y un cuello muy largos.', 'Su resistencia le permite volar durante mucho tiempo.'],
  23: ['Se desplaza silenciosamente por la hierba.', 'Puede enrollarse alrededor de sus presas.'],
  24: ['Su capucha muestra patrones intimidantes.', 'Usa su cuerpo para constreñir a sus rivales.'],
  25: ['Almacena electricidad en las bolsas de sus mejillas.', 'Es el Pokémon más conocido de la franquicia.'],
};

/** The current playable single-player catalog: the same 25 local Kanto candidates as multiplayer. */
export const SINGLE_PLAYER_KANTO_CANDIDATES: readonly PokemonCandidate[] = Object.freeze(
  LOCAL_KANTO_ROSTER.map((candidate) => ({ ...candidate, types: [...candidate.types] })),
);

function makeQuestion(
  id: string,
  trait: SinglePlayerTraitKey,
  prompt: string,
  category: SinglePlayerQuestionCategory,
  priority = 1,
): SinglePlayerQuestion {
  return { id, trait, prompt, category, priority, yesLabel: 'Sí', noLabel: 'No' };
}

const CORE_QUESTIONS: readonly SinglePlayerQuestion[] = [
  makeQuestion('type.normal', 'type.normal', '¿Es de tipo Normal?', 'type', 2),
  makeQuestion('type.fire', 'type.fire', '¿Es de tipo Fuego?', 'type', 2),
  makeQuestion('type.water', 'type.water', '¿Es de tipo Agua?', 'type', 2),
  makeQuestion('type.electric', 'type.electric', '¿Es de tipo Eléctrico?', 'type', 2),
  makeQuestion('type.grass', 'type.grass', '¿Es de tipo Planta?', 'type', 2),
  makeQuestion('type.poison', 'type.poison', '¿Es de tipo Veneno?', 'type', 2),
  makeQuestion('type.bug', 'type.bug', '¿Es de tipo Bicho?', 'type', 2),
  makeQuestion('type.flying', 'type.flying', '¿Es de tipo Volador?', 'type', 2),
  makeQuestion('type.dual', 'type.dual', '¿Tiene dos tipos?', 'type', 2),

  makeQuestion('evolution.base', 'evolution.base', '¿Está en su forma básica?', 'evolution', 2),
  makeQuestion('evolution.hasPrevious', 'evolution.hasPrevious', '¿Ha evolucionado desde otro Pokémon?', 'evolution', 2),
  makeQuestion('evolution.canEvolve', 'evolution.canEvolve', '¿Puede evolucionar a otro Pokémon?', 'evolution', 2),
  makeQuestion('evolution.final', 'evolution.final', '¿Es la última fase de su línea evolutiva?', 'evolution', 2),
  makeQuestion('evolution.hasMultipleStages', 'evolution.hasMultipleStages', '¿Pertenece a una línea de tres fases?', 'evolution', 1),

  makeQuestion('special.legendary', 'special.legendary', '¿Es legendario?', 'special', 1),
  makeQuestion('special.starter', 'special.starter', '¿Es uno de los Pokémon iniciales de Kanto?', 'special', 2),
  makeQuestion('special.mascot', 'special.mascot', '¿Es la mascota más reconocible de la saga?', 'special', 1),

  makeQuestion('appearance.plant', 'appearance.plant', '¿Tiene aspecto de planta?', 'appearance'),
  makeQuestion('appearance.reptile', 'appearance.reptile', '¿Tiene aspecto de reptil?', 'appearance'),
  makeQuestion('appearance.quadruped', 'appearance.quadruped', '¿Camina sobre cuatro patas?', 'appearance'),
  makeQuestion('appearance.hasTail', 'appearance.hasTail', '¿Tiene cola?', 'appearance'),
  makeQuestion('appearance.hasSpots', 'appearance.hasSpots', '¿Tiene manchas visibles?', 'appearance'),
  makeQuestion('appearance.hasBulb', 'appearance.hasBulb', '¿Lleva un bulbo o una gran planta en el lomo?', 'appearance'),
  makeQuestion('appearance.hasWings', 'appearance.hasWings', '¿Tiene alas?', 'appearance'),
  makeQuestion('appearance.hasFlameTail', 'appearance.hasFlameTail', '¿Tiene una llama en la cola?', 'appearance'),
  makeQuestion('appearance.hasClaws', 'appearance.hasClaws', '¿Tiene garras destacadas?', 'appearance'),
  makeQuestion('appearance.dragonLike', 'appearance.dragonLike', '¿Tiene aspecto de dragón?', 'appearance'),
  makeQuestion('appearance.turtle', 'appearance.turtle', '¿Tiene aspecto de tortuga?', 'appearance'),
  makeQuestion('appearance.shell', 'appearance.shell', '¿Tiene caparazón?', 'appearance'),
  makeQuestion('appearance.waterCannons', 'appearance.waterCannons', '¿Tiene cañones de agua?', 'appearance'),
  makeQuestion('appearance.insect', 'appearance.insect', '¿Tiene aspecto de insecto?', 'appearance'),
  makeQuestion('appearance.caterpillar', 'appearance.caterpillar', '¿Tiene aspecto de oruga?', 'appearance'),
  makeQuestion('appearance.antennae', 'appearance.antennae', '¿Tiene antenas?', 'appearance'),
  makeQuestion('appearance.cocoon', 'appearance.cocoon', '¿Tiene aspecto de capullo?', 'appearance'),
  makeQuestion('appearance.butterfly', 'appearance.butterfly', '¿Tiene aspecto de mariposa?', 'appearance'),
  makeQuestion('appearance.bee', 'appearance.bee', '¿Tiene aspecto de abeja?', 'appearance'),
  makeQuestion('appearance.stinger', 'appearance.stinger', '¿Tiene aguijón?', 'appearance'),
  makeQuestion('appearance.horn', 'appearance.horn', '¿Tiene un cuerno visible?', 'appearance'),
  makeQuestion('appearance.bird', 'appearance.bird', '¿Tiene aspecto de ave?', 'appearance'),
  makeQuestion('appearance.predatoryBird', 'appearance.predatoryBird', '¿Tiene aspecto de ave rapaz?', 'appearance'),
  makeQuestion('appearance.rodent', 'appearance.rodent', '¿Tiene aspecto de roedor?', 'appearance'),
  makeQuestion('appearance.fangs', 'appearance.fangs', '¿Tiene colmillos destacados?', 'appearance'),
  makeQuestion('appearance.snake', 'appearance.snake', '¿Tiene aspecto de serpiente?', 'appearance'),
  makeQuestion('appearance.canCoil', 'appearance.canCoil', '¿Puede enrollar su cuerpo?', 'appearance'),
  makeQuestion('appearance.hood', 'appearance.hood', '¿Tiene una capucha o dibujo de capucha?', 'appearance'),
  makeQuestion('appearance.longEars', 'appearance.longEars', '¿Tiene orejas largas y puntiagudas?', 'appearance'),
  makeQuestion('appearance.cheekPouches', 'appearance.cheekPouches', '¿Tiene bolsas en las mejillas?', 'appearance'),
];

const LINE_QUESTIONS: readonly SinglePlayerQuestion[] = SINGLE_PLAYER_KANTO_EVOLUTION_LINES.map((line) => (
  makeQuestion(
    `line.${line.id}`,
    `line.${line.id}`,
    `¿Pertenece a la línea evolutiva de ${line.label}?`,
    'evolution',
    1,
  )
));

const KANTO_DEX_CUTOFFS = Array.from({ length: 24 }, (_, index) => index + 1);
const KANTO_WEIGHT_CUTOFFS = [3, 5, 10, 20, 40, 70, 90] as const;

const KANTO_DEX_QUESTIONS: readonly SinglePlayerQuestion[] = KANTO_DEX_CUTOFFS.map((cutoff) => (
  makeQuestion(
    `dex.lte.${cutoff}`,
    `dex.lte.${cutoff}`,
    `¿Su número de Pokédex Nacional es ${cutoff} o menor?`,
    'dex',
    0,
  )
));

const KANTO_WEIGHT_QUESTIONS: readonly SinglePlayerQuestion[] = KANTO_WEIGHT_CUTOFFS.flatMap((cutoff) => [
  makeQuestion(
    `weight.lte.${cutoff}`,
    `weight.lte.${cutoff}`,
    `¿Pesa ${cutoff} kg o menos?`,
    'weight',
    0,
  ),
  makeQuestion(
    `weight.gte.${cutoff}`,
    `weight.gte.${cutoff}`,
    `¿Pesa ${cutoff} kg o más?`,
    'weight',
    0,
  ),
]);

/**
 * The initial Kanto bank contains semantic questions plus exact binary-search
 * cut-offs. The cut-offs guarantee that all 25 current candidates can be
 * distinguished even when two Pokémon share type, body shape and stage.
 */
export const SINGLE_PLAYER_QUESTION_BANK: readonly SinglePlayerQuestion[] = Object.freeze([
  ...CORE_QUESTIONS,
  ...LINE_QUESTIONS,
  ...KANTO_DEX_QUESTIONS,
  ...KANTO_WEIGHT_QUESTIONS,
]);

function addTrait(
  traits: Partial<Record<SinglePlayerTraitKey, boolean>>,
  trait: SinglePlayerTraitKey,
) {
  traits[trait] = true;
}

function buildTraits(candidate: PokemonCandidate, semanticTraits: readonly SinglePlayerTraitKey[]) {
  const traits: Partial<Record<SinglePlayerTraitKey, boolean>> = {};

  semanticTraits.forEach((trait) => addTrait(traits, trait));
  candidate.types.forEach((type) => {
    const trait = TYPE_TRAIT_BY_NAME[type];
    if (trait) addTrait(traits, trait);
  });

  const lineId = KANTO_LINE_BY_ID[candidate.id];
  const isFinal = KANTO_FINAL_IDS.has(candidate.id);

  traits['type.dual'] = candidate.types.length > 1;
  traits['evolution.base'] = candidate.stage === 0;
  traits['evolution.hasPrevious'] = candidate.stage > 0;
  traits['evolution.final'] = isFinal;
  traits['evolution.canEvolve'] = !isFinal;
  traits['evolution.hasMultipleStages'] = lineId ? KANTO_MULTI_STAGE_LINE_IDS.has(lineId) : false;
  traits['special.legendary'] = candidate.legendary;

  // Keep the local Kanto thresholds materialized and also support a future
  // candidate whose national number is outside the current 1..25 catalog.
  const dexCutoffLimit = Math.max(candidate.id, KANTO_DEX_CUTOFFS[KANTO_DEX_CUTOFFS.length - 1]);
  for (let cutoff = 1; cutoff <= dexCutoffLimit; cutoff += 1) {
    traits[`dex.lte.${cutoff}`] = candidate.id <= cutoff;
  }

  for (const cutoff of KANTO_WEIGHT_CUTOFFS) {
    traits[`weight.lte.${cutoff}`] = candidate.weightKg <= cutoff;
    traits[`weight.gte.${cutoff}`] = candidate.weightKg >= cutoff;
  }

  return traits;
}

export function createSinglePlayerKnowledgeRecord(
  candidate: PokemonCandidate,
  semanticTraits: readonly SinglePlayerTraitKey[] = [],
  shortFacts: readonly string[] = [],
  generation = 1,
): SinglePlayerPokemonKnowledge {
  return {
    candidate,
    generation,
    dexNumber: candidate.id,
    traits: buildTraits(candidate, semanticTraits),
    aliases: [candidate.name.toLocaleLowerCase('es-ES')],
    shortFacts,
  };
}

export const SINGLE_PLAYER_KANTO_KNOWLEDGE: readonly SinglePlayerPokemonKnowledge[] = Object.freeze(
  SINGLE_PLAYER_KANTO_CANDIDATES.map((candidate) => createSinglePlayerKnowledgeRecord(
    candidate,
    KANTO_SEMANTIC_TRAITS[candidate.id] ?? [],
    candidate.facts ?? KANTO_SHORT_FACTS[candidate.id] ?? [],
  )),
);

export const SINGLE_PLAYER_KANTO_CATALOG: SinglePlayerKnowledgeCatalog = Object.freeze({
  id: 'kanto',
  label: 'Kanto · 25 candidatos',
  candidates: SINGLE_PLAYER_KANTO_CANDIDATES,
  knowledge: SINGLE_PLAYER_KANTO_KNOWLEDGE,
});

/** A registry makes future catalogs discoverable without changing the engine API. */
export const SINGLE_PLAYER_KNOWLEDGE_CATALOGS: readonly SinglePlayerKnowledgeCatalog[] = Object.freeze([
  SINGLE_PLAYER_KANTO_CATALOG,
]);

export function getSinglePlayerCatalog(catalogId = 'kanto') {
  return SINGLE_PLAYER_KNOWLEDGE_CATALOGS.find((catalog) => catalog.id === catalogId) ?? SINGLE_PLAYER_KANTO_CATALOG;
}

export function getKnowledgeById(
  id: number,
  pool: readonly SinglePlayerPokemonKnowledge[] = SINGLE_PLAYER_KANTO_KNOWLEDGE,
) {
  return pool.find((entry) => entry.candidate.id === id);
}

export function getQuestionById(questionId: string) {
  return SINGLE_PLAYER_QUESTION_BANK.find((question) => question.id === questionId);
}

export function hasSinglePlayerTrait(
  entry: SinglePlayerPokemonKnowledge,
  trait: SinglePlayerTraitKey,
) {
  return entry.traits[trait] === true;
}

/**
 * Filters a working candidate set after a player's Sí/No response. Unknown
 * traits are treated as false, so an incomplete future record is safe to use
 * while its knowledge is being filled in.
 */
export function filterBySinglePlayerAnswer(
  pool: readonly SinglePlayerPokemonKnowledge[],
  question: SinglePlayerQuestion | string,
  answer: SinglePlayerAnswer | boolean,
) {
  const resolvedQuestion = typeof question === 'string' ? getQuestionById(question) : question;
  if (!resolvedQuestion) return [...pool];

  const expectsTrait = answer === true || answer === 'yes';
  return pool.filter((entry) => hasSinglePlayerTrait(entry, resolvedQuestion.trait) === expectsTrait);
}

/**
 * Selects the next unanswered question with the highest binary information
 * gain. This is deliberately a pure helper: the UI can store the question
 * history wherever it needs, while the knowledge layer stays deterministic.
 */
export function chooseBestSinglePlayerQuestion(
  pool: readonly SinglePlayerPokemonKnowledge[],
  askedQuestionIds: ReadonlySet<string> = new Set<string>(),
  questionBank: readonly SinglePlayerQuestion[] = SINGLE_PLAYER_QUESTION_BANK,
) {
  if (pool.length < 2) return null;

  let bestQuestion: SinglePlayerQuestion | null = null;
  let bestScore = -1;

  for (const question of questionBank) {
    if (askedQuestionIds.has(question.id)) continue;

    const yesCount = pool.reduce(
      (count, entry) => count + (hasSinglePlayerTrait(entry, question.trait) ? 1 : 0),
      0,
    );
    const noCount = pool.length - yesCount;
    if (yesCount === 0 || noCount === 0) continue;

    const yesProbability = yesCount / pool.length;
    const noProbability = noCount / pool.length;
    const entropy = -(yesProbability * Math.log2(yesProbability) + noProbability * Math.log2(noProbability));
    const score = entropy * 100 + question.priority;

    if (score > bestScore) {
      bestQuestion = question;
      bestScore = score;
    }
  }

  return bestQuestion;
}

/**
 * Creates National Dex threshold questions for a future catalog. The current
 * bank only materializes 1..24 because the shipped local catalog is Kanto;
 * no motor change is needed to use this helper for a larger Pokédex.
 */
export function createDexThresholdQuestions(maxDexNumber: number): SinglePlayerQuestion[] {
  const max = Math.max(1, Math.floor(maxDexNumber));
  return Array.from({ length: Math.max(0, max - 1) }, (_, index) => {
    const cutoff = index + 1;
    return makeQuestion(
      `dex.lte.${cutoff}`,
      `dex.lte.${cutoff}`,
      `¿Su número de Pokédex Nacional es ${cutoff} o menor?`,
      'dex',
      0,
    );
  });
}

const NATIONAL_TYPE_QUESTIONS: readonly SinglePlayerQuestion[] = [
  ['normal', 'Normal'], ['fire', 'Fuego'], ['water', 'Agua'], ['electric', 'Eléctrico'],
  ['grass', 'Planta'], ['ice', 'Hielo'], ['fighting', 'Lucha'], ['poison', 'Veneno'],
  ['ground', 'Tierra'], ['flying', 'Volador'], ['psychic', 'Psíquico'], ['bug', 'Bicho'],
  ['rock', 'Roca'], ['ghost', 'Fantasma'], ['dragon', 'Dragón'], ['dark', 'Siniestro'],
  ['steel', 'Acero'], ['fairy', 'Hada'],
].map(([id, label]) => makeQuestion(`type.${id}`, `type.${id}` as SinglePlayerTraitKey, `¿Es de tipo ${label}?`, 'type', 2));

const NATIONAL_WEIGHT_CUTOFFS = [1, 5, 10, 20, 40, 80, 120, 200, 400] as const;
const NATIONAL_WEIGHT_QUESTIONS: readonly SinglePlayerQuestion[] = NATIONAL_WEIGHT_CUTOFFS.flatMap((cutoff) => [
  makeQuestion(`weight.lte.${cutoff}`, `weight.lte.${cutoff}`, `¿Pesa ${cutoff} kg o menos?`, 'weight'),
  makeQuestion(`weight.gte.${cutoff}`, `weight.gte.${cutoff}`, `¿Pesa ${cutoff} kg o más?`, 'weight'),
]);

/**
 * Banco nacional generado: el corte de Pokédex convierte los 1.025 Pokémon
 * en un árbol de decisión binario. Es grande de forma deliberada, pero los
 * datos se derivan de la PokéAPI y no se repiten en un JSON inmanejable.
 */
export const SINGLE_PLAYER_NATIONAL_QUESTION_BANK: readonly SinglePlayerQuestion[] = Object.freeze([
  ...NATIONAL_TYPE_QUESTIONS,
  makeQuestion('type.dual', 'type.dual', '¿Tiene dos tipos?', 'type', 2),
  makeQuestion('special.legendary', 'special.legendary', '¿Es legendario?', 'special', 1),
  ...NATIONAL_WEIGHT_QUESTIONS,
  ...createDexThresholdQuestions(1025),
]);

function generationForDex(id: number) {
  if (id <= 151) return 1;
  if (id <= 251) return 2;
  if (id <= 386) return 3;
  if (id <= 493) return 4;
  if (id <= 649) return 5;
  if (id <= 721) return 6;
  if (id <= 809) return 7;
  if (id <= 905) return 8;
  return 9;
}

function createNationalTraits(candidate: PokemonCandidate) {
  const traits: Partial<Record<SinglePlayerTraitKey, boolean>> = {};
  candidate.types.forEach((type) => {
    const trait = TYPE_TRAIT_BY_NAME[type];
    if (trait) traits[trait] = true;
  });
  traits['type.dual'] = candidate.types.length > 1;
  traits['special.legendary'] = candidate.legendary;
  NATIONAL_WEIGHT_CUTOFFS.forEach((cutoff) => {
    traits[`weight.lte.${cutoff}`] = candidate.weightKg <= cutoff;
    traits[`weight.gte.${cutoff}`] = candidate.weightKg >= cutoff;
  });
  for (let cutoff = 1; cutoff < 1025; cutoff += 1) {
    traits[`dex.lte.${cutoff}`] = candidate.id <= cutoff;
  }
  return traits;
}

export function createNationalSinglePlayerKnowledge(candidate: PokemonCandidate): SinglePlayerPokemonKnowledge {
  return {
    candidate,
    generation: generationForDex(candidate.id),
    dexNumber: candidate.id,
    traits: createNationalTraits(candidate),
    aliases: [candidate.name.toLocaleLowerCase('es-ES')],
    shortFacts: candidate.facts ?? [candidate.funFact ?? `${candidate.name} ocupa el número ${candidate.id} de la Pokédex Nacional.`],
  };
}

export async function loadSinglePlayerNationalKnowledge(onProgress?: (loaded: number, total: number) => void) {
  const roster = await loadNationalRoster(onProgress);
  return roster.map(createNationalSinglePlayerKnowledge);
}
