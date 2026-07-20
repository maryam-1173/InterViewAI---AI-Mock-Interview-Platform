"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mic, Square, ArrowRight, Video, VideoOff, Loader2, Keyboard } from "lucide-react";
import Waveform from "@/components/waveform";
import { ROLE_OPTIONS } from "@/lib/mock-data";
import type { InterviewQuestion, TranscriptEntry } from "@/lib/types";

type Phase =
  | "setup"
  | "ai-asking"
  | "awaiting-answer"
  | "recording"
  | "processing"
  | "done";

function fillerWordsIn(text: string): string[] {
  const fillers = ["um", "uh", "like", "you know", "sort of", "kind of"];
  const found: string[] = [];
  for (const f of fillers) {
    const m = text.match(new RegExp(`\\b${f}\\b`, "gi"));
    if (m) found.push(...m.map((x) => x.toLowerCase()));
  }
  return found;
}

// Minimal ambient typing for the Web Speech API, which TypeScript's DOM
// lib doesn't ship types for.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onend: (() => void) | null;
}

export default function SessionPage() {
  const router = useRouter();
  const [role, setRole] = useState<string>(ROLE_OPTIONS[0]);
  const [phase, setPhase] = useState<Phase>("setup");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [cameraOn, setCameraOn] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [manualAnswer, setManualAnswer] = useState("");
  const [liveInterim, setLiveInterim] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const sessionStartRef = useRef<number>(0);
  const answerCountRef = useRef<number>(0);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    setSpeechSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, liveInterim]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  function startTimer() {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
  }
  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  async function toggleCamera() {
    if (cameraOn) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraOn(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOn(true);
    } catch {
      setCameraOn(false);
    }
  }

  function addLocalEntry(speaker: "ai" | "candidate", text: string) {
    setTranscript((prev) => [
      ...prev,
      {
        id: `${speaker}-${prev.length}-${Date.now()}`,
        speaker,
        text,
        timestampMs: Date.now() - sessionStartRef.current,
        fillerWords: speaker === "candidate" ? fillerWordsIn(text) : undefined,
      },
    ]);
  }

  /** Speaks text aloud with the browser's native TTS, resolving when done. */
  function speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) {
        resolve();
        return;
      }
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1;
      utter.pitch = 1;
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      window.speechSynthesis.speak(utter);
    });
  }

  async function beginSession() {
    sessionStartRef.current = Date.now();
    answerCountRef.current = 0;
    setTranscript([]);
    setElapsedSec(0);
    startTimer();
    setPhase("ai-asking");

    const res = await fetch("/api/interview/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const data = await res.json();
    setSessionId(data.sessionId);
    setCurrentQuestion(data.question);
    addLocalEntry("ai", data.question.prompt);

    await speak(data.question.prompt);
    setPhase("awaiting-answer");
  }

  function beginRecording() {
    finalTranscriptRef.current = "";
    setLiveInterim("");
    setPhase("recording");

    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return; // handled by manual-entry UI instead

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (ev: SpeechRecognitionEventLike) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) {
          finalTranscriptRef.current += res[0].transcript + " ";
        } else {
          interim += res[0].transcript;
        }
      }
      setLiveInterim(interim);
    };
    recognition.onerror = () => {
      /* swallow -- user can still press Stop & submit with whatever was captured */
    };
    recognition.onend = () => {
      /* no-op: we drive stop state manually via finishRecording */
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  async function finishRecording(overrideText?: string) {
    recognitionRef.current?.stop();
    const text = (overrideText ?? finalTranscriptRef.current ?? "").trim();
    setLiveInterim("");
    setManualAnswer("");

    if (!text) {
      setPhase("awaiting-answer");
      return;
    }

    setPhase("processing");
    addLocalEntry("candidate", text);
    answerCountRef.current += 1;

    await fetch("/api/interview/stt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        text,
        timestampMs: Date.now() - sessionStartRef.current,
      }),
    });

    // Cap at 3 exchanges so a demo session stays short; the adaptive
    // question engine still decides follow-up vs. next question for
    // however many are asked within that cap.
    if (answerCountRef.current >= 3) {
      await finalize();
      return;
    }

    const qRes = await fetch("/api/interview/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, role }),
    });
    const qData = await qRes.json();

    if (qData.done || !qData.question) {
      await finalize();
      return;
    }

    setCurrentQuestion(qData.question);
    setPhase("ai-asking");
    addLocalEntry("ai", qData.question.prompt);
    await speak(qData.question.prompt);
    setPhase("awaiting-answer");
  }

  async function finalize() {
    stopTimer();
    const durationSec = Math.round((Date.now() - sessionStartRef.current) / 1000);
    await fetch("/api/interview/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, role, durationSec }),
    });
    setPhase("done");
  }

  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
  const ss = String(elapsedSec % 60).padStart(2, "0");

  if (phase === "setup") {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-73px)] max-w-lg flex-col justify-center px-6 py-16">
        <span className="font-mono text-xs tracking-wide text-graphite">New session</span>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-paper">
          What role are you interviewing for?
        </h1>
        <p className="mt-3 font-body text-sm text-graphite">
          InterViewAI will tailor jargon, depth, and follow-up questions to this role. It
          asks its questions out loud and listens for your spoken answer.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3">
          {ROLE_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`rounded-sm border px-4 py-3 text-left font-body text-sm transition-colors ${
                role === r
                  ? "border-spotlight bg-spotlight/10 text-paper"
                  : "border-border text-graphite hover:border-graphite"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {!speechSupported && (
          <p className="mt-6 flex items-center gap-2 rounded-sm border border-border bg-panel px-3 py-2 font-mono text-xs text-graphite">
            <Keyboard size={13} />
            Speech recognition isn&apos;t supported in this browser -- you&apos;ll type your
            answers instead. Try Chrome for the full voice experience.
          </p>
        )}

        <button
          onClick={beginSession}
          className="mt-10 flex items-center justify-center gap-2 rounded-sm bg-spotlight px-6 py-3 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.02]"
        >
          Enter the room
          <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-73px)] max-w-6xl flex-col px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <span className="font-mono text-xs text-graphite">{role}</span>
          <h1 className="font-display text-xl font-semibold text-paper">Live session</h1>
        </div>
        <div className="flex items-center gap-4 font-mono text-sm text-graphite">
          <span>
            {mm}:{ss}
          </span>
          <span className="text-graphite-dim">Q{answerCountRef.current + 1}/3</span>
        </div>
      </div>

      <div className="grid flex-1 gap-6 lg:grid-cols-[1fr_1fr]">
        {/* AI interviewer panel */}
        <div className="flex flex-col rounded-md border border-border bg-panel p-6">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-spotlight" />
            <span className="font-body text-xs font-medium text-graphite">AI interviewer</span>
          </div>
          <div className="mt-6 flex flex-1 flex-col items-center justify-center gap-8">
            <Waveform
              color="spotlight"
              bars={32}
              active={phase === "ai-asking" || phase === "processing"}
              heightClass="h-16"
            />
            <p className="max-w-md text-center font-display text-lg leading-snug text-paper">
              {currentQuestion?.prompt ?? "Preparing your first question..."}
            </p>
            {currentQuestion?.isFollowUp && (
              <span className="rounded-full border border-spotlight-dim bg-spotlight/10 px-3 py-1 font-mono text-[11px] text-spotlight">
                follow-up
              </span>
            )}
          </div>
        </div>

        {/* Candidate panel */}
        <div className="flex flex-col rounded-md border border-border bg-panel p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-signal" />
              <span className="font-body text-xs font-medium text-graphite">You</span>
            </div>
            <button
              onClick={toggleCamera}
              className="flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1 font-body text-xs text-graphite transition-colors hover:border-graphite"
            >
              {cameraOn ? <Video size={13} /> : <VideoOff size={13} />}
              {cameraOn ? "Camera on" : "Camera off"}
            </button>
          </div>

          <div className="relative mt-6 flex aspect-video items-center justify-center overflow-hidden rounded-sm border border-border bg-ink">
            {cameraOn ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video ref={videoRef} autoPlay muted playsInline className="h-full w-full scale-x-[-1] object-cover" />
            ) : (
              <span className="font-mono text-xs text-graphite-dim">
                Webcam panel -- click &quot;Camera off&quot; to enable
              </span>
            )}
          </div>

          <div className="mt-6 flex flex-1 flex-col items-center justify-center gap-6">
            {phase === "recording" && speechSupported && (
              <>
                <Waveform color="signal" bars={32} active heightClass="h-16" />
                {liveInterim && (
                  <p className="max-w-sm text-center font-body text-sm text-graphite-dim">
                    {liveInterim}
                  </p>
                )}
              </>
            )}
            {phase === "recording" && !speechSupported && (
              <textarea
                autoFocus
                value={manualAnswer}
                onChange={(e) => setManualAnswer(e.target.value)}
                placeholder="Type your answer..."
                className="h-28 w-full rounded-sm border border-border bg-ink p-3 font-body text-sm text-paper outline-none focus:border-signal"
              />
            )}
            {phase === "processing" && (
              <div className="flex items-center gap-2 font-mono text-xs text-graphite">
                <Loader2 size={14} className="animate-spin" />
                scoring your answer
              </div>
            )}

            {phase === "awaiting-answer" && (
              <button
                onClick={beginRecording}
                className="flex items-center gap-2 rounded-full bg-signal px-6 py-3 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.03]"
              >
                <Mic size={16} />
                Start answering
              </button>
            )}
            {phase === "recording" && (
              <button
                onClick={() => finishRecording(speechSupported ? undefined : manualAnswer)}
                className="flex items-center gap-2 rounded-full bg-alert px-6 py-3 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.03]"
              >
                <Square size={14} />
                Stop & submit
              </button>
            )}
            {phase === "done" && (
              <button
                onClick={() => router.push(`/report?sessionId=${sessionId}`)}
                className="flex items-center gap-2 rounded-full bg-spotlight px-6 py-3 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.03]"
              >
                See your report
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live transcript */}
      <div className="mt-6 max-h-56 overflow-y-auto rounded-md border border-border bg-panel-raised p-5">
        <span className="font-mono text-[11px] tracking-wide text-graphite-dim">LIVE TRANSCRIPT</span>
        <div className="mt-3 flex flex-col gap-3">
          {transcript.length === 0 && (
            <p className="font-mono text-xs text-graphite-dim">Your conversation will appear here.</p>
          )}
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
          <div ref={transcriptEndRef} />
        </div>
      </div>

      <div className="mt-4 text-center">
        <Link href="/" className="font-body text-xs text-graphite-dim hover:text-graphite">
          Exit session
        </Link>
      </div>
    </div>
  );
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
