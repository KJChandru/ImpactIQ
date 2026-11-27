"use client";

import { useState } from "react";
import { DependencyGraph } from "@/components/results/DependencyGraph";
import { exportJson, exportMarkdown } from "@/lib/report-format";
import { highlightLine, type TokenKind } from "@/lib/highlight";
import type { CodeSnippet, ImpactKind, RepoHealth, RepoImpactReport, ValidatedFinding } from "@/types";

type Phase = "input" | "loading" | "report";
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

const SEV_DOT: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#a1a1aa",
};

const RISK_DOT: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#10b981",
};

const EXAMPLE_REPOS = ["developit/mitt", "lukeed/clsx", "sindresorhus/yocto-queue"];
const DEMO_NAME = "sample/checkout-demo";

const TOKEN_CLASS: Record<TokenKind, string> = {
  comment: "text-zinc-500 italic",
  string: "text-emerald-400",
  keyword: "text-violet-400",
  type: "text-sky-400",
  number: "text-amber-300",
  plain: "text-zinc-300",
};

const SEV_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

const byStrength = (a: ValidatedFinding, b: ValidatedFinding) =>
  SEV_RANK[a.severity] - SEV_RANK[b.severity] || SEV_RANK[a.confidence] - SEV_RANK[b.confidence];

const IMPACT_DOT: Record<ImpactKind, string> = {
  direct: "bg-red-500",
  indirect: "bg-amber-500",
  potential: "bg-zinc-400",
};

export default function Home() {
  const [phase, setPhase] = useState<Phase>("input");
  const [githubUrl, setGithubUrl] = useState("");
  const [changeRequest, setChangeRequest] = useState("");
  const [report, setReport] = useState<RepoImpactReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>({ stage: "fetching" });
  const [helpOpen, setHelpOpen] = useState(false);

  const hasSource = githubUrl.trim().length > 0;
  const canAnalyze = hasSource && changeRequest.trim().length > 0;
  const disabledReason = !hasSource
    ? "Paste a GitHub repository URL to continue."
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
      const body = { githubUrl: githubUrl.trim(), changeRequest: changeRequest.trim() };
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

  async function loadDemo() {
    try {
      const res = await fetch("/demo/report.json");
      if (!res.ok) throw new Error();
      const demo = (await res.json()) as RepoImpactReport;
      setChangeRequest(demo.changeRequest);
      setReport(demo);
      setError(null);
      setPhase("report");
    } catch {
      setError("Could not load the demo. Try analyzing a repository instead.");
    }
  }

  function reset() {
    setPhase("input");
    setReport(null);
    setError(null);
    setGithubUrl("");
    setChangeRequest("");
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
          <button
            onClick={() => setHelpOpen(true)}
            aria-label="What is ImpactIQ?"
            className="flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-500 transition-colors hover:border-violet-300 hover:text-violet-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 1.978-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="hidden sm:inline">How it works</span>
          </button>
        </div>
      </header>

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}

      <main className={`flex-1 mx-auto w-full px-4 sm:px-6 py-10 ${phase === "report" ? "max-w-6xl" : "max-w-3xl"}`}>
        {phase === "input" && (
          <InputView
            githubUrl={githubUrl}
            setGithubUrl={setGithubUrl}
            changeRequest={changeRequest}
            setChangeRequest={setChangeRequest}
            error={error}
            canAnalyze={canAnalyze}
            disabledReason={disabledReason}
            onAnalyze={analyze}
            onDemo={loadDemo}
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

const HELP_STEPS: { n: string; title: string; desc: string }[] = [
  { n: "1", title: "Paste a GitHub repo", desc: "Any public repository URL. ImpactIQ reads the code in memory — it never runs it." },
  { n: "2", title: "Describe your change", desc: "In plain English, say what you want to add or modify (name the feature, file, or method)." },
  { n: "3", title: "Read the impact report", desc: "See which files will be affected, why, how risky it is, and which tests to write." },
];

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900">What is ImpactIQ?</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-zinc-600">
          Before you write any code, ImpactIQ tells you <b className="text-zinc-800">what a change might break</b>.
          Point it at a codebase and describe what you want to do — it traces which files depend on each other and
          shows you the ripple effect, with every finding backed by the real code so you can verify it yourself.
        </p>

        <div className="mt-5">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">How to use it</div>
          <ol className="flex flex-col gap-3">
            {HELP_STEPS.map((s) => (
              <li key={s.n} className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                  {s.n}
                </span>
                <div>
                  <div className="text-sm font-semibold text-zinc-800">{s.title}</div>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

function InputView(props: {
  githubUrl: string;
  setGithubUrl: (s: string) => void;
  changeRequest: string;
  setChangeRequest: (s: string) => void;
  error: string | null;
  canAnalyze: boolean;
  disabledReason: string | null;
  onAnalyze: () => void;
  onDemo: () => void;
}) {
  const {
    githubUrl, setGithubUrl, changeRequest, setChangeRequest,
    error, canAnalyze, disabledReason, onAnalyze, onDemo,
  } = props;

  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <div className="pt-6 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-medium text-zinc-500 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Evidence-backed impact analysis
        </span>
        <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">
          What will this change break?
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-500">
          Point ImpactIQ at a GitHub repository and describe a change in plain English. It predicts the blast
          radius — every finding backed by a real file, symbol, and line you can click to verify.
        </p>
        <button
          onClick={onDemo}
          className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:border-violet-300 hover:bg-violet-100"
        >
          ✨ Try the demo — no setup needed
        </button>
      </div>

      {/* Step 1 — GitHub repository */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-6">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-[11px] font-bold text-violet-700">1</span>
          <h2 className="text-sm font-semibold text-zinc-800">GitHub repository</h2>
        </div>
        <label className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-slate-50/50 px-3.5 transition-colors focus-within:border-violet-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-violet-100">
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
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-zinc-400">Try one:</span>
          {EXAMPLE_REPOS.map((r) => (
            <button
              key={r}
              onClick={() => setGithubUrl(`https://github.com/${r}`)}
              className="rounded-md border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-500 transition-colors hover:border-violet-300 hover:text-violet-700"
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2 — the change */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-6">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-[11px] font-bold text-violet-700">2</span>
          <h2 className="text-sm font-semibold text-zinc-800">Describe the change</h2>
        </div>
        <textarea
          value={changeRequest}
          onChange={(e) => setChangeRequest(e.target.value)}
          placeholder="e.g. Add a once() method that auto-removes the handler after the first call"
          rows={3}
          className="w-full resize-none rounded-xl border border-zinc-200 bg-slate-50/50 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100"
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
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-violet-700 hover:shadow-md disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 disabled:shadow-none"
        >
          Analyze impact
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
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
  const [showAll, setShowAll] = useState(false);
  const githubBase = report.repo?.githubBase;
  const isDemo = report.repo?.name === DEMO_NAME;

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

  // Default view = confident findings (direct/indirect, confidence ≠ low).
  const isConfident = (f: ValidatedFinding) => f.impact !== "potential" && f.confidence !== "low";
  const hidden = report.findings.filter((f) => !isConfident(f));
  const shown = showAll ? report.findings : report.findings.filter(isConfident);

  const counts = { high: 0, medium: 0, low: 0 };
  for (const f of report.findings.filter(isConfident)) counts[f.severity]++;

  const directItems = shown.filter((f) => f.impact === "direct").sort(byStrength);
  const indirectItems = shown.filter((f) => f.impact === "indirect").sort(byStrength);
  const potentialItems = shown.filter((f) => f.impact === "potential").sort(byStrength);
  const affected = new Set(report.findings.filter(isConfident).map((f) => f.file)).size;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[clamp(260px,26%,320px)_1fr] lg:gap-8">
      {/* ───────── LEFT RAIL ───────── */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        <button
          onClick={onReset}
          className="group inline-flex items-center gap-1.5 self-start text-sm font-medium text-zinc-500 transition-colors hover:text-violet-700"
        >
          <span className="transition-transform group-hover:-translate-x-0.5">←</span> New analysis
        </button>

        {/* Verdict */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: RISK_DOT[report.risk.level] }} />
            <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">{report.risk.level} risk</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-5xl font-bold tracking-tight" style={{ color: RISK_DOT[report.risk.level] }}>
              {report.risk.score}
            </span>
            <span className="text-sm text-zinc-400">/ 100</span>
          </div>
          <p className="mt-1 cursor-help text-[11px] text-zinc-400" title={report.risk.note}>
            heuristic score — hover for details
          </p>

          <SeverityBar counts={counts} />

          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-zinc-100 pt-4">
            <Stat label="Files affected" value={affected} />
            <Stat label="Blast radius" value={report.retrieval.blastRadius} />
            <Stat label="Verified" value={`${report.stats.verified}/${report.stats.total}`} />
            <Stat label="Coverage" value={`${Math.round(report.stats.evidenceCoverage * 100)}%`} />
          </dl>
          {report.stats.rejected > 0 && (
            <p className="mt-3 text-[11px] font-medium text-red-600">{report.stats.rejected} fabricated claim(s) rejected</p>
          )}
        </div>

        {/* Repository health */}
        {report.health && <RailHealth health={report.health} />}

        {/* Exports */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => download("impactiq-report.md", exportMarkdown(report), "text/markdown")} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:border-violet-400 hover:text-violet-700">↓ Markdown</button>
          <button onClick={() => download("impactiq-report.json", exportJson(report), "application/json")} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:border-violet-400 hover:text-violet-700">↓ JSON</button>
        </div>
      </aside>

      {/* ───────── RIGHT PANE ───────── */}
      <div className="flex min-w-0 flex-col gap-6">
        {/* Header */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Impact report</div>
          <h1 className="mt-1 text-xl font-semibold leading-snug tracking-tight text-zinc-900">{report.changeRequest}</h1>
          {report.repo && (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-400">
              <span className="font-medium text-zinc-500">{report.repo.name}</span>
              <span>·</span>
              <span>{report.repo.fileCount} files</span>
              {report.repo.languages.length > 0 && (
                <>
                  <span>·</span>
                  <span>{report.repo.languages.join(", ")}</span>
                </>
              )}
            </p>
          )}
          <p className="mt-4 text-sm leading-relaxed text-zinc-600">{report.summary}</p>
        </div>

        {/* Banners */}
        {isDemo && (
          <div className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-xs text-violet-700">
            <span className="flex-shrink-0 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Demo</span>
            <span>Prepared <b>sample repository</b> — the full analysis flow ran on fixed demo data.</span>
          </div>
        )}
        {(weakRetrieval || truncated) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {weakRetrieval && <p>⚠ Your description didn&apos;t strongly match any files, so this run may be incomplete. Try naming a specific feature, file, or symbol.</p>}
            {truncated && <p>⚠ This repository is large and was truncated during indexing — some impacts may be missed.</p>}
          </div>
        )}

        {/* Impact findings */}
        {shown.length > 0 ? (
          <div className="flex flex-col gap-6">
            <ImpactLegend />
            {directItems.length > 0 && (
              <Section title="Direct impact" count={directItems.length} dot="bg-red-500">
                <FindingList items={directItems} githubBase={githubBase} pathSnippets={report.pathSnippets} />
              </Section>
            )}
            {indirectItems.length > 0 && (
              <Section title="Indirect impact" count={indirectItems.length} dot="bg-amber-500">
                <FindingList items={indirectItems} githubBase={githubBase} pathSnippets={report.pathSnippets} />
              </Section>
            )}
            {potentialItems.length > 0 && (
              <Section title="Potential impact" count={potentialItems.length} dot="bg-zinc-400">
                <FindingList items={potentialItems} githubBase={githubBase} pathSnippets={report.pathSnippets} />
              </Section>
            )}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-400">
            No confident impacts found for this change.
          </p>
        )}

        {hidden.length > 0 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="self-start text-xs font-medium text-violet-600 transition-colors hover:text-violet-700"
          >
            {showAll
              ? "Hide speculative / low-confidence findings"
              : `Show ${hidden.length} speculative / low-confidence finding${hidden.length > 1 ? "s" : ""} →`}
          </button>
        )}

        {/* Recommended tests */}
        {report.testRecommendations.length > 0 && (
          <Section title="Recommended tests" count={report.testRecommendations.length}>
            <ul className="flex flex-col divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
              {report.testRecommendations.map((t, i) => (
                <li key={i} className="px-4 py-3">
                  <code className="text-xs font-medium text-zinc-800">{t.file}</code>
                  <p className="mt-0.5 text-sm text-zinc-600">{t.why}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">{t.existingTest ? `covered by ${t.existingTest}` : "no existing test"}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Blast-radius graph */}
        {report.graph && report.graph.nodes.length > 0 && (
          <Section title="Blast-radius graph" count={report.graph.nodes.length}>
            <p className="mb-3 text-xs text-zinc-400">
              How the change spreads — the target on the left, each column one import hop further out. Hover a file to trace connections.
            </p>
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-3">
              <DependencyGraph graph={report.graph} />
            </div>
          </Section>
        )}

        {/* Assumptions & limitations */}
        {(report.assumptions.length > 0 || report.limitations.length > 0) && (
          <NotesCard assumptions={report.assumptions} limitations={report.limitations} />
        )}

        {/* Back to start */}
        <div className="pt-1">
          <button
            onClick={onReset}
            className="w-full rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-600 shadow-sm transition-colors hover:border-violet-400 hover:text-violet-700"
          >
            ← Analyze another change
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dd className="text-xl font-semibold tabular-nums text-zinc-900">{value}</dd>
      <dt className="mt-0.5 text-[10px] uppercase tracking-wide text-zinc-400">{label}</dt>
    </div>
  );
}

function Section({ title, count, dot, children }: { title: string; count?: number; dot?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
        <h2 className="text-sm font-semibold text-zinc-800">{title}</h2>
        {count != null && <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">{count}</span>}
      </div>
      {children}
    </section>
  );
}

function FindingList({
  items,
  githubBase,
  pathSnippets,
}: {
  items: ValidatedFinding[];
  githubBase?: string;
  pathSnippets?: Record<string, CodeSnippet>;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((f, i) => (
        <FindingRow key={`${f.file}-${i}`} f={f} index={i} githubBase={githubBase} pathSnippets={pathSnippets} />
      ))}
    </ul>
  );
}

function RailHealth({ health }: { health: RepoHealth }) {
  const [open, setOpen] = useState(false);
  const rows: { label: string; value: number; warn?: boolean }[] = [
    { label: "Files", value: health.filesIndexed },
    { label: "Symbols", value: health.symbolsIndexed },
    { label: "Imports", value: health.importsIndexed },
    { label: "Tests", value: health.testFiles },
    { label: "Unresolved", value: health.unresolvedImports, warn: health.unresolvedImports > 0 },
    { label: "Skipped", value: health.skippedCount, warn: health.skippedCount > 0 },
  ];
  const hasDetails = health.warnings.length > 0 || health.skipped.length > 0;
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Repository health</span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            health.partial ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${health.partial ? "bg-amber-500" : "bg-emerald-500"}`} />
          {health.partial ? "Partial" : "Complete"}
        </span>
      </div>
      <dl className="mt-3 flex flex-col gap-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-xs">
            <dt className="text-zinc-500">{r.label}</dt>
            <dd className={`font-medium tabular-nums ${r.warn ? "text-amber-600" : "text-zinc-700"}`}>{r.value.toLocaleString()}</dd>
          </div>
        ))}
      </dl>
      {hasDetails && (
        <div className="mt-3 border-t border-zinc-100 pt-2.5">
          <button onClick={() => setOpen(!open)} className="text-[11px] font-medium text-violet-600 hover:text-violet-700">
            {open ? "Hide" : "Show"} warnings &amp; skipped ({health.warnings.length + health.skipped.length})
          </button>
          {open && (
            <div className="mt-2 flex flex-col gap-2">
              {health.warnings.map((w, i) => (
                <p key={i} className="flex gap-1.5 text-[11px] text-amber-700">
                  <span>⚠</span>
                  <span>{w}</span>
                </p>
              ))}
              {health.skipped.length > 0 && (
                <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                  {health.skipped.map((s, i) => (
                    <li key={i} className="text-[11px]">
                      <code className="text-zinc-600">{s.path.split("/").pop()}</code>
                      <span className="text-zinc-400"> — {s.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotesCard({ assumptions, limitations }: { assumptions: string[]; limitations: string[] }) {
  const [open, setOpen] = useState(false);
  const total = assumptions.length + limitations.length;
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-5 py-3.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Assumptions &amp; limitations</h2>
        <span className="flex items-center gap-2 text-[11px]">
          <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-zinc-500">{total}</span>
          <span className="text-violet-600">{open ? "Hide" : "Show"}</span>
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-4 border-t border-zinc-100 px-5 py-4">
          {assumptions.length > 0 && (
            <div>
              <div className="mb-1.5 text-[11px] font-medium text-zinc-500">Assumptions</div>
              <BulletList items={assumptions} />
            </div>
          )}
          {limitations.length > 0 && (
            <div>
              <div className="mb-1.5 text-[11px] font-medium text-zinc-500">Limitations</div>
              <BulletList items={limitations} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SeverityBar({ counts }: { counts: { high: number; medium: number; low: number } }) {
  const total = counts.high + counts.medium + counts.low;
  if (total === 0) return null;
  return (
    <div className="mt-4">
      <div className="flex h-2 overflow-hidden rounded-full bg-zinc-100">
        {counts.high > 0 && <div style={{ flex: counts.high }} className="bg-red-500" />}
        {counts.medium > 0 && <div style={{ flex: counts.medium }} className="bg-amber-500" />}
        {counts.low > 0 && <div style={{ flex: counts.low }} className="bg-zinc-400" />}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 text-[11px] text-zinc-500">
        {counts.high > 0 && <span><b className="text-red-600">{counts.high}</b> high</span>}
        {counts.medium > 0 && <span><b className="text-amber-600">{counts.medium}</b> medium</span>}
        {counts.low > 0 && <span><b className="text-zinc-600">{counts.low}</b> low</span>}
      </div>
    </div>
  );
}

const IMPACT_LEGEND: { kind: ImpactKind; color: string; blurb: string }[] = [
  { kind: "direct", color: "bg-red-500", blurb: "The file is a change target — it lexically matched the change description." },
  { kind: "indirect", color: "bg-amber-500", blurb: "Connected to a changed file through one or more import relationships." },
  { kind: "potential", color: "bg-zinc-400", blurb: "A plausible relationship, but no dependency path confirms it — verify manually." },
];

function ImpactLegend() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-zinc-500 hover:text-zinc-700">
        <span className="flex items-center gap-3">
          {IMPACT_LEGEND.map((l) => (
            <span key={l.kind} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${l.color}`} />
              {cap(l.kind)}
            </span>
          ))}
        </span>
        <span className="text-[11px] text-violet-600">{open ? "Hide" : "What do these mean?"}</span>
      </button>
      {open && (
        <ul className="mt-3 flex flex-col gap-2 border-t border-zinc-100 pt-3">
          {IMPACT_LEGEND.map((l) => (
            <li key={l.kind} className="flex gap-2 text-zinc-600">
              <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${l.color}`} />
              <span>
                <b className="text-zinc-800">{cap(l.kind)} impact</b> — {l.blurb}
              </span>
            </li>
          ))}
          <li className="text-[11px] text-zinc-400">
            Category describes the relationship to the change; <b>confidence</b> (shown per finding) describes how sure the model is — the two are independent.
          </li>
        </ul>
      )}
    </div>
  );
}

function FindingRow({
  f,
  index,
  githubBase,
  pathSnippets,
}: {
  f: ValidatedFinding;
  index: number;
  githubBase?: string;
  pathSnippets?: Record<string, CodeSnippet>;
}) {
  const [open, setOpen] = useState(false);
  const loc = [f.symbol, f.line ? `L${f.line}` : null].filter(Boolean).join(" ");
  const canExpand = Boolean(f.snippet);
  const ghUrl = githubBase ? `${githubBase}/${f.file}${f.line ? `#L${f.line}` : ""}` : null;

  return (
    <li
      className="overflow-hidden rounded-lg border border-zinc-200"
      style={{ animation: "fadeIn .3s ease-out both", animationDelay: `${index * 50}ms` }}
    >
      <div className="p-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: SEV_DOT[f.severity] }} title={`${f.severity} severity`} />
          <code className="truncate text-xs font-medium text-zinc-800">{f.file}</code>
          {loc && <span className="flex-shrink-0 text-[11px] text-zinc-400">{loc}</span>}
          {!f.verified && (
            <span className="flex-shrink-0 text-[10px] text-amber-600" title={f.issues.map((i) => i.message).join("; ")}>
              unverified
            </span>
          )}
          <span className="ml-auto flex flex-shrink-0 items-center gap-3 text-[11px]">
            {f.confidence !== "high" && <span className="text-zinc-400">{f.confidence} confidence</span>}
            {ghUrl && (
              <a href={ghUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-violet-600 transition-colors">
                GitHub ↗
              </a>
            )}
            {canExpand && (
              <button onClick={() => setOpen(!open)} className="text-violet-600">
                {open ? "Hide" : "Code"}
              </button>
            )}
          </span>
        </div>
        <p className="mt-2 text-sm text-zinc-700">{f.reason}</p>
        <p className="mt-1 text-[11px] text-zinc-400">{f.evidence}</p>
        {f.impactReason && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-500">
            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${IMPACT_DOT[f.impact]}`} />
            <span className="font-medium text-zinc-600">{cap(f.impact)} impact:</span> {f.impactReason}
          </p>
        )}
        {f.path && f.path.length > 1 && (
          <DependencyPath path={f.path} pathSnippets={pathSnippets} githubBase={githubBase} />
        )}
      </div>

      {open && f.snippet && <SnippetView snippet={f.snippet} />}
    </li>
  );
}

function SnippetView({ snippet }: { snippet: CodeSnippet }) {
  return (
    <div className="overflow-x-auto border-t border-zinc-200 bg-zinc-950">
      <pre className="py-2 font-mono text-[12px] leading-relaxed">
        {snippet.lines.map((line, i) => {
          const lineNo = snippet.startLine + i;
          const isFocus = lineNo === snippet.focusLine;
          const tokens = highlightLine(line);
          return (
            <div key={i} className={isFocus ? "bg-violet-500/15" : ""}>
              <span className="inline-block w-10 select-none pr-3 text-right text-zinc-600">{lineNo}</span>
              {tokens.length === 0 ? (
                <span> </span>
              ) : (
                tokens.map((t, j) => (
                  <span key={j} className={TOKEN_CLASS[t.kind]}>
                    {t.text}
                  </span>
                ))
              )}
            </div>
          );
        })}
      </pre>
    </div>
  );
}

/**
 * The dependency chain that explains why a file is in scope. `path` is ordered
 * [this file, …, change target]; each file imports the one below it. Clicking a
 * file reveals its top-of-file source (where the import lives).
 */
function DependencyPath({
  path,
  pathSnippets,
  githubBase,
}: {
  path: string[];
  pathSnippets?: Record<string, CodeSnippet>;
  githubBase?: string;
}) {
  const [openFile, setOpenFile] = useState<string | null>(null);
  return (
    <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50/70 p-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Dependency path</div>
      <ol className="flex flex-col gap-1">
        {path.map((file, i) => {
          const snippet = pathSnippets?.[file];
          const isTarget = i === path.length - 1;
          const open = openFile === file;
          const ghUrl = githubBase ? `${githubBase}/${file}` : null;
          const name = file.split("/").pop() ?? file;
          return (
            <li key={`${file}-${i}`} style={{ marginLeft: `${i * 16}px` }}>
              <div className="flex items-center gap-1.5">
                {i > 0 && <span className="text-zinc-300" title="imports">↳</span>}
                <button
                  onClick={() => snippet && setOpenFile(open ? null : file)}
                  disabled={!snippet}
                  className={`font-mono text-[11px] ${snippet ? "text-zinc-700 hover:text-violet-600" : "cursor-default text-zinc-500"}`}
                  title={file}
                >
                  {name}
                </button>
                {isTarget && (
                  <span className="rounded bg-violet-50 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-violet-600">
                    change target
                  </span>
                )}
                {ghUrl && (
                  <a href={ghUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-zinc-400 hover:text-violet-600" title="Open on GitHub">
                    ↗
                  </a>
                )}
              </div>
              {open && snippet && (
                <div className="mt-1 overflow-hidden rounded-md border border-zinc-200">
                  <SnippetView snippet={snippet} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[10px] text-zinc-400">Each file imports the one below it; the change target is at the bottom.</p>
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
