"use client";

import { useState } from "react";
import type { IterationLog as IterationLogType } from "@/types";

interface Props {
  logs: IterationLogType[];
  agentConfidence?: number;
}

export function IterationLog({ logs, agentConfidence }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!logs || logs.length === 0) return null;

  const totalTools = logs.reduce((sum, l) => sum + l.toolsCalled.length, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-violet-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <h3 className="text-sm font-semibold text-zinc-800">Agent Reasoning Trail</h3>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] text-zinc-400">
            {logs.length} iteration{logs.length !== 1 ? "s" : ""} &middot; {totalTools} tool
            {totalTools !== 1 ? "s" : ""}
          </span>
          {agentConfidence != null && (
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                agentConfidence >= 0.85
                  ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                  : "bg-amber-50 text-amber-600 border-amber-200"
              }`}
            >
              {Math.round(agentConfidence * 100)}% confident
            </span>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical connecting line */}
        <div className="absolute left-[19px] top-5 bottom-5 w-px bg-zinc-200" />

        <div className="flex flex-col">
          {logs.map((log, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={i} className="relative flex gap-4 mb-3 last:mb-0">
                {/* Node */}
                <div
                  className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center z-10 border-2 ${
                    log.confidence >= 0.85
                      ? "bg-emerald-50 border-emerald-200"
                      : "bg-violet-50 border-violet-200"
                  }`}
                >
                  {log.confidence >= 0.85 ? (
                    <svg
                      className="w-4 h-4 text-emerald-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-xs font-bold text-violet-600">{log.iteration}</span>
                  )}
                </div>

                {/* Card */}
                <div className="flex-1 rounded-xl border border-zinc-200 bg-white overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 transition-colors"
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-zinc-700">
                          Iteration {log.iteration}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            log.confidence >= 0.85
                              ? "bg-emerald-50 text-emerald-600"
                              : log.confidence >= 0.5
                              ? "bg-amber-50 text-amber-600"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          {Math.round(log.confidence * 100)}%
                        </span>
                        {log.toolsCalled.map((tc, j) => (
                          <span
                            key={j}
                            className="text-[10px] font-mono bg-violet-50 text-violet-500 border border-violet-100 px-1.5 py-0.5 rounded-full"
                          >
                            {tc.tool}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">{log.findings}</p>
                    </div>
                    <svg
                      className={`w-4 h-4 text-zinc-400 flex-shrink-0 transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {isOpen && (
                    <div className="border-t border-zinc-100 px-4 py-3 flex flex-col gap-3">
                      <div>
                        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                          Findings
                        </p>
                        <p className="text-xs text-zinc-600 leading-relaxed">{log.findings}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                          Self-critique
                        </p>
                        <p className="text-xs text-zinc-500 leading-relaxed italic">
                          {log.critique}
                        </p>
                      </div>

                      {log.toolsCalled.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                            Tool calls
                          </p>
                          <div className="flex flex-col gap-1.5">
                            {log.toolsCalled.map((tc, j) => (
                              <div
                                key={j}
                                className="rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-2"
                              >
                                <span className="text-[10px] font-mono font-semibold text-violet-600">
                                  {tc.tool}
                                </span>
                                <p className="text-[10px] text-zinc-500 mt-0.5 font-mono truncate">
                                  {JSON.stringify(tc.input).slice(0, 70)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
