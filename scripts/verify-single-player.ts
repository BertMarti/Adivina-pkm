import assert from 'node:assert/strict';
import {
  answerQuestion,
  createSinglePlayerGame,
  SINGLE_PLAYER_MAX_QUESTIONS,
} from '../src/game/singlePlayerEngine';
import {
  SINGLE_PLAYER_NATIONAL_QUESTION_BANK,
  SINGLE_PLAYER_QUESTION_BANK,
} from '../src/data/singlePlayerKnowledge';

const fixtureCandidates = [
  { id: 1, name: 'A', answers: { fur: true, wings: false, water: false } },
  { id: 2, name: 'B', answers: { fur: false, wings: true, water: false } },
  { id: 3, name: 'C', answers: { fur: false, wings: false, water: true } },
  { id: 4, name: 'D', answers: { fur: true, wings: true, water: true } },
];
const fixtureQuestions = [
  { id: 'fur', trait: 'fur', text: '¿Tiene pelo?' },
  { id: 'wings', trait: 'wings', text: '¿Tiene alas?' },
  { id: 'water', trait: 'water', text: '¿Es acuático?' },
];

function playTruthful(seed: number) {
  let state = createSinglePlayerGame(fixtureCandidates, {
    questions: fixtureQuestions,
    questionSelectionSeed: seed,
  });
  while (state.phase === 'playing' && state.currentQuestion !== null) {
    const answer = fixtureCandidates[0].answers[state.currentQuestion.trait as keyof typeof fixtureCandidates[0]['answers']] === true;
    state = answerQuestion(state, answer);
  }
  return state;
}

const firstQuestions = new Set(
  Array.from({ length: 32 }, (_, index) => createSinglePlayerGame(fixtureCandidates, {
    questions: fixtureQuestions,
    questionSelectionSeed: index + 1,
  }).currentQuestion?.id),
);
assert(firstQuestions.size >= 2, 'Las semillas deben variar la primera pregunta.');
assert.deepEqual(
  playTruthful(123).history.map((event) => event.question.id),
  playTruthful(123).history.map((event) => event.question.id),
  'La misma semilla debe ser reproducible.',
);
assert(playTruthful(123).history.length <= SINGLE_PLAYER_MAX_QUESTIONS, 'La partida no puede superar 30 preguntas.');

const limited = answerQuestion(createSinglePlayerGame(fixtureCandidates, {
  questions: fixtureQuestions,
  maxQuestions: 1,
  questionSelectionSeed: 1,
}), true);
assert.equal(limited.phase, 'limit-reached', 'El límite debe dar la victoria al jugador.');

const forbidden = [...SINGLE_PLAYER_QUESTION_BANK, ...SINGLE_PLAYER_NATIONAL_QUESTION_BANK]
  .filter((question) => /pokédex|pokedex|número|numero|peso|región|region|generación|generacion/i.test(question.prompt));
assert.deepEqual(forbidden, [], 'El banco no debe contener atajos numéricos, físicos, regionales o generacionales.');

console.log(JSON.stringify({
  ok: true,
  firstQuestions: [...firstQuestions],
  kantoQuestions: SINGLE_PLAYER_QUESTION_BANK.length,
  nationalQuestions: SINGLE_PLAYER_NATIONAL_QUESTION_BANK.length,
  maxQuestions: SINGLE_PLAYER_MAX_QUESTIONS,
}));
