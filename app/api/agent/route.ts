import { NextRequest, NextResponse } from "next/server";
import { AnalyzeRequestSchema } from "@/lib/validators";
import { createMemory } from "@/lib/agent-memory";
import { runAgentLoop } from "@/lib/agent-loop";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = AnalyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { architecture, feature } = parsed.data;
  const memory = createMemory(architecture, feature);

  try {
    console.log("[/api/agent] Starting agent loop:", parsed.data.feature.slice(0, 80));
    const report = await runAgentLoop(memory, (log) => {
      console.log(`[/api/agent] Iteration ${log.iteration} done — confidence: ${log.confidence}, tools: ${log.toolsCalled.length}`);
    });
    console.log("[/api/agent] Complete — confidence:", report.agentConfidence);
    return NextResponse.json(report);
  } catch (err) {
    console.error("[/api/agent] FAILED:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Agent loop failed", details: message }, { status: 500 });
  }
}
