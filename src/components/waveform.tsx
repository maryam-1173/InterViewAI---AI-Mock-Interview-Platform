"use client";

type WaveformProps = {
  color?: "spotlight" | "signal" | "graphite";
  bars?: number;
  active?: boolean;
  className?: string;
  heightClass?: string;
};

const colorMap: Record<NonNullable<WaveformProps["color"]>, string> = {
  spotlight: "bg-spotlight",
  signal: "bg-signal",
  graphite: "bg-graphite",
};

/**
 * The recurring visual signature of InterViewAI: a row of pulse bars
 * standing in for a voice waveform. Used in the hero, the live session
 * (to show who is speaking), and behind report metrics.
 */
export default function Waveform({
  color = "spotlight",
  bars = 24,
  active = true,
  className = "",
  heightClass = "h-10",
}: WaveformProps) {
  return (
    <div
      className={`flex items-end gap-[3px] ${heightClass} ${className}`}
      aria-hidden="true"
    >
      {Array.from({ length: bars }).map((_, i) => {
        const delay = (i % 8) * 0.09;
        const baseHeight = 20 + ((i * 37) % 80);
        return (
          <span
            key={i}
            className={`waveform-bar w-[3px] rounded-full ${colorMap[color]} ${
              active ? "opacity-90" : "opacity-30"
            }`}
            style={{
              height: `${baseHeight}%`,
              animationDelay: `${delay}s`,
              animationPlayState: active ? "running" : "paused",
            }}
          />
        );
      })}
    </div>
  );
}
