import type {
  RepoAnalysis,
  RepoIndex,
  RepoTestRec,
  ValidatedFinding,
  ValidationIssue,
  ValidationResult,
} from "@/types";

/**
 * Module E — Evidence Validation.
 *
 * Keeps the AI honest. Every file, symbol, and line the model cites is checked
 * against the deterministic `RepoIndex`:
 *   - file does not exist  → REJECTED (fabricated path; dropped from the report)
 *   - symbol/line is wrong → FLAGGED (file is real, but the citation is off)
 *   - everything checks out → VERIFIED
 *
 * This is where "evidence before AI claims" is enforced — the validator, not
 * the model, decides what reaches the final report.
 */
export function validateAnalysis(analysis: RepoAnalysis, index: RepoIndex): ValidationResult {
  const fileLines = new Map(index.files.map((f) => [f.path, f.lines]));
  const symbolsByFile = new Map<string, Set<string>>();
  for (const s of index.symbols) {
    const set = symbolsByFile.get(s.file);
    if (set) set.add(s.name);
    else symbolsByFile.set(s.file, new Set([s.name]));
  }

  const findings: ValidatedFinding[] = [];
  const rejected: ValidatedFinding[] = [];

  for (const f of analysis.findings) {
    const issues: ValidationIssue[] = [];
    const fileExists = fileLines.has(f.file);

    if (!fileExists) {
      issues.push({ field: "file", message: `File "${f.file}" is not in the indexed repository.` });
      rejected.push({ ...f, verified: false, issues });
      continue; // hard reject — never report a fabricated path
    }

    if (f.symbol && !symbolsByFile.get(f.file)?.has(f.symbol)) {
      issues.push({
        field: "symbol",
        message: `Symbol "${f.symbol}" was not found in ${f.file}.`,
      });
    }

    if (f.line !== undefined) {
      const lines = fileLines.get(f.file)!;
      if (f.line < 1 || f.line > lines) {
        issues.push({
          field: "line",
          message: `Line ${f.line} is out of range for ${f.file} (1–${lines}).`,
        });
      }
    }

    findings.push({ ...f, verified: issues.length === 0, issues });
  }

  // Tests may only point at files that actually exist.
  const tests: RepoTestRec[] = analysis.tests.filter((t) => fileLines.has(t.file));
  const droppedTests = analysis.tests.length - tests.length;

  const limitations = [...analysis.limitations];
  if (rejected.length > 0) {
    limitations.push(
      `${rejected.length} finding(s) referenced non-existent files and were dropped.`
    );
  }
  if (droppedTests > 0) {
    limitations.push(`${droppedTests} test recommendation(s) referenced unknown files and were dropped.`);
  }

  const verified = findings.filter((f) => f.verified).length;
  const flagged = findings.length - verified;
  const total = analysis.findings.length;

  return {
    summary: analysis.summary,
    findings,
    rejected,
    tests,
    assumptions: analysis.assumptions,
    limitations,
    stats: {
      total,
      verified,
      flagged,
      rejected: rejected.length,
      evidenceCoverage: total === 0 ? 1 : round2(verified / total),
    },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
