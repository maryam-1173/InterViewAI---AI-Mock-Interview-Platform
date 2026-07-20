import { NextRequest, NextResponse } from "next/server";
import { createSession, addResponse } from "@/lib/db";
import { getQuestionsForRole } from "@/lib/mock-data";

/**
 * POST /api/interview/session
 *
 * Creates a real session row in SQLite (see src/lib/db.ts) and persists
 * the opening question as the first AI transcript entry. Returns the
 * session id the client should attach to every subsequent call.
 *
 * Body: { role: string }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const role: string = body?.role ?? "Software Engineer";

  const session = createSession(role);
  const bank = getQuestionsForRole(role);
  const firstQuestion = bank.find((q) => !q.isFollowUp) ?? bank[0];

  addResponse(session.id, "ai", firstQuestion.prompt, 0, []);

  return NextResponse.json({
    sessionId: session.id,
    role,
    question: firstQuestion,
  });
}
