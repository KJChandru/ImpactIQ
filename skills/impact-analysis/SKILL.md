---
name: Impact Analysis
description: Trace the dependency graph to compute blast radius and generate a structured impact report for a proposed feature
---

# Skill: Impact Analysis

## Purpose

Given a confirmed architecture (modules + dependencies) and a plain-English feature description, trace the dependency graph to compute the full blast radius and generate a structured impact report.

## Input

```json
{
  "architecture": {
    "modules": ["Auth", "Database", "Cache"],
    "dependencies": [
      { "from": "Auth", "to": "Database", "type": "reads" }
    ]
  },
  "feature": "Add OAuth 2.0 login support"
}
```

## Output

```json
{
  "blastRadius": 2,
  "impacted": [
    { "module": "Auth", "severity": "high", "reason": "OAuth flow directly modifies auth logic" },
    { "module": "Database", "severity": "medium", "reason": "New OAuth token table required" }
  ],
  "hiddenDeps": [
    { "from": "Auth", "to": "Cache", "risk": "Session invalidation may leave stale cache entries" }
  ],
  "tests": [
    { "module": "Auth", "cases": ["Test OAuth token exchange", "Test refresh token rotation", "Test session expiry handling"] }
  ],
  "deploymentRisks": ["Run database migration before deploying Auth service"]
}
```

## Model

claude-sonnet-4-6 (text reasoning)

## System Prompt

See `lib/prompt-builder.ts` → `buildAnalysisPrompt()`

## Algorithm

1. Identify modules directly touched by the feature
2. Trace all downstream dependents (transitive closure)
3. Identify shared resources (DBs, caches, message queues) as hidden deps
4. Assign severity based on change type
5. Generate test cases for high/medium severity modules
6. Sequence deployment ordering from the dependency graph
