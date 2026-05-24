import type { AgentMemory, Architecture, IterationLog, ImpactedModule } from "@/types";

export function createMemory(architecture: Architecture, featureDescription: string): AgentMemory {
  return {
    architecture,
    featureDescription,
    discoveredRisks: [],
    investigatedModules: [],
    assumptions: [],
    confidence: 0,
    iterationHistory: [],
    toolsUsed: [],
  };
}

export function updateMemory(
  memory: AgentMemory,
  log: IterationLog,
  newRisks: ImpactedModule[],
  newModules: string[],
  newAssumptions: string[]
): AgentMemory {
  return {
    ...memory,
    confidence: log.confidence,
    iterationHistory: [...memory.iterationHistory, log],
    toolsUsed: [...memory.toolsUsed, ...log.toolsCalled],
    discoveredRisks: mergeRisks(memory.discoveredRisks, newRisks),
    investigatedModules: [...new Set([...memory.investigatedModules, ...newModules])],
    assumptions: [...new Set([...memory.assumptions, ...newAssumptions])],
  };
}

function mergeRisks(existing: ImpactedModule[], incoming: ImpactedModule[]): ImpactedModule[] {
  const map = new Map(existing.map((r) => [r.module, r]));
  for (const r of incoming) {
    if (!map.has(r.module) || severityRank(r.severity) > severityRank(map.get(r.module)!.severity)) {
      map.set(r.module, r);
    }
  }
  return Array.from(map.values());
}

function severityRank(s: string): number {
  return s === "high" ? 3 : s === "medium" ? 2 : 1;
}
