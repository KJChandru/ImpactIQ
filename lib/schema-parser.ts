import type { Architecture } from "./validators";

/**
 * Parses SQL DDL (CREATE TABLE statements + FK constraints) into an Architecture.
 * Handles PostgreSQL, MySQL, SQLite DDL. No external deps — pure regex.
 */
export function parseSchema(sql: string): Architecture & { confidence: number } {
  const modules: string[] = [];
  const dependencies: Architecture["dependencies"] = [];

  // Normalize: strip comments, collapse whitespace
  const normalized = sql
    .replace(/--[^\n]*/g, "")          // single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, "")  // block comments
    .replace(/\s+/g, " ")
    .trim();

  // Extract table names from CREATE TABLE [IF NOT EXISTS] `name` / "name" / name
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?\s*\(/gi;
  let match: RegExpExecArray | null;
  const tableNames = new Set<string>();

  while ((match = tableRegex.exec(normalized)) !== null) {
    const name = match[1];
    tableNames.add(name);
    if (!modules.includes(name)) modules.push(name);
  }

  // Extract FK constraints: FOREIGN KEY (col) REFERENCES table(col)
  // Also handles: col TYPE REFERENCES table(col) (inline FK syntax)
  const fkRegex = /FOREIGN\s+KEY\s*\([^)]+\)\s*REFERENCES\s+[`"']?(\w+)[`"']?\s*\([^)]+\)/gi;
  // We need to know which table the FK is in — re-split by CREATE TABLE blocks
  const tableBlocks = normalized.split(/(?=CREATE\s+TABLE)/gi).filter(Boolean);

  for (const block of tableBlocks) {
    const tableMatch = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?/i.exec(block);
    if (!tableMatch) continue;
    const fromTable = tableMatch[1];

    // Reset regex lastIndex for each block
    fkRegex.lastIndex = 0;
    let fkMatch: RegExpExecArray | null;
    while ((fkMatch = fkRegex.exec(block)) !== null) {
      const toTable = fkMatch[1];
      if (fromTable !== toTable && tableNames.has(toTable)) {
        // Avoid duplicate edges
        const exists = dependencies.some(d => d.from === fromTable && d.to === toTable);
        if (!exists) {
          dependencies.push({ from: fromTable, to: toTable, type: "references" });
        }
      }
    }

    // Also catch inline FK: column_name TYPE REFERENCES other_table(col)
    const inlineFkRegex = /\w+\s+\w+.*?REFERENCES\s+[`"']?(\w+)[`"']?\s*\(/gi;
    let inlineMatch: RegExpExecArray | null;
    while ((inlineMatch = inlineFkRegex.exec(block)) !== null) {
      const toTable = inlineMatch[1];
      if (fromTable !== toTable && tableNames.has(toTable)) {
        const exists = dependencies.some(d => d.from === fromTable && d.to === toTable);
        if (!exists) {
          dependencies.push({ from: fromTable, to: toTable, type: "references" });
        }
      }
    }
  }

  // Confidence based on how much structure we found
  const confidence = modules.length > 0
    ? Math.min(0.95, 0.7 + dependencies.length * 0.05)
    : 0;

  return { modules, dependencies, confidence };
}
