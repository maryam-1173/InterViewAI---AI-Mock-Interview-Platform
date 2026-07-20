import { NextRequest, NextResponse } from "next/server";
import { getSessionWithScore } from "@/lib/db";

/**
 * GET /api/interview/session/[id]
 *
 * Reads the real persisted session, its full transcript, and its score
 * summary (if the session has been finalized) back out of SQLite. The
 * /report page calls this to render real results instead of demo data.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = getSessionWithScore(id);

  if (!data) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
