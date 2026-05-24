"use client";

import type { ImpactedModule } from "@/types";

const SEVERITY_STYLES = {
  high: {
    leftBorder: "border-l-red-500",
    badge: "text-red-600 border-red-300 bg-red-50",
    dot: "bg-red-500",
    code: "SEVERITY_0",
  },
  medium: {
    leftBorder: "border-l-amber-400",
    badge: "text-amber-600 border-amber-300 bg-amber-50",
    dot: "bg-amber-400",
    code: "SEVERITY_1",
  },
  low: {
    leftBorder: "border-l-blue-400",
    badge: "text-blue-600 border-blue-300 bg-blue-50",
    dot: "bg-blue-400",
    code: "SEVERITY_2",
  },
};

interface Props {
  module: ImpactedModule;
  index: number;
}

export function ImpactCard({ module: mod, index }: Props) {
  const s = SEVERITY_STYLES[mod.severity];

  return (
    <div
      className={`rounded-lg border border-zinc-200 border-l-4 ${s.leftBorder} bg-white px-4 py-3.5 opacity-0 animate-[fadeIn_0.3s_ease_forwards]`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-0.5 ${s.dot}`} />
          <span className="font-mono font-bold text-sm text-zinc-900 truncate">{mod.module}</span>
        </div>
        <span className={`flex-shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${s.badge}`}>
          {s.code}
        </span>
      </div>
      <p className="text-xs text-zinc-500 leading-relaxed pl-3.5">{mod.reason}</p>
    </div>
  );
}
