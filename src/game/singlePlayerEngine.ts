/**
 * Motor puro para el modo de un jugador.
 *
 * El motor no conoce React Native, sonidos ni la interfaz. Recibe candidatos
 * que ya tienen resueltas sus respuestas booleanas a distintos rasgos y va
 * escogiendo la pregunta que mejor divide el conjunto restante.
 *
 * Ejemplo mínimo:
 *
 * ```ts
 * const game = createSinglePlayerGame([
 *   { id: 1, name: 'Bulbasaur', answers: { fire: false, water: false } },
 *   { id: 4, name: 'Charmander', answers: { fire: true, water: false } },
 * ]);
 *
 * const next = answerQuestion(game, true);
 * if (next.phase === 'won') console.log(next.winner?.name);
 * ```
 */

export type CandidateId = string | number;

/** Respuestas normalizadas de un candidato: una clave de rasgo y un sí/no. */
export type TraitAnswers = Readonly<Record<string, boolean>>;

/**
 * Un candidato puede llevar datos de presentación sin que el motor tenga que
 * saber qué contienen (sprite, descripción, generación, etc.).
 */
export type SinglePlayerCandidate<
  TId extends CandidateId = string,
  TMetadata = unknown,
> = {
  readonly id: TId;
  readonly name: string;
  readonly answers: TraitAnswers;
  readonly metadata?: TMetadata;
};

/** Pregunta que se presenta al jugador. `trait` apunta a una clave de answers. */
export type SinglePlayerQuestion = {
  readonly id: string;
  readonly trait: string;
  readonly text: string;
};

export type QuestionSelectionStrategy = 'information-gain' | 'balance';

/** Una pregunta con las métricas que explican por qué fue escogida. */
export type ScoredSinglePlayerQuestion = SinglePlayerQuestion & {
  /** Número de candidatos que responderían sí/no. */
  readonly yesCount: number;
  readonly noCount: number;
  /** Ganancia de información en bits, suponiendo candidatos equiprobables. */
  readonly informationGain: number;
  /** 0 es un corte inútil y 1 es un corte perfectamente equilibrado. */
  readonly balance: number;
  /** Candidatos esperados que quedarían después de responder. */
  readonly expectedRemaining: number;
  /** Métrica usada para ordenar esta pregunta. */
  readonly score: number;
};

export type SinglePlayerPhase = 'playing' | 'won' | 'tie' | 'no-match';

export type SinglePlayerAnswerRecord = {
  readonly question: SinglePlayerQuestion;
  readonly answer: boolean;
  readonly remainingCount: number;
  readonly yesCountBeforeAnswer: number;
  readonly noCountBeforeAnswer: number;
};

export type SinglePlayerOutcome<
  TId extends CandidateId = string,
  TMetadata = unknown,
> =
  | {
      readonly phase: 'playing';
      readonly winner: null;
      readonly candidates: readonly SinglePlayerCandidate<TId, TMetadata>[];
    }
  | {
      readonly phase: 'won';
      readonly winner: SinglePlayerCandidate<TId, TMetadata>;
      readonly candidates: readonly [SinglePlayerCandidate<TId, TMetadata>];
    }
  | {
      readonly phase: 'tie';
      readonly winner: null;
      readonly candidates: readonly SinglePlayerCandidate<TId, TMetadata>[];
    }
  | {
      readonly phase: 'no-match';
      readonly winner: null;
      readonly candidates: readonly [];
    };

export type SinglePlayerState<
  TId extends CandidateId = string,
  TMetadata = unknown,
> = {
  readonly candidates: readonly SinglePlayerCandidate<TId, TMetadata>[];
  readonly questions: readonly SinglePlayerQuestion[];
  readonly strategy: QuestionSelectionStrategy;
  readonly remainingCandidates: readonly SinglePlayerCandidate<TId, TMetadata>[];
  readonly askedQuestionIds: readonly string[];
  readonly askedTraits: readonly string[];
  readonly answers: Readonly<Record<string, boolean>>;
  readonly history: readonly SinglePlayerAnswerRecord[];
  readonly phase: SinglePlayerPhase;
  readonly currentQuestion: ScoredSinglePlayerQuestion | null;
  readonly winner: SinglePlayerCandidate<TId, TMetadata> | null;
  readonly tiedCandidates: readonly SinglePlayerCandidate<TId, TMetadata>[];
};

export type SinglePlayerGameOptions = {
  /** Si se omite, se crea una pregunta automáticamente por cada rasgo. */
  readonly questions?: readonly SinglePlayerQuestion[];
  readonly strategy?: QuestionSelectionStrategy;
  /** Personaliza el texto de las preguntas generadas automáticamente. */
  readonly questionText?: (trait: string) => string;
};

function hasOwn(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function sameId(left: CandidateId, right: CandidateId): boolean {
  return Object.is(left, right);
}

function assertCandidates<TId extends CandidateId, TMetadata>(
  candidates: readonly SinglePlayerCandidate<TId, TMetadata>[],
): void {
  if (!Array.isArray(candidates)) {
    throw new Error('La lista de candidatos debe ser un array.');
  }

  const ids: CandidateId[] = [];
  candidates.forEach((candidate, index) => {
    if (candidate === null || typeof candidate !== 'object') {
      throw new Error(`El candidato ${index} no es válido.`);
    }
    if (
      (typeof candidate.id !== 'string' && typeof candidate.id !== 'number')
      || (typeof candidate.id === 'number' && !Number.isFinite(candidate.id))
    ) {
      throw new Error(`El candidato ${index} necesita un id de texto o numérico.`);
    }
    if (typeof candidate.name !== 'string' || candidate.name.trim().length === 0) {
      throw new Error(`El candidato ${String(candidate.id)} necesita un nombre.`);
    }
    if (candidate.answers === null || typeof candidate.answers !== 'object' || Array.isArray(candidate.answers)) {
      throw new Error(`El candidato ${String(candidate.id)} necesita respuestas booleanas.`);
    }
    if (ids.some((id) => sameId(id, candidate.id))) {
      throw new Error(`El id de candidato ${String(candidate.id)} está repetido.`);
    }
    ids.push(candidate.id);

    Object.entries(candidate.answers).forEach(([trait, value]) => {
      if (trait.trim().length === 0 || typeof value !== 'boolean') {
        throw new Error(`El candidato ${String(candidate.id)} tiene un rasgo no booleano.`);
      }
    });
  });
}

function assertQuestions(questions: readonly SinglePlayerQuestion[]): void {
  if (!Array.isArray(questions)) {
    throw new Error('La lista de preguntas debe ser un array.');
  }
  const ids = new Set<string>();
  questions.forEach((question, index) => {
    if (question === null || typeof question !== 'object') {
      throw new Error(`La pregunta ${index} no es válida.`);
    }
    if (typeof question.id !== 'string' || question.id.trim().length === 0) {
      throw new Error(`La pregunta ${index} necesita un id.`);
    }
    if (typeof question.trait !== 'string' || question.trait.trim().length === 0) {
      throw new Error(`La pregunta ${question.id} necesita un rasgo.`);
    }
    if (typeof question.text !== 'string' || question.text.trim().length === 0) {
      throw new Error(`La pregunta ${question.id} necesita un texto.`);
    }
    if (ids.has(question.id)) {
      throw new Error(`El id de pregunta ${question.id} está repetido.`);
    }
    ids.add(question.id);
  });
}

function validateQuestionCoverage<TId extends CandidateId, TMetadata>(
  candidates: readonly SinglePlayerCandidate<TId, TMetadata>[],
  questions: readonly SinglePlayerQuestion[],
): void {
  questions.forEach((question) => {
    candidates.forEach((candidate) => {
      if (!hasOwn(candidate.answers, question.trait) || typeof candidate.answers[question.trait] !== 'boolean') {
        throw new Error(
          `El candidato ${String(candidate.id)} no tiene una respuesta booleana para "${question.trait}".`,
        );
      }
    });
  });
}

/**
 * Crea preguntas a partir de las claves de rasgo presentes en los candidatos.
 * Es útil para una base de datos grande: basta con añadir nuevos rasgos y el
 * motor podrá utilizarlos sin tocar la lógica de la partida.
 */
export function buildQuestionsFromTraits<TId extends CandidateId, TMetadata>(
  candidates: readonly SinglePlayerCandidate<TId, TMetadata>[],
  questionText: (trait: string) => string = (trait) => `¿Tiene el rasgo "${trait}"?`,
): SinglePlayerQuestion[] {
  assertCandidates(candidates);
  const traits = new Set<string>();
  candidates.forEach((candidate) => {
    Object.keys(candidate.answers).forEach((trait) => traits.add(trait));
  });

  return [...traits]
    .sort((left, right) => left.localeCompare(right))
    .map((trait) => ({
      id: trait,
      trait,
      text: questionText(trait),
    }));
}

function entropy(probability: number): number {
  if (probability <= 0 || probability >= 1) return 0;
  return -probability * Math.log2(probability) - (1 - probability) * Math.log2(1 - probability);
}

/** Calcula las métricas de una pregunta; devuelve null si no divide el grupo. */
export function scoreQuestion<TId extends CandidateId, TMetadata>(
  candidates: readonly SinglePlayerCandidate<TId, TMetadata>[],
  question: SinglePlayerQuestion,
  strategy: QuestionSelectionStrategy = 'information-gain',
): ScoredSinglePlayerQuestion | null {
  if (candidates.length < 2) return null;
  const yesCount = candidates.filter((candidate) => candidate.answers[question.trait] === true).length;
  const noCount = candidates.length - yesCount;
  if (yesCount === 0 || noCount === 0) return null;

  const probabilityYes = yesCount / candidates.length;
  const informationGain = entropy(probabilityYes);
  const balance = 1 - Math.abs(yesCount - noCount) / candidates.length;
  const expectedRemaining = (yesCount * yesCount + noCount * noCount) / candidates.length;
  const score = strategy === 'balance' ? balance : informationGain;

  return {
    ...question,
    yesCount,
    noCount,
    informationGain,
    balance,
    expectedRemaining,
    score,
  };
}

/**
 * Selecciona la mejor pregunta disponible.
 *
 * Las preguntas que ya usan un rasgo preguntado se descartan, aunque tengan
 * ids distintos. Así una base de datos puede tener variantes de redacción sin
 * hacer que el jugador responda dos veces lo mismo.
 */
export function chooseNextQuestion<TId extends CandidateId, TMetadata>(
  candidates: readonly SinglePlayerCandidate<TId, TMetadata>[],
  questions: readonly SinglePlayerQuestion[],
  askedQuestionIds: readonly string[] = [],
  strategy: QuestionSelectionStrategy = 'information-gain',
): ScoredSinglePlayerQuestion | null {
  const askedIds = new Set(askedQuestionIds);
  const askedTraits = new Set(
    questions.filter((question) => askedIds.has(question.id)).map((question) => question.trait),
  );

  return questions
    .filter((question) => !askedIds.has(question.id) && !askedTraits.has(question.trait))
    .map((question) => scoreQuestion(candidates, question, strategy))
    .filter((question): question is ScoredSinglePlayerQuestion => question !== null)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.balance !== left.balance) return right.balance - left.balance;
      if (right.informationGain !== left.informationGain) return right.informationGain - left.informationGain;
      return left.id.localeCompare(right.id);
    })[0] ?? null;
}

/** Filtra candidatos sin mutar la lista original. */
export function filterCandidatesByAnswer<TId extends CandidateId, TMetadata>(
  candidates: readonly SinglePlayerCandidate<TId, TMetadata>[],
  questionOrTrait: SinglePlayerQuestion | string,
  answer: boolean,
): SinglePlayerCandidate<TId, TMetadata>[] {
  const trait = typeof questionOrTrait === 'string' ? questionOrTrait : questionOrTrait.trait;
  return candidates.filter((candidate) => candidate.answers[trait] === answer);
}

/** Evalúa el conjunto actual y distingue victoria, empate y contradicción. */
export function evaluateSinglePlayerOutcome<TId extends CandidateId, TMetadata>(
  candidates: readonly SinglePlayerCandidate<TId, TMetadata>[],
): SinglePlayerOutcome<TId, TMetadata> {
  if (candidates.length === 0) {
    return { phase: 'no-match', winner: null, candidates: [] };
  }
  if (candidates.length === 1) {
    return { phase: 'won', winner: candidates[0], candidates: [candidates[0]] };
  }
  return { phase: 'tie', winner: null, candidates };
}

function buildState<TId extends CandidateId, TMetadata>(
  candidates: readonly SinglePlayerCandidate<TId, TMetadata>[],
  questions: readonly SinglePlayerQuestion[],
  strategy: QuestionSelectionStrategy,
  remainingCandidates: readonly SinglePlayerCandidate<TId, TMetadata>[],
  askedQuestionIds: readonly string[],
  answers: Readonly<Record<string, boolean>>,
  history: readonly SinglePlayerAnswerRecord[],
): SinglePlayerState<TId, TMetadata> {
  const outcome = evaluateSinglePlayerOutcome(remainingCandidates);
  const nextQuestion = outcome.phase === 'tie'
    ? chooseNextQuestion(remainingCandidates, questions, askedQuestionIds, strategy)
    : null;

  // Si quedan varios candidatos pero ninguna pregunta los separa, es un
  // empate real: sus perfiles de respuestas son indistinguibles.
  const phase: SinglePlayerPhase = outcome.phase === 'tie' && nextQuestion !== null
    ? 'playing'
    : outcome.phase;

  const askedTraits = questions
    .filter((question) => askedQuestionIds.includes(question.id))
    .map((question) => question.trait);

  return {
    candidates,
    questions,
    strategy,
    remainingCandidates,
    askedQuestionIds,
    askedTraits,
    answers,
    history,
    phase,
    currentQuestion: phase === 'playing' ? nextQuestion : null,
    winner: phase === 'won' ? outcome.winner : null,
    tiedCandidates: phase === 'tie' ? outcome.candidates : [],
  };
}

/** Crea una partida y escoge la primera pregunta automáticamente. */
export function createSinglePlayerGame<TId extends CandidateId, TMetadata = unknown>(
  candidates: readonly SinglePlayerCandidate<TId, TMetadata>[],
  options: SinglePlayerGameOptions = {},
): SinglePlayerState<TId, TMetadata> {
  assertCandidates(candidates);

  const questions = options.questions === undefined
    ? buildQuestionsFromTraits(candidates, options.questionText)
    : [...options.questions];
  assertQuestions(questions);
  validateQuestionCoverage(candidates, questions);

  const strategy = options.strategy ?? 'information-gain';
  if (strategy !== 'information-gain' && strategy !== 'balance') {
    throw new Error(`Estrategia de preguntas no soportada: ${String(strategy)}.`);
  }
  return buildState(
    [...candidates],
    questions,
    strategy,
    [...candidates],
    [],
    {},
    [],
  );
}

/**
 * Aplica la respuesta a la pregunta actual y devuelve un nuevo estado.
 * Responder después de terminar la partida es una operación segura y no-op.
 */
export function answerQuestion<TId extends CandidateId, TMetadata>(
  state: SinglePlayerState<TId, TMetadata>,
  answer: boolean,
): SinglePlayerState<TId, TMetadata> {
  if (state.phase !== 'playing' || state.currentQuestion === null || typeof answer !== 'boolean') return state;

  const question = state.currentQuestion;
  const remainingCandidates = filterCandidatesByAnswer(state.remainingCandidates, question, answer);
  const askedQuestionIds = [...state.askedQuestionIds, question.id];
  const answers = { ...state.answers, [question.id]: answer };
  const history = [
    ...state.history,
    {
      question: {
        id: question.id,
        trait: question.trait,
        text: question.text,
      },
      answer,
      remainingCount: remainingCandidates.length,
      yesCountBeforeAnswer: question.yesCount,
      noCountBeforeAnswer: question.noCount,
    },
  ];

  return buildState(
    state.candidates,
    state.questions,
    state.strategy,
    remainingCandidates,
    askedQuestionIds,
    answers,
    history,
  );
}

/**
 * Permite corregir una propuesta cuando el jugador responde NO a
 * "¿Es este tu Pokémon?". El candidato se elimina del conjunto actual sin
 * inventar una respuesta a una pregunta que nunca se hizo.
 */
export function rejectWinner<TId extends CandidateId, TMetadata>(
  state: SinglePlayerState<TId, TMetadata>,
): SinglePlayerState<TId, TMetadata> {
  if (state.phase !== 'won' || state.winner === null) return state;
  const winnerId = state.winner.id;
  const remainingCandidates = state.remainingCandidates.filter(
    (candidate) => !sameId(candidate.id, winnerId),
  );
  return buildState(
    state.candidates,
    state.questions,
    state.strategy,
    remainingCandidates,
    state.askedQuestionIds,
    state.answers,
    state.history,
  );
}

/** Alias semántico para integraciones que reciben eventos de la interfaz. */
export const answerCurrentQuestion = answerQuestion;

/** Reinicia la partida conservando candidatos, preguntas y estrategia. */
export function restartSinglePlayerGame<TId extends CandidateId, TMetadata>(
  state: SinglePlayerState<TId, TMetadata>,
): SinglePlayerState<TId, TMetadata> {
  return createSinglePlayerGame(state.candidates, {
    questions: state.questions,
    strategy: state.strategy,
  });
}

/** Obtiene una vista de resultado directamente desde el estado actual. */
export function getSinglePlayerOutcome<TId extends CandidateId, TMetadata>(
  state: SinglePlayerState<TId, TMetadata>,
): SinglePlayerOutcome<TId, TMetadata> {
  if (state.phase === 'playing') {
    return { phase: 'playing', winner: null, candidates: state.remainingCandidates };
  }
  if (state.phase === 'won' && state.winner !== null) {
    return { phase: 'won', winner: state.winner, candidates: [state.winner] };
  }
  if (state.phase === 'tie') {
    return { phase: 'tie', winner: null, candidates: state.tiedCandidates };
  }
  return { phase: 'no-match', winner: null, candidates: [] };
}
