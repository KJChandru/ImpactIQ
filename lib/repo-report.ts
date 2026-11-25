import type {
  GraphEdge,
  GraphNode,
  ReportGraph,
  RepoImpactReport,
  RepoIndex,
  RetrievalResult,
  RiskAssessment,
  TestRecommendation,
  ValidationResult,
} from "@/types";
import { buildRepoGraph } from "./repo-graph";
import { assessRisk, recommendTests } from "./risk-heuristic";
import { runRepoImpactAnalysis } from "./repo-analyzer";

const GRAPH_NODE_CAP = 40;
const SEV_RANK = { high: 0, medium: 1, low: 2 } as const;

/**
 * Build the blast-radius graph subset for the report visualization: candidate
 * files + finding files as nodes, and the import edges among them. Capped to
 * keep the SVG readable; nodes closest to a seed are kept first.
 */
export function buildReportGraph(
  index: RepoIndex,
  retrieval: RetrievalResult,
  validated: ValidationResult,
  cap = GRAPH_NODE_CAP
): ReportGraph {
  const graph = buildRepoGraph(index);
  const seedSet = new Set(retrieval.seeds);
  const candByFile = new Map(retrieval.candidates.map((c) => [c.file, c]));

  // Strongest severity (+ a reason) per flagged file.
  const flagged = new Map<string, { severity: "high" | "medium" | "low"; reason: string }>();
  for (const f of validated.findings) {
    const prev = flagged.get(f.file);
    if (!prev || SEV_RANK[f.severity] < SEV_RANK[prev.severity]) {
      flagged.set(f.file, { severity: f.severity, reason: f.reason });
    }
  }

  const files = new Set<string>([
    ...retrieval.candidates.map((c) => c.file),
    ...validated.findings.map((f) => f.file),
  ]);

  const ordered = [...files]
    .map((file) => ({ file, distance: candByFile.get(file)?.distance ?? 0 }))
    .sort((a, b) => a.distance - b.distance || a.file.localeCompare(b.file));

  const truncated = ordered.length > cap;
  const kept = ordered.slice(0, cap);
  const keptSet = new Set(kept.map((k) => k.file));

  const nodes: GraphNode[] = kept.map(({ file, distance }) => {
    const fi = flagged.get(file);
    return {
      file,
      relation: seedSet.has(file) ? "seed" : "dependent",
      distance,
      flagged: Boolean(fi),
      severity: fi?.severity,
      reason: fi?.reason,
    };
  });

  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const from of keptSet) {
    for (const to of graph.dependencies.get(from) ?? []) {
      if (!keptSet.has(to)) continue;
      const key = `${from} ${to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from, to });
    }
  }

  return { nodes, edges, truncated };
}

/**
 * Module G — Report & Export.
 *
 * Assembles the deterministic pieces (retrieval, validated findings, risk,
 * test recommendations) into one `RepoImpactReport`, and renders it to
 * Markdown or JSON for the evidence viewer and export buttons.
 */

/** Combine the pipeline outputs into a single report object. */
export function assembleReport(args: {
  changeRequest: string;
  retrieval: RetrievalResult;
  validated: ValidationResult;
  risk: RiskAssessment;
  testRecommendations: TestRecommendation[];
}): RepoImpactReport {
  const { changeRequest, retrieval, validated, risk, testRecommendations } = args;
  return {
    changeRequest,
    summary: validated.summary,
    risk,
    findings: validated.findings,
    rejected: validated.rejected,
    testRecommendations,
    assumptions: validated.assumptions,
    limitations: validated.limitations,
    retrieval: {
      seeds: retrieval.seeds,
      blastRadius: retrieval.stats.blastRadius,
      notes: retrieval.notes,
    },
    stats: validated.stats,
  };
}

/**
 * Full repo-mode pipeline C→D→E→F→G. Requires ANTHROPIC_API_KEY (Module D).
 * Returns a ready-to-render, ready-to-export report.
 */
export async function generateRepoReport(
  index: RepoIndex,
  changeRequest: string
): Promise<RepoImpactReport> {
  const { retrieval, validated } = await runRepoImpactAnalysis(index, changeRequest);
  const graph = buildRepoGraph(index);
  const risk = assessRisk(validated, index, graph, changeRequest);
  const testRecommendations = recommendTests(validated, index, graph);
  const report = assembleReport({ changeRequest, retrieval, validated, risk, testRecommendations });
  report.graph = buildReportGraph(index, retrieval, validated);
  return report;
}

// Export renderers live in a server-import-free module so client components
// (the /repo export buttons) can use them too.
export { exportJson, exportMarkdown } from "./report-format";
