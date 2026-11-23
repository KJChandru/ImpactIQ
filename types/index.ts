export interface Dependency {
  from: string;
  to: string;
  type?: string;
}

export interface Architecture {
  modules: string[];
  dependencies: Dependency[];
  confidence?: number;
}

export interface ImpactedModule {
  module: string;
  severity: "high" | "medium" | "low";
  reason: string;
}

export interface HiddenDep {
  from: string;
  to: string;
  risk: string;
}

export interface TestSuite {
  module: string;
  cases: string[];
}

export interface ToolCall {
  tool: string;
  input: Record<string, unknown>;
  output: string;
  reasoning: string;
}

export interface IterationLog {
  iteration: number;
  confidence: number;
  toolsCalled: ToolCall[];
  findings: string;
  critique: string;
}

export interface AgentMemory {
  architecture: Architecture;
  featureDescription: string;
  discoveredRisks: ImpactedModule[];
  investigatedModules: string[];
  assumptions: string[];
  confidence: number;
  iterationHistory: IterationLog[];
  toolsUsed: ToolCall[];
}

export interface ImpactReport {
  blastRadius: number;
  impacted: ImpactedModule[];
  hiddenDeps: HiddenDep[];
  tests: TestSuite[];
  deploymentRisks: string[];
  iterationHistory?: IterationLog[];
  agentConfidence?: number;
}

export type Step =
  | "upload"
  | "extracting"
  | "review"
  | "feature"
  | "analyzing"
  | "report";

// ─────────────────────────────────────────────────────────────
// V2: Real-codebase analysis (Modules A–F)
// Deterministic facts produced BEFORE any AI call.
// ─────────────────────────────────────────────────────────────

export type SupportedLanguage = "typescript" | "tsx" | "javascript" | "jsx";

// Module A — Repository Intake
export interface IntakeFile {
  path: string; // normalized, repo-relative, POSIX separators
  content: string; // decoded UTF-8 source
  bytes: number; // raw byte length
  ext: string; // lowercase extension incl. dot, e.g. ".ts"
}

export interface SkippedEntry {
  path: string;
  reason: string;
}

export interface IntakeResult {
  files: IntakeFile[];
  skipped: SkippedEntry[];
  warnings: string[];
  stats: {
    totalEntries: number;
    acceptedFiles: number;
    skippedFiles: number;
    totalBytes: number;
  };
}

// Module B — Code Indexing
export type SymbolKind =
  | "function"
  | "class"
  | "interface"
  | "type"
  | "enum"
  | "const"
  | "variable";

export interface SymbolInfo {
  name: string;
  kind: SymbolKind;
  file: string; // repo-relative path
  line: number; // 1-based
  exported: boolean;
}

export interface ImportEdge {
  from: string; // importer file (repo-relative)
  to: string | null; // resolved target file, or null if external/unresolved
  specifier: string; // raw module specifier, e.g. "./utils" or "react"
  external: boolean; // true when the specifier points outside the repo
  imported: string[]; // imported names: "default", "*", or named symbols
  line: number; // 1-based line of the import/require/export-from
}

export interface IndexedFile {
  path: string;
  language: SupportedLanguage;
  lines: number;
  isTest: boolean;
}

export interface RepoIndex {
  files: IndexedFile[];
  symbols: SymbolInfo[];
  edges: ImportEdge[];
  stats: {
    fileCount: number;
    symbolCount: number;
    edgeCount: number;
    externalEdgeCount: number; // edges to node_modules / bare specifiers
    unresolvedEdgeCount: number; // internal-style edges that didn't resolve
  };
}

// Module C — Dependency Graph & Retrieval
export interface RepoGraph {
  modules: string[]; // every indexed file path
  architecture: Architecture; // projected { modules, dependencies } for reuse
  dependencies: Map<string, string[]>; // file → files it imports (downstream)
  dependents: Map<string, string[]>; // file → files that import it (upstream)
}

export type CandidateRelation = "seed" | "direct-dependent" | "transitive-dependent";

export interface CandidateFile {
  file: string;
  relation: CandidateRelation;
  distance: number; // hops from the nearest seed (0 = seed itself)
  via: string[]; // dependency path: this file → … → seed (the "why")
  reason: string; // human-readable explanation of the path
}

export interface RetrievalResult {
  seeds: string[]; // files the change text most likely targets
  candidates: CandidateFile[]; // seeds + their transitive dependents
  stats: {
    seedCount: number;
    candidateCount: number;
    blastRadius: number; // distinct impacted files excluding the seeds
  };
  notes: string[]; // honest caveats (e.g. "no strong lexical match")
}

// Module D — AI reasoning output (pre-validation; may contain claims to verify)
export type ImpactKind = "direct" | "indirect" | "potential";

export interface RepoFinding {
  file: string;
  symbol?: string; // optional cited symbol
  line?: number; // optional cited 1-based line
  impact: ImpactKind;
  severity: "high" | "medium" | "low";
  reason: string;
  evidence: string; // the model's stated justification
}

export interface RepoTestRec {
  file: string;
  cases: string[];
  existingTest?: string | null;
}

export interface RepoAnalysis {
  summary: string;
  findings: RepoFinding[];
  tests: RepoTestRec[];
  assumptions: string[];
  limitations: string[];
}

// Module E — Evidence validation (keeps the AI honest)
export interface ValidationIssue {
  field: "file" | "symbol" | "line";
  message: string;
}

export interface CodeSnippet {
  startLine: number; // 1-based line number of lines[0]
  lines: string[]; // the source lines in this window
  focusLine: number | null; // the cited line to highlight, if any
}

export interface ValidatedFinding extends RepoFinding {
  verified: boolean; // true when every cited reference exists in the RepoIndex
  issues: ValidationIssue[]; // why it was flagged (empty when verified)
  snippet?: CodeSnippet; // the actual code behind the citation (attached server-side)
}

export interface ValidationResult {
  summary: string;
  findings: ValidatedFinding[]; // file exists — kept (verified or flagged)
  rejected: ValidatedFinding[]; // file does NOT exist — fabricated, dropped
  tests: RepoTestRec[]; // only tests whose file exists
  assumptions: string[];
  limitations: string[];
  stats: {
    total: number;
    verified: number; // fully grounded
    flagged: number; // file real but symbol/line off
    rejected: number; // fabricated file
    evidenceCoverage: number; // verified / total (0–1)
  };
}

// Module F — Risk & Test Recommendations (deterministic heuristic)
export interface RiskFactor {
  label: string;
  detail: string;
  weight: number; // points this factor contributed to the score
}

export interface RiskAssessment {
  level: "low" | "medium" | "high";
  score: number; // 0–100 heuristic (NOT a probability)
  factors: RiskFactor[];
  note: string; // states explicitly that this is a documented heuristic
}

export interface TestRecommendation {
  file: string;
  why: string;
  existingTest: string | null; // a repo test file that already covers this file, or null
}

export interface RepoMeta {
  name: string | null; // e.g. "developit/mitt" or the uploaded file name
  fileCount: number;
  languages: string[];
  truncated: boolean; // repo was large and limited during intake
  warnings: string[]; // intake warnings surfaced to the user
}

// Module G — assembled, exportable report
export interface RepoImpactReport {
  changeRequest: string;
  summary: string;
  risk: RiskAssessment;
  findings: ValidatedFinding[]; // verified + flagged (grouped by impact in the UI)
  rejected: ValidatedFinding[]; // fabrications that were dropped (shown for transparency)
  testRecommendations: TestRecommendation[];
  assumptions: string[];
  limitations: string[];
  retrieval: { seeds: string[]; blastRadius: number; notes: string[] };
  stats: ValidationResult["stats"];
  repo?: RepoMeta; // what was ingested (attached server-side)
}
