"use client";

import type { Step } from "@/types";
import { useAnalysisStore } from "@/store/analysis.store";

const STEP_ORDER: Step[] = ["upload", "extracting", "review", "feature", "analyzing", "report"];

interface Phase {
  num: string;
  label: string;
  steps: Step[];
}

const PHASES: Phase[] = [
  { num: "01", label: "INGESTION", steps: ["upload", "extracting", "review"] },
  { num: "02", label: "DECOMPOSITION", steps: ["feature", "analyzing"] },
  { num: "03", label: "DIAGNOSTIC", steps: ["report"] },
];

function getPhaseState(phase: Phase, currentIndex: number): "done" | "active" | "pending" {
  const indices = phase.steps.map((s) => STEP_ORDER.indexOf(s));
  const max = Math.max(...indices);
  const min = Math.min(...indices);
  if (currentIndex > max) return "done";
  if (currentIndex >= min) return "active";
  return "pending";
}

interface Props {
  current: Step;
}

export function Sidebar({ current }: Props) {
  const { reset } = useAnalysisStore();
  const currentIndex = STEP_ORDER.indexOf(current);

  return (
    <aside className="fixed left-0 top-0 h-full w-56 bg-zinc-950 flex flex-col z-10">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 bg-white rounded flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-zinc-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-[11px] font-bold text-white font-mono tracking-wider">IMPACTIQ V0.1.7</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 flex flex-col gap-1.5">
        {PHASES.map((phase) => {
          const state = getPhaseState(phase, currentIndex);
          return (
            <div
              key={phase.num}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                state === "active"
                  ? "bg-white"
                  : state === "done"
                  ? "hover:bg-zinc-900"
                  : ""
              }`}
            >
              <span className={`text-[10px] font-mono font-bold ${
                state === "active" ? "text-zinc-400" : "text-zinc-600"
              }`}>
                {phase.num}
              </span>
              <span className={`text-[11px] font-mono font-bold uppercase tracking-wider ${
                state === "active"
                  ? "text-zinc-950"
                  : state === "done"
                  ? "text-zinc-400"
                  : "text-zinc-600"
              }`}>
                {phase.label}
              </span>
              {state === "done" && (
                <svg className="ml-auto w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          );
        })}
      </nav>

      {/* CTA */}
      {current !== "upload" && (
        <div className="px-3 pb-4 border-t border-zinc-800 pt-4">
          <button
            onClick={reset}
            className="w-full py-2.5 bg-white hover:bg-zinc-100 text-zinc-950 text-[10px] font-mono font-bold uppercase tracking-wider rounded transition-colors"
          >
            Run New Scan
          </button>
        </div>
      )}
    </aside>
  );
}
