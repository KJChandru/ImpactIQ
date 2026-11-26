import { NextRequest, NextResponse } from "next/server";
import { AnalyzeRepoRequestSchema } from "@/lib/validators";
import { readRepoZip, IntakeError, INTAKE_LIMITS } from "@/lib/zip-reader";
import { indexRepo } from "@/lib/code-indexer";
import { retrieveCandidates, buildRepoGraph } from "@/lib/repo-graph";
import { analyzeRepoImpact } from "@/lib/repo-analyzer";
import { validateAnalysis } from "@/lib/evidence-validator";
import { assessRisk, recommendTests } from "@/lib/risk-heuristic";
import { assembleReport, buildReportGraph, buildRepoHealth, reconcileFindings } from "@/lib/repo-report";
import { attachSnippets, attachPathSnippets } from "@/lib/report-format";
import { fetchGithubZip, GithubError, parseGithubTarget } from "@/lib/github";

// The TypeScript Compiler API + ZIP parsing need the Node runtime, not Edge.
export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Module H backend — repo-mode impact analysis, streamed as NDJSON so the UI
 * can show real pipeline progress. Body: { changeRequest } plus either
 * `zipBase64` or `githubUrl`.
 *
 * Each line is a JSON event: { stage: "fetching"|"indexed"|"retrieved"
 * |"reasoning"|"verifying"|"done"|"error", ... }.
 */
export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Server is missing ANTHROPIC_API_KEY." }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = AnalyzeRepoRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { zipBase64, githubUrl, changeRequest } = parsed.data;
  const target = githubUrl ? parseGithubTarget(githubUrl) : null;
  const sourceName = githubUrl ? (target ? `${target.owner}/${target.repo}` : githubUrl) : "uploaded.zip";
  const githubBase = target ? `https://github.com/${target.owner}/${target.repo}/blob/HEAD` : undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        send({ stage: "fetching", source: sourceName });
        const bytes = githubUrl
          ? await fetchGithubZip(githubUrl, INTAKE_LIMITS.maxZipBytes)
          : new Uint8Array(Buffer.from(zipBase64!, "base64"));

        const intake = readRepoZip(bytes);
        const index = indexRepo(intake);
        const languages = [...new Set(index.files.map((f) => f.language))];
        send({
          stage: "indexed",
          fileCount: index.stats.fileCount,
          languages,
          truncated: intake.warnings.length > 0,
        });

        const retrieval = retrieveCandidates(index, changeRequest);
        send({
          stage: "retrieved",
          seeds: retrieval.seeds.length,
          candidates: retrieval.stats.candidateCount,
        });

        send({ stage: "reasoning" });
        const analysis = await analyzeRepoImpact(index, retrieval, changeRequest);

        send({ stage: "verifying" });
        const validated = validateAnalysis(analysis, index);
        reconcileFindings(validated.findings, retrieval);
        const graph = buildRepoGraph(index);
        const risk = assessRisk(validated, index, graph, changeRequest);
        const testRecommendations = recommendTests(validated, index, graph);
        const report = assembleReport({ changeRequest, retrieval, validated, risk, testRecommendations });

        report.repo = {
          name: sourceName,
          fileCount: index.stats.fileCount,
          languages,
          truncated: intake.warnings.length > 0,
          warnings: intake.warnings,
          githubBase,
        };
        report.health = buildRepoHealth(index, intake);
        report.graph = buildReportGraph(index, retrieval, validated);
        const contents = new Map(intake.files.map((f) => [f.path, f.content]));
        attachSnippets(report, contents);
        attachPathSnippets(report, contents);

        send({ stage: "done", report });
      } catch (err) {
        const message =
          err instanceof IntakeError || err instanceof GithubError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Analysis failed.";
        send({ stage: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
