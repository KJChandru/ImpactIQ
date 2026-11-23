import type {
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
  return assembleReport({ changeRequest, retrieval, validated, risk, testRecommendations });
}

// Export renderers live in a server-import-free module so client components
// (the /repo export buttons) can use them too.
export { exportJson, exportMarkdown } from "./report-format";
