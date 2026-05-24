"use client";

import { useState, useEffect, useRef } from "react";
import { useAnalysisStore } from "@/store/analysis.store";
import { Sidebar } from "@/components/shared/Sidebar";
import { LoadingSteps } from "@/components/shared/LoadingSteps";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { MermaidInput } from "@/components/upload/MermaidInput";
import { ModuleChips } from "@/components/review/ModuleChips";
import { DependencyMapper } from "@/components/review/DependencyMapper";
import { ImpactCard } from "@/components/results/ImpactCard";
import { HiddenDeps } from "@/components/results/HiddenDeps";
import { TestChecklist } from "@/components/results/TestChecklist";
import { DeploymentRisks } from "@/components/results/DeploymentRisks";
import { AgentThinking } from "@/components/agent/AgentThinking";
import { IterationLog } from "@/components/agent/IterationLog";
import type { Architecture, ImpactReport } from "@/types";
import { parseSchema } from "@/lib/schema-parser";

const EXTRACT_STEPS = [
  "Reading diagram...",
  "Identifying modules...",
  "Mapping dependencies...",
  "Building architecture graph...",
];

type UploadTab = "image" | "mermaid" | "schema";

const DEMO_ARCHITECTURE: Architecture = {
  modules: [
    "Auth Service",
    "API Gateway",
    "Payment Service",
    "PostgreSQL",
    "Redis Cache",
    "Notification Service",
    "Frontend App",
  ],
  dependencies: [
    { from: "API Gateway", to: "Auth Service" },
    { from: "API Gateway", to: "Payment Service" },
    { from: "Auth Service", to: "PostgreSQL" },
    { from: "Auth Service", to: "Redis Cache" },
    { from: "Payment Service", to: "PostgreSQL" },
    { from: "Notification Service", to: "Redis Cache" },
    { from: "Frontend App", to: "API Gateway" },
  ],
  confidence: 0.95,
};

const DEMO_REPORT: ImpactReport = {
  blastRadius: 5,
  agentConfidence: 0.91,
  iterationHistory: [
    {
      iteration: 1,
      confidence: 0.62,
      toolsCalled: [
        {
          tool: "trace_dependency",
          input: { module: "Auth Service" },
          output: JSON.stringify({ module: "Auth Service", upstream: ["API Gateway"], downstream: ["PostgreSQL", "Redis Cache"], transitive_upstreams: ["Frontend App"] }),
          reasoning: "Agent called trace_dependency to investigate Auth Service impact",
        },
        {
          tool: "estimate_blast_radius",
          input: { impacted_modules: ["Auth Service", "API Gateway"] },
          output: JSON.stringify({ directCount: 2, transitiveCount: 3, totalAffected: 5, percentageOfSystem: 71 }),
          reasoning: "Agent called estimate_blast_radius to quantify scope",
        },
      ],
      findings: "Auth Service is directly impacted — OAuth replaces the entire token flow. API Gateway must update middleware to validate JWTs. Frontend App login UI must be replaced. Blast radius is 5 modules (71% of system).",
      critique: "Not yet verified if Notification Service email flows link back to auth endpoints. Payment Service internal auth path also unclear.",
    },
    {
      iteration: 2,
      confidence: 0.91,
      toolsCalled: [
        {
          tool: "trace_dependency",
          input: { module: "Notification Service" },
          output: JSON.stringify({ module: "Notification Service", upstream: [], downstream: ["Redis Cache"], transitive_upstreams: [] }),
          reasoning: "Agent called trace_dependency to check Notification Service auth dependency",
        },
        {
          tool: "generate_migration_path",
          input: { risks: ["PostgreSQL", "Auth Service", "API Gateway", "Frontend App"] },
          output: JSON.stringify({ deploymentOrder: ["PostgreSQL", "Auth Service", "API Gateway", "Frontend App"], warnings: [] }),
          reasoning: "Agent called generate_migration_path to produce safe deployment order",
        },
      ],
      findings: "Confirmed Notification Service has hidden dependency on Auth Service via password reset email flows. Payment Service also relies on internal auth tokens. Safe deployment order: PostgreSQL → Auth Service → API Gateway → Frontend App.",
      critique: "All major risks identified. Deployment order confirmed via topological sort. Confidence sufficient to finalize report.",
    },
  ],
  impacted: [
    {
      module: "Auth Service",
      severity: "high",
      reason:
        "OAuth replaces the entire authentication flow. All token issuance, session management, and user identity resolution must be rewritten.",
    },
    {
      module: "API Gateway",
      severity: "high",
      reason:
        "Every inbound request must now validate OAuth tokens instead of session cookies. Auth middleware changes affect all downstream routes.",
    },
    {
      module: "Frontend App",
      severity: "medium",
      reason:
        "Login/signup UI must be replaced with OAuth provider buttons. Session storage strategy changes from cookie-based to token-based.",
    },
    {
      module: "PostgreSQL",
      severity: "medium",
      reason:
        "User table schema changes required — password_hash column deprecated, new oauth_provider and oauth_id columns needed with a unique index.",
    },
    {
      module: "Redis Cache",
      severity: "low",
      reason:
        "Session cache keys need migration. OAuth tokens are stateless so cache invalidation simplifies, but all existing sessions must be flushed on deploy.",
    },
  ],
  hiddenDeps: [
    {
      from: "Notification Service",
      to: "Auth Service",
      risk: "Password reset emails link back to the auth flow. OAuth changes will break the reset token validation endpoint these emails point to.",
    },
    {
      from: "Payment Service",
      to: "Auth Service",
      risk: "Payment webhooks verify caller identity via internal auth tokens. OAuth migration must preserve this internal service-to-service auth path or payments will fail silently.",
    },
  ],
  tests: [
    {
      module: "Auth Service",
      cases: [
        "Google OAuth callback returns valid JWT",
        "GitHub OAuth callback returns valid JWT",
        "Invalid OAuth state param returns 400",
        "Expired OAuth code returns 401",
        "New user auto-provisioned on first OAuth login",
        "Existing user matched by email on OAuth login",
      ],
    },
    {
      module: "API Gateway",
      cases: [
        "All routes reject requests with no auth header",
        "Routes accept valid OAuth JWT",
        "Routes reject expired JWT",
        "Routes reject tampered JWT signature",
      ],
    },
    {
      module: "Frontend App",
      cases: [
        "Login page renders Google and GitHub OAuth buttons",
        "Redirect to provider OAuth on button click",
        "Token stored correctly after OAuth callback",
        "Logged-out state clears token from storage",
      ],
    },
    {
      module: "PostgreSQL",
      cases: [
        "Migration adds oauth_provider column without data loss",
        "Migration adds oauth_id column with unique index",
        "Rollback migration restores previous schema cleanly",
      ],
    },
  ],
  deploymentRisks: [
    "All active user sessions will be invalidated on deploy. Users must re-authenticate via OAuth. Schedule during a low-traffic window and communicate downtime in advance.",
    "Database migration is destructive — password_hash column will be dropped. Ensure a full verified backup exists before running the migration in production.",
    "OAuth app credentials (client_id, client_secret) must be provisioned in both Google and GitHub developer consoles before deployment. Missing credentials cause complete auth failure.",
  ],
};

export default function Home() {
  const store = useAnalysisStore();
  const [uploadTab, setUploadTab] = useState<UploadTab>("mermaid");
  const [schemaCode, setSchemaCode] = useState("");
  const [showTests, setShowTests] = useState(false);
  const [sessionId] = useState(() => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")).join("-");
  });
  const sessionTs = new Date().toISOString().slice(0, 16).replace("T", "-").replace(/:/g, ":");

  function handleDemo() {
    store.setFeatureDescription(
      "Add OAuth 2.0 login with Google and GitHub, replacing the current email/password flow"
    );
    store.setArchitecture(DEMO_ARCHITECTURE);
    store.setReport(DEMO_REPORT);
    store.setStep("report");
  }

  async function handleExtract() {
    store.setStep("extracting");
    store.setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
        // Schema tab: parse locally, no API call
      if (uploadTab === "schema") {
        clearTimeout(timeoutId);
        const arch = parseSchema(schemaCode);
        if (arch.modules.length === 0) throw new Error("No tables found. Paste a valid SQL DDL with CREATE TABLE statements.");
        store.setArchitecture(arch);
        store.setStep("review");
        return;
      }

      const body =
        uploadTab === "mermaid"
          ? { mermaid: store.mermaidCode }
          : { image: store.uploadedImage, mediaType: store.uploadedImageType };

      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        let data: { error?: string };
        try { data = await res.json(); } catch { throw new Error("Unexpected response from server."); }
        throw new Error(data.error ?? "Extraction failed");
      }

      let arch: Architecture;
      try { arch = await res.json(); } catch { throw new Error("Unexpected response from server."); }
      store.setArchitecture(arch);
      store.setStep("review");
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        store.setError("Request timed out. Please try again.");
      } else {
        store.setError(err instanceof Error ? err.message : "Unknown error");
      }
      store.setStep("upload");
    }
  }

  async function handleAnalyze() {
    if (!store.architecture || !store.featureDescription.trim()) return;
    store.setStep("analyzing");
    store.setError(null);
    store.setAgentProgress(0, 0);

    // Agent loop: 3 iterations × ~40s each; give 3min buffer
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180_000);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          architecture: store.architecture,
          feature: store.featureDescription,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        let data: { error?: string };
        try { data = await res.json(); } catch { throw new Error("Unexpected response from server."); }
        throw new Error(data.error ?? "Analysis failed");
      }

      let report: ImpactReport;
      try { report = await res.json(); } catch { throw new Error("Unexpected response from server."); }
      store.setReport(report);
      store.setStep("report");
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("[handleAnalyze] Agent failed:", err);
      const msg = err instanceof Error && err.name === "AbortError"
        ? "Request timed out after 3 minutes. Please try again."
        : err instanceof Error ? err.message : "Unknown error";
      // setStep first (it clears error), then setError so it stays visible
      store.setStep("feature");
      store.setError(msg);
    }
  }

  const isWide = store.step === "report";

  return (
    <div className="flex min-h-screen bg-slate-50 text-zinc-900">
      <Sidebar current={store.step} />

      <div className="flex-1 ml-56 min-h-screen">
        {/* Session bar */}
        {store.step === "report" && (
          <div className="border-b border-zinc-200 bg-white px-8 py-2 flex items-center gap-4">
            <span className="text-[10px] font-mono text-zinc-400 tracking-wider">
              SESSION_ID: {sessionId} / TIMESTAMP: {sessionTs}
            </span>
            {store.report?.agentConfidence != null && (
              <span className="ml-auto text-[10px] font-mono text-emerald-600 font-bold">
                ● AGENT CONFIDENCE: {Math.round(store.report.agentConfidence * 100)}%
              </span>
            )}
          </div>
        )}
        <main className={`${isWide ? "max-w-5xl" : "max-w-2xl"} mx-auto px-8 py-10 flex flex-col gap-8`}>
          {store.error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {store.error}
            </div>
          )}

          {/* Upload */}
          {store.step === "upload" && (
            <div className="flex flex-col gap-6">
              <div>
                <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
                  What will this feature break?
                </h1>
                <p className="mt-1.5 text-sm text-zinc-500">
                  Upload your architecture diagram and ImpactIQ computes the blast radius before you write a single line of code.
                </p>
              </div>

              {/* Demo banner */}
              <div className="flex items-center justify-between rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-zinc-800">See a live example</p>
                  <p className="text-xs text-zinc-500 mt-0.5">OAuth migration — 2-iteration agent run, no API key needed</p>
                </div>
                <button
                  onClick={handleDemo}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-colors"
                >
                  Try the demo
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>

              <div className="flex gap-1 p-1 bg-zinc-100 rounded-xl w-fit">
                {([
                  { id: "mermaid", label: "Mermaid" },
                  { id: "schema", label: "DB Schema" },
                  { id: "image", label: "Image" },
                ] as { id: UploadTab; label: string }[]).map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setUploadTab(id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      uploadTab === id
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {uploadTab === "mermaid" && <MermaidInput onReady={handleExtract} />}
              {uploadTab === "image" && <ImageUploader onReady={handleExtract} />}
              {uploadTab === "schema" && (
                <div className="flex flex-col gap-3">
                  <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50 border-b border-zinc-100">
                      <span className="text-xs font-mono font-semibold text-zinc-500">SQL DDL — paste CREATE TABLE statements</span>
                      <button
                        onClick={() => setSchemaCode(`CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  status VARCHAR(50) NOT NULL,
  total DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2)
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2),
  stock_count INTEGER DEFAULT 0
);`)}
                        className="text-[10px] font-mono text-violet-600 hover:text-violet-700 font-semibold"
                      >
                        Load example
                      </button>
                    </div>
                    <textarea
                      value={schemaCode}
                      onChange={(e) => setSchemaCode(e.target.value)}
                      placeholder={`CREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  email VARCHAR(255)\n);\n\nCREATE TABLE orders (\n  id SERIAL PRIMARY KEY,\n  user_id INTEGER REFERENCES users(id)\n);`}
                      rows={14}
                      spellCheck={false}
                      className="w-full px-4 py-3 font-mono text-xs text-zinc-800 placeholder:text-zinc-300 focus:outline-none resize-none bg-white"
                    />
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Tables become modules · <code className="bg-zinc-100 px-1 rounded">FOREIGN KEY ... REFERENCES</code> constraints become dependencies · Parsed locally, no API call
                  </p>
                  <button
                    onClick={handleExtract}
                    disabled={!schemaCode.trim()}
                    className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-100 disabled:text-zinc-400 text-white font-semibold text-sm transition-colors"
                  >
                    Parse Schema
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Extracting */}
          {store.step === "extracting" && (
            <div className="flex flex-col items-center gap-8 py-16">
              <div className="w-14 h-14 rounded-2xl bg-violet-100 border border-violet-200 flex items-center justify-center">
                <svg className="w-7 h-7 text-violet-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="text-center">
                <h2 className="text-lg font-semibold text-zinc-800">Extracting Architecture</h2>
                <p className="text-sm text-zinc-500 mt-1">Claude is reading your diagram...</p>
              </div>
              <LoadingSteps steps={EXTRACT_STEPS} />
            </div>
          )}

          {/* Review */}
          {store.step === "review" && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Review Extracted Architecture</h2>
                <p className="text-sm text-zinc-500 mt-1.5">
                  Confirm Claude extracted your system correctly. Add or remove modules and dependencies.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-6 flex flex-col gap-6">
                <ModuleChips />
                <div className="border-t border-zinc-200" />
                <DependencyMapper />
              </div>
              <button
                onClick={() => store.setStep("feature")}
                disabled={!store.architecture?.modules.length}
                className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-100 disabled:text-zinc-400 text-white font-semibold text-sm transition-colors"
              >
                Architecture Looks Good — Describe Your Feature
              </button>
            </div>
          )}

          {/* Feature */}
          {store.step === "feature" && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 tracking-tight">What are you building?</h2>
                <p className="text-sm text-zinc-500 mt-1.5">
                  Describe the feature in plain English. ImpactIQ will trace every module it could affect.
                </p>
              </div>
              <textarea
                value={store.featureDescription}
                onChange={(e) => store.setFeatureDescription(e.target.value)}
                placeholder="e.g. Add OAuth 2.0 login with Google and GitHub, replacing the current email/password flow..."
                rows={5}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 resize-none transition-colors shadow-sm"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => store.setStep("review")}
                  className="px-5 py-3 rounded-xl border border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:border-zinc-300 text-sm font-medium transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleAnalyze}
                  disabled={!store.featureDescription.trim()}
                  className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-100 disabled:text-zinc-400 text-white font-semibold text-sm transition-colors"
                >
                  Analyze Impact
                </button>
              </div>
            </div>
          )}

          {/* Analyzing — time-driven animated progress */}
          {store.step === "analyzing" && (
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <AgentThinking />
            </div>
          )}

          {/* Report */}
          {store.step === "report" && store.report && (() => {
            const report = store.report!;
            const total = store.architecture?.modules.length ?? report.blastRadius;
            const pct = total > 0 ? Math.round((report.blastRadius / total) * 100) : 0;
            const highCount = report.impacted.filter(m => m.severity === "high").length;
            const medCount = report.impacted.filter(m => m.severity === "medium").length;
            const lowCount = report.impacted.filter(m => m.severity === "low").length;
            const confidence = report.agentConfidence ?? 0;
            const iterCount = report.iterationHistory?.length ?? 0;

            const blastColor = pct >= 70 ? { text: "text-red-600", border: "border-red-200", bar: "bg-red-500" }
              : pct >= 40 ? { text: "text-amber-600", border: "border-amber-200", bar: "bg-amber-500" }
              : pct >= 20 ? { text: "text-yellow-600", border: "border-yellow-200", bar: "bg-yellow-400" }
              : { text: "text-emerald-600", border: "border-emerald-200", bar: "bg-emerald-500" };

            // Auto-generate summary from data
            const highModules = report.impacted.filter(m => m.severity === "high").map(m => m.module);
            const medModules = report.impacted.filter(m => m.severity === "medium").map(m => m.module);
            let summary = "";
            if (highModules.length > 0) {
              summary += `${highModules.slice(0, 2).join(" and ")}${highModules.length > 2 ? ` and ${highModules.length - 2} more` : ""} require${highModules.length === 1 ? "s" : ""} direct code changes.`;
            }
            if (medModules.length > 0) {
              summary += ` ${medModules.slice(0, 2).join(", ")}${medModules.length > 2 ? ` +${medModules.length - 2}` : ""} ${medModules.length === 1 ? "has" : "have"} interface or contract changes.`;
            }
            if (report.hiddenDeps.length > 0) {
              summary += ` ${report.hiddenDeps.length} non-obvious risk${report.hiddenDeps.length !== 1 ? "s" : ""} detected that could break silently.`;
            }
            if (!summary) summary = "Analysis complete. Review impacted modules below.";

            const totalTests = report.tests.reduce((acc, t) => acc + t.cases.length, 0);

            return (
              <div className="flex flex-col gap-5">
                {/* Page header */}
                <div>
                  <h2 className="text-xl font-black text-zinc-900 tracking-tight uppercase">Impact Report</h2>
                  <p className="text-xs text-zinc-400 font-mono mt-1 truncate max-w-lg">&ldquo;{store.featureDescription}&rdquo;</p>
                </div>

                {/* Metrics bar */}
                <div className="grid grid-cols-3 gap-3">
                  {/* Blast radius */}
                  <div className={`rounded-xl border ${blastColor.border} bg-white p-4 flex flex-col gap-1`}>
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Blast Radius</span>
                    <span className={`text-3xl font-black tabular-nums ${blastColor.text}`}>{pct}%</span>
                    <div className="h-1 rounded-full bg-zinc-100 overflow-hidden mt-1">
                      <div className={`h-full rounded-full ${blastColor.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] text-zinc-400 font-mono">{report.blastRadius}/{total} modules</span>
                  </div>

                  {/* Severity breakdown */}
                  <div className="rounded-xl border border-zinc-200 bg-white p-4 flex flex-col gap-2">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Severity</span>
                    <div className="flex flex-col gap-1.5 mt-1">
                      {highCount > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono font-semibold text-red-600">● HIGH</span>
                          <span className="text-xs font-bold text-zinc-800 tabular-nums">{highCount} module{highCount !== 1 ? "s" : ""}</span>
                        </div>
                      )}
                      {medCount > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono font-semibold text-amber-500">● MEDIUM</span>
                          <span className="text-xs font-bold text-zinc-800 tabular-nums">{medCount} module{medCount !== 1 ? "s" : ""}</span>
                        </div>
                      )}
                      {lowCount > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono font-semibold text-blue-500">● LOW</span>
                          <span className="text-xs font-bold text-zinc-800 tabular-nums">{lowCount} module{lowCount !== 1 ? "s" : ""}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Agent confidence */}
                  <div className="rounded-xl border border-zinc-200 bg-white p-4 flex flex-col gap-1">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Agent Confidence</span>
                    <span className={`text-3xl font-black tabular-nums ${confidence >= 0.85 ? "text-emerald-600" : confidence >= 0.6 ? "text-amber-500" : "text-red-500"}`}>
                      {Math.round(confidence * 100)}%
                    </span>
                    <span className="text-[11px] text-zinc-400 font-mono">{iterCount} iteration{iterCount !== 1 ? "s" : ""} · {iterCount === 3 ? "max reached" : confidence >= 0.85 ? "converged" : "partial"}</span>
                  </div>
                </div>

                {/* Summary */}
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3.5">
                  <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1.5">TL;DR</p>
                  <p className="text-sm text-zinc-700 leading-relaxed">{summary}</p>
                </div>

                {/* What Breaks */}
                <div>
                  <h3 className="text-[11px] font-mono font-bold uppercase tracking-widest text-zinc-500 mb-3">
                    What Breaks <span className="text-zinc-300 mx-1">·</span> {report.impacted.length} module{report.impacted.length !== 1 ? "s" : ""}
                  </h3>
                  <div className="flex flex-col gap-2">
                    {report.impacted.map((mod, i) => (
                      <ImpactCard key={mod.module} module={mod} index={i} />
                    ))}
                  </div>
                </div>

                {/* Non-Obvious Risks */}
                {report.hiddenDeps.length > 0 && (
                  <div>
                    <h3 className="text-[11px] font-mono font-bold uppercase tracking-widest text-zinc-500 mb-3">
                      Non-Obvious Risks <span className="text-zinc-300 mx-1">·</span> {report.hiddenDeps.length} hidden dependency
                    </h3>
                    <HiddenDeps deps={report.hiddenDeps} />
                  </div>
                )}

                {/* Action Plan */}
                {report.deploymentRisks.length > 0 && (
                  <div>
                    <h3 className="text-[11px] font-mono font-bold uppercase tracking-widest text-zinc-500 mb-3">
                      Action Plan <span className="text-zinc-300 mx-1">·</span> {report.deploymentRisks.length} step{report.deploymentRisks.length !== 1 ? "s" : ""}
                    </h3>
                    <DeploymentRisks risks={report.deploymentRisks} />
                  </div>
                )}

                {/* Test Coverage — collapsible */}
                {report.tests.length > 0 && (
                  <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
                    <button
                      onClick={() => setShowTests(!showTests)}
                      className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-zinc-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        <span className="text-sm font-semibold text-zinc-700">Test Coverage</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500">
                          {totalTests} cases · {report.tests.length} module{report.tests.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <svg
                        className={`w-4 h-4 text-zinc-400 transition-transform ${showTests ? "rotate-180" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showTests && (
                      <div className="border-t border-zinc-100 divide-y divide-zinc-100">
                        {report.tests.map((t) => (
                          <div key={t.module} className="px-5 py-3.5">
                            <p className="text-xs font-mono font-bold text-zinc-700 mb-2">{t.module}</p>
                            <ul className="flex flex-col gap-1">
                              {t.cases.map((c, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-zinc-500">
                                  <span className="w-4 h-4 rounded-full border border-zinc-200 flex-shrink-0 mt-0.5" />
                                  {c}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Agent Reasoning Trail — collapsible */}
                {report.iterationHistory && report.iterationHistory.length > 0 && (
                  <div className="rounded-xl border border-zinc-200 bg-white p-5">
                    <IterationLog logs={report.iterationHistory} agentConfidence={report.agentConfidence} />
                  </div>
                )}

                {/* Run New Scan */}
                <button
                  onClick={store.reset}
                  className="w-full py-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-[11px] font-mono font-bold uppercase tracking-wider transition-colors"
                >
                  Run New Scan
                </button>
              </div>
            );
          })()}
        </main>
      </div>
    </div>
  );
}
