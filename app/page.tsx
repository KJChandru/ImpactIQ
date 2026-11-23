"use client";

import { useState } from "react";
import Link from "next/link";
import { ZipUploader } from "@/components/upload/ZipUploader";
import { exportJson, exportMarkdown } from "@/lib/report-format";
import type { ImpactKind, RepoImpactReport, ValidatedFinding } from "@/types";

type Phase = "input" | "loading" | "report";
type SourceMode = "github" | "zip";
type Stage = "fetching" | "indexed" | "retrieved" | "reasoning" | "verifying" | "done";

interface Progress {
  stage: Stage;
  source?: string;
  fileCount?: number;
  languages?: string[];
  truncated?: boolean;
  seeds?: number;
  candidates?: number;
}

const SEVERITY: Record<string, string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-zinc-50 text-zinc-600 border-zinc-200",
};

const RISK: Record<string, string> = {
  high: "bg-red-600 text-white",
  medium: "bg-amber-500 text-white",
  low: "bg-emerald-600 text-white",
};

const EXAMPLE_REPOS = ["developit/mitt", "lukeed/clsx", "sindresorhus/yocto-queue"];

export default function Home() {
  const [phase, setPhase] = useState<Phase>("input");
  const [mode, setMode] = useState<SourceMode>("github");
  const [githubUrl, setGithubUrl] = useState("");
  const [zipBase64, setZipBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [changeRequest, setChangeRequest] = useState("");
  const [report, setReport] = useState<RepoImpactReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>({ stage: "fetching" });

  const hasSource = mode === "github" ? githubUrl.trim().length > 0 : Boolean(zipBase64);
  const canAnalyze = hasSource && changeRequest.trim().length > 0;
  const disabledReason = !hasSource
    ? mode === "github"
      ? "Paste a GitHub repository URL to continue."
      : "Upload a repository .zip to continue."
    : changeRequest.trim().length === 0
      ? "Describe the change to continue."
      : null;

  async function analyze() {
    if (!canAnalyze) return;
    setPhase("loading");
    setError(null);
    setProgress({ stage: "fetching" });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 150_000);
    try {
      const body =
        mode === "github"
          ? { githubUrl: githubUrl.trim(), changeRequest: changeRequest.trim() }
          : { zipBase64, changeRequest: changeRequest.trim() };
      const res = await fetch("/api/analyze-repo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Analysis failed.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let finished = false;
      while (!finished) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const evt = JSON.parse(line) as Progress & { report?: RepoImpactReport; error?: string };
          if (evt.stage === "done" && evt.report) {
            setReport(evt.report);
            setPhase("report");
            finished = true;
            break;
          }
          if ((evt as { stage: string }).stage === "error") {
            throw new Error(evt.error ?? "Analysis failed.");
          }
          setProgress((p) => ({ ...p, ...evt }));
        }
      }
    } catch (e) {
      const msg =
        e instanceof DOMException && e.name === "AbortError"
          ? "Analysis timed out. Try a smaller repository."
          : e instanceof Error
            ? e.message
            : "Unexpected error.";
      setError(msg);
      setPhase("input");
    } finally {
      clearTimeout(timeout);
    }
  }

  function reset() {
    setPhase("input");
    setReport(null);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-zinc-900 flex flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            <span className="font-semibold tracking-tight">ImpactIQ</span>
            <span className="hidden sm:inline rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
              Repo analysis
            </span>
          </div>
          <Link href="/diagram" className="text-xs text-zinc-500 hover:text-violet-600 transition-colors">
            Diagram mode →
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-10">
        {phase === "input" && (
          <InputView
            mode={mode}
            setMode={setMode}
            githubUrl={githubUrl}
            setGithubUrl={setGithubUrl}
            fileName={fileName}
            onZip={(b64, name) => {
              setZipBase64(b64);
              setFileName(name);
            }}
            changeRequest={changeRequest}
            setChangeRequest={setChangeRequest}
            error={error}
            canAnalyze={canAnalyze}
            disabledReason={disabledReason}
            onAnalyze={analyze}
          />
        )}
        {phase === "loading" && <ProgressView progress={progress} />}
        {phase === "report" && report && <Report report={report} onReset={reset} />}
      </main>

      <footer className="border-t border-zinc-200 py-4">
        <p className="mx-auto max-w-3xl px-6 text-center text-[11px] text-zinc-400">
          Code is analyzed in memory and never executed · secrets &amp; <code>node_modules</code> stripped · every finding verified against the source
        </p>
      </footer>
    </div>
  );
}

function InputView(props: {
  mode: SourceMode;
  setMode: (m: SourceMode) => void;
  githubUrl: string;
  setGithubUrl: (s: string) => void;
  fileName: string | null;
  onZip: (b64: string, name: string) => void;
  changeRequest: string;
  setChangeRequest: (s: string) => void;
  error: string | null;
  canAnalyze: boolean;
  disabledReason: string | null;
  onAnalyze: () => void;
}) {
  const {
    mode, setMode, githubUrl, setGithubUrl, fileName, onZip,
    changeRequest, setChangeRequest, error, canAnalyze, disabledReason, onAnalyze,
  } = props;

  return (
    <div className="flex flex-col gap-8">
      <div className="pt-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">What will this change break?</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-500">
          Point ImpactIQ at a repository and describe a change in plain English. It predicts the blast
          radius — every finding backed by a real file, symbol, and line you can click to verify.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-6">
        <div className="mb-1 text-xs font-semibold text-zinc-400">Step 1 — the code</div>
        <div className="mb-4 mt-2 inline-flex rounded-lg bg-zinc-100 p-1 text-sm">
          {([ { id: "github", label: "GitHub URL" }, { id: "zip", label: "Upload ZIP" } ] as { id: SourceMode; label: string }[]).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`px-4 py-1.5 rounded-md font-medium transition-all ${mode === id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "github" ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100 transition-colors">
              <svg className="h-4 w-4 flex-shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 .5C5.73.5.75 5.48.75 11.75c0 4.98 3.23 9.2 7.7 10.7.56.1.77-.24.77-.54v-1.9c-3.13.68-3.79-1.51-3.79-1.51-.51-1.3-1.25-1.64-1.25-1.64-1.02-.7.08-.68.08-.68 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.56 0-1.23.44-2.23 1.16-3.02-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.1 1.15a10.8 10.8 0 015.64 0c2.15-1.45 3.09-1.15 3.09-1.15.62 1.55.23 2.7.11 2.98.72.79 1.16 1.79 1.16 3.02 0 4.32-2.63 5.27-5.14 5.55.4.35.76 1.03.76 2.08v3.08c0 .3.2.65.78.54a11.26 11.26 0 007.69-10.7C23.25 5.48 18.27.5 12 .5z" />
              </svg>
              <input
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canAnalyze && onAnalyze()}
                placeholder="https://github.com/owner/repo"
                spellCheck={false}
                className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-zinc-400"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-zinc-400">Try:</span>
              {EXAMPLE_REPOS.map((r) => (
                <button
                  key={r}
                  onClick={() => setGithubUrl(`https://github.com/${r}`)}
                  className="rounded-md border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-500 hover:border-violet-300 hover:text-violet-700 transition-colors"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ZipUploader fileName={fileName} onLoaded={(b64, name) => onZip(b64, name)} />
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-6">
        <div className="mb-2 text-xs font-semibold text-zinc-400">Step 2 — the change</div>
        <textarea
          value={changeRequest}
          onChange={(e) => setChangeRequest(e.target.value)}
          placeholder="e.g. Add a once() method that auto-removes the handler after the first call"
          rows={3}
          className="w-full resize-none rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-colors"
        />
        <p className="mt-2 text-[11px] text-zinc-400">
          Tip: name the feature or method you&apos;re adding (e.g. &ldquo;add <code>once()</code> to the emitter&rdquo;) rather than a vague goal — the retrieval matches your words against real code.
        </p>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="flex flex-col items-center gap-2">
        <button
          onClick={onAnalyze}
          disabled={!canAnalyze}
          className="w-full rounded-xl bg-violet-600 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
        >
          Analyze impact
        </button>
        {disabledReason && <p className="text-[11px] text-zinc-400">{disabledReason}</p>}
      </div>
    </div>
  );
}

const STEP_ORDER: Stage[] = ["fetching", "indexed", "retrieved", "reasoning", "verifying"];

function ProgressView({ progress }: { progress: Progress }) {
  const current = STEP_ORDER.indexOf(progress.stage === "done" ? "verifying" : progress.stage);
  const labels: Record<Stage, string> = {
    fetching: progress.source ? `Fetching ${progress.source}` : "Fetching repository",
    indexed:
      progress.fileCount != null
        ? `Indexed ${progress.fileCount} file${progress.fileCount === 1 ? "" : "s"}${progress.languages?.length ? ` · ${progress.languages.join(", ")}` : ""}`
        : "Indexing code",
    retrieved:
      progress.candidates != null
        ? `Traced blast radius · ${progress.candidates} candidate${progress.candidates === 1 ? "" : "s"}, ${progress.seeds} seed${progress.seeds === 1 ? "" : "s"}`
        : "Tracing dependencies",
    reasoning: "Reasoning over evidence with Claude",
    verifying: "Verifying every finding against the code",
    done: "Done",
  };

  return (
    <div className="mx-auto max-w-md py-20">
      <ul className="flex flex-col gap-4">
        {STEP_ORDER.map((stage, i) => {
          const state = i < current ? "done" : i === current ? "active" : "pending";
          return (
            <li key={stage} className="flex items-center gap-3">
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                {state === "done" ? (
                  <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : state === "active" ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-200 border-t-violet-600" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-zinc-300" />
                )}
              </span>
              <span className={`text-sm ${state === "pending" ? "text-zinc-400" : state === "active" ? "text-zinc-800 font-medium" : "text-zinc-600"}`}>
                {labels[stage]}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-center text-[11px] text-zinc-400">Reasoning can take 20–40s for a real repository.</p>
    </div>
  );
}

function Report({ report, onReset }: { report: RepoImpactReport; onReset: () => void }) {
  function download(name: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  const weakRetrieval = report.retrieval.seeds.length === 0;
  const truncated = report.repo?.truncated;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          <span className="font-medium text-zinc-700">Change:</span> {report.changeRequest}
        </p>
        <button onClick={onReset} className="text-xs text-zinc-500 hover:text-violet-600 transition-colors">
          ← New analysis
        </button>
      </div>

      {/* Repo summary */}
      {report.repo && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs text-zinc-500">
          <span className="font-medium text-zinc-700">{report.repo.name}</span>
          <span>{report.repo.fileCount} files</span>
          {report.repo.languages.length > 0 && <span>{report.repo.languages.join(", ")}</span>}
          {report.retrieval.seeds.length > 0 && (
            <span>seeds: {report.retrieval.seeds.map((s) => s.split("/").pop()).join(", ")}</span>
          )}
        </div>
      )}

      {/* Honesty banner */}
      {(weakRetrieval || truncated) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {weakRetrieval && (
            <p>⚠ Your description didn&apos;t strongly match any files, so this run may be incomplete. Try naming a specific feature, file, or symbol.</p>
          )}
          {truncated && <p>⚠ This repository is large and was truncated during indexing — some impacts may be missed.</p>}
        </div>
      )}

      {/* Risk header */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-5">
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${RISK[report.risk.level]}`}>
            {report.risk.level} risk · {report.risk.score}/100
          </span>
          <div className="flex gap-2">
            <button onClick={() => download("impactiq-report.md", exportMarkdown(report), "text/markdown")} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs transition-colors hover:border-violet-400 hover:text-violet-700">Export .md</button>
            <button onClick={() => download("impactiq-report.json", exportJson(report), "application/json")} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs transition-colors hover:border-violet-400 hover:text-violet-700">Export .json</button>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-zinc-700">{report.summary}</p>
        <p className="mt-2 text-[11px] text-zinc-400">{report.risk.note}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {report.risk.factors.map((f, i) => (
            <span key={i} title={f.detail} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] text-zinc-600">
              {f.label}
              {f.weight > 0 && <span className="text-zinc-400">+{f.weight}</span>}
            </span>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-zinc-500">
          <span>Blast radius: {report.retrieval.blastRadius}</span>
          <span>Evidence coverage: {Math.round(report.stats.evidenceCoverage * 100)}%</span>
          <span>Verified: {report.stats.verified}/{report.stats.total}</span>
          {report.stats.rejected > 0 && <span className="text-red-600">Fabrications rejected: {report.stats.rejected}</span>}
        </div>
      </div>

      {(["direct", "indirect", "potential"] as ImpactKind[]).map((kind) => {
        const items = report.findings.filter((f) => f.impact === kind);
        if (items.length === 0) return null;
        return (
          <Card key={kind} title={`${cap(kind)} impact (${items.length})`}>
            <ul className="flex flex-col gap-3">
              {items.map((f, i) => (
                <FindingRow key={i} f={f} />
              ))}
            </ul>
          </Card>
        );
      })}

      {report.testRecommendations.length > 0 && (
        <Card title="Recommended tests">
          <ul className="flex flex-col gap-2">
            {report.testRecommendations.map((t, i) => (
              <li key={i} className="text-sm">
                <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">{t.file}</code>
                <span className="text-zinc-600"> — {t.why}</span>
                <span className="text-[11px] text-zinc-400"> ({t.existingTest ? `covered by ${t.existingTest}` : "no existing test"})</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {report.assumptions.length > 0 && (
        <Card title="Assumptions"><BulletList items={report.assumptions} /></Card>
      )}
      {report.limitations.length > 0 && (
        <Card title="Limitations"><BulletList items={report.limitations} /></Card>
      )}
    </section>
  );
}

function FindingRow({ f }: { f: ValidatedFinding }) {
  const [open, setOpen] = useState(false);
  const loc = [f.symbol, f.line ? `L${f.line}` : null].filter(Boolean).join(" ");
  const canExpand = Boolean(f.snippet);

  return (
    <li className="rounded-lg border border-zinc-200 overflow-hidden">
      <button
        onClick={() => canExpand && setOpen(!open)}
        className={`w-full text-left p-3 ${canExpand ? "hover:bg-zinc-50 cursor-pointer" : "cursor-default"}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${SEVERITY[f.severity]}`}>{f.severity}</span>
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">{f.file}</code>
          {loc && <span className="text-[11px] text-zinc-400">{loc}</span>}
          {f.verified ? (
            <span className="text-[10px] text-emerald-600" title="All cited references exist in the code">✓ verified</span>
          ) : (
            <span className="text-[10px] text-amber-600" title={f.issues.map((i) => i.message).join("; ")}>⚠︎ unverified</span>
          )}
          {canExpand && (
            <span className="ml-auto text-[11px] text-violet-600">{open ? "Hide code" : "View code"}</span>
          )}
        </div>
        <p className="mt-2 text-sm text-zinc-700">{f.reason}</p>
        <p className="mt-1 text-[11px] text-zinc-400">Evidence: {f.evidence}</p>
      </button>

      {open && f.snippet && (
        <div className="border-t border-zinc-200 bg-zinc-950 overflow-x-auto">
          <pre className="text-[12px] leading-relaxed font-mono text-zinc-300 py-2">
            {f.snippet.lines.map((line, i) => {
              const lineNo = f.snippet!.startLine + i;
              const isFocus = lineNo === f.snippet!.focusLine;
              return (
                <div key={i} className={isFocus ? "bg-violet-500/20" : ""}>
                  <span className="inline-block w-10 pr-3 text-right text-zinc-600 select-none">{lineNo}</span>
                  <span className={isFocus ? "text-white" : ""}>{line || " "}</span>
                </div>
              );
            })}
          </pre>
        </div>
      )}
    </li>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-5">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</h2>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((s, i) => (
        <li key={i} className="flex gap-2 text-sm text-zinc-600">
          <span className="text-zinc-300">•</span>
          <span>{s}</span>
        </li>
      ))}
    </ul>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
