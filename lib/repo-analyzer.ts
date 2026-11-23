import type {
  ImportEdge,
  RepoAnalysis,
  RepoIndex,
  RetrievalResult,
  SymbolInfo,
  ValidationResult,
} from "@/types";
import { callText } from "./claude";
import { buildRepoAnalysisSystem, buildRepoAnalysisUser } from "./prompt-builder";
import { retrieveCandidates } from "./repo-graph";
import { validateAnalysis } from "./evidence-validator";
import { RepoAnalysisSchema } from "./validators";

/**
 * Module D — AI Reasoning Engine (repo mode).
 *
 * Reasons over a BOUNDED, evidence-backed slice of the codebase — the candidate
 * files from Module C plus their symbols, imports, and dependency paths — never
 * the whole repo. The model only interprets; the facts come from the index and
 * every claim is checked afterward by Module E.
 */

const MAX_EXPORTS_PER_FILE = 25;
const MAX_IMPORTS_PER_FILE = 25;

/** Format the candidate set + index evidence into the FACTS block for the prompt. */
export function buildRepoContext(index: RepoIndex, retrieval: RetrievalResult): string {
  const linesByFile = new Map(index.files.map((f) => [f.path, f.lines]));
  const exportsByFile = groupExports(index.symbols);
  const importsByFile = groupImports(index.edges);

  const lines: string[] = [];
  lines.push(
    `Change retrieval: ${retrieval.seeds.length} seed file(s), ` +
      `${retrieval.stats.blastRadius} downstream file(s) in the blast radius.`
  );
  if (retrieval.notes.length > 0) {
    lines.push(`Retrieval notes: ${retrieval.notes.join(" ")}`);
  }
  if (retrieval.candidates.length === 0) {
    lines.push("\n(No candidate files were retrieved for this change.)");
    return lines.join("\n");
  }

  for (const c of retrieval.candidates) {
    const nLines = linesByFile.get(c.file) ?? 0;
    lines.push(`\n### ${c.file}  [${c.relation}, distance ${c.distance}, ${nLines} lines]`);
    lines.push(`why: ${c.reason}  (path: ${c.via.join(" → ")})`);

    const exps = (exportsByFile.get(c.file) ?? []).slice(0, MAX_EXPORTS_PER_FILE);
    if (exps.length > 0) {
      lines.push(
        "exports: " + exps.map((s) => `${s.name} (${s.kind}, L${s.line})`).join(", ")
      );
    }

    const imps = (importsByFile.get(c.file) ?? []).slice(0, MAX_IMPORTS_PER_FILE);
    if (imps.length > 0) {
      lines.push("imports: " + imps.map(formatImport).join("; "));
    }
  }

  return lines.join("\n");
}

/**
 * Full repo-mode pipeline: retrieve candidates (C) → reason over them (D) →
 * validate every claim against the index (E). Requires ANTHROPIC_API_KEY.
 */
export async function runRepoImpactAnalysis(
  index: RepoIndex,
  changeRequest: string
): Promise<{ retrieval: RetrievalResult; analysis: RepoAnalysis; validated: ValidationResult }> {
  const retrieval = retrieveCandidates(index, changeRequest);
  const analysis = await analyzeRepoImpact(index, retrieval, changeRequest);
  const validated = validateAnalysis(analysis, index);
  return { retrieval, analysis, validated };
}

/** Module D proper: build context, call Claude, parse to a schema-valid RepoAnalysis. */
export async function analyzeRepoImpact(
  index: RepoIndex,
  retrieval: RetrievalResult,
  changeRequest: string
): Promise<RepoAnalysis> {
  const facts = buildRepoContext(index, retrieval);
  const raw = await callText(
    buildRepoAnalysisUser(changeRequest, facts),
    buildRepoAnalysisSystem()
  );
  return RepoAnalysisSchema.parse(extractJsonObject(raw)) as RepoAnalysis;
}

// ─── Helpers ───────────────────────────────────────────────────

function groupExports(symbols: SymbolInfo[]): Map<string, SymbolInfo[]> {
  const map = new Map<string, SymbolInfo[]>();
  for (const s of symbols) {
    if (!s.exported) continue;
    const list = map.get(s.file);
    if (list) list.push(s);
    else map.set(s.file, [s]);
  }
  return map;
}

function groupImports(edges: ImportEdge[]): Map<string, ImportEdge[]> {
  const map = new Map<string, ImportEdge[]>();
  for (const e of edges) {
    const list = map.get(e.from);
    if (list) list.push(e);
    else map.set(e.from, [e]);
  }
  return map;
}

function formatImport(e: ImportEdge): string {
  const target = e.external ? `${e.specifier} (external)` : `${e.specifier} → ${e.to}`;
  const names = e.imported.length > 0 ? ` {${e.imported.join(", ")}}` : "";
  return target + names;
}

/** Extract a JSON object from a model response, tolerating ```json fences and prose. */
export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in model response.");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}
