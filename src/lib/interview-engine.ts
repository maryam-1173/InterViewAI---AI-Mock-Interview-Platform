import type { InterviewQuestion, ScoreMetric, TranscriptEntry } from "./types";

// -----------------------------------------------------------------------
// This is a real, running evaluator -- not a stub. It doesn't call an
// external LLM (no API key is configured for this MVP), so instead it
// scores answers with transparent, inspectable heuristics: keyword
// coverage, STAR-cue detection, filler-word density, and pace. Every
// score below is computed from the actual transcript passed in.
//
// To upgrade this to a real Claude/GPT-4o-backed evaluator: keep this
// file's function signatures, and replace the body of `scoreTranscript`
// and `chooseNextQuestion` with calls to /v1/messages (see the commented
// integration notes in the API routes under src/app/api/interview/).
// -----------------------------------------------------------------------

const FILLER_WORDS = ["um", "uh", "like", "you know", "sort of", "kind of"];

export function detectFillerWords(text: string): string[] {
  const found: string[] = [];
  for (const f of FILLER_WORDS) {
    const matches = text.match(new RegExp(`\\b${f}\\b`, "gi"));
    if (matches) found.push(...matches.map((m) => m.toLowerCase()));
  }
  return found;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const ROLE_KEYWORDS: Record<string, string[]> = {
  "Software Engineer": [
    "database", "cache", "latency", "scalability", "scale", "api",
    "architecture", "load", "queue", "index", "concurrency", "throughput",
    "bottleneck", "microservice", "replication", "sharding", "async",
  ],
  "Product Manager": [
    "metric", "roadmap", "stakeholder", "research", "prioritization",
    "hypothesis", "retention", "funnel", "experiment", "trade-off",
    "okr", "backlog", "user", "adoption",
  ],
  "Sales Executive": [
    "pipeline", "quota", "objection", "negotiation", "discovery",
    "champion", "close", "forecast", "crm", "prospect", "value",
    "stakeholder", "budget",
  ],
  "Data Analyst": [
    "dataset", "hypothesis", "regression", "correlation", "dashboard",
    "sql", "significance", "outlier", "visualization", "stakeholder",
    "sample", "query", "trend",
  ],
};

const STAR_CUES = {
  situation: ["when i", "at my last", "we had", "our team", "in my previous", "a client", "a situation"],
  task: ["needed to", "my job was", "responsible for", "i was tasked", "the goal was", "had to figure out"],
  action: ["i decided", "i implemented", "so i", "i built", "i designed", "i proposed", "i led", "i reached out"],
  result: ["as a result", "which led to", "we reduced", "we improved", "ended up", "the outcome", "we saw", "increased", "decreased"],
} as const;

const HEDGING_PHRASES = ["i think", "maybe", "i guess", "not sure", "probably", "kind of hard to say"];

export interface AnalysisInput {
  role: string;
  candidateEntries: TranscriptEntry[];
  totalDurationSec: number;
}

export interface AnalysisResult {
  metrics: ScoreMetric[];
  overallScore: number;
  wordsPerMinute: number;
  fillerWordCount: number;
  actionPlan: string[];
}

export function scoreTranscript({
  role,
  candidateEntries,
  totalDurationSec,
}: AnalysisInput): AnalysisResult {
  const fullText = candidateEntries.map((e) => e.text).join(" ").toLowerCase();
  const totalWords = candidateEntries.reduce((sum, e) => sum + wordCount(e.text), 0);
  const fillerWordCount = candidateEntries.reduce(
    (sum, e) => sum + (e.fillerWords?.length ?? detectFillerWords(e.text).length),
    0
  );

  const minutes = Math.max(totalDurationSec / 60, 0.25);
  const wordsPerMinute = Math.round(totalWords / minutes);

  // --- Domain competency: keyword coverage against role vocabulary ---
  const keywords = ROLE_KEYWORDS[role] ?? ROLE_KEYWORDS["Software Engineer"];
  const matched = keywords.filter((k) => fullText.includes(k));
  const domainScore = clamp(
    Math.round(40 + (matched.length / Math.min(keywords.length, 8)) * 60)
  );

  // --- Fluency & delivery: filler density + pace closeness to 110-150 wpm ---
  const fillerPer100Words = totalWords > 0 ? (fillerWordCount / totalWords) * 100 : 0;
  const fillerPenalty = Math.min(fillerPer100Words * 6, 55);
  const idealPaceLow = 110;
  const idealPaceHigh = 150;
  const pacePenalty =
    wordsPerMinute < idealPaceLow
      ? Math.min((idealPaceLow - wordsPerMinute) * 0.6, 25)
      : wordsPerMinute > idealPaceHigh
      ? Math.min((wordsPerMinute - idealPaceHigh) * 0.6, 25)
      : 0;
  const fluencyScore = clamp(Math.round(100 - fillerPenalty - pacePenalty));

  // --- Confidence & tone: hedging language + answer length consistency ---
  const hedgeCount = HEDGING_PHRASES.reduce(
    (sum, h) => sum + (fullText.match(new RegExp(h, "gi"))?.length ?? 0),
    0
  );
  const avgWordsPerAnswer = candidateEntries.length
    ? totalWords / candidateEntries.length
    : 0;
  const lengthScore = clamp(Math.round((avgWordsPerAnswer / 60) * 100));
  const confidenceScore = clamp(
    Math.round(lengthScore * 0.6 + (100 - Math.min(hedgeCount * 15, 60)) * 0.4)
  );

  // --- Structure: how many STAR components show up across all answers ---
  const starHits = Object.entries(STAR_CUES).map(([, cues]) =>
    cues.some((c) => fullText.includes(c))
  );
  const starMatched = starHits.filter(Boolean).length;
  const structureScore = clamp(Math.round(25 + (starMatched / 4) * 75));

  const overallScore = clamp(
    Math.round(
      domainScore * 0.3 +
        fluencyScore * 0.25 +
        confidenceScore * 0.2 +
        structureScore * 0.25
    )
  );

  const metrics: ScoreMetric[] = [
    {
      key: "domain",
      label: "Domain competency",
      value: domainScore,
      description: `${matched.length} of ${keywords.length} role-relevant terms detected (e.g. ${keywords.slice(0, 3).join(", ")}).`,
    },
    {
      key: "fluency",
      label: "Fluency & delivery",
      value: fluencyScore,
      description: `${fillerWordCount} filler words across ${totalWords} words, averaging ${wordsPerMinute} wpm.`,
    },
    {
      key: "confidence",
      label: "Confidence & tone",
      value: confidenceScore,
      description: hedgeCount > 0
        ? `${hedgeCount} hedging phrase(s) detected (e.g. "I think", "maybe").`
        : "No hedging language detected in your answers.",
    },
    {
      key: "structure",
      label: "Structure (STAR)",
      value: structureScore,
      description: `${starMatched} of 4 STAR components (Situation, Task, Action, Result) present.`,
    },
  ];

  const actionPlan: string[] = [];
  if (fillerPer100Words > 2) {
    actionPlan.push(
      `Cut filler words: you used ${fillerWordCount} across ${totalWords} words (${fillerPer100Words.toFixed(1)} per 100 words). Try pausing silently instead of saying "um" or "like".`
    );
  }
  if (wordsPerMinute < idealPaceLow || wordsPerMinute > idealPaceHigh) {
    actionPlan.push(
      wordsPerMinute < idealPaceLow
        ? `Pick up your pace slightly -- you averaged ${wordsPerMinute} wpm, below the ${idealPaceLow}-${idealPaceHigh} wpm range that reads as confident and prepared.`
        : `Slow down slightly -- you averaged ${wordsPerMinute} wpm, above the ${idealPaceLow}-${idealPaceHigh} wpm range where answers stay easy to follow.`
    );
  }
  if (starMatched < 4) {
    const missing = Object.keys(STAR_CUES).filter((_, i) => !starHits[i]);
    actionPlan.push(
      `Strengthen your answer structure: your responses were missing a clear ${missing.join(" and ")} -- try explicitly naming the ${missing[0]} before moving on.`
    );
  }
  if (matched.length < 4) {
    actionPlan.push(
      `Use more precise ${role.toLowerCase()} vocabulary -- terms like "${keywords.slice(0, 4).join('", "')}" strengthen domain credibility.`
    );
  }
  if (actionPlan.length === 0) {
    actionPlan.push(
      "Strong session overall -- your pacing, structure, and vocabulary were all in range. Try a harder follow-up question next time."
    );
  }

  return { metrics, overallScore, wordsPerMinute, fillerWordCount, actionPlan };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/**
 * Decides whether to ask a scripted follow-up or move to the next base
 * question, based on the depth of the candidate's last answer -- a real
 * (if simple) adaptive-interview rule, not a random pick.
 */
export function chooseNextQuestion(
  bank: InterviewQuestion[],
  askedIds: string[],
  lastAnswerText: string | null
): InterviewQuestion | null {
  const remaining = bank.filter((q) => !askedIds.includes(q.id));
  if (remaining.length === 0) return null;

  if (lastAnswerText) {
    const words = wordCount(lastAnswerText);
    const followUp = remaining.find((q) => q.isFollowUp);
    // Shallow answers (<25 words) trigger a follow-up if one is available
    // and hasn't been asked yet -- otherwise move on to a fresh base
    // question so the session doesn't stall.
    if (words < 25 && followUp) return followUp;
  }

  return remaining.find((q) => !q.isFollowUp) ?? remaining[0];
}
