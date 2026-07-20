import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

// -----------------------------------------------------------------------
// Real persistence for the MVP, using Node's built-in `node:sqlite`
// module (Node 22.5+) instead of Prisma. Prisma's schema is kept at
// prisma/schema.prisma as the intended production shape (Postgres via
// Prisma), but Prisma's query/schema engines have to be downloaded from
// binaries.prisma.sh, which this sandbox can't reach. node:sqlite ships
// with Node itself, so this actually runs, with the same table shape
// Prisma would have created.
//
// To move to real Postgres in production: keep this file's query shapes
// as a reference and swap the DatabaseSync calls for a Prisma client
// generated from prisma/schema.prisma (change its datasource provider
// back to "postgresql" first).
// -----------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "interviewai.db");

declare global {
  // eslint-disable-next-line no-var
  var __interviewaiDb: DatabaseSync | undefined;
}

function getDb(): DatabaseSync {
  if (global.__interviewaiDb) return global.__interviewaiDb;

  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_sec INTEGER
    );

    CREATE TABLE IF NOT EXISTS responses (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      speaker TEXT NOT NULL,
      text TEXT NOT NULL,
      timestamp_ms INTEGER NOT NULL,
      filler_words_json TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS score_summaries (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL UNIQUE,
      domain_score INTEGER NOT NULL,
      fluency_score INTEGER NOT NULL,
      confidence_score INTEGER NOT NULL,
      structure_score INTEGER NOT NULL,
      overall_score INTEGER NOT NULL,
      words_per_minute INTEGER NOT NULL,
      filler_word_count INTEGER NOT NULL,
      action_plan_json TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );
  `);
  global.__interviewaiDb = db;
  return db;
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export interface DbResponse {
  id: string;
  sessionId: string;
  speaker: "ai" | "candidate";
  text: string;
  timestampMs: number;
  fillerWords: string[];
}

export interface DbScoreSummary {
  domainScore: number;
  fluencyScore: number;
  confidenceScore: number;
  structureScore: number;
  overallScore: number;
  wordsPerMinute: number;
  fillerWordCount: number;
  actionPlan: string[];
}

export function createSession(role: string): { id: string; startedAt: string } {
  const db = getDb();
  const id = newId("sess");
  const startedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO sessions (id, role, started_at) VALUES (?, ?, ?)`
  ).run(id, role, startedAt);
  return { id, startedAt };
}

export function addResponse(
  sessionId: string,
  speaker: "ai" | "candidate",
  text: string,
  timestampMs: number,
  fillerWords: string[] = []
): DbResponse {
  const db = getDb();
  const id = newId("resp");
  db.prepare(
    `INSERT INTO responses (id, session_id, speaker, text, timestamp_ms, filler_words_json)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, sessionId, speaker, text, timestampMs, JSON.stringify(fillerWords));
  return { id, sessionId, speaker, text, timestampMs, fillerWords };
}

export function getResponses(sessionId: string): DbResponse[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, session_id as sessionId, speaker, text, timestamp_ms as timestampMs, filler_words_json as fillerWordsJson
       FROM responses WHERE session_id = ? ORDER BY timestamp_ms ASC`
    )
    .all(sessionId) as Array<{
    id: string;
    sessionId: string;
    speaker: string;
    text: string;
    timestampMs: number;
    fillerWordsJson: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    sessionId: r.sessionId,
    speaker: r.speaker as "ai" | "candidate",
    text: r.text,
    timestampMs: r.timestampMs,
    fillerWords: JSON.parse(r.fillerWordsJson || "[]"),
  }));
}

export function finalizeSession(
  sessionId: string,
  durationSec: number,
  summary: DbScoreSummary
): void {
  const db = getDb();
  const endedAt = new Date().toISOString();

  db.prepare(
    `UPDATE sessions SET ended_at = ?, duration_sec = ? WHERE id = ?`
  ).run(endedAt, durationSec, sessionId);

  const id = newId("score");
  db.prepare(
    `INSERT INTO score_summaries
       (id, session_id, domain_score, fluency_score, confidence_score, structure_score,
        overall_score, words_per_minute, filler_word_count, action_plan_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET
       domain_score=excluded.domain_score,
       fluency_score=excluded.fluency_score,
       confidence_score=excluded.confidence_score,
       structure_score=excluded.structure_score,
       overall_score=excluded.overall_score,
       words_per_minute=excluded.words_per_minute,
       filler_word_count=excluded.filler_word_count,
       action_plan_json=excluded.action_plan_json`
  ).run(
    id,
    sessionId,
    summary.domainScore,
    summary.fluencyScore,
    summary.confidenceScore,
    summary.structureScore,
    summary.overallScore,
    summary.wordsPerMinute,
    summary.fillerWordCount,
    JSON.stringify(summary.actionPlan)
  );
}

export function getSessionWithScore(sessionId: string): {
  session: { id: string; role: string; durationSec: number | null };
  responses: DbResponse[];
  score: DbScoreSummary | null;
} | null {
  const db = getDb();
  const session = db
    .prepare(
      `SELECT id, role, duration_sec as durationSec FROM sessions WHERE id = ?`
    )
    .get(sessionId) as { id: string; role: string; durationSec: number | null } | undefined;

  if (!session) return null;

  const responses = getResponses(sessionId);

  const scoreRow = db
    .prepare(
      `SELECT domain_score as domainScore, fluency_score as fluencyScore,
              confidence_score as confidenceScore, structure_score as structureScore,
              overall_score as overallScore, words_per_minute as wordsPerMinute,
              filler_word_count as fillerWordCount, action_plan_json as actionPlanJson
       FROM score_summaries WHERE session_id = ?`
    )
    .get(sessionId) as
    | {
        domainScore: number;
        fluencyScore: number;
        confidenceScore: number;
        structureScore: number;
        overallScore: number;
        wordsPerMinute: number;
        fillerWordCount: number;
        actionPlanJson: string;
      }
    | undefined;

  const score: DbScoreSummary | null = scoreRow
    ? {
        domainScore: scoreRow.domainScore,
        fluencyScore: scoreRow.fluencyScore,
        confidenceScore: scoreRow.confidenceScore,
        structureScore: scoreRow.structureScore,
        overallScore: scoreRow.overallScore,
        wordsPerMinute: scoreRow.wordsPerMinute,
        fillerWordCount: scoreRow.fillerWordCount,
        actionPlan: JSON.parse(scoreRow.actionPlanJson),
      }
    : null;

  return { session, responses, score };
}
