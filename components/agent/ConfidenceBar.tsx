"use client";

interface Props {
  confidence: number; // 0–1
}

export function ConfidenceBar({ confidence }: Props) {
  const pct = Math.round(confidence * 100);
  const r = 48;
  const circumference = 2 * Math.PI * r;
  const arcLength = circumference * 0.75;
  const gap = circumference - arcLength;
  const offset = arcLength * (1 - pct / 100);

  const strokeColor =
    confidence >= 0.85 ? "#10b981" : confidence >= 0.5 ? "#f59e0b" : "#ef4444";
  const textColor =
    confidence >= 0.85 ? "text-emerald-600" : confidence >= 0.5 ? "text-amber-500" : "text-red-500";
  const label =
    confidence >= 0.85 ? "Threshold reached" : "Target \u226585%";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg viewBox="0 0 120 120" className="w-32 h-32">
          {/* Background arc */}
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="#e4e4e7"
            strokeWidth="8"
            strokeDasharray={`${arcLength} ${gap}`}
            strokeLinecap="round"
            transform="rotate(-135 60 60)"
          />
          {/* Progress arc */}
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={strokeColor}
            strokeWidth="8"
            strokeDasharray={`${arcLength} ${gap}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-135 60 60)"
            style={{ transition: "stroke-dashoffset 0.7s ease, stroke 0.5s ease" }}
          />
        </svg>
        {/* Center number */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold tabular-nums leading-none ${textColor}`}>{pct}</span>
          <span className="text-[10px] text-zinc-400 font-medium mt-0.5">%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold text-zinc-600">Agent confidence</p>
        <p className="text-[10px] text-zinc-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}
