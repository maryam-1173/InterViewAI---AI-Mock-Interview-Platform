import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/interview/tts
 *
 * Integration point: Text-to-Speech (ElevenLabs / Cartesia Sonic).
 *
 * NOTE: the running MVP does not call this route. The session page uses
 * the browser's built-in `window.speechSynthesis` to actually speak AI
 * questions out loud (see src/app/session/page.tsx), since that requires
 * no API key and works today. This route is kept as the intended
 * production integration point for a higher-quality cloud voice.
 *
 * Expected request body: { text: string; voiceId?: string }
 *
 * In production this route should:
 *   1. Call ElevenLabs' or Cartesia's streaming synthesis endpoint with
 *      `text`, targeting the ~200ms generation budget from the
 *      architecture doc's latency table.
 *   2. Pipe the returned audio stream directly back to the client (or to
 *      the LiveKit room as a published audio track) rather than buffering
 *      the whole file, to keep round-trip latency under the 800ms budget.
 *
 * This stub returns a placeholder payload -- no audio bytes -- so the
 * session UI can simulate "AI is speaking" without a configured TTS key.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({
    text: body?.text ?? "",
    audioUrl: null,
    note: "[stub] audio stream would be returned here by ElevenLabs / Cartesia.",
  });
}
