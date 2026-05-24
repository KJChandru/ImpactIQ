import type { AgentMemory, IterationLog, ImpactReport, ToolCall } from "@/types";
import { callWithTools, callText } from "./claude";
import { executeTool } from "./agent-tools";
import { updateMemory } from "./agent-memory";
import { buildIterationPrompt, buildFinalReportPrompt } from "./prompt-builder";

const CONFIDENCE_THRESHOLD = 0.85;
const MAX_ITERATIONS = 2;

interface IterationResponse {
  confidence: number;
  findings: string;
  critique: string;
  risks: Array<{ module: string; severity: string; reason: string }>;
  modules: string[];
  assumptions: string[];
}

function parseJsonFromText(text: string): unknown {
  const stripped = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    // Fallback: extract first {...} block from prose
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error("No valid JSON found in response");
  }
}

function parseIterationResponse(text: string): IterationResponse {
  try {
    const parsed = parseJsonFromText(text) as IterationResponse;
    return {
      confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
      findings: parsed.findings ?? "No findings reported.",
      critique: parsed.critique ?? "No critique reported.",
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      modules: Array.isArray(parsed.modules) ? parsed.modules : [],
      assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [],
    };
  } catch {
    // If Claude didn't return valid JSON, extract what we can
    return {
      confidence: 0.5,
      findings: text.slice(0, 200),
      critique: "Could not parse structured response.",
      risks: [],
      modules: [],
      assumptions: [],
    };
  }
}

export async function runAgentLoop(
  memory: AgentMemory,
  onProgress: (log: IterationLog) => void
): Promise<ImpactReport> {
  let iteration = 0;

  while (memory.confidence < CONFIDENCE_THRESHOLD && iteration < MAX_ITERATIONS) {
    iteration++;

    const systemPrompt = buildIterationPrompt(memory, iteration);
    const collectedToolCalls: ToolCall[] = [];

    const { text } = await callWithTools(
      systemPrompt,
      `Iteration ${iteration}: Analyze the architecture and feature. Use tools as needed, then return your JSON assessment.`,
      (toolName, input) => {
        const output = executeTool(toolName, input, memory.architecture);
        collectedToolCalls.push({
          tool: toolName,
          input,
          output,
          reasoning: `Agent called ${toolName} to investigate the architecture`,
        });
        return output;
      }
    );

    const parsed = parseIterationResponse(text);

    const log: IterationLog = {
      iteration,
      confidence: parsed.confidence,
      toolsCalled: collectedToolCalls,
      findings: parsed.findings,
      critique: parsed.critique,
    };

    const validRisks = parsed.risks
      .filter((r) => ["high", "medium", "low"].includes(r.severity))
      .map((r) => ({
        module: r.module,
        severity: r.severity as "high" | "medium" | "low",
        reason: r.reason,
      }));

    memory = updateMemory(memory, log, validRisks, parsed.modules, parsed.assumptions);
    onProgress(log);
  }

  // Final deterministic synthesis from accumulated memory
  const finalPrompt = buildFinalReportPrompt(memory);
  const reportText = await callText(finalPrompt);

  let report: Omit<ImpactReport, "iterationHistory" | "agentConfidence">;
  try {
    const parsed = parseJsonFromText(reportText) as typeof report;
    const isValid = parsed && Array.isArray((parsed as any).impacted) && typeof (parsed as any).blastRadius === "number";
    if (!isValid) throw new Error("Report shape invalid");
    report = parsed;
  } catch {
    // Fallback: build report from accumulated memory
    report = {
      blastRadius: memory.discoveredRisks.length,
      impacted: memory.discoveredRisks,
      hiddenDeps: [],
      tests: memory.discoveredRisks
        .filter((r) => r.severity === "high")
        .map((r) => ({
          module: r.module,
          cases: [
            `Verify ${r.module} handles the new feature correctly`,
            `Test ${r.module} integration with dependent modules`,
            `Check ${r.module} rollback scenario`,
          ],
        })),
      deploymentRisks: ["Review high-severity modules before deploying"],
    };
  }

  return {
    ...report,
    iterationHistory: memory.iterationHistory,
    agentConfidence: memory.confidence,
  };
}
