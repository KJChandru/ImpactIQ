"use client";

import { useState } from "react";
import type { TestSuite } from "@/types";

interface Props {
  tests: TestSuite[];
}

export function TestChecklist({ tests }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  if (tests.length === 0) return null;

  const toggle = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const allCases = tests.flatMap((t) => t.cases.map((c) => `[${t.module}] ${c}`));
  const totalCount = allCases.length;
  const doneCount = checked.size;

  const copyAll = async () => {
    const text = tests
      .map((t) => `## ${t.module}\n${t.cases.map((c) => `- [ ] ${c}`).join("\n")}`)
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <h3 className="text-sm font-semibold text-zinc-800">Test Checklist</h3>
          <span className="text-xs text-zinc-400">{doneCount}/{totalCount} done</span>
        </div>
        <button
          onClick={copyAll}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-emerald-600">Copied!</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy all
            </>
          )}
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-zinc-200 overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
          style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }}
        />
      </div>

      <div className="flex flex-col gap-4">
        {tests.map((suite) => (
          <div key={suite.module} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-violet-600 uppercase tracking-wider">{suite.module}</span>
              <div className="flex-1 h-px bg-zinc-200" />
            </div>
            {suite.cases.map((c, j) => {
              const key = `${suite.module}::${j}`;
              const isChecked = checked.has(key);
              return (
                <label key={j} className="flex items-start gap-3 cursor-pointer group">
                  <div className={`mt-0.5 w-4 h-4 flex-shrink-0 rounded border transition-all ${isChecked ? "bg-emerald-500 border-emerald-500" : "border-zinc-300 group-hover:border-violet-500"}`}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isChecked}
                      onChange={() => toggle(key)}
                    />
                    {isChecked && (
                      <svg className="w-full h-full text-white p-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-xs leading-relaxed transition-colors ${isChecked ? "line-through text-zinc-400" : "text-zinc-600 group-hover:text-zinc-800"}`}>
                    {c}
                  </span>
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
