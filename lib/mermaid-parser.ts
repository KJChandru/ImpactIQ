export interface ParsedArchitecture {
  modules: string[];
  dependencies: Array<{ from: string; to: string; type: string }>;
}

// Strips Mermaid label syntax: A[Auth Service] → "Auth Service", A --> B
function extractLabel(raw: string): string {
  // Match label in brackets: A[Label] or A(Label) or A{Label} or A((Label))
  const match = raw.match(/^[A-Za-z0-9_]+[\[({\|](.+?)[\])}|]$/);
  if (match) return match[1].trim();
  // Plain identifier — return as-is
  return raw.trim();
}

function extractId(raw: string): string {
  // Get just the identifier before any bracket
  const match = raw.match(/^([A-Za-z0-9_]+)/);
  return match ? match[1] : raw.trim();
}

export function parseMermaid(code: string): ParsedArchitecture {
  const modules = new Set<string>();
  const dependencies: ParsedArchitecture["dependencies"] = [];

  // Map from id → label for readability
  const labelMap = new Map<string, string>();

  const lines = code.split("\n").map((l) => l.trim()).filter(Boolean);

  // Arrow patterns: -->, --->, -.->, ==>, --text-->, etc.
  const arrowPattern = /([A-Za-z0-9_]+(?:[\[({\|][^\])}|]*[\])}|])?)\s*(-->|---?>|==+>|-\.-?>|--[^>]*-->)\s*([A-Za-z0-9_]+(?:[\[({\|][^\])}|]*[\])}|])?)/g;

  // Label-only pattern: node definitions like A[Auth] or A(Auth)
  const nodePattern = /^([A-Za-z0-9_]+)([\[({\|](.+?)[\])}|])?$/;

  for (const line of lines) {
    // Skip graph/flowchart/subgraph/end/direction declarations
    if (/^(graph|flowchart|subgraph|end|direction|classDef|class\s)/i.test(line)) continue;

    let match;
    arrowPattern.lastIndex = 0;

    let hasArrow = false;
    while ((match = arrowPattern.exec(line)) !== null) {
      hasArrow = true;
      const fromRaw = match[1];
      const toRaw = match[3];

      const fromId = extractId(fromRaw);
      const toId = extractId(toRaw);
      const fromLabel = extractLabel(fromRaw);
      const toLabel = extractLabel(toRaw);

      labelMap.set(fromId, fromLabel);
      labelMap.set(toId, toLabel);

      modules.add(fromLabel);
      modules.add(toLabel);
      dependencies.push({ from: fromLabel, to: toLabel, type: "depends_on" });
    }

    if (!hasArrow) {
      // Pure node definition
      const nodeMatch = line.match(nodePattern);
      if (nodeMatch && nodeMatch[1] && !nodeMatch[1].match(/^(graph|flowchart)/i)) {
        const id = nodeMatch[1];
        const label = nodeMatch[3] ? nodeMatch[3].trim() : id;
        labelMap.set(id, label);
        modules.add(label);
      }
    }
  }

  return {
    modules: Array.from(modules),
    dependencies,
  };
}
