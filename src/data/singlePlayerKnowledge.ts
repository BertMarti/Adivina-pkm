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
  | 'cheekPouches'
  | 'aquatic'
  | 'furry'
  | 'mechanical'
  | 'mystical'
  | 'armored'
  | 'spiky'
  | 'hot'
  | 'cold'
  | 'goodCompanion'
  | 'cityFriendly'
  | 'scaryAtNight'
  | 'colorRed'
  | 'colorBlue'
  | 'colorYellow'
  | 'colorGreen'
  | 'colorBrown'
  | 'colorPurple'
  | 'colorPink'
  | 'colorWhite'
  | 'colorBlack'
  | 'colorGray'
  | 'animalMammal'
  | 'animalAquatic'
  | 'animalReptile'
  | 'animalBird'
  | 'animalInsect'
  | 'animalPlant'
  | 'hasHands'
  | 'hasArms'
  | 'hasLegs'
  | 'biped'
  | 'floats'
  | 'humanoid'
  | 'round'
  | 'cute'
  | 'scary'
  | 'silhouetteBall'
  | 'silhouetteBlob'
  | 'silhouetteFish'
  | 'silhouetteArms'
  | 'silhouetteUpright'
  | 'silhouetteLegs'
  | 'silhouetteQuadruped'
  | 'silhouetteWings'
  | 'silhouetteTentacles'
  | 'silhouetteHead'
  | 'silhouetteHumanoid'
  | 'silhouetteBugWings'
  | 'silhouetteArmor'
  | 'silhouetteSquiggle'
  | 'habitatCave'
  | 'habitatForest'
  | 'habitatGrassland'
  | 'habitatMountain'
  | 'habitatRare'
  | 'habitatRoughTerrain'
  | 'habitatSea'
  | 'habitatUrban'
  | 'habitatWatersEdge';

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

const NATIONAL_STARTER_IDS = new Set([
  1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 494, 498, 501,
  650, 653, 656, 722, 725, 728, 810, 813, 816, 906, 909, 912,
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

/** The default solo catalog: all 151 local Kanto candidates. */
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
  makeQuestion('type.ice', 'type.ice', '¿Es de tipo Hielo?', 'type', 2),
  makeQuestion('type.fighting', 'type.fighting', '¿Es de tipo Lucha?', 'type', 2),
  makeQuestion('type.ground', 'type.ground', '¿Es de tipo Tierra?', 'type', 2),
  makeQuestion('type.psychic', 'type.psychic', '¿Es de tipo Psíquico?', 'type', 2),
  makeQuestion('type.rock', 'type.rock', '¿Es de tipo Roca?', 'type', 2),
  makeQuestion('type.ghost', 'type.ghost', '¿Es de tipo Fantasma?', 'type', 2),
  makeQuestion('type.dragon', 'type.dragon', '¿Es de tipo Dragón?', 'type', 2),
  makeQuestion('type.dark', 'type.dark', '¿Es de tipo Siniestro?', 'type', 2),
  makeQuestion('type.steel', 'type.steel', '¿Es de tipo Acero?', 'type', 2),
  makeQuestion('type.fairy', 'type.fairy', '¿Es de tipo Hada?', 'type', 2),
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

const DERIVED_VISUAL_QUESTIONS: readonly SinglePlayerQuestion[] = [
  makeQuestion('appearance.aquatic', 'appearance.aquatic', '¿Tiene aspecto acuático?', 'appearance', 1),
  makeQuestion('appearance.furry', 'appearance.furry', '¿Parece tener pelo o pelaje?', 'appearance', 1),
  makeQuestion('appearance.mechanical', 'appearance.mechanical', '¿Tiene un aspecto mecánico?', 'appearance', 1),
  makeQuestion('appearance.mystical', 'appearance.mystical', '¿Tiene un aire místico o sobrenatural?', 'appearance', 1),
  makeQuestion('appearance.armored', 'appearance.armored', '¿Parece llevar armadura?', 'appearance', 1),
  makeQuestion('appearance.spiky', 'appearance.spiky', '¿Tiene un aspecto puntiagudo o rocoso?', 'appearance', 1),
  makeQuestion('appearance.hot', 'appearance.hot', '¿Te recuerda al calor o al fuego?', 'appearance', 1),
  makeQuestion('appearance.cold', 'appearance.cold', '¿Te recuerda al frío o al hielo?', 'appearance', 1),
  makeQuestion('appearance.goodCompanion', 'appearance.goodCompanion', '¿Te lo imaginarías como mascota?', 'appearance', 1),
  makeQuestion('appearance.cityFriendly', 'appearance.cityFriendly', '¿Te lo imaginarías viviendo en una ciudad?', 'appearance', 1),
  makeQuestion('appearance.scaryAtNight', 'appearance.scaryAtNight', '¿Daría miedo encontrarlo de noche?', 'appearance', 1),
  makeQuestion('appearance.colorRed', 'appearance.colorRed', '¿Predomina el color rojo?', 'appearance', 1),
  makeQuestion('appearance.colorBlue', 'appearance.colorBlue', '¿Predomina el color azul?', 'appearance', 1),
  makeQuestion('appearance.colorYellow', 'appearance.colorYellow', '¿Predomina el color amarillo?', 'appearance', 1),
  makeQuestion('appearance.colorGreen', 'appearance.colorGreen', '¿Predomina el color verde?', 'appearance', 1),
  makeQuestion('appearance.colorBrown', 'appearance.colorBrown', '¿Predomina el color marrón?', 'appearance', 1),
  makeQuestion('appearance.colorPurple', 'appearance.colorPurple', '¿Predomina el color morado?', 'appearance', 1),
  makeQuestion('appearance.colorPink', 'appearance.colorPink', '¿Predomina el color rosa?', 'appearance', 1),
  makeQuestion('appearance.colorWhite', 'appearance.colorWhite', '¿Predomina el color blanco?', 'appearance', 1),
  makeQuestion('appearance.colorBlack', 'appearance.colorBlack', '¿Predomina el color negro?', 'appearance', 1),
  makeQuestion('appearance.colorGray', 'appearance.colorGray', '¿Predomina el color gris?', 'appearance', 1),
  makeQuestion('appearance.animalMammal', 'appearance.animalMammal', '¿Está inspirado en un mamífero?', 'appearance', 1),
  makeQuestion('appearance.animalAquatic', 'appearance.animalAquatic', '¿Está inspirado en un animal acuático?', 'appearance', 1),
  makeQuestion('appearance.animalReptile', 'appearance.animalReptile', '¿Está inspirado en un reptil?', 'appearance', 1),
  makeQuestion('appearance.animalBird', 'appearance.animalBird', '¿Está inspirado en un ave?', 'appearance', 1),
  makeQuestion('appearance.animalInsect', 'appearance.animalInsect', '¿Está inspirado en un insecto?', 'appearance', 1),
  makeQuestion('appearance.animalPlant', 'appearance.animalPlant', '¿Está inspirado en una planta?', 'appearance', 1),
  makeQuestion('appearance.hasHands', 'appearance.hasHands', '¿Tiene manos visibles?', 'appearance', 1),
  makeQuestion('appearance.hasArms', 'appearance.hasArms', '¿Tiene brazos visibles?', 'appearance', 1),
  makeQuestion('appearance.hasLegs', 'appearance.hasLegs', '¿Tiene piernas o patas visibles?', 'appearance', 1),
  makeQuestion('appearance.biped', 'appearance.biped', '¿Camina normalmente sobre dos patas?', 'appearance', 1),
  makeQuestion('appearance.floats', 'appearance.floats', '¿Parece capaz de flotar?', 'appearance', 1),
  makeQuestion('appearance.humanoid', 'appearance.humanoid', '¿Tiene una silueta parecida a la humana?', 'appearance', 1),
  makeQuestion('appearance.round', 'appearance.round', '¿Tiene una silueta redondeada?', 'appearance', 1),
  makeQuestion('appearance.cute', 'appearance.cute', '¿Tiene un aspecto tierno?', 'appearance', 1),
  makeQuestion('appearance.scary', 'appearance.scary', '¿Tiene un aspecto inquietante?', 'appearance', 1),
  makeQuestion('appearance.silhouetteBall', 'appearance.silhouetteBall', '¿Su silueta recuerda a una bola?', 'appearance', 1),
  makeQuestion('appearance.silhouetteBlob', 'appearance.silhouetteBlob', '¿Tiene una silueta blanda y redondeada?', 'appearance', 1),
  makeQuestion('appearance.silhouetteFish', 'appearance.silhouetteFish', '¿Su silueta recuerda a un pez?', 'appearance', 1),
  makeQuestion('appearance.silhouetteArms', 'appearance.silhouetteArms', '¿Su silueta destaca por tener brazos?', 'appearance', 1),
  makeQuestion('appearance.silhouetteUpright', 'appearance.silhouetteUpright', '¿Tiene una silueta erguida?', 'appearance', 1),
  makeQuestion('appearance.silhouetteLegs', 'appearance.silhouetteLegs', '¿Su silueta destaca por tener patas?', 'appearance', 1),
  makeQuestion('appearance.silhouetteQuadruped', 'appearance.silhouetteQuadruped', '¿Su silueta es de cuatro patas?', 'appearance', 1),
  makeQuestion('appearance.silhouetteWings', 'appearance.silhouetteWings', '¿Su silueta tiene alas?', 'appearance', 1),
  makeQuestion('appearance.silhouetteTentacles', 'appearance.silhouetteTentacles', '¿Su silueta tiene tentáculos?', 'appearance', 1),
  makeQuestion('appearance.silhouetteHead', 'appearance.silhouetteHead', '¿Su silueta parece principalmente una cabeza?', 'appearance', 1),
  makeQuestion('appearance.silhouetteHumanoid', 'appearance.silhouetteHumanoid', '¿Tiene una silueta humanoide?', 'appearance', 1),
  makeQuestion('appearance.silhouetteBugWings', 'appearance.silhouetteBugWings', '¿Tiene alas con silueta de insecto?', 'appearance', 1),
  makeQuestion('appearance.silhouetteArmor', 'appearance.silhouetteArmor', '¿Su silueta recuerda a una armadura?', 'appearance', 1),
  makeQuestion('appearance.silhouetteSquiggle', 'appearance.silhouetteSquiggle', '¿Tiene una silueta alargada o serpenteante?', 'appearance', 1),
  makeQuestion('appearance.habitatCave', 'appearance.habitatCave', '¿Se asocia normalmente con cuevas?', 'appearance', 1),
  makeQuestion('appearance.habitatForest', 'appearance.habitatForest', '¿Se asocia normalmente con bosques?', 'appearance', 1),
  makeQuestion('appearance.habitatGrassland', 'appearance.habitatGrassland', '¿Se asocia normalmente con praderas?', 'appearance', 1),
  makeQuestion('appearance.habitatMountain', 'appearance.habitatMountain', '¿Se asocia normalmente con montañas?', 'appearance', 1),
  makeQuestion('appearance.habitatRare', 'appearance.habitatRare', '¿Es difícil encontrarlo en la naturaleza?', 'appearance', 1),
  makeQuestion('appearance.habitatRoughTerrain', 'appearance.habitatRoughTerrain', '¿Se asocia con terrenos accidentados?', 'appearance', 1),
  makeQuestion('appearance.habitatSea', 'appearance.habitatSea', '¿Se asocia normalmente con el mar?', 'appearance', 1),
  makeQuestion('appearance.habitatUrban', 'appearance.habitatUrban', '¿Se asocia normalmente con ciudades?', 'appearance', 1),
  makeQuestion('appearance.habitatWatersEdge', 'appearance.habitatWatersEdge', '¿Se asocia con la orilla del agua?', 'appearance', 1),
];

/**
 * The Kanto bank deliberately uses questions that a person can answer from a
 * portrait or from very basic Pokémon knowledge. It never asks for a national
 * number, a Pokédex range, a weight, a region or a generation.
 */
export const SINGLE_PLAYER_QUESTION_BANK: readonly SinglePlayerQuestion[] = Object.freeze([
  ...CORE_QUESTIONS,
  ...LINE_QUESTIONS,
  ...DERIVED_VISUAL_QUESTIONS,
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

  applyDerivedTraits(candidate, traits);

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
  label: 'Kanto · 151 candidatos',
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

const NATIONAL_TYPE_QUESTIONS: readonly SinglePlayerQuestion[] = [
  ['normal', 'Normal'], ['fire', 'Fuego'], ['water', 'Agua'], ['electric', 'Eléctrico'],
  ['grass', 'Planta'], ['ice', 'Hielo'], ['fighting', 'Lucha'], ['poison', 'Veneno'],
  ['ground', 'Tierra'], ['flying', 'Volador'], ['psychic', 'Psíquico'], ['bug', 'Bicho'],
  ['rock', 'Roca'], ['ghost', 'Fantasma'], ['dragon', 'Dragón'], ['dark', 'Siniestro'],
  ['steel', 'Acero'], ['fairy', 'Hada'],
].map(([id, label]) => makeQuestion(`type.${id}`, `type.${id}` as SinglePlayerTraitKey, `¿Es de tipo ${label}?`, 'type', 2));

const NATIONAL_EVOLUTION_QUESTIONS: readonly SinglePlayerQuestion[] = [
  makeQuestion('evolution.base', 'evolution.base', '¿Está en su forma básica?', 'evolution', 2),
  makeQuestion('evolution.hasPrevious', 'evolution.hasPrevious', '¿Ha evolucionado desde otra forma?', 'evolution', 2),
  makeQuestion('evolution.canEvolve', 'evolution.canEvolve', '¿Puede evolucionar a otra forma?', 'evolution', 2),
  makeQuestion('evolution.final', 'evolution.final', '¿Es una evolución final?', 'evolution', 2),
  makeQuestion('evolution.hasMultipleStages', 'evolution.hasMultipleStages', '¿Pertenece a una línea evolutiva de varias etapas?', 'evolution', 1),
];

function applyDerivedTraits(
  candidate: PokemonCandidate,
  traits: Partial<Record<SinglePlayerTraitKey, boolean>>,
) {
  const types = new Set(candidate.types);
  const has = (...values: string[]) => values.some((value) => types.has(value));
  const name = candidate.name.toLocaleLowerCase('es-ES');
  const shape = candidate.shape?.toLocaleLowerCase('es-ES') ?? '';
  const color = candidate.color?.toLocaleLowerCase('es-ES') ?? '';
  const shapeIs = (...values: string[]) => values.some((value) => shape === value);
  const nameHas = (...values: string[]) => values.some((value) => name.includes(value));
  // Las entradas manuales de Kanto tienen prioridad sobre estas inferencias.
  // Así una forma visual corregida no vuelve a ser sobrescrita por un proxy de
  // tipo que solo sirve como aproximación para el catálogo nacional.
  const setTrait = (trait: SinglePlayerTraitKey, value: boolean) => {
    if (!Object.prototype.hasOwnProperty.call(traits, trait)) traits[trait] = value;
  };

  // Rasgos visuales derivados de color dominante y silueta pública de PokéAPI.
  // No contienen la elección del jugador ni consultan ningún secreto de sala.
  setTrait('appearance.aquatic', has('Agua') || shapeIs('fish', 'tentacles'));
  setTrait('appearance.furry', shapeIs('quadruped', 'upright', 'humanoid') || nameHas('fur', 'fuzzy'));
  setTrait('appearance.mechanical', has('Acero', 'Eléctrico'));
  setTrait('appearance.mystical', has('Psíquico', 'Fantasma', 'Hada') || candidate.legendary);
  setTrait('appearance.armored', has('Acero', 'Roca'));
  setTrait('appearance.spiky', has('Roca', 'Acero', 'Eléctrico'));
  setTrait('appearance.hot', has('Fuego'));
  setTrait('appearance.cold', has('Hielo'));
  setTrait('appearance.goodCompanion', has('Normal', 'Hada', 'Eléctrico') || nameHas('pikachu', 'eevee', 'meowth'));
  setTrait('appearance.cityFriendly', has('Normal', 'Eléctrico', 'Acero'));
  setTrait('appearance.scaryAtNight', has('Fantasma', 'Siniestro'));

  setTrait('appearance.plant', has('Planta'));
  setTrait('appearance.insect', has('Bicho'));
  setTrait('appearance.bird', has('Volador'));
  setTrait('appearance.hasWings', has('Volador') || shapeIs('wings', 'bug-wings'));
  setTrait('appearance.dragonLike', has('Dragón'));
  setTrait('appearance.reptile', shapeIs('quadruped', 'upright', 'legs') && (has('Fuego', 'Dragón', 'Veneno', 'Tierra') || nameHas('saur', 'izard', 'snake', 'cobra')));
  setTrait('appearance.quadruped', shapeIs('quadruped'));

  setTrait('appearance.colorRed', color === 'rojo');
  setTrait('appearance.colorBlue', color === 'azul');
  setTrait('appearance.colorYellow', color === 'amarillo');
  setTrait('appearance.colorGreen', color === 'verde');
  setTrait('appearance.colorBrown', color === 'marrón');
  setTrait('appearance.colorPurple', color === 'morado');
  setTrait('appearance.colorPink', color === 'rosa');
  setTrait('appearance.colorWhite', color === 'blanco');
  setTrait('appearance.colorBlack', color === 'negro');
  setTrait('appearance.colorGray', color === 'gris');

  const insectShape = shapeIs('bug-wings', 'insect');
  const birdShape = shapeIs('wings') || has('Volador');
  const aquaticShape = shapeIs('fish', 'tentacles') || has('Agua');
  const reptileShape = shapeIs('quadruped', 'upright', 'legs') && (has('Fuego', 'Dragón', 'Veneno', 'Tierra') || nameHas('saur', 'izard', 'snake', 'cobra'));
  const mammalShape = shapeIs('quadruped', 'upright', 'legs', 'humanoid');
  const humanoidShape = shapeIs('humanoid', 'upright', 'arms');
  const bipedShape = shapeIs('upright', 'humanoid', 'legs');
  const hasArmsShape = shapeIs('arms', 'humanoid', 'upright');
  const hasLegsShape = shapeIs('legs', 'quadruped', 'upright', 'humanoid');

  setTrait('appearance.animalMammal', mammalShape);
  setTrait('appearance.animalAquatic', aquaticShape);
  setTrait('appearance.animalReptile', reptileShape);
  setTrait('appearance.animalBird', birdShape);
  setTrait('appearance.animalInsect', insectShape || has('Bicho'));
  setTrait('appearance.animalPlant', has('Planta'));
  setTrait('appearance.hasHands', hasArmsShape);
  setTrait('appearance.hasArms', hasArmsShape);
  setTrait('appearance.hasLegs', hasLegsShape);
  setTrait('appearance.biped', bipedShape);
  setTrait('appearance.floats', has('Volador', 'Fantasma', 'Psíquico', 'Hada') || shapeIs('ball', 'blob', 'tentacles'));
  setTrait('appearance.humanoid', humanoidShape);
  setTrait('appearance.round', shapeIs('ball', 'blob', 'head') || nameHas('round', 'jiggly', 'voltorb'));
  setTrait('appearance.cute', has('Hada', 'Normal', 'Eléctrico') && !has('Siniestro', 'Fantasma'));
  setTrait('appearance.scary', has('Fantasma', 'Siniestro', 'Veneno') || candidate.legendary && shapeIs('arms', 'tentacles'));

  const silhouetteTraits: Readonly<Record<string, SinglePlayerTraitKey>> = {
    ball: 'appearance.silhouetteBall',
    blob: 'appearance.silhouetteBlob',
    fish: 'appearance.silhouetteFish',
    arms: 'appearance.silhouetteArms',
    upright: 'appearance.silhouetteUpright',
    legs: 'appearance.silhouetteLegs',
    quadruped: 'appearance.silhouetteQuadruped',
    wings: 'appearance.silhouetteWings',
    tentacles: 'appearance.silhouetteTentacles',
    heads: 'appearance.silhouetteHead',
    humanoid: 'appearance.silhouetteHumanoid',
    'bug-wings': 'appearance.silhouetteBugWings',
    armor: 'appearance.silhouetteArmor',
    squiggle: 'appearance.silhouetteSquiggle',
  };
  const silhouetteTrait = silhouetteTraits[shape];
  if (silhouetteTrait) setTrait(silhouetteTrait, true);

  const habitatTraits: Readonly<Record<string, SinglePlayerTraitKey>> = {
    cueva: 'appearance.habitatCave',
    bosque: 'appearance.habitatForest',
    pradera: 'appearance.habitatGrassland',
    montaña: 'appearance.habitatMountain',
    raro: 'appearance.habitatRare',
    'terreno accidentado': 'appearance.habitatRoughTerrain',
    mar: 'appearance.habitatSea',
    ciudad: 'appearance.habitatUrban',
    'orilla del agua': 'appearance.habitatWatersEdge',
  };
  const habitatTrait = habitatTraits[candidate.habitat ?? ''];
  if (habitatTrait) setTrait(habitatTrait, true);
}

/**
 * Banco nacional semántico: utiliza tipos, evolución, categoría especial y
 * rasgos visuales básicos. No incluye preguntas de número, rango nacional o
 * peso, por lo que cada respuesta representa una observación jugable.
 */
export const SINGLE_PLAYER_NATIONAL_QUESTION_BANK: readonly SinglePlayerQuestion[] = Object.freeze([
  ...NATIONAL_TYPE_QUESTIONS,
  ...NATIONAL_EVOLUTION_QUESTIONS,
  makeQuestion('type.dual', 'type.dual', '¿Tiene dos tipos?', 'type', 2),
  makeQuestion('special.legendary', 'special.legendary', '¿Es legendario?', 'special', 1),
  makeQuestion('special.starter', 'special.starter', '¿Es uno de los Pokémon iniciales?', 'special', 1),
  makeQuestion('special.mascot', 'special.mascot', '¿Es la mascota más reconocible de la saga?', 'special', 1),
  ...DERIVED_VISUAL_QUESTIONS,
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
  traits['special.starter'] = NATIONAL_STARTER_IDS.has(candidate.id);
  traits['special.mascot'] = candidate.id === 25;
  const evolutionStage = candidate.evolutionStage ?? candidate.stage;
  const evolutionStageCount = candidate.evolutionStageCount ?? 1;
  const isFinalEvolution = evolutionStageCount > 1 && evolutionStage >= evolutionStageCount - 1;
  traits['evolution.base'] = evolutionStage === 0;
  traits['evolution.hasPrevious'] = evolutionStage > 0;
  traits['evolution.canEvolve'] = !isFinalEvolution;
  traits['evolution.final'] = isFinalEvolution;
  traits['evolution.hasMultipleStages'] = evolutionStageCount > 1;
  const lineId = KANTO_LINE_BY_ID[candidate.id];
  if (lineId) traits[`line.${lineId}`] = true;
  applyDerivedTraits(candidate, traits);
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
