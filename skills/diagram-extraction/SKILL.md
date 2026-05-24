---
name: diagram-extraction
description: Extract a structured list of modules and dependencies from an architecture diagram image or Mermaid code string
---

# Skill: Diagram Extraction

## Purpose

Extract a structured list of modules and their dependencies from an architecture diagram image or Mermaid code string.

## Input

- `image` (base64 string) — architecture diagram as a PNG/JPEG
- OR `mermaid` (string) — Mermaid graph code

## Output

```json
{
  "modules": ["Auth", "Database", "Cache"],
  "dependencies": [
    { "from": "Auth", "to": "Database", "type": "reads" },
    { "from": "Database", "to": "Cache", "type": "uses" }
  ],
  "confidence": 0.92
}
```

## Model

claude-sonnet-4-6 with vision capability (image input) or local parser (Mermaid input)

## System Prompt

See `lib/prompt-builder.ts` → `buildExtractionPrompt()`

## Rules

- Only extract modules explicitly shown in the diagram
- Dependency types: calls, reads, writes, subscribes, uses, extends, depends_on
- confidence reflects diagram clarity (1.0 for Mermaid, 0.5–0.95 for images)
- Return JSON only — no prose explanation
