"use client";

import type { HiddenDep } from "@/types";

interface Props {
  deps: HiddenDep[];
}

export function HiddenDeps({ deps }: Props) {
  if (deps.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 className="text-sm font-semibold text-zinc-800">Hidden Dependencies</h3>
        <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
          {deps.length} risk{deps.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {deps.map((dep, i) => (
          <div key={i} className="rounded-xl border border-amber-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-100">
              <span className="text-xs font-semibold font-mono text-zinc-700">{dep.from}</span>
              <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <span className="text-xs font-semibold font-mono text-zinc-700">{dep.to}</span>
              <span className="ml-auto text-[10px] text-amber-600 font-semibold uppercase tracking-wide">Hidden</span>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-zinc-600 leading-relaxed">{dep.risk}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
