"use client";

import { useAnalysisStore } from "@/store/analysis.store";
import type { Dependency } from "@/types";

const TYPE_COLORS: Record<string, string> = {
  calls: "text-blue-600 bg-blue-50 border-blue-200",
  reads: "text-emerald-600 bg-emerald-50 border-emerald-200",
  writes: "text-amber-600 bg-amber-50 border-amber-200",
  subscribes: "text-purple-600 bg-purple-50 border-purple-200",
  uses: "text-zinc-600 bg-zinc-100 border-zinc-200",
  extends: "text-pink-600 bg-pink-50 border-pink-200",
  depends_on: "text-zinc-600 bg-zinc-100 border-zinc-200",
};

function typeColor(type?: string): string {
  return type && TYPE_COLORS[type] ? TYPE_COLORS[type] : TYPE_COLORS.depends_on;
}

export function DependencyMapper() {
  const { architecture, setArchitecture } = useAnalysisStore();

  if (!architecture) return null;

  const removeDep = (dep: Dependency) => {
    setArchitecture({
      ...architecture,
      dependencies: architecture.dependencies.filter(
        (d) => !(d.from === dep.from && d.to === dep.to)
      ),
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
        Dependencies ({architecture.dependencies.length})
      </span>

      {architecture.dependencies.length === 0 ? (
        <p className="text-sm text-zinc-400">No dependencies found.</p>
      ) : (
        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
          {architecture.dependencies.map((dep, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 group"
            >
              <span className="text-sm text-zinc-800 font-medium">{dep.from}</span>
              <svg className="w-4 h-4 text-zinc-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
              <span className="text-sm text-zinc-800 font-medium">{dep.to}</span>
              {dep.type && (
                <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full border ${typeColor(dep.type)}`}>
                  {dep.type}
                </span>
              )}
              <button
                onClick={() => removeDep(dep)}
                className="ml-2 opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-all"
                aria-label="Remove dependency"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
