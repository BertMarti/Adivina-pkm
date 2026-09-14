import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

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

type SoakDocument = {
  format: string;
  formatVersion: number;
  agentId: string;
  startedAt: string;
  finishedAt: string;
  seed: number;
  runs: number;
  contradictionRate: number;
  summary: {
    wins: number;
    inconsistent: number;
    ambiguous: number;
    limitReached: number;
    totalQuestions: number;
    averageQuestions: number;
  };
  sessions: SoakSession[];
};

type QuestionStat = {
  asked: number;
  yes: number;
  no: number;
  candidateReduction: number;
};

async function main() {
  const shardDirectory = resolve(process.cwd(), process.env.SINGLE_PLAYER_SOAK_SHARD_DIR ?? 'artifacts/soak-shards');
  const outputPath = resolve(process.cwd(), process.env.SINGLE_PLAYER_SOAK_MERGED_OUTPUT ?? 'artifacts/single-player-soak-results-merged.json');
  const entries = (await readdir(shardDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .sort((left, right) => left.name.localeCompare(right.name));

  const documents = await Promise.all(entries.map(async (entry) => {
    const source = await readFile(join(shardDirectory, entry.name), 'utf8');
    return JSON.parse(source) as SoakDocument;
  }));
  const sessions: SoakSession[] = [];
  const seenSessionIds = new Set<string>();
  const questionStats = new Map<string, QuestionStat>();

  for (const document of documents) {
    for (const session of document.sessions) {
      if (seenSessionIds.has(session.sessionId)) continue;
      seenSessionIds.add(session.sessionId);
      sessions.push(session);
      for (const event of session.events) {
        const previous = questionStats.get(event.questionId) ?? { asked: 0, yes: 0, no: 0, candidateReduction: 0 };
        previous.asked += 1;
        if (event.answer === 'yes') previous.yes += 1;
        else previous.no += 1;
        previous.candidateReduction += event.candidatesBefore - event.candidatesAfter;
        questionStats.set(event.questionId, previous);
      }
    }
  }

  const summary = sessions.reduce((result, session) => {
    const resultKey = session.result === 'won' ? 'wins' : session.result === 'ambiguous' ? 'ambiguous' : session.result === 'inconsistent' ? 'inconsistent' : 'limitReached';
    result[resultKey] += 1;
    result.totalQuestions += session.questions;
    return result;
  }, { wins: 0, inconsistent: 0, ambiguous: 0, limitReached: 0, totalQuestions: 0 } as Record<string, number>);

  const questionSummary = Object.fromEntries([...questionStats.entries()].map(([questionId, stat]) => [questionId, {
    ...stat,
    averageCandidateReduction: Number((stat.candidateReduction / stat.asked).toFixed(2)),
  }]));
  const startedAt = documents.map((document) => document.startedAt).sort()[0] ?? new Date().toISOString();
  const finishedAt = documents.map((document) => document.finishedAt).sort().at(-1) ?? new Date().toISOString();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify({
    format: 'adivina-pkm-single-player-soak-merged',
    formatVersion: 1,
    startedAt,
    finishedAt,
    agents: [...new Set(documents.map((document) => document.agentId))].sort(),
    shards: entries.map((entry) => entry.name),
    runs: sessions.length,
    summary: {
      ...summary,
      defeats: summary.inconsistent,
      averageQuestions: sessions.length ? Number((summary.totalQuestions / sessions.length).toFixed(2)) : 0,
    },
    questionSummary,
    sessions,
  }, null, 2), 'utf8');
  console.log(JSON.stringify({ agents: documents.length, shards: entries.length, runs: sessions.length, totalQuestions: summary.totalQuestions, output: outputPath }));
}

void main();
