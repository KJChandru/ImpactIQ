import Anthropic from "@anthropic-ai/sdk";
import { cacheGet, cacheKey, cacheSet } from "./response-cache";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-4-6";

/** Token usage of the most recent callText (for the eval harness cost metric). */
export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cached: boolean;
}
let lastUsage: Usage | null = null;
export function getLastUsage(): Usage | null {
  return lastUsage;
}

export async function callVision(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp",
  systemPrompt: string
): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: "Analyze this architecture diagram and extract all modules and dependencies as JSON.",
          },
        ],
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type from Claude Vision");
  return block.text;
}

export async function callText(prompt: string, system?: string): Promise<string> {
  const key = cacheKey(["callText", system ?? "", prompt]);
  const cached = cacheGet(key);
  if (cached !== null) {
    lastUsage = { inputTokens: 0, outputTokens: 0, cached: true };
    return cached;
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    ...(system ? { system } : {}),
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  lastUsage = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cached: false,
  };

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type from Claude");
  cacheSet(key, block.text);
  return block.text;
}

export const AGENT_TOOL_DEFINITIONS = [
  {
    name: "trace_dependency",
    description:
      "Traces all upstream and downstream paths for a module. Call this when you suspect a module has non-obvious transitive impacts.",
    input_schema: {
      type: "object",
      properties: {
        module: { type: "string", description: "The exact module name to trace" },
      },
      required: ["module"],
    },
  },
  {
    name: "check_circular",
    description:
      "Detects circular dependency chains among a set of modules. Call this when you see potential cycles.",
    input_schema: {
      type: "object",
      properties: {
        modules: {
          type: "array",
          items: { type: "string" },
          description: "List of module names to check for circular dependencies",
        },
      },
      required: ["modules"],
    },
  },
  {
    name: "estimate_blast_radius",
    description:
      "Calculates the true blast radius including all transitive dependents. Call this when scope is unclear.",
    input_schema: {
      type: "object",
      properties: {
        impacted_modules: {
          type: "array",
          items: { type: "string" },
          description: "List of directly impacted module names",
        },
      },
      required: ["impacted_modules"],
    },
  },
  {
    name: "generate_migration_path",
    description:
      "Generates a safe deployment order for high-severity modules. Call this when HIGH severity risks are found.",
    input_schema: {
      type: "object",
      properties: {
        risks: {
          type: "array",
          items: { type: "string" },
          description: "List of high-risk module names that need safe ordering",
        },
      },
      required: ["risks"],
    },
  },
];

export interface ToolCallResult {
  tool: string;
  input: Record<string, unknown>;
  output: string;
  reasoning: string;
}

export async function callWithTools(
  systemPrompt: string,
  userMessage: string,
  onToolCall: (name: string, input: Record<string, unknown>) => string
): Promise<{ text: string; toolCallResults: ToolCallResult[] }> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  const allToolCallResults: ToolCallResult[] = [];
  let toolRounds = 0;
  const MAX_TOOL_ROUNDS = 8;

  while (true) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: systemPrompt,
      tools: AGENT_TOOL_DEFINITIONS as Parameters<typeof client.messages.create>[0]["tools"],
      messages,
    });

    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");

    if (response.stop_reason === "end_turn" || toolUseBlocks.length === 0) {
      const finalText = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as Anthropic.TextBlock).text)
        .join("\n");
      return { text: finalText, toolCallResults: allToolCallResults };
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of toolUseBlocks) {
      const toolUse = block as Anthropic.ToolUseBlock;
      const input = toolUse.input as Record<string, unknown>;
      const output = onToolCall(toolUse.name, input);

      allToolCallResults.push({
        tool: toolUse.name,
        input,
        output,
        reasoning: `Agent called ${toolUse.name} to investigate the architecture`,
      });

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: output,
      });
    }

    messages.push({ role: "user", content: toolResults });

    if (++toolRounds >= MAX_TOOL_ROUNDS) {
      const finalText = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as Anthropic.TextBlock).text)
        .join("\n");
      return { text: finalText, toolCallResults: allToolCallResults };
    }
  }
}
