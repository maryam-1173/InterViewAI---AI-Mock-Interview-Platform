import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/ai";
import { getResponses, finalizeSession } from "@/lib/db";
import { ANALYZE_INTERVIEW_PROMPT } from "@/lib/prompts";
import { scoreTranscript } from "@/lib/interview-engine";
import type { SessionSummary } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const sessionId: string | undefined = body?.sessionId;
    const role: string = body?.role ?? "Software Engineer";
    const durationSec: number = body?.durationSec ?? 0;

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    const responses = getResponses(sessionId);

    const transcript = responses
      .map(
        (r) =>
          `${r.speaker === "ai" ? "Interviewer" : "Candidate"}: ${r.text}`
      )
      .join("\n");

    let aiResult: any = null;

    // -------------------------------
    // Try Groq AI Analysis
    // -------------------------------
    try {
      const completion = await ai.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: ANALYZE_INTERVIEW_PROMPT,
          },
          {
            role: "user",
            content: transcript,
          },
        ],
      });

      const content =
        completion.choices[0]?.message?.content?.trim() ?? "";

      aiResult = JSON.parse(content);
    } catch (err) {
      console.error("Groq Analysis Error:", err);
    }

    // -------------------------------
    // Fallback to local scoring
    // -------------------------------
    if (!aiResult) {
      const candidateEntries = responses.filter(
        (r) => r.speaker === "candidate"
      );

      const local = scoreTranscript({
        role,
        candidateEntries: candidateEntries.map((r) => ({
          id: r.id,
          speaker: "candidate",
          text: r.text,
          timestampMs: r.timestampMs,
          fillerWords: r.fillerWords,
        })),
        totalDurationSec: durationSec,
      });

      aiResult = {
        overallScore: local.overallScore,
        metrics: {
          domain: local.metrics.find((m) => m.key === "domain")?.value ?? 0,
          fluency: local.metrics.find((m) => m.key === "fluency")?.value ?? 0,
          confidence:
            local.metrics.find((m) => m.key === "confidence")?.value ?? 0,
          structure:
            local.metrics.find((m) => m.key === "structure")?.value ?? 0,
        },
        actionPlan: local.actionPlan,
        wordsPerMinute: local.wordsPerMinute,
        fillerWordCount: local.fillerWordCount,
      };
    }

    // -------------------------------
    // Extra Metrics
    // -------------------------------
    const candidateResponses = responses.filter(
      (r) => r.speaker === "candidate"
    );

    const totalWords = candidateResponses.reduce(
      (sum, r) =>
        sum + r.text.split(/\s+/).filter(Boolean).length,
      0
    );

    const fillerCount = candidateResponses.reduce(
      (sum, r) => sum + (r.fillerWords?.length ?? 0),
      0
    );

    const wpm =
      durationSec > 0
        ? Math.round(totalWords / (durationSec / 60))
        : 0;

    finalizeSession(sessionId, durationSec, {
      domainScore: aiResult.metrics.domain,
      fluencyScore: aiResult.metrics.fluency,
      confidenceScore: aiResult.metrics.confidence,
      structureScore: aiResult.metrics.structure,
      overallScore: aiResult.overallScore,
      wordsPerMinute:
        aiResult.wordsPerMinute ?? wpm,
      fillerWordCount:
        aiResult.fillerWordCount ?? fillerCount,
      actionPlan: aiResult.actionPlan,
    });

    const summary: SessionSummary = {
      role,
      durationSeconds: durationSec,
      overallScore: aiResult.overallScore,
      wordsPerMinute:
        aiResult.wordsPerMinute ?? wpm,
      fillerWordCount:
        aiResult.fillerWordCount ?? fillerCount,
      metrics: [
        {
          key: "domain",
          label: "Domain competency",
          value: aiResult.metrics.domain,
          description: "Technical knowledge and correctness.",
        },
        {
          key: "fluency",
          label: "Fluency & delivery",
          value: aiResult.metrics.fluency,
          description: "Communication and speaking flow.",
        },
        {
          key: "confidence",
          label: "Confidence & tone",
          value: aiResult.metrics.confidence,
          description: "Confidence while answering.",
        },
        {
          key: "structure",
          label: "Structure (STAR)",
          value: aiResult.metrics.structure,
          description: "Organization of your answers.",
        },
      ],
      actionPlan: aiResult.actionPlan,
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Analysis failed.",
      },
      {
        status: 500,
      }
    );
  } 
}