import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  loadSinglePlayerNationalKnowledge,
  SINGLE_PLAYER_NATIONAL_QUESTION_BANK,
} from '../src/data/singlePlayerKnowledge';
import { answerQuestion, createSinglePlayerGame, SINGLE_PLAYER_MAX_QUESTIONS, SinglePlayerState } from '../src/game/singlePlayerEngine';

type FleetEvent = {
  questionId: string;
  question: string;
  answer: 'yes' | 'no';
  candidatesBefore: number;
  candidatesAfter: number;
  remainingCandidateIds: number[];
};

type FleetSession = {
  sessionId: string;
  agentId: string;
  secretId: number;
  result: 'won' | 'inconsistent' | 'ambiguous' | 'limit-reached';
  questions: number;
  events: FleetEvent[];
};

type FleetManifest = {
  format: 'pokequien-single-player-national-fleet';
  formatVersion: 2;
  catalog: 'national-1025-local';
  agentCount: number;
  runsPerAgent: number;
  maxQuestions: number;
  contradictionRate: number;
  seed: number;
  startedAt: string;
  finishedAt: string;
  summary: {
    wins: number;
    inconsistent: number;
    ambiguous: number;
    limitReached: number;
    totalQuestions: number;
    sessions: number;
    averageQuestions: number;
  };
  shardSize: number;
  shards: string[];
};

function seeded(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function classify<T>(state: SinglePlayerState<number, T>, secretId: number): FleetSession['result'] {
  if (state.phase === 'won' && state.winner?.id === secretId) return 'won';
  if (state.phase === 'won' || state.phase === 'no-match') return 'inconsistent';
  if (state.phase === 'tie') return 'ambiguous';
  return 'limit-reached';
}

async function main() {
  const agentCount = Math.max(1, Number(process.env.SINGLE_PLAYER_FLEET_AGENTS ?? 50));
  // 50 logical agents × 1.000 sessions = the requested 50.000 games.
  const runsPerAgent = Math.max(1, Number(process.env.SINGLE_PLAYER_FLEET_RUNS ?? 1000));
  const contradictionRate = Math.min(1, Math.max(0, Number(process.env.SINGLE_PLAYER_FLEET_CONTRADICTION_RATE ?? 0.04)));
  const seed = Number(process.env.SINGLE_PLAYER_FLEET_SEED ?? 20260914);
  const outputDirectory = process.env.SINGLE_PLAYER_FLEET_OUTPUT ?? 'artifacts/single-player-national-fleet-50000';
  const shardSize = Math.max(1, Number(process.env.SINGLE_PLAYER_FLEET_SHARD_SIZE ?? 1000));
  const knowledge = await loadSinglePlayerNationalKnowledge();
  await mkdir(join(process.cwd(), outputDirectory), { recursive: true });
  const questions = SINGLE_PLAYER_NATIONAL_QUESTION_BANK.map((question) => ({ id: question.id, trait: question.trait, text: question.prompt }));
  const candidates = knowledge.map((entry) => ({
    id: entry.candidate.id,
    name: entry.candidate.name,
    answers: Object.fromEntries(questions.map((question) => [question.trait, entry.traits[question.trait] === true])),
    metadata: entry,
  }));
  const random = seeded(seed);
  const sessions: FleetSession[] = [];
  const shardFiles: string[] = [];
  let shardNumber = 0;
  const summary = { wins: 0, inconsistent: 0, ambiguous: 0, limitReached: 0, totalQuestions: 0 };
  const startedAt = new Date().toISOString();

  const flushShard = async () => {
    if (sessions.length === 0) return;
    shardNumber += 1;
    const fileName = `shard-${String(shardNumber).padStart(3, '0')}.json`;
    const shardDocument = {
      format: 'pokequien-single-player-national-fleet-shard',
      formatVersion: 2,
      shard: shardNumber,
      sessions,
    };
    await writeFile(join(process.cwd(), outputDirectory, fileName), JSON.stringify(shardDocument), 'utf8');
    shardFiles.push(fileName);
    sessions.length = 0;
  };

  for (let agentIndex = 0; agentIndex < agentCount; agentIndex += 1) {
    const agentId = `national-agent-${String(agentIndex + 1).padStart(2, '0')}`;
    for (let runIndex = 0; runIndex < runsPerAgent; runIndex += 1) {
      const state0 = createSinglePlayerGame(candidates, {
        questions,
        maxQuestions: SINGLE_PLAYER_MAX_QUESTIONS,
        questionSelectionSeed: Math.max(1, Math.floor(random() * 0xFFFFFFFF)),
      });
      const secret = state0.candidates[Math.floor(random() * state0.candidates.length)];
      let state = state0;
      const events: FleetEvent[] = [];
      let step = 0;
      while (state.phase === 'playing' && state.currentQuestion && step < state.maxQuestions) {
        const question = state.currentQuestion;
        const truthfulAnswer = state.candidates.find((candidate) => candidate.id === secret.id)?.answers[question.trait] === true;
        const shouldContradict = step === 0 && random() < contradictionRate;
        const answer = shouldContradict ? !truthfulAnswer : truthfulAnswer;
        const next = answerQuestion(state, answer);
        events.push({ questionId: question.id, question: question.text, answer: answer ? 'yes' : 'no', candidatesBefore: state.remainingCandidates.length, candidatesAfter: next.remainingCandidates.length, remainingCandidateIds: next.remainingCandidates.map((candidate) => candidate.id) });
        state = next;
        step += 1;
      }
      const result = classify(state, secret.id);
      const summaryKey = result === 'won' ? 'wins' : result === 'limit-reached' ? 'limitReached' : result;
      summary[summaryKey] += 1;
      summary.totalQuestions += events.length;
      sessions.push({ sessionId: `${agentId}-run-${runIndex + 1}`, agentId, secretId: secret.id, result, questions: events.length, events });
      if (sessions.length >= shardSize) await flushShard();
    }
    if ((agentIndex + 1) % 5 === 0) console.log(`Flota nacional: ${agentIndex + 1}/${agentCount} agentes`);
  }

  await flushShard();
  const document: FleetManifest = {
    format: 'pokequien-single-player-national-fleet',
    formatVersion: 2,
    catalog: 'national-1025-local',
    agentCount,
    runsPerAgent,
    maxQuestions: SINGLE_PLAYER_MAX_QUESTIONS,
    contradictionRate,
    seed,
    startedAt,
    finishedAt: new Date().toISOString(),
    summary: { ...summary, sessions: agentCount * runsPerAgent, averageQuestions: Number((summary.totalQuestions / (agentCount * runsPerAgent)).toFixed(2)) },
    shardSize,
    shards: shardFiles,
  };
  await writeFile(join(process.cwd(), outputDirectory, 'manifest.json'), JSON.stringify(document, null, 2), 'utf8');
  console.log(JSON.stringify({ output: join(outputDirectory, 'manifest.json'), ...document.summary, shards: shardFiles.length }));
}

void main();
