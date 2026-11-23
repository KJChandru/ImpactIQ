import type {
  RepoGraph,
  RepoIndex,
  RiskAssessment,
  RiskFactor,
  TestRecommendation,
  ValidationResult,
} from "@/types";

/**
 * Module F — Risk & Test Recommendations.
 *
 * Translates validated findings into a transparent, DETERMINISTIC risk level
 * and test recommendations. Every point in the score is attributable to a named
 * factor, and the result is explicitly labelled a heuristic — not a probability.
 *
 * No AI here: given the same validated findings + index, the output is identical.
 */

// Files whose paths suggest security- or money-sensitive surface area.
const SENSITIVE = /(auth|login|session|token|password|secret|payment|billing|checkout|invoice|charge|migration|schema|permission|role)/i;

// Signals that a change touches an API contract or data model.
const CONTRACT = /(api|endpoint|route|contract|schema|interface|dto|payload|response|request|model)/i;

const CORE_DEPENDENTS = 3; // a file this many others import is "widely depended on"

const THRESHOLDS = { medium: 30, high: 65 } as const;

export function assessRisk(
  validated: ValidationResult,
  index: RepoIndex,
  graph: RepoGraph,
  changeRequest: string
): RiskAssessment {
  const factors: RiskFactor[] = [];
  const testFiles = new Set(index.files.filter((f) => f.isTest).map((f) => f.path));

  // Distinct, real impacted files (verified + flagged; rejected are already gone).
  const impacted = [...new Set(validated.findings.map((f) => f.file))];
  const impactedNonTest = impacted.filter((f) => !testFiles.has(f));

  // 1) Blast radius — more files touched, more risk.
  if (impacted.length > 0) {
    const w = Math.min(impacted.length * 4, 30);
    factors.push({
      label: "Blast radius",
      detail: `${impacted.length} file(s) impacted.`,
      weight: w,
    });
  }

  // 2) High-severity findings.
  const highCount = validated.findings.filter((f) => f.severity === "high").length;
  if (highCount > 0) {
    factors.push({
      label: "High-severity changes",
      detail: `${highCount} finding(s) require direct changes.`,
      weight: Math.min(highCount * 12, 36),
    });
  }

  // 3) Centrality — impacted files that many others depend on.
  const coreFiles = impacted.filter(
    (f) => (graph.dependents.get(f)?.length ?? 0) >= CORE_DEPENDENTS
  );
  if (coreFiles.length > 0) {
    factors.push({
      label: "Core module involvement",
      detail: `${coreFiles.join(", ")} — widely depended upon.`,
      weight: Math.min(coreFiles.length * 8, 16),
    });
  }

  // 4) Sensitive surface (auth/payment/schema/…).
  const sensitiveFiles = impacted.filter((f) => SENSITIVE.test(f));
  if (sensitiveFiles.length > 0) {
    factors.push({
      label: "Sensitive modules",
      detail: `${sensitiveFiles.join(", ")} — security/data-sensitive.`,
      weight: Math.min(sensitiveFiles.length * 10, 20),
    });
  }

  // 5) Test-coverage gaps — impacted source files with no covering test.
  const uncovered = impactedNonTest.filter((f) => !hasCoveringTest(f, graph, testFiles));
  if (uncovered.length > 0) {
    factors.push({
      label: "Test-coverage gaps",
      detail: `${uncovered.length} impacted file(s) have no existing test.`,
      weight: Math.min(uncovered.length * 4, 16),
    });
  }

  // 6) API-contract / data-model signal (from the change text or findings).
  const contractHit =
    CONTRACT.test(changeRequest) ||
    validated.findings.some((f) => CONTRACT.test(`${f.reason} ${f.evidence} ${f.symbol ?? ""}`));
  if (contractHit) {
    factors.push({
      label: "API/data-model change",
      detail: "Change appears to touch an API contract or data model.",
      weight: 10,
    });
  }

  let score = Math.min(
    factors.reduce((sum, f) => sum + f.weight, 0),
    100
  );
  let level = levelFor(score);

  // Documented override: a required change on a sensitive module is at least High.
  if (highCount > 0 && sensitiveFiles.length > 0 && level !== "high") {
    factors.push({
      label: "Floor rule",
      detail: "Required change on a sensitive module → risk floored to High.",
      weight: 0,
    });
    level = "high";
    score = Math.max(score, THRESHOLDS.high);
  }

  return {
    level,
    score,
    factors,
    note: "Heuristic risk score (0–100) from weighted structural factors — not a probability or guarantee.",
  };
}

/** Deterministic test recommendations tied to validated findings. */
export function recommendTests(
  validated: ValidationResult,
  index: RepoIndex,
  graph: RepoGraph
): TestRecommendation[] {
  const testFiles = new Set(index.files.filter((f) => f.isTest).map((f) => f.path));
  const severityRank = { high: 0, medium: 1, low: 2 };

  // First finding per non-test file, strongest severity first.
  const byFile = new Map<string, { why: string; rank: number }>();
  for (const f of validated.findings) {
    if (testFiles.has(f.file)) continue;
    const rank = severityRank[f.severity];
    const existing = byFile.get(f.file);
    if (!existing || rank < existing.rank) {
      byFile.set(f.file, { why: f.reason, rank });
    }
  }

  return [...byFile.entries()]
    .sort((a, b) => a[1].rank - b[1].rank || a[0].localeCompare(b[0]))
    .map(([file, { why }]) => ({
      file,
      why,
      existingTest: coveringTest(file, graph, testFiles),
    }));
}

// ─── Helpers ───────────────────────────────────────────────────

function hasCoveringTest(file: string, graph: RepoGraph, testFiles: Set<string>): boolean {
  return coveringTest(file, graph, testFiles) !== null;
}

/** A test file that imports `file` (its dependents that are tests), or null. */
function coveringTest(file: string, graph: RepoGraph, testFiles: Set<string>): string | null {
  for (const dep of graph.dependents.get(file) ?? []) {
    if (testFiles.has(dep)) return dep;
  }
  return null;
}

function levelFor(score: number): "low" | "medium" | "high" {
  if (score >= THRESHOLDS.high) return "high";
  if (score >= THRESHOLDS.medium) return "medium";
  return "low";
}
