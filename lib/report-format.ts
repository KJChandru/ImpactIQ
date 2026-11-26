import type { CodeSnippet, RepoImpactReport, ValidatedFinding } from "@/types";

/**
 * Attach a small code window to each finding so the UI can show the actual
 * source behind a citation (evidence viewer). Mutates the report in place.
 * `contents` maps repo-relative path → full file text.
 */
export function attachSnippets(
  report: RepoImpactReport,
  contents: Map<string, string>,
  context = 4
): void {
  for (const f of report.findings) {
    const src = contents.get(f.file);
    if (src === undefined) continue;
    const all = src.split("\n");
    const focus = f.line && f.line >= 1 && f.line <= all.length ? f.line : null;
    const start = focus ? Math.max(1, focus - context) : 1;
    const end = focus ? Math.min(all.length, focus + context) : Math.min(all.length, 12);
    f.snippet = { startLine: start, lines: all.slice(start - 1, end), focusLine: focus };
  }
}

/**
 * Attach a top-of-file source window for every file that appears on a finding's
 * dependency path, so each hop in the clickable path can reveal its code. Import
 * statements live near the top, so this window usually shows the relevant edge.
 * `contents` maps repo-relative path → full file text. Mutates in place.
 */
export function attachPathSnippets(
  report: RepoImpactReport,
  contents: Map<string, string>,
  maxLines = 14
): void {
  const files = new Set<string>();
  for (const f of report.findings) for (const p of f.path ?? []) files.add(p);
  if (files.size === 0) return;

  const snippets: Record<string, CodeSnippet> = {};
  for (const file of files) {
    const src = contents.get(file);
    if (src === undefined) continue;
    const lines = src.split("\n").slice(0, maxLines);
    snippets[file] = { startLine: 1, lines, focusLine: null };
  }
  report.pathSnippets = snippets;
}

/**
 * Pure report renderers (Module G export half).
 *
 * Kept free of any server-only imports (no Anthropic SDK, no TS compiler) so it
 * can be imported directly into client components for the export buttons.
 */

export function exportJson(report: RepoImpactReport): string {
  return JSON.stringify(report, null, 2);
}

export function exportMarkdown(report: RepoImpactReport): string {
  const lines: string[] = [];
  const L = (s = "") => lines.push(s);

  L(`# ImpactIQ Report`);
  L();
  L(`**Change:** ${report.changeRequest}`);
  L();
  L(`**Risk:** ${report.risk.level.toUpperCase()} (${report.risk.score}/100)`);
  L(`> ${report.risk.note}`);
  L();
  L(report.summary);
  L();

  if (report.health) {
    const h = report.health;
    L(`## Repository health`);
    L(`_${h.partial ? "Partial" : "Complete"} analysis._`);
    L(
      `- ${h.filesIndexed} files · ${h.symbolsIndexed} symbols · ${h.importsIndexed} imports · ${h.testFiles} test file(s)`
    );
    L(`- Unresolved imports: ${h.unresolvedImports} · Skipped files: ${h.skippedCount}`);
    for (const w of h.warnings) L(`- ⚠ ${w}`);
    L();
  }

  L(`## Risk factors`);
  if (report.risk.factors.length === 0) L(`_No contributing factors._`);
  for (const f of report.risk.factors) L(`- **${f.label}** (+${f.weight}) — ${f.detail}`);
  L();

  L(`## Impacted files`);
  for (const group of ["direct", "indirect", "potential"] as const) {
    const items = report.findings.filter((f) => f.impact === group);
    if (items.length === 0) continue;
    L(`### ${cap(group)}`);
    for (const f of items) L(renderFinding(f));
    L();
  }
  if (report.findings.length === 0) L(`_No impacted files found._`);
  L();

  L(`## Recommended tests`);
  if (report.testRecommendations.length === 0) L(`_None._`);
  for (const t of report.testRecommendations) {
    const cover = t.existingTest ? `existing: \`${t.existingTest}\`` : "no existing test";
    L(`- \`${t.file}\` — ${t.why} _(${cover})_`);
  }
  L();

  if (report.assumptions.length > 0) {
    L(`## Assumptions`);
    for (const a of report.assumptions) L(`- ${a}`);
    L();
  }

  if (report.limitations.length > 0) {
    L(`## Limitations`);
    for (const a of report.limitations) L(`- ${a}`);
    L();
  }

  L(`---`);
  L(
    `_Blast radius: ${report.retrieval.blastRadius} · Evidence coverage: ${Math.round(
      report.stats.evidenceCoverage * 100
    )}% · ${report.stats.rejected} fabricated claim(s) rejected._`
  );

  return lines.join("\n");
}

function renderFinding(f: ValidatedFinding): string {
  const loc = [f.symbol, f.line ? `L${f.line}` : null].filter(Boolean).join(" ");
  const where = loc ? ` (${loc})` : "";
  const flag = f.verified ? "" : " ⚠︎ unverified citation";
  const path =
    f.path && f.path.length > 1
      ? "\n" + f.path.map((p, i) => `${"  ".repeat(i + 1)}↳ \`${p}\``).join("\n")
      : "";
  return `- **${f.file}**${where} — _${f.severity}_: ${f.reason}${flag}${path}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
