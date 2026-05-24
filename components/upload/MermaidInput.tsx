"use client";

import { useAnalysisStore } from "@/store/analysis.store";

interface Props {
  onReady: () => void;
}

const EXAMPLE = `graph TD
  A[Auth Service] --> B[(PostgreSQL)]
  A --> C[(Redis Cache)]
  D[API Gateway] --> A
  D --> E[Payment Service]
  E --> B
  F[Notification Service] --> C`;

export function MermaidInput({ onReady }: Props) {
  const { mermaidCode, setMermaidCode } = useAnalysisStore();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">Paste your Mermaid graph definition below</p>
        <button
          onClick={() => setMermaidCode(EXAMPLE)}
          className="text-xs text-violet-600 hover:text-violet-700 transition-colors"
        >
          Load example
        </button>
      </div>

      <textarea
        value={mermaidCode}
        onChange={(e) => setMermaidCode(e.target.value)}
        placeholder={`graph TD\n  A[Service A] --> B[Service B]\n  B --> C[(Database)]`}
        rows={10}
        className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 font-mono text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 resize-none transition-colors shadow-sm"
        spellCheck={false}
      />

      <button
        onClick={onReady}
        disabled={!mermaidCode.trim()}
        className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-100 disabled:text-zinc-400 text-white font-semibold text-sm transition-colors"
      >
        Parse Architecture
      </button>
    </div>
  );
}
