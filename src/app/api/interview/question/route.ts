
import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/ai";
import { addResponse, getResponses } from "@/lib/db";
import { getQuestionsForRole } from "@/lib/mock-data";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const sessionId: string | undefined = body?.sessionId;
    const role: string = body?.role ?? "Software Engineer";

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    const responses = getResponses(sessionId);

    const aiMessages = responses.filter((r) => r.speaker === "ai");
    const candidateMessages = responses.filter(
      (r) => r.speaker === "candidate"
    );

    const bank = getQuestionsForRole(role);

    // First question if candidate hasn't answered yet
    if (candidateMessages.length === 0) {
      const firstQuestion = bank.find((q) => !q.isFollowUp) ?? bank[0];

      return NextResponse.json({
        done: false,
        question: firstQuestion,
      });
    }

    const lastAnswer =
      candidateMessages[candidateMessages.length - 1]?.text ?? "";

    const transcript = responses
      .map(
        (r) =>
          `${r.speaker === "ai" ? "Interviewer" : "Candidate"}: ${r.text}`
      )
      .join("\n");

    let questionText = "";

    try {
      const completion = await ai.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: `You are a professional interviewer.

Role: ${role}

Your job is to ask ONLY ONE interview question.

Rules:

- Ask only one question.
- Do not explain anything.
- Do not give feedback.
- Do not answer yourself.
- If the candidate answer is weak or short, ask a follow-up.
- Otherwise ask the next interview question.
- Return plain text only.
`,
          },
          {
            role: "user",
            content: `Interview Transcript:

${transcript}

Candidate's latest answer:

${lastAnswer}

Ask the next interview question.`,
          },
        ],
      });

      questionText =
        completion.choices[0]?.message?.content?.trim() ?? "";
    } catch (err) {
      console.error("Groq Question Error:", err);
    }

    // Fallback to local question bank
    if (!questionText) {
      const askedQuestions = aiMessages.map((m) => m.text);

      const next =
        bank.find((q) => !askedQuestions.includes(q.prompt)) ?? null;

      if (!next) {
        return NextResponse.json({
          done: true,
        });
      }

      questionText = next.prompt;
    }

    const timestamp =
      responses.length > 0
        ? Math.max(...responses.map((r) => r.timestampMs)) + 1000
        : 0;

    addResponse(sessionId, "ai", questionText, timestamp, []);

    return NextResponse.json({
      done: false,
      question: {
        id: `ai-${Date.now()}`,
        prompt: questionText,
        role,
        mode: "speaking",
        isFollowUp: true,
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Failed to generate question.",
      },
      {
        status: 500,
      }
    );
  }
} 