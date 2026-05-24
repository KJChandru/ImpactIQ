"use client";

import type { Step } from "@/types";

const STEPS: { id: Step; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "extracting", label: "Extract" },
  { id: "review", label: "Review" },
  { id: "feature", label: "Feature" },
  { id: "analyzing", label: "Analyze" },
  { id: "report", label: "Report" },
];

const STEP_ORDER: Step[] = ["upload", "extracting", "review", "feature", "analyzing", "report"];

interface Props {
  current: Step;
}

export function StepProgress({ current }: Props) {
  const currentIndex = STEP_ORDER.indexOf(current);

  return (
    <div className="flex items-center gap-0 w-full max-w-2xl mx-auto">
      {STEPS.map((step, i) => {
        const isDone = i < currentIndex;
        const isActive = i === currentIndex;
        return (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  isDone
                    ? "bg-emerald-500 text-white"
                    : isActive
                    ? "bg-violet-600 text-white ring-4 ring-violet-600/30"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                {isDone ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`mt-1 text-[10px] font-medium tracking-wide ${
                  isActive ? "text-violet-400" : isDone ? "text-emerald-500" : "text-zinc-600"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-[2px] flex-1 mt-[-14px] transition-all duration-500 ${
                  i < currentIndex ? "bg-emerald-500" : "bg-zinc-800"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
