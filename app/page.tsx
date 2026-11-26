"use client";

import { useState } from "react";
import { DependencyGraph } from "@/components/results/DependencyGraph";
import { exportJson, exportMarkdown } from "@/lib/report-format";
import { highlightLine, type TokenKind } from "@/lib/highlight";
import type { CodeSnippet, ImpactKind, RepoHealth, ReportGraph, RepoImpactReport, ValidatedFinding } from "@/types";

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

const RISK: Record<string, string> = {
  high: "bg-red-600 text-white",
  medium: "bg-amber-500 text-white",
  low: "bg-emerald-600 text-white",
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
          {/* Diagram mode temporarily hidden — repo analysis is the primary flow.
          <Link href="/diagram" className="text-xs text-zinc-500 hover:text-violet-600 transition-colors">
            Diagram mode →
          </Link>
          */}
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-10">
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

  return (
    <section className="flex flex-col gap-5">
      {/* Sticky summary */}
      <div className="sticky top-14 z-[5] -mx-4 sm:-mx-6 flex items-center justify-between gap-3 border-b border-zinc-200 bg-slate-50/85 px-4 sm:px-6 py-2 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${RISK[report.risk.level]}`}>
            {report.risk.level} · {report.risk.score}
          </span>
          <span className="truncate text-xs text-zinc-500">{report.changeRequest}</span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button onClick={() => download("impactiq-report.md", exportMarkdown(report), "text/markdown")} className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs transition-colors hover:border-violet-400 hover:text-violet-700">.md</button>
          <button onClick={() => download("impactiq-report.json", exportJson(report), "application/json")} className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs transition-colors hover:border-violet-400 hover:text-violet-700">.json</button>
          <button onClick={onReset} className="text-xs text-zinc-500 hover:text-violet-600 transition-colors">New</button>
        </div>
      </div>

      {/* Sample-data banner */}
      {isDemo && (
        <div className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-xs text-violet-700">
          <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Demo</span>
          <span>
            This is a prepared <b>sample repository</b> — the full analysis flow ran on fixed demo data. Analyze your own repo above to see real results.
          </span>
        </div>
      )}

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

      {/* Repository health */}
      {report.health && <HealthSummary health={report.health} />}

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
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${RISK[report.risk.level]}`}>
          {report.risk.level} risk · {report.risk.score}/100
        </span>
        <p className="mt-3 text-sm leading-relaxed text-zinc-700">{report.summary}</p>
        <p className="mt-2 text-[11px] text-zinc-400">{report.risk.note}</p>

        <SeverityBar counts={counts} />

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

      {/* Dependency / blast-radius graph */}
      {report.graph && report.graph.nodes.length > 0 && <GraphCard graph={report.graph} />}

      {shown.length > 0 && <ImpactLegend />}

      {(["direct", "indirect", "potential"] as ImpactKind[]).map((kind) => {
        const items = shown
          .filter((f) => f.impact === kind)
          .sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || SEV_RANK[a.confidence] - SEV_RANK[b.confidence]);
        if (items.length === 0) return null;
        return (
          <Card key={kind} title={`${cap(kind)} impact (${items.length})`}>
            <ul className="flex flex-col gap-3">
              {items.map((f, i) => (
                <FindingRow key={`${f.file}-${i}`} f={f} index={i} githubBase={githubBase} pathSnippets={report.pathSnippets} />
              ))}
            </ul>
          </Card>
        );
      })}

      {hidden.length > 0 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="self-start text-xs text-zinc-500 hover:text-violet-600 transition-colors"
        >
          {showAll
            ? "Hide speculative / low-confidence findings"
            : `Show ${hidden.length} speculative / low-confidence finding${hidden.length > 1 ? "s" : ""} →`}
        </button>
      )}

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

function HealthSummary({ health }: { health: RepoHealth }) {
  const [open, setOpen] = useState(false);
  const metrics: { label: string; value: number; warn?: boolean }[] = [
    { label: "Files indexed", value: health.filesIndexed },
    { label: "Symbols", value: health.symbolsIndexed },
    { label: "Imports", value: health.importsIndexed },
    { label: "Test files", value: health.testFiles },
    { label: "Unresolved imports", value: health.unresolvedImports, warn: health.unresolvedImports > 0 },
    { label: "Skipped files", value: health.skippedCount, warn: health.skippedCount > 0 },
  ];
  const hasDetails = health.warnings.length > 0 || health.skipped.length > 0;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Repository health</h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            health.partial ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${health.partial ? "bg-amber-500" : "bg-emerald-500"}`} />
          {health.partial ? "Partial analysis" : "Complete analysis"}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.label}>
            <dt className="text-[11px] text-zinc-400">{m.label}</dt>
            <dd className={`text-lg font-semibold tabular-nums ${m.warn ? "text-amber-600" : "text-zinc-800"}`}>
              {m.value.toLocaleString()}
            </dd>
          </div>
        ))}
      </dl>

      {hasDetails && (
        <div className="mt-4 border-t border-zinc-100 pt-3">
          <button onClick={() => setOpen(!open)} className="text-[11px] font-medium text-violet-600 hover:text-violet-700">
            {open ? "Hide" : "Show"} warnings &amp; skipped files
            {" "}({health.warnings.length + health.skipped.length})
          </button>
          {open && (
            <div className="mt-3 flex flex-col gap-3">
              {health.warnings.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {health.warnings.map((w, i) => (
                    <li key={i} className="flex gap-2 text-[11px] text-amber-700">
                      <span>⚠</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              )}
              {health.skipped.length > 0 && (
                <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                  {health.skipped.map((s, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 text-[11px]">
                      <code className="truncate text-zinc-600">{s.path}</code>
                      <span className="flex-shrink-0 text-zinc-400">{s.reason}</span>
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

function GraphCard({ graph }: { graph: ReportGraph }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-5">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Blast-radius graph</h2>
        <span className="text-[11px] text-violet-600">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="mt-3">
          <DependencyGraph graph={graph} />
        </div>
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
