import { NextRequest, NextResponse } from "next/server";
import { addResponse } from "@/lib/db";
import { detectFillerWords } from "@/lib/interview-engine";

/**
 * POST /api/interview/stt
 *
 * The transcription itself happens live in the browser via the Web
 * Speech API (SpeechRecognition) in src/app/session/page.tsx -- no audio
 * bytes are sent here, since the browser already returns text. This
 * route's real job is server-side: it runs filler-word detection on the
 * final transcript and persists it as a candidate response.
 *
 * If you swap browser STT for a cloud provider (Deepgram/Whisper) for
 * higher accuracy or non-Chrome support, this is where the raw audio
 * would be POSTed and transcribed server-side instead.
 *
 * Body: { sessionId: string; text: string; timestampMs: number }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const sessionId: string | undefined = body?.sessionId;
  const text: string = body?.text ?? "";
  const timestampMs: number = body?.timestampMs ?? 0;

  if (!sessionId || !text.trim()) {
    return NextResponse.json(
      { error: "sessionId and non-empty text are required" },
      { status: 400 }
    );
  }

  const fillerWords = detectFillerWords(text);
  const response = addResponse(sessionId, "candidate", text, timestampMs, fillerWords);

  return NextResponse.json({ response });
}
