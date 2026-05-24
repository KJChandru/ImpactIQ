import type { Architecture } from "./validators";

export function buildExtractionPrompt(): string {
  return `You are an expert software architect. Your task is to analyze architecture diagrams and extract structured information.

Extract all software modules/services and their dependencies from the diagram.

Respond with ONLY valid JSON in this exact format:
{
  "modules": ["ModuleA", "ModuleB", "ModuleC"],
  "dependencies": [
    { "from": "ModuleA", "to": "ModuleB", "type": "calls" },
    { "from": "ModuleB", "to": "ModuleC", "type": "reads" }
  ],
  "confidence": 0.95
}

Rules:
- Use the exact module names as shown in the diagram
- Dependency types: "calls", "reads", "writes", "subscribes", "uses", "extends", "depends_on"
- confidence is a float 0-1 reflecting how clearly the diagram shows relationships
- Do NOT include any explanation outside the JSON`;
}

export function buildAnalysisPrompt(
  architecture: Architecture,
  featureDescription: string
): string {
  const modulesFormatted = architecture.modules.join(", ");
  const depsFormatted = architecture.dependencies
    .map((d) => `  ${d.from} → ${d.to}${d.type ? ` (${d.type})` : ""}`)
    .join("\n");

  return `You are ImpactIQ, an expert software architect specializing in architectural impact analysis.

## Current System Architecture

Modules: ${modulesFormatted}

Dependencies:
${depsFormatted}

## Proposed Feature

"${featureDescription}"

## Your Task

Analyze what this feature will impact. Trace the dependency graph carefully — a change to a module affects all modules that depend on it, transitively.

Respond with ONLY valid JSON in this exact format:
{
  "blastRadius": 3,
  "impacted": [
    { "module": "ModuleName", "severity": "high", "reason": "Direct dependency that must change" },
    { "module": "ModuleB", "severity": "medium", "reason": "Transitively affected via ModuleName" }
  ],
  "hiddenDeps": [
    { "from": "ModuleA", "to": "ModuleC", "risk": "Shared DB schema change may break reads" }
  ],
  "tests": [
    { "module": "ModuleName", "cases": ["Test case 1", "Test case 2", "Test case 3"] }
  ],
  "deploymentRisks": [
    "Deploy ModuleA before ModuleB to avoid schema mismatch",
    "Add feature flag to gate new OAuth flow"
  ]
}

Rules:
- blastRadius = total count of distinct impacted modules
- severity: "high" (direct change required), "medium" (interface/contract change), "low" (monitoring only)
- hiddenDeps: transitive or non-obvious risks the developer might miss
- tests: minimum 3 test cases per high-severity module
- deploymentRisks: concrete, actionable deployment warnings
- Do NOT include any explanation outside the JSON`;
}

import type { AgentMemory } from "@/types";

export function buildIterationPrompt(memory: AgentMemory, iteration: number): string {
  const modulesFormatted = memory.architecture.modules.join(", ");
  const depsFormatted = memory.architecture.dependencies
    .map((d) => `  ${d.from} → ${d.to}${d.type ? ` (${d.type})` : ""}`)
    .join("\n");

  const priorFindings = memory.iterationHistory.length > 0
    ? memory.iterationHistory
        .map((log) => `  Iteration ${log.iteration} (confidence ${log.confidence}): ${log.findings}`)
        .join("\n")
    : "  None yet — this is the first iteration.";

  const investigatedModules = memory.investigatedModules.length > 0
    ? memory.investigatedModules.join(", ")
    : "None yet";

  const discoveredRisks = memory.discoveredRisks.length > 0
    ? memory.discoveredRisks
        .map((r) => `  [${r.severity.toUpperCase()}] ${r.module}: ${r.reason}`)
        .join("\n")
    : "  None discovered yet";

  const assumptions = memory.assumptions.length > 0
    ? memory.assumptions.map((a) => `  - ${a}`).join("\n")
    : "  None yet";

  return `You are ImpactIQ, an autonomous architectural impact analysis agent.

## System Architecture

Modules: ${modulesFormatted}

Dependencies:
${depsFormatted}

## Feature Being Analyzed

"${memory.featureDescription}"

## Agent Memory (from previous iterations)

Prior findings:
${priorFindings}

Modules already investigated: ${investigatedModules}

Risks discovered so far:
${discoveredRisks}

Assumptions made:
${assumptions}

Current confidence: ${memory.confidence} (target: ≥0.85)

## Your Task — Iteration ${iteration}

Analyze the architecture and feature. Use tools to investigate anything you are not confident about:
- Call trace_dependency when a module's full impact path is unclear
- Call check_circular when you suspect circular dependencies
- Call estimate_blast_radius when the total impact scope is uncertain
- Call generate_migration_path when you find HIGH severity modules

After calling tools (or if you are already confident), respond with ONLY this JSON:
{
  "confidence": 0.75,
  "findings": "What you discovered in this iteration — specific and concrete",
  "critique": "What gaps remain or what you are still uncertain about",
  "risks": [
    { "module": "ModuleName", "severity": "high", "reason": "Direct change required because..." }
  ],
  "modules": ["ModuleName", "OtherModule"],
  "assumptions": ["Assumption you made about the system"]
}

Rules:
- confidence: 0.0–1.0. Be honest. Only go ≥0.85 when you are truly certain about all impacts.
- risks: ALL impacted modules you found (including from prior iterations — repeat if still valid)
- modules: list of modules you investigated this iteration
- Do NOT include any explanation outside the JSON`;
}

export function buildFinalReportPrompt(memory: AgentMemory): string {
  const modulesFormatted = memory.architecture.modules.join(", ");
  const depsFormatted = memory.architecture.dependencies
    .map((d) => `  ${d.from} → ${d.to}${d.type ? ` (${d.type})` : ""}`)
    .join("\n");

  const allFindings = memory.iterationHistory
    .map((log) => `Iteration ${log.iteration} (confidence: ${log.confidence}):\n  ${log.findings}\n  Critique: ${log.critique}`)
    .join("\n\n");

  const allRisks = memory.discoveredRisks
    .map((r) => `  [${r.severity.toUpperCase()}] ${r.module}: ${r.reason}`)
    .join("\n");

  const toolsUsed = memory.toolsUsed.length > 0
    ? memory.toolsUsed.map((t) => `  - ${t.tool}: ${t.reasoning}`).join("\n")
    : "  None";

  return `You are ImpactIQ. You have completed your analysis loop (${memory.iterationHistory.length} iteration(s), final confidence: ${memory.confidence}).

## Architecture

Modules: ${modulesFormatted}

Dependencies:
${depsFormatted}

## Feature

"${memory.featureDescription}"

## Agent Findings (Accumulated)

${allFindings}

## Discovered Risks

${allRisks}

## Tools Used

${toolsUsed}

## Final Task

Synthesize all findings into the final impact report. Respond with ONLY valid JSON:
{
  "blastRadius": 4,
  "impacted": [
    { "module": "ModuleName", "severity": "high", "reason": "Specific reason from analysis" }
  ],
  "hiddenDeps": [
    { "from": "ModuleA", "to": "ModuleC", "risk": "Transitive risk found during analysis" }
  ],
  "tests": [
    { "module": "ModuleName", "cases": ["Test case 1", "Test case 2", "Test case 3"] }
  ],
  "deploymentRisks": [
    "Concrete deployment warning 1",
    "Concrete deployment warning 2"
  ]
}

Rules:
- blastRadius = total count of distinct impacted modules
- severity: "high" (direct change required), "medium" (interface/contract change), "low" (monitoring only)
- tests: minimum 3 cases per high-severity module
- Use the agent's actual findings — do not invent new information
- Do NOT include any explanation outside the JSON`;
}
