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
