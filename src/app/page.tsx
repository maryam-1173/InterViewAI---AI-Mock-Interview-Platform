import Link from "next/link";
import Waveform from "@/components/waveform";
import {
  Mic,
  Headphones,
  Code2,
  ArrowRight,
  GraduationCap,
  Building2,
  Users,
} from "lucide-react";

const MODULES = [
  {
    icon: Mic,
    title: "Speaking & fluency",
    color: "spotlight",
    description:
      "A dynamic AI voice interviewer reads your pace, filler-word usage, pause duration, and vocal modulation in real time.",
  },
  {
    icon: Headphones,
    title: "Listening & comprehension",
    color: "signal",
    description:
      "Situational audio clips test whether you can absorb a client requirement under pressure and respond accurately.",
  },
  {
    icon: Code2,
    title: "Written & technical",
    color: "spotlight",
    description:
      "Live coding, essay, or judgment responses scored for logical structure, technical precision, and clarity.",
  },
] as const;

const PIPELINE = [
  { label: "Audio / text input", detail: "Candidate speaks or types" },
  { label: "Speech-to-text", detail: "Timestamped transcription" },
  { label: "Contextual evaluator", detail: "Scores + writes the next question" },
  { label: "Feedback report", detail: "Metrics, transcript, action plan" },
];

const AUDIENCE = [
  {
    icon: GraduationCap,
    title: "Job seekers & graduates",
    description:
      "Rehearse high-stakes interviews somewhere the stakes are zero, until the real ones feel familiar.",
  },
  {
    icon: Users,
    title: "Universities & bootcamps",
    description:
      "Run cohort-wide mock interview programs and benchmark student readiness without staffing every session.",
  },
  {
    icon: Building2,
    title: "Enterprise HR teams",
    description:
      "Pre-screen applicant communication skills automatically before a human interviewer's calendar is on the line.",
  },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center opacity-40">
          <Waveform bars={60} heightClass="h-64" color="spotlight" />
        </div>
        <div className="relative mx-auto max-w-4xl px-6 pb-28 pt-24 text-center">
          <span className="inline-block rounded-full border border-border bg-panel px-3 py-1 font-mono text-xs tracking-wide text-graphite">
            AI-powered interview simulation
          </span>
          <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.1] tracking-tight text-paper sm:text-6xl">
            Practice the room
            <br />
            before you&apos;re in it.
          </h1>
          <p className="mx-auto mt-6 max-w-xl font-body text-base text-graphite sm:text-lg">
            InterViewAI runs real-time voice, listening, and technical
            interviews, then tells you exactly what to fix -- down to the
            filler word.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/session"
              className="group flex items-center gap-2 rounded-sm bg-spotlight px-6 py-3 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.03]"
            >
              Start a mock interview
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
            <Link
              href="/report"
              className="rounded-sm border border-border px-6 py-3 font-body text-sm font-medium text-paper transition-colors hover:border-graphite"
            >
              See a sample report
            </Link>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-14 max-w-2xl">
          <span className="font-mono text-xs tracking-wide text-graphite">
            01 / Assessment engine
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-paper">
            One session, three ways of listening.
          </h2>
        </div>
        <div className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
          {MODULES.map((m) => (
            <div key={m.title} className="bg-panel p-8">
              <m.icon
                size={22}
                className={m.color === "spotlight" ? "text-spotlight" : "text-signal"}
              />
              <h3 className="mt-5 font-display text-lg font-semibold text-paper">
                {m.title}
              </h3>
              <p className="mt-3 font-body text-sm leading-relaxed text-graphite">
                {m.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pipeline */}
      <section id="pipeline" className="border-y border-border bg-panel/40">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="mb-14 max-w-2xl">
            <span className="font-mono text-xs tracking-wide text-graphite">
              02 / How it works
            </span>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-paper">
              A pipeline built for a two-second window.
            </h2>
            <p className="mt-4 font-body text-sm leading-relaxed text-graphite">
              If the AI takes longer than that to respond, the realism
              breaks. Every stage below is budgeted in milliseconds.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-4">
            {PIPELINE.map((step, i) => (
              <div key={step.label} className="relative">
                <div className="font-mono text-xs text-spotlight">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="mt-3 h-px w-full bg-border" />
                <h3 className="mt-4 font-display text-base font-semibold text-paper">
                  {step.label}
                </h3>
                <p className="mt-2 font-body text-sm text-graphite">
                  {step.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Audience */}
      <section id="audience" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-14 max-w-2xl">
          <span className="font-mono text-xs tracking-wide text-graphite">
            03 / Who it&apos;s for
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-paper">
            Built for the practice, and the pipeline.
          </h2>
        </div>
        <div className="grid gap-8 sm:grid-cols-3">
          {AUDIENCE.map((a) => (
            <div key={a.title}>
              <a.icon size={20} className="text-graphite" />
              <h3 className="mt-4 font-display text-base font-semibold text-paper">
                {a.title}
              </h3>
              <p className="mt-2 font-body text-sm leading-relaxed text-graphite">
                {a.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-20 text-center">
          <Waveform bars={40} color="signal" heightClass="h-8" />
          <h2 className="font-display text-2xl font-semibold tracking-tight text-paper sm:text-3xl">
            Your next interview is rehearsable.
          </h2>
          <Link
            href="/session"
            className="rounded-sm bg-spotlight px-6 py-3 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.03]"
          >
            Start a mock interview
          </Link>
        </div>
      </section>
    </>
  );
}
