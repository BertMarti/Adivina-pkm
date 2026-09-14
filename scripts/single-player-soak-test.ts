import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SINGLE_PLAYER_KANTO_KNOWLEDGE, SINGLE_PLAYER_QUESTION_BANK } from '../src/data/singlePlayerKnowledge';
import {
  answerQuestion,
  createSinglePlayerGame,
  SinglePlayerState,
} from '../src/game/singlePlayerEngine';

type SoakEvent = {
  questionId: string;
  answer: 'yes' | 'no';
  candidatesBefore: number;
  candidatesAfter: number;
  remainingCandidateIds: number[];
};

type SoakSession = {
  sessionId: string;
  agentId: string;
  secretId: number;
  result: 'won' | 'ambiguous' | 'inconsistent' | 'limit-reached';
  questions: number;
  events: SoakEvent[];
};

function createSeededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function makeState() {
  const questions = SINGLE_PLAYER_QUESTION_BANK.map((question) => ({
    id: question.id,
    trait: question.trait,
    text: question.prompt,
  }));
  const candidates = SINGLE_PLAYER_KANTO_KNOWLEDGE.map((entry) => ({
    id: entry.candidate.id,
    name: entry.candidate.name,
    answers: Object.fromEntries(questions.map((question) => [question.trait, entry.traits[question.trait as keyof typeof entry.traits] === true])),
    metadata: entry,
  }));
  return createSinglePlayerGame(candidates, { questions });
}

function classify(state: SinglePlayerState<number, typeof SINGLE_PLAYER_KANTO_KNOWLEDGE[number]>, secretId: number): SoakSession['result'] {
  if (state.phase === 'won' && state.winner?.id === secretId) return 'won';
  if (state.phase === 'won') return 'inconsistent';
  if (state.phase === 'no-match') return 'inconsistent';
  if (state.phase === 'tie') return 'ambiguous';
  return 'limit-reached';
}

async function main() {
  const runs = Math.max(1, Number(process.env.SINGLE_PLAYER_SOAK_RUNS ?? 10000));
  const contradictionRate = Math.min(1, Math.max(0, Number(process.env.SINGLE_PLAYER_SOAK_CONTRADICTION_RATE ?? 0.1)));
  const seed = Number(process.env.SINGLE_PLAYER_SOAK_SEED ?? 20260914);
  const agentId = process.env.SINGLE_PLAYER_SOAK_AGENT_ID ?? 'local';
  const outputPath = process.env.SINGLE_PLAYER_SOAK_OUTPUT ?? 'artifacts/single-player-soak-results.json';
  const random = createSeededRandom(seed);
  const sessions: SoakSession[] = [];
  const startedAt = new Date().toISOString();
  let wins = 0;
  let inconsistent = 0;
  let ambiguous = 0;
  let questions = 0;

  for (let index = 0; index < runs; index += 1) {
    const state0 = makeState();
    const secret = state0.candidates[Math.floor(random() * state0.candidates.length)];
    let state = state0;
    const events: SoakEvent[] = [];
    let step = 0;
    while (state.phase === 'playing' && state.currentQuestion && step < 100) {
      const question = state.currentQuestion;
      const truthfulAnswer = state.candidates.find((candidate) => candidate.id === secret.id)?.answers[question.trait] === true;
      const shouldContradict = step === 0 && random() < contradictionRate;
      const answer = shouldContradict ? !truthfulAnswer : truthfulAnswer;
      const next = answerQuestion(state, answer);
      events.push({
        questionId: question.id,
        answer: answer ? 'yes' : 'no',
        candidatesBefore: state.remainingCandidates.length,
        candidatesAfter: next.remainingCandidates.length,
        remainingCandidateIds: next.remainingCandidates.map((candidate) => candidate.id),
      });
      state = next;
      step += 1;
    }
    const result = classify(state, secret.id);
    if (result === 'won') wins += 1;
    if (result === 'inconsistent') inconsistent += 1;
    if (result === 'ambiguous') ambiguous += 1;
    questions += events.length;
    sessions.push({ sessionId: `${agentId}-soak-${index + 1}`, agentId, secretId: secret.id, result, questions: events.length, events });
  }

  const finishedAt = new Date().toISOString();
  const outputFile = join(process.cwd(), outputPath);
  const outputDirectory = join(process.cwd(), outputPath.split(/[\\/]/).slice(0, -1).join('/') || 'artifacts');
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputFile, JSON.stringify({
    format: 'adivina-pkm-single-player-soak',
    formatVersion: 1,
    agentId,
    startedAt,
    finishedAt,
    seed,
    runs,
    contradictionRate,
    summary: {
      wins,
      inconsistent,
      ambiguous,
      limitReached: runs - wins - inconsistent - ambiguous,
      totalQuestions: questions,
      averageQuestions: Number((questions / runs).toFixed(2)),
    },
    sessions,
  }, null, 2), 'utf8');
  console.log(JSON.stringify({ agentId, runs, wins, inconsistent, ambiguous, totalQuestions: questions, averageQuestions: Number((questions / runs).toFixed(2)), output: outputPath }));
}

void main();
