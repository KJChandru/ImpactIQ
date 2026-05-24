"use client";

import { useEffect, useRef, useState } from "react";

// Time-driven phases: each iteration ~30s, 3 iterations total = ~90s
const PHASES = [
  { label: "Tracing dependency paths", tool: "trace_dependency", iteration: 1 },
  { label: "Mapping transitive impacts", tool: "trace_dependency", iteration: 1 },
  { label: "Checking for circular dependencies", tool: "check_circular", iteration: 1 },
  { label: "Estimating blast radius", tool: "estimate_blast_radius", iteration: 2 },
  { label: "Investigating hidden dependencies", tool: "estimate_blast_radius", iteration: 2 },
  { label: "Generating migration path", tool: "generate_migration_path", iteration: 2 },
  { label: "Synthesizing findings across modules", tool: "generate_migration_path", iteration: 3 },
  { label: "Cross-validating impact assumptions", tool: "trace_dependency", iteration: 3 },
  { label: "Finalizing impact report", tool: "generate_migration_path", iteration: 3 },
];

const TOOL_COLOR: Record<string, string> = {
  trace_dependency: "text-violet-600 bg-violet-50 border-violet-200",
  check_circular: "text-amber-600 bg-amber-50 border-amber-200",
  estimate_blast_radius: "text-red-600 bg-red-50 border-red-200",
  generate_migration_path: "text-emerald-600 bg-emerald-50 border-emerald-200",
};

// Target total duration in ms (matches server timeout with buffer)
const TOTAL_MS = 90_000;
const PHASE_INTERVAL_MS = Math.floor(TOTAL_MS / PHASES.length);

export function AgentThinking() {
  const [elapsed, setElapsed] = useState(0); // ms
  const [phaseIndex, setPhaseIndex] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    // Tick elapsed every 250ms
    const elapsedId = setInterval(() => {
      setElapsed(Date.now() - startRef.current);
    }, 250);

    // Advance phase every PHASE_INTERVAL_MS
    const phaseId = setInterval(() => {
      setPhaseIndex((i) => Math.min(i + 1, PHASES.length - 1));
    }, PHASE_INTERVAL_MS);

    return () => {
      clearInterval(elapsedId);
      clearInterval(phaseId);
    };
  }, []);

  const phase = PHASES[phaseIndex];

  // Progress: fills to 95% over TOTAL_MS, then holds
  const rawPct = Math.min((elapsed / TOTAL_MS) * 95, 95);
  const progressPct = Math.round(rawPct);

  // Elapsed display
  const elapsedSec = Math.floor(elapsed / 1000);
  const mins = Math.floor(elapsedSec / 60);
  const secs = elapsedSec % 60;
  const elapsedStr = mins > 0
    ? `${mins}m ${secs.toString().padStart(2, "0")}s`
    : `${secs}s`;

  // Completed iterations (phases that are done)
  const completedIterations = Array.from(
    new Set(PHASES.slice(0, phaseIndex).map((p) => p.iteration))
  ).filter((it) => it < phase.iteration);

  return (
    <div className="flex flex-col items-center gap-8 py-6">

      {/* Spinner ring + % */}
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          {/* Track */}
          <circle
            cx="60" cy="60" r="50"
            fill="none"
            stroke="#e4e4e7"
            strokeWidth="8"
          />
          {/* Progress arc */}
          <circle
            cx="60" cy="60" r="50"
            fill="none"
            stroke="#7c3aed"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 50}`}
            strokeDashoffset={`${2 * Math.PI * 50 * (1 - progressPct / 100)}`}
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-zinc-900 tabular-nums">{progressPct}%</span>
          <span className="text-[10px] font-mono text-zinc-400 mt-0.5">{elapsedStr}</span>
        </div>
      </div>

      {/* Title */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="relative w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-violet-400 animate-ping opacity-75" />
            <span className="relative block w-2 h-2 rounded-full bg-violet-500" />
          </div>
          <span className="text-[11px] font-mono font-bold text-zinc-500 uppercase tracking-widest">
            AGENT RUNNING · ITERATION {phase.iteration} / 3
          </span>
        </div>
        <p className="text-zinc-400 text-xs font-mono">Autonomous multi-pass architectural analysis</p>
      </div>

      {/* Current phase card */}
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between">
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Current operation</span>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${TOOL_COLOR[phase.tool]}`}>
            {phase.tool}
          </span>
        </div>
        <div className="px-4 py-3 flex items-center gap-3">
          {/* Animated dots */}
          <div className="flex gap-1 flex-shrink-0">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
          <span className="text-sm text-zinc-700 font-medium">{phase.label}</span>
        </div>
      </div>

      {/* Iteration progress pills */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((it) => {
          const isDone = completedIterations.includes(it);
          const isActive = it === phase.iteration;
          return (
            <div key={it} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-mono font-semibold transition-all ${
                  isDone
                    ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                    : isActive
                    ? "bg-violet-50 border-violet-200 text-violet-600"
                    : "bg-zinc-50 border-zinc-200 text-zinc-400"
                }`}
              >
                {isDone ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : isActive ? (
                  <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-zinc-300" />
                )}
                ITER_{it}
              </div>
              {it < 3 && <div className={`w-4 h-px ${isDone ? "bg-emerald-300" : "bg-zinc-200"}`} />}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-sm">
        <div className="flex justify-between mb-1.5">
          <span className="text-[10px] font-mono text-zinc-400">Analysis progress</span>
          <span className="text-[10px] font-mono text-zinc-500 font-semibold">{progressPct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-violet-500 transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-[10px] text-zinc-400 font-mono mt-1.5 text-center">
          Typically completes in 60–90s · Please wait
        </p>
      </div>

    </div>
  );
}
