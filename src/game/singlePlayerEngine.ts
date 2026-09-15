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

/** Límite de seguridad y regla de producto del modo solitario. */
export const SINGLE_PLAYER_MAX_QUESTIONS = 30;

/**
 * Permite explorar preguntas casi tan informativas como la mejor. Con un
 * margen demasiado pequeño el banco de Kanto solo ofrecía dos aperturas
 * (`type.dual` y `appearance.biped`) y la partida parecía seguir un guion.
 */
export const SINGLE_PLAYER_QUESTION_EXPLORATION_MARGIN = 0.08;

/** Likelihoods for the binary, noise-tolerant belief update. */
const BELIEF_MATCH_LIKELIHOOD = 0.9;
const BELIEF_MISMATCH_LIKELIHOOD = 0.1;
const ACTIVE_POSTERIOR_RATIO = 0.08;
const MIN_QUESTIONS_BEFORE_GUESS = 4;
const GUESS_CONFIDENCE = 0.68;
const GUESS_MARGIN = 5;

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

export type SinglePlayerPhase = 'playing' | 'won' | 'tie' | 'no-match' | 'limit-reached';

export type SinglePlayerAnswerRecord = {
  readonly question: SinglePlayerQuestion;
  readonly answer: boolean;
  readonly remainingCount: number;
  readonly remainingCandidateIds: readonly CandidateId[];
  readonly yesCountBeforeAnswer: number;
  readonly noCountBeforeAnswer: number;
};

export type SinglePlayerCandidateScore<
  TId extends CandidateId = string,
  TMetadata = unknown,
> = {
  readonly candidate: SinglePlayerCandidate<TId, TMetadata>;
  /** Normalized posterior-like score; scores sum to 1 across non-rejected candidates. */
  readonly score: number;
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
      readonly phase: 'limit-reached';
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
  readonly maxQuestions: number;
  /** Same seed keeps a round reproducible while changing the order between rounds. */
  readonly questionSelectionSeed: number;
  readonly remainingCandidates: readonly SinglePlayerCandidate<TId, TMetadata>[];
  readonly candidateScores: readonly SinglePlayerCandidateScore<TId, TMetadata>[];
  readonly rejectedCandidateIds: readonly TId[];
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
  /** Maximum number of yes/no questions before the player wins. */
  readonly maxQuestions?: number;
  /** Optional per-round seed used to randomize near-equivalent questions. */
  readonly questionSelectionSeed?: number;
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

function questionHash(seed: number, questionId: string, depth: number): number {
  let value = (seed >>> 0) ^ Math.imul(depth + 1, 0x9e3779b9);
  for (let index = 0; index < questionId.length; index += 1) {
    value = Math.imul(value ^ questionId.charCodeAt(index), 16777619);
  }
  return value >>> 0;
}

/**
 * Updates the belief state without making one imperfect answer fatal.
 *
 * A matching answer receives 0.9 likelihood and a mismatch 0.1. This is a
 * deliberately small, local Bayesian-style model: it is not pretending that
 * the PMD portrait metadata is perfect, but it keeps a plausible Pokémon in
 * play after an accidental SÍ/NO and lets later evidence recover it.
 */
function calculateCandidateScores<TId extends CandidateId, TMetadata>(
  candidates: readonly SinglePlayerCandidate<TId, TMetadata>[],
  history: readonly SinglePlayerAnswerRecord[],
  rejectedCandidateIds: readonly TId[],
): SinglePlayerCandidateScore<TId, TMetadata>[] {
  const rawScores = candidates
    .filter((candidate) => !rejectedCandidateIds.some((id) => sameId(id, candidate.id)))
    .map((candidate) => {
      let logScore = 0;
      for (const event of history) {
        const matches = candidate.answers[event.question.trait] === event.answer;
        logScore += Math.log(matches ? BELIEF_MATCH_LIKELIHOOD : BELIEF_MISMATCH_LIKELIHOOD);
      }
      return { candidate, logScore };
    });

  if (rawScores.length === 0) return [];
  const highestLogScore = Math.max(...rawScores.map((item) => item.logScore));
  const normalizedScores = rawScores.map((item) => ({
    candidate: item.candidate,
    score: Math.exp(item.logScore - highestLogScore),
  }));
  const total = normalizedScores.reduce((sum, item) => sum + item.score, 0);
  return normalizedScores.map((item) => ({ ...item, score: item.score / total }));
}

function selectActiveCandidateScores<TId extends CandidateId, TMetadata>(
  scores: readonly SinglePlayerCandidateScore<TId, TMetadata>[],
): SinglePlayerCandidateScore<TId, TMetadata>[] {
  if (scores.length < 2) return [...scores];
  const highestScore = Math.max(...scores.map((item) => item.score));
  const active = scores.filter((item) => item.score >= highestScore * ACTIVE_POSTERIOR_RATIO);
  if (active.length >= 2) return active;
  // A low-confidence leader must not become an automatic win just because
  // the posterior threshold removed its nearest alternative. Keep the two
  // best candidates available for another question or an explicit guess.
  return scores.slice(0, Math.min(2, scores.length));
}

function findConfidentWinner<TId extends CandidateId, TMetadata>(
  scores: readonly SinglePlayerCandidateScore<TId, TMetadata>[],
  questionCount: number,
): SinglePlayerCandidate<TId, TMetadata> | null {
  if (questionCount < MIN_QUESTIONS_BEFORE_GUESS || scores.length === 0) return null;
  let best: SinglePlayerCandidateScore<TId, TMetadata> | null = null;
  let secondBestScore = 0;
  for (const score of scores) {
    if (best === null || score.score > best.score) {
      secondBestScore = best?.score ?? 0;
      best = score;
    } else if (score.score > secondBestScore) {
      secondBestScore = score.score;
    }
  }
  if (best !== null && best.score >= GUESS_CONFIDENCE && best.score >= secondBestScore * GUESS_MARGIN) {
    return best.candidate;
  }
  return null;
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
  questionSelectionSeed = 0,
  candidateWeights?: readonly number[],
): ScoredSinglePlayerQuestion | null {
  const askedIds = new Set(askedQuestionIds);
  const askedTraits = new Set(
    questions.filter((question) => askedIds.has(question.id)).map((question) => question.trait),
  );

  // Keep the exact ordering semantics of the previous map/filter/sort chain,
  // but avoid allocating one scored array per answer. This matters for the
  // national catalog, where a single solo session can evaluate 1.025
  // candidates against dozens of questions repeatedly.
  let bestQuestion: ScoredSinglePlayerQuestion | null = null;
  const nearBestQuestions: ScoredSinglePlayerQuestion[] = [];
  const NEAR_BEST_MARGIN = SINGLE_PLAYER_QUESTION_EXPLORATION_MARGIN;
  const weightedSelection = candidateWeights !== undefined
    && candidateWeights.length === candidates.length
    && candidateWeights.every((weight) => Number.isFinite(weight) && weight >= 0)
    && candidateWeights.some((weight) => weight > 0);
  const totalWeight = weightedSelection
    ? candidateWeights!.reduce((sum, weight) => sum + weight, 0)
    : candidates.length;
  for (const question of questions) {
    if (askedIds.has(question.id) || askedTraits.has(question.trait)) continue;

    let yesCount = 0;
    let yesWeight = 0;
    for (const candidate of candidates) {
      if (candidate.answers[question.trait] === true) yesCount += 1;
    }
    if (weightedSelection) {
      for (let index = 0; index < candidates.length; index += 1) {
        if (candidates[index].answers[question.trait] === true) yesWeight += candidateWeights![index];
      }
    }
    const noCount = candidates.length - yesCount;
    if (yesCount === 0 || noCount === 0) continue;

    const probabilityYes = weightedSelection ? yesWeight / totalWeight : yesCount / candidates.length;
    const informationGain = entropy(probabilityYes);
    const probabilityNo = 1 - probabilityYes;
    const balance = 1 - Math.abs(probabilityYes - probabilityNo);
    const expectedRemaining = candidates.length * (probabilityYes * probabilityYes + probabilityNo * probabilityNo);
    const score = strategy === 'balance' ? balance : informationGain;
    const scored: ScoredSinglePlayerQuestion = {
      ...question,
      yesCount,
      noCount,
      informationGain,
      balance,
      expectedRemaining,
      score,
    };

    const isBetter = bestQuestion === null
      || scored.score > bestQuestion.score
      || (scored.score === bestQuestion.score && scored.balance > bestQuestion.balance)
      || (scored.score === bestQuestion.score && scored.balance === bestQuestion.balance
        && scored.informationGain > bestQuestion.informationGain)
      || (scored.score === bestQuestion.score && scored.balance === bestQuestion.balance
        && scored.informationGain === bestQuestion.informationGain
        && scored.id.localeCompare(bestQuestion.id) < 0);
    if (bestQuestion === null || scored.score > bestQuestion.score + NEAR_BEST_MARGIN) {
      bestQuestion = scored;
      nearBestQuestions.length = 0;
      nearBestQuestions.push(scored);
    } else if (scored.score >= bestQuestion.score - NEAR_BEST_MARGIN) {
      nearBestQuestions.push(scored);
      if (isBetter) bestQuestion = scored;
    }
  }

  if (bestQuestion === null || questionSelectionSeed === 0) return bestQuestion;
  const eligibleQuestions = nearBestQuestions.filter(
    (question) => question.score >= bestQuestion!.score - NEAR_BEST_MARGIN,
  );
  if (eligibleQuestions.length < 2) return bestQuestion;
  const choiceIndex = questionHash(questionSelectionSeed, `${askedQuestionIds.length}:${bestQuestion.id}`, askedQuestionIds.length) % eligibleQuestions.length;
  return eligibleQuestions[choiceIndex];
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
  maxQuestions: number,
  questionSelectionSeed: number,
  askedQuestionIds: readonly string[],
  answers: Readonly<Record<string, boolean>>,
  history: readonly SinglePlayerAnswerRecord[],
  rejectedCandidateIds: readonly TId[],
): SinglePlayerState<TId, TMetadata> {
  const candidateScores = calculateCandidateScores(candidates, history, rejectedCandidateIds);
  const activeCandidateScores = selectActiveCandidateScores(candidateScores);
  const remainingCandidates = activeCandidateScores.map((item) => item.candidate);
  const confidentWinner = findConfidentWinner(candidateScores, history.length);
  const outcome = confidentWinner === null
    ? evaluateSinglePlayerOutcome(remainingCandidates)
    : { phase: 'won' as const, winner: confidentWinner, candidates: [confidentWinner] as const };
  const reachedLimit = history.length >= maxQuestions;
  const nextQuestion = outcome.phase === 'tie' && !reachedLimit
    ? chooseNextQuestion(
      remainingCandidates,
      questions,
      askedQuestionIds,
      strategy,
      questionSelectionSeed,
      activeCandidateScores.map((item) => item.score),
    )
    : null;

  // Si quedan varios candidatos pero ninguna pregunta los separa, es un
  // empate real: sus perfiles de respuestas son indistinguibles.
  const phase: SinglePlayerPhase = outcome.phase === 'tie' && nextQuestion !== null
    ? 'playing'
    : outcome.phase === 'tie' && reachedLimit
      ? 'limit-reached'
      : outcome.phase;

  const askedTraits = questions
    .filter((question) => askedQuestionIds.includes(question.id))
    .map((question) => question.trait);

  return {
    candidates,
    questions,
    strategy,
    maxQuestions,
    questionSelectionSeed,
    remainingCandidates,
    candidateScores,
    rejectedCandidateIds,
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
  const maxQuestions = options.maxQuestions ?? SINGLE_PLAYER_MAX_QUESTIONS;
  if (!Number.isInteger(maxQuestions) || maxQuestions < 1) {
    throw new Error('El límite de preguntas debe ser un entero positivo.');
  }
  const questionSelectionSeed = options.questionSelectionSeed === undefined
    ? Math.floor(Math.random() * 0xFFFFFFFF)
    : options.questionSelectionSeed >>> 0;
  return buildState(
    [...candidates],
    questions,
    strategy,
    maxQuestions,
    questionSelectionSeed,
    [],
    {},
    [],
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
      remainingCount: 0,
      remainingCandidateIds: [],
      yesCountBeforeAnswer: question.yesCount,
      noCountBeforeAnswer: question.noCount,
    },
  ];

  const nextState = buildState(
    state.candidates,
    state.questions,
    state.strategy,
    state.maxQuestions,
    state.questionSelectionSeed,
    askedQuestionIds,
    answers,
    history,
    state.rejectedCandidateIds,
  );
  const lastEvent = nextState.history[nextState.history.length - 1];
  return {
    ...nextState,
    history: [
      ...nextState.history.slice(0, -1),
      {
        ...lastEvent,
        remainingCount: nextState.remainingCandidates.length,
        remainingCandidateIds: nextState.remainingCandidates.map((candidate) => candidate.id),
      },
    ],
  };
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
  const nextState = buildState(
    state.candidates,
    state.questions,
    state.strategy,
    state.maxQuestions,
    state.questionSelectionSeed,
    state.askedQuestionIds,
    state.answers,
    state.history,
    [...state.rejectedCandidateIds, winnerId],
  );
  // A proposal rejected on the final allowed question is a player win: the
  // machine has used its complete budget and cannot ask another question.
  return state.history.length >= state.maxQuestions
    ? { ...nextState, phase: 'limit-reached', currentQuestion: null, winner: null }
    : nextState;
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
    maxQuestions: state.maxQuestions,
    questionSelectionSeed: state.questionSelectionSeed,
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
  if (state.phase === 'limit-reached') {
    return { phase: 'limit-reached', winner: null, candidates: state.remainingCandidates };
  }
  return { phase: 'no-match', winner: null, candidates: [] };
}
