// Shared domain types for InterViewAI.
// These mirror the eventual Prisma models (see prisma/schema.prisma) so the
// UI, API stubs, and DB layer stay in sync once real persistence is wired in.

export type AssessmentMode = "speaking" | "listening" | "written";

export type Speaker = "ai" | "candidate";

export interface TranscriptEntry {
  id: string;
  speaker: Speaker;
  text: string;
  timestampMs: number;
  /** Filler words detected in this line, e.g. "um", "like". Speaking mode only. */
  fillerWords?: string[];
}

export interface InterviewQuestion {
  id: string;
  prompt: string;
  mode: AssessmentMode;
  role: string;
  isFollowUp: boolean;
}

export interface ScoreMetric {
  key: "domain" | "fluency" | "confidence" | "structure";
  label: string;
  value: number; // 0-100
  description: string;
}

export interface SessionSummary {
  role: string;
  durationSeconds: number;
  wordsPerMinute: number;
  fillerWordCount: number;
  overallScore: number;
  metrics: ScoreMetric[];
  actionPlan: string[];
}
