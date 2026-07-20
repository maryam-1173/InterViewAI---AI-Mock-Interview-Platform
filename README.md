# InterViewAI

A fully working Next.js app for the InterViewAI brief. This isn't a UI
shell over fake data anymore -- every page is backed by real logic,
running end-to-end with no external API keys.

## What actually works, end to end

- **A real live session** (`/session`): pick a role, and the app creates
  a real database row, asks a real question, listens with your actual
  microphone via the browser's Web Speech API, and speaks with the
  browser's native voice via `speechSynthesis` -- both work with zero API
  keys. If a browser doesn't support speech recognition, it falls back to
  a typed-answer box automatically.
- **A real adaptive question engine** (`src/lib/interview-engine.ts`):
  after each answer, the app decides whether to ask a scripted follow-up
  or move on, based on the actual length of what you said (see
  `chooseNextQuestion`). Short answers get probed further.
- **Real scoring, not canned numbers** (`scoreTranscript` in the same
  file): domain competency is scored by matching your actual words
  against role-specific vocabulary; fluency by real filler-word counts
  and words-per-minute computed from real timestamps; confidence by
  detected hedging language ("I think", "maybe"); structure by detecting
  Situation/Task/Action/Result cues in what you actually said. The action
  plan on the report is generated from your real weakest areas, with your
  real numbers in the text.
- **Real persistence** (`src/lib/db.ts`): sessions, every transcript
  entry, and the final score are written to a real local SQLite database
  at `data/interviewai.db`, using Node's built-in `node:sqlite` module.
  The `/report` page reads this back by `sessionId` and renders your
  actual transcript and actual scores -- refresh it and your data is
  still there.
- **A real webcam panel**: an actual `getUserMedia` call, not a mock box.

Try it: go to `/session`, run through a role, and the `/report` page at
the end will show your real transcript, your real filler-word count, and
scores computed from what you actually said.

## What's an honest stub, and why

- **No cloud LLM/STT/TTS provider is wired in.** This MVP has no
  `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `DEEPGRAM_API_KEY`, or
  `ELEVENLABS_API_KEY` configured, so the "AI" here is the heuristic
  engine described above, not a model call. It's real, inspectable logic
  -- just not an LLM. The API routes under `src/app/api/interview/`
  (`question`, `stt`, `tts`, `analyze`) each have a comment block showing
  exactly what to replace with a real provider call, and the
  request/response shapes are already correct so the frontend won't need
  to change.
- **Prisma is not connected.** `prisma/schema.prisma` documents the
  intended production schema (Postgres via Prisma, matching the
  architecture doc). It isn't used at runtime because Prisma's engine
  binaries have to download from `binaries.prisma.sh`, which wasn't
  reachable in the sandbox this was built in. `src/lib/db.ts` is a real,
  working substitute using the same table shapes via `node:sqlite`. If
  you have normal internet access, you can restore Prisma: set
  `datasource.provider` back to `"postgresql"` in the schema, run
  `npx prisma migrate dev`, and swap the functions in `db.ts` for a
  generated Prisma client.
- **No LiveKit / WebRTC room.** Voice happens via the browser's own
  SpeechRecognition/SpeechSynthesis rather than a low-latency media
  server. Fine for practice sessions; the architecture doc's LiveKit
  layer would replace this for true multi-party or ultra-low-latency use.
- **Fonts fall back to a system stack** (`src/app/globals.css`) because
  this sandbox can't reach `fonts.googleapis.com`. The exact code to
  restore Space Grotesk / Inter / IBM Plex Mono is commented in
  `src/app/layout.tsx`.

## Run it

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`. Chrome is recommended for real speech
recognition; other browsers fall back to typed answers automatically.
Requires Node 22.5+ (for `node:sqlite`).

## Upgrading to a real LLM

Every heuristic in `interview-engine.ts` is a placeholder for a model
call. The fastest path to a real LLM-backed version:

1. Add `ANTHROPIC_API_KEY` to `.env`.
2. In `/api/interview/question`, replace `chooseNextQuestion(...)` with a
   call to Claude, prompting it with the full transcript so far and
   asking it to write a genuinely dynamic follow-up.
3. In `/api/interview/analyze`, replace `scoreTranscript(...)` with a
   call to Claude using a scoring rubric prompt, asking for the same
   `{ metrics, overallScore, actionPlan }` shape this route already
   returns -- so `/report` doesn't need to change at all.
