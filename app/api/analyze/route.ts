import { NextRequest, NextResponse } from "next/server";
import { AnalyzeRequestSchema } from "@/lib/validators";
import { callText } from "@/lib/claude";
import { buildAnalysisPrompt } from "@/lib/prompt-builder";

function parseJsonFromText(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  return JSON.parse(cleaned);
}

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

  try {
    const prompt = buildAnalysisPrompt(architecture, feature);
    const rawText = await callText(prompt);
    const result = parseJsonFromText(rawText) as {
      blastRadius: number;
      impacted: Array<{ module: string; severity: string; reason: string }>;
      hiddenDeps: Array<{ from: string; to: string; risk: string }>;
      tests: Array<{ module: string; cases: string[] }>;
      deploymentRisks: string[];
    };

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Analysis failed", details: message }, { status: 500 });
  }
}
