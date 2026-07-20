"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import Waveform from "@/components/waveform";
import {
  DEMO_SUMMARY,
  DEMO_TRANSCRIPT,
  DEMO_WPM_HISTORY,
} from "@/lib/mock-data";
import type { SessionSummary, TranscriptEntry } from "@/lib/types";
import { ArrowLeft, Loader2, RotateCcw } from "lucide-react";

interface DbResponseShape {
  speaker: "ai" | "candidate";
  text: string;
  timestampMs: number;
  fillerWords: string[];
}

export default function ReportPage() {
  return (
    <Suspense fallback={<ReportLoading />}>
      <ReportContent />
    </Suspense>
  );
}

function ReportLoading() {
  return (
    <div className="flex min-h-[calc(100vh-73px)] items-center justify-center gap-2 font-mono text-xs text-graphite">
      <Loader2 size={14} className="animate-spin" />
      Loading report...
    </div>
  );
}

function ReportContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [loading, setLoading] = useState(Boolean(sessionId));
  const [isDemo, setIsDemo] = useState(!sessionId);

  useEffect(() => {
    if (!sessionId) {
      setSummary(DEMO_SUMMARY);
      setTranscript(DEMO_TRANSCRIPT);
      setIsDemo(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/interview/session/${sessionId}`);
        if (!res.ok) throw new Error("not found");
        const data = await res.json();
        if (cancelled) return;

        if (!data.score) {
          // Session exists but hasn't been analyzed yet -- fall back to demo.
          setSummary(DEMO_SUMMARY);
          setTranscript(DEMO_TRANSCRIPT);
          setIsDemo(true);
          setLoading(false);
          return;
        }

        const realSummary: SessionSummary = {
          role: data.session.role,
          durationSeconds: data.session.durationSec ?? 0,
          wordsPerMinute: data.score.wordsPerMinute,
          fillerWordCount: data.score.fillerWordCount,
          overallScore: data.score.overallScore,
          metrics: [
            { key: "domain", label: "Domain competency", value: data.score.domainScore, description: "Keyword coverage of role-relevant vocabulary." },
            { key: "fluency", label: "Fluency & delivery", value: data.score.fluencyScore, description: "Pace and filler-word density." },
            { key: "confidence", label: "Confidence & tone", value: data.score.confidenceScore, description: "Hedging language and answer length." },
            { key: "structure", label: "Structure (STAR)", value: data.score.structureScore, description: "Situation -> Task -> Action -> Result alignment." },
          ],
          actionPlan: data.score.actionPlan,
        };

        const realTranscript: TranscriptEntry[] = data.responses.map(
          (r: DbResponseShape, i: number) => ({
            id: `${r.speaker}-${i}`,
            speaker: r.speaker,
            text: r.text,
            timestampMs: r.timestampMs,
            fillerWords: r.fillerWords,
          })
        );

        setSummary(realSummary);
        setTranscript(realTranscript);
        setIsDemo(false);
      } catch {
        if (!cancelled) {
          setSummary(DEMO_SUMMARY);
          setTranscript(DEMO_TRANSCRIPT);
          setIsDemo(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (loading || !summary) return <ReportLoading />;

  const radarData = summary.metrics.map((m) => ({ metric: m.label, value: m.value }));
  const wpmHistory = isDemo
    ? DEMO_WPM_HISTORY
    : buildWpmHistory(transcript, summary.durationSeconds);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Link href="/session" className="flex items-center gap-1.5 font-body text-xs text-graphite hover:text-paper">
        <ArrowLeft size={13} />
        Back to session
      </Link>

      {isDemo && (
        <p className="mt-4 rounded-sm border border-border bg-panel px-3 py-2 font-mono text-xs text-graphite">
          Showing a sample report -- run a session to see your own real, scored results here.
        </p>
      )}

      <div className="mt-6 flex flex-col items-start justify-between gap-6 border-b border-border pb-10 sm:flex-row sm:items-end">
        <div>
          <span className="font-mono text-xs tracking-wide text-graphite">
            Diagnostic report -- {summary.role}
          </span>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-paper sm:text-4xl">
            Overall score: {summary.overallScore}
            <span className="text-graphite">/100</span>
          </h1>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <Waveform bars={20} color="spotlight" heightClass="h-6" />
          <span className="font-mono text-xs text-graphite">
            {Math.floor(summary.durationSeconds / 60)}m {summary.durationSeconds % 60}s session
          </span>
        </div>
      </div>

      {/* Metric cards */}
      <div className="mt-10 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4">
        {summary.metrics.map((m) => (
          <div key={m.key} className="bg-panel p-6">
            <span className="font-mono text-3xl font-medium text-paper">{m.value}</span>
            <h3 className="mt-2 font-display text-sm font-semibold text-paper">{m.label}</h3>
            <p className="mt-1 font-body text-xs leading-relaxed text-graphite">{m.description}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Radar */}
        <div className="rounded-md border border-border bg-panel p-6">
          <span className="font-mono text-[11px] tracking-wide text-graphite-dim">SCORE BREAKDOWN</span>
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="70%">
                <PolarGrid stroke="#262b38" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "#838ba0", fontSize: 11 }} />
                <Radar dataKey="value" stroke="#f2a93b" fill="#f2a93b" fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* WPM over time */}
        <div className="rounded-md border border-border bg-panel p-6">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[11px] tracking-wide text-graphite-dim">PACE OVER TIME</span>
            <span className="font-mono text-xs text-graphite">avg {summary.wordsPerMinute} wpm</span>
          </div>
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={wpmHistory}>
                <CartesianGrid stroke="#262b38" vertical={false} />
                <XAxis dataKey="minute" tick={{ fill: "#565d70", fontSize: 11 }} axisLine={{ stroke: "#262b38" }} tickLine={false} />
                <YAxis tick={{ fill: "#565d70", fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                <Tooltip contentStyle={{ background: "#171b25", border: "1px solid #262b38", borderRadius: 4, fontSize: 12 }} labelStyle={{ color: "#838ba0" }} />
                <Line type="monotone" dataKey="wpm" stroke="#5eead4" strokeWidth={2} dot={{ fill: "#5eead4", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Action plan */}
      <div className="mt-8 rounded-md border border-border bg-panel p-6">
        <span className="font-mono text-[11px] tracking-wide text-graphite-dim">PERSONALIZED ACTION PLAN</span>
        <ul className="mt-4 flex flex-col gap-4">
          {summary.actionPlan.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 font-mono text-xs text-alert">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-body text-sm leading-relaxed text-paper">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Annotated transcript */}
      <div className="mt-8 rounded-md border border-border bg-panel p-6">
        <span className="font-mono text-[11px] tracking-wide text-graphite-dim">ANNOTATED TRANSCRIPT</span>
        <div className="mt-4 flex flex-col gap-4">
          {transcript.map((entry) => (
            <div key={entry.id} className="font-body text-sm leading-relaxed">
              <span className={`mr-2 font-mono text-[11px] ${entry.speaker === "ai" ? "text-spotlight" : "text-signal"}`}>
                {entry.speaker === "ai" ? "AI" : "YOU"}
              </span>
              <span className="text-graphite">
                {entry.fillerWords && entry.fillerWords.length > 0 ? highlightFillers(entry.text) : entry.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 flex justify-center">
        <Link href="/session" className="flex items-center gap-2 rounded-sm bg-spotlight px-6 py-3 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.02]">
          <RotateCcw size={15} />
          Run another session
        </Link>
      </div>
    </div>
  );
}

/** Buckets candidate word counts into ~30s windows to chart real pace over the session. */
function buildWpmHistory(transcript: TranscriptEntry[], durationSeconds: number) {
  const candidateEntries = transcript.filter((t) => t.speaker === "candidate");
  if (candidateEntries.length === 0 || durationSeconds === 0) {
    return DEMO_WPM_HISTORY;
  }
  return candidateEntries.map((entry, i) => {
    const words = entry.text.trim().split(/\s+/).filter(Boolean).length;
    const sec = Math.max(entry.timestampMs / 1000, 1);
    const wpm = Math.round((words / sec) * 60);
    const mm = Math.floor(sec / 60);
    const ss = Math.floor(sec % 60);
    return {
      minute: `${mm}:${String(ss).padStart(2, "0")}`,
      wpm: Math.min(wpm, 240),
      key: i,
    };
  });
}

function highlightFillers(text: string) {
  const parts = text.split(/(\bum\b|\buh\b|\blike\b|\byou know\b|\bsort of\b|\bkind of\b)/gi);
  return parts.map((part, i) =>
    /^(um|uh|like|you know|sort of|kind of)$/i.test(part) ? (
      <span key={i} className="rounded-sm bg-alert/20 px-1 text-alert">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}
