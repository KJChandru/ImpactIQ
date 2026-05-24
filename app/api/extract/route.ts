import { NextRequest, NextResponse } from "next/server";
import { ExtractRequestSchema } from "@/lib/validators";
import { callVision } from "@/lib/claude";
import { buildExtractionPrompt } from "@/lib/prompt-builder";
import { parseMermaid } from "@/lib/mermaid-parser";

function parseJsonFromText(text: string): unknown {
  // Strip markdown code fences if Claude wraps the JSON
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

  const parsed = ExtractRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { image, mediaType, mermaid } = parsed.data;

  try {
    if (mermaid) {
      const result = parseMermaid(mermaid);
      return NextResponse.json({ ...result, confidence: 1.0 });
    }

    // image path
    const rawText = await callVision(
      image!,
      mediaType ?? "image/png",
      buildExtractionPrompt()
    );

    const result = parseJsonFromText(rawText) as {
      modules: string[];
      dependencies: Array<{ from: string; to: string; type?: string }>;
      confidence: number;
    };

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Extraction failed", details: message }, { status: 500 });
  }
}
