import type {
  InterviewQuestion,
  ScoreMetric,
  SessionSummary,
  TranscriptEntry,
} from "./types";

// -----------------------------------------------------------------------
// This file stands in for the AI Pipeline Services described in the
// architecture doc (Deepgram/Whisper STT, Claude/GPT-4o reasoning,
// ElevenLabs/Cartesia TTS). Every function here has a matching stub route
// under src/app/api/interview/* with the real integration points marked.
// -----------------------------------------------------------------------

export const ROLE_OPTIONS = [
  "Software Engineer",
  "Product Manager",
  "Sales Executive",
  "Data Analyst",
] as const;

const QUESTION_BANK: Record<string, InterviewQuestion[]> = {
  "Software Engineer": [
    {
      id: "q1",
      prompt:
        "Walk me through a system you designed that had to scale under real load. What broke first?",
      mode: "speaking",
      role: "Software Engineer",
      isFollowUp: false,
    },
    {
      id: "q1a",
      prompt:
        "You mentioned the database was the bottleneck -- what did you consider before adding a cache layer?",
      mode: "speaking",
      role: "Software Engineer",
      isFollowUp: true,
    },
    {
      id: "q1b",
      prompt:
        "How do you decide when a piece of technical debt is worth paying down versus living with?",
      mode: "speaking",
      role: "Software Engineer",
      isFollowUp: false,
    },
  ],
  "Product Manager": [
    {
      id: "q2",
      prompt:
        "Tell me about a feature you shipped that didn't move the metric you expected. What did you do next?",
      mode: "speaking",
      role: "Product Manager",
      isFollowUp: false,
    },
    {
      id: "q2a",
      prompt:
        "How did you decide it was the feature itself, and not the metric or the rollout, that was the problem?",
      mode: "speaking",
      role: "Product Manager",
      isFollowUp: true,
    },
    {
      id: "q2b",
      prompt:
        "How do you prioritize between a request from a big customer and something your data says most users need?",
      mode: "speaking",
      role: "Product Manager",
      isFollowUp: false,
    },
  ],
  "Sales Executive": [
    {
      id: "q3",
      prompt:
        "Describe the last deal you lost. What would you do differently with that same prospect today?",
      mode: "speaking",
      role: "Sales Executive",
      isFollowUp: false,
    },
    {
      id: "q3a",
      prompt:
        "At what point in that deal did you sense it was slipping, and what did you try before it fell through?",
      mode: "speaking",
      role: "Sales Executive",
      isFollowUp: true,
    },
    {
      id: "q3b",
      prompt:
        "Walk me through how you qualify a prospect early, before you've invested real time in them.",
      mode: "speaking",
      role: "Sales Executive",
      isFollowUp: false,
    },
  ],
  "Data Analyst": [
    {
      id: "q4",
      prompt:
        "A stakeholder disagrees with a conclusion your data supports. Walk me through how you handle that conversation.",
      mode: "speaking",
      role: "Data Analyst",
      isFollowUp: false,
    },
    {
      id: "q4a",
      prompt:
        "What would actually change your own mind about that conclusion, if anything?",
      mode: "speaking",
      role: "Data Analyst",
      isFollowUp: true,
    },
    {
      id: "q4b",
      prompt:
        "Tell me about a time your analysis was technically correct but still didn't land with the audience.",
      mode: "speaking",
      role: "Data Analyst",
      isFollowUp: false,
    },
  ],
};

export function getQuestionsForRole(role: string): InterviewQuestion[] {
  return QUESTION_BANK[role] ?? QUESTION_BANK["Software Engineer"];
}

export const DEMO_TRANSCRIPT: TranscriptEntry[] = [
  {
    id: "t1",
    speaker: "ai",
    text: "Walk me through a system you designed that had to scale under real load. What broke first?",
    timestampMs: 0,
  },
  {
    id: "t2",
    speaker: "candidate",
    text: "So, um, we had a booking service that was, like, fine at low traffic, but once we hit about, um, 3,000 requests a minute the database connections just started queuing up.",
    timestampMs: 4200,
    fillerWords: ["um", "like", "um"],
  },
  {
    id: "t3",
    speaker: "ai",
    text: "What did you consider before adding a cache layer?",
    timestampMs: 15800,
  },
];

export const DEMO_SCORE_METRICS: ScoreMetric[] = [
  {
    key: "domain",
    label: "Domain competency",
    value: 78,
    description: "Technical depth and accuracy of the explanation.",
  },
  {
    key: "fluency",
    label: "Fluency & delivery",
    value: 61,
    description: "Pace, filler-word density, and pause control.",
  },
  {
    key: "confidence",
    label: "Confidence & tone",
    value: 70,
    description: "Vocal steadiness and assertiveness under follow-up.",
  },
  {
    key: "structure",
    label: "Structure (STAR)",
    value: 66,
    description: "Situation -> Task -> Action -> Result alignment.",
  },
];

export const DEMO_WPM_HISTORY = [
  { minute: "0:30", wpm: 132 },
  { minute: "1:00", wpm: 118 },
  { minute: "1:30", wpm: 96 },
  { minute: "2:00", wpm: 141 },
  { minute: "2:30", wpm: 124 },
  { minute: "3:00", wpm: 108 },
];

export const DEMO_SUMMARY: SessionSummary = {
  role: "Software Engineer",
  durationSeconds: 372,
  wordsPerMinute: 119,
  fillerWordCount: 14,
  overallScore: 69,
  metrics: DEMO_SCORE_METRICS,
  actionPlan: [
    "Reduce response latency -- you paused over 4s before three of five answers.",
    "Strengthen technical terminology in system-design answers; 'thing' and 'stuff' stood in for precise nouns twice.",
    "Cut filler words under pressure: 'um' and 'like' spiked specifically on follow-up questions, not opening answers.",
  ],
};
