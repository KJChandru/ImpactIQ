"use client";

import { useState } from "react";
import { useAnalysisStore } from "@/store/analysis.store";

export function ModuleChips() {
  const { architecture, setArchitecture } = useAnalysisStore();
  const [newModule, setNewModule] = useState("");

  if (!architecture) return null;

  const addModule = () => {
    const trimmed = newModule.trim();
    if (!trimmed || architecture.modules.includes(trimmed)) return;
    setArchitecture({ ...architecture, modules: [...architecture.modules, trimmed] });
    setNewModule("");
  };

  const removeModule = (mod: string) => {
    setArchitecture({
      ...architecture,
      modules: architecture.modules.filter((m) => m !== mod),
      dependencies: architecture.dependencies.filter(
        (d) => d.from !== mod && d.to !== mod
      ),
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Modules ({architecture.modules.length})
        </span>
        {architecture.confidence != null && (
          <span className="text-xs text-zinc-500">
            Confidence:{" "}
            <span className={architecture.confidence >= 0.8 ? "text-emerald-600" : "text-amber-600"}>
              {Math.round(architecture.confidence * 100)}%
            </span>
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {architecture.modules.map((mod) => (
          <span
            key={mod}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-xs font-medium"
          >
            {mod}
            <button
              onClick={() => removeModule(mod)}
              className="text-violet-400 hover:text-red-400 transition-colors"
              aria-label={`Remove ${mod}`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-2 mt-1">
        <input
          value={newModule}
          onChange={(e) => setNewModule(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addModule()}
          placeholder="Add missing module..."
          className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-violet-500 transition-colors"
        />
        <button
          onClick={addModule}
          disabled={!newModule.trim()}
          className="px-3 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40 text-zinc-600 text-sm transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}
