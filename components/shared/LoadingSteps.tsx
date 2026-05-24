"use client";

import { useEffect, useState } from "react";

interface Props {
  steps: string[];
  intervalMs?: number;
}

export function LoadingSteps({ steps, intervalMs = 1800 }: Props) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    }, intervalMs);
    return () => clearInterval(interval);
  }, [steps.length, intervalMs]);

  return (
    <div className="flex flex-col gap-3">
      {steps.map((step, i) => {
        const isDone = i < currentStep;
        const isActive = i === currentStep;
        return (
          <div
            key={i}
            className={`flex items-center gap-3 text-sm transition-all duration-300 ${
              isDone ? "opacity-50" : isActive ? "opacity-100" : "opacity-30"
            }`}
          >
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              {isDone ? (
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : isActive ? (
                <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-zinc-300" />
              )}
            </div>
            <span className={isActive ? "text-zinc-900" : isDone ? "text-zinc-500" : "text-zinc-400"}>
              {step}
            </span>
          </div>
        );
      })}
    </div>
  );
}
