# ImpactIQ — Project Overview

> **"If I make this change, what will it break — and can I trust the answer?"**

ImpactIQ is an AI-powered architectural impact analysis tool. You point it at a real
TypeScript/JavaScript repository (a GitHub URL or a ZIP), describe a change in plain
English, and it predicts the **blast radius** — the files, symbols, and lines the change
will affect — **before you write any code**. Every finding is backed by real code you can
click to verify.

Built for the **Lyzr Builder Challenge**.

---

## The core idea: trust through evidence

Most "AI impact" tools ask a model to guess and hope it's right. ImpactIQ is built the
opposite way:

- **Deterministic code analysis establishes the _facts_** (what imports what, which
  symbols exist, on which lines).
- **The LLM only _interprets_ those facts** over a bounded, evidence-backed slice — never
  the whole repo.
- **A validation layer rejects anything the model invents.** If Claude cites a file,
  symbol, or line that doesn't exist, it never reaches the report.

> The deterministic layers own **truth**; the model owns only the **interpretation** in
> between.

---

## Architecture

```
GitHub URL / ZIP
      │
[A] Intake          unzip in memory · strip secrets & node_modules · NEVER execute code
      │
[B] Indexing        TypeScript Compiler API (real AST, not regex) → imports, exports,
      │             symbols — all with file + line numbers    →   RepoIndex
      │
[C] Graph + Retrieval   build the dependency graph · lexically seed from the change
      │                 description · trace the transitive blast radius   (the FACTS)
      │
[D] AI Reasoning    Claude reasons over a BOUNDED, evidence-backed candidate slice
      │             → structured findings (file / symbol / line / impact / severity)
      │
[E] Validation      verify EVERY cited file, symbol, and line against the index;
      │             reject fabrications                         (keeps the AI honest)
      │
[F] Risk + Tests    deterministic, transparent risk score (0–100) + test recommendations
      │
[G] Report          blast-radius graph · grouped findings · clickable evidence viewer
                    · Markdown / JSON export
```

### Layer responsibilities

| Layer | Responsibility | Nature |
|-------|----------------|--------|
| Intake + Indexing (A, B) | Parse the repo into structured facts | Pure code (no AI) |
| Graph + Retrieval (C) | "Who depends on what" + candidate blast radius | Pure code (no AI) |
| AI Reasoning (D) | Interpret the change, explain impacts | Claude API |
| Validation (E) | Verify every claim against the index | Pure code (no AI) |
| Risk + Report (F, G) | Transparent risk + readable, exportable report | Pure code |
| Evaluation harness | Measure precision / recall on labeled cases | Vitest |

---

## Tech stack

- **Framework:** Next.js 16 (App Router) · React 19 · TypeScript
- **AI:** Claude Sonnet 4.6 (Anthropic SDK), with a prompt-injection-safe prompt
- **Code analysis:** TypeScript Compiler API (AST) · in-memory ZIP parsing (`fflate`)
- **Validation & state:** Zod · Zustand
- **UI:** Tailwind CSS v4 · streamed progress (NDJSON)
- **Testing / eval:** Vitest, with a cached-response harness

**Deliberately lean:** the ZIP reader, AST indexer, dependency graph, blast-radius graph
visualization, and syntax highlighter are all hand-rolled or use tiny libraries — **no
heavyweight runtime dependencies.**

---

## Measured results

Honest numbers from the evaluation harness — **17 labeled change scenarios** across small
synthetic fixtures (objective ground truth):

| Metric | Result | Meaning |
|--------|--------|---------|
| **Recall** | **1.00** | Never missed a truly-impacted file |
| **Precision** | **0.63** | Some over-flagging remains (a review checklist, not gospel) |
| **F1** | **0.75** | |
| **Evidence coverage** | **0.90** | Fraction of findings fully grounded to file+symbol+line |
| **Schema-validity** | **100%** | Model output parsed on the first try, every time |
| **Fabricated paths** | **0** | The validator guarantee held under measurement |
| **Cost / latency** | **~$0.02 · ~22s** | Per analysis |

> **Honest caveat:** these are small, self-authored fixtures, so the numbers are
> optimistic versus messy real-world repos. They validate the *pipeline and guarantees* —
> real-world accuracy would need a labeled real-repo dataset.

**How to trust it:** a high-recall, lower-precision assistant. Great as a
*"don't-miss-anything" checklist* that will never invent files — expect to dismiss a few
false positives.

---

## What the app looks like

- **`/`** — repo analysis (GitHub URL or ZIP → describe change → report)
- **`/diagram`** — the original V1 flow (analyze an architecture diagram / Mermaid / DB schema)

The report includes:
- A **risk header** with a transparent score, contributing factors, and a severity bar
- A **blast-radius graph** — files laid out by dependency distance, colored by severity
- **Findings** grouped by direct / indirect / potential impact, each with a **confidence**
  chip and a **"View code"** evidence viewer (syntax-highlighted, cited line highlighted,
  with an "open on GitHub" deep-link)
- **Recommended tests**, assumptions, limitations, and **Markdown / JSON export**

---

## Development history (what was built)

The project pivoted from analyzing architecture **diagrams** (V1) to analyzing **real
codebases** (V2), delivered in five gated milestones:

| Milestone | Delivered |
|-----------|-----------|
| **M1** | Repo intake + AST indexing → real import graph with line numbers |
| **M2** | Dependency graph + candidate blast-radius retrieval (no AI yet) |
| **M3** | Evidence-grounded AI findings + validation (zero fabricated paths) |
| **M4** | Risk heuristic, report, export, and the repo-analysis UI |
| **M5** | Evaluation harness (Vitest) + cached responses → measured accuracy |

Followed by two quality passes:
- GitHub-URL input, **streamed live progress**, repo summary + honesty banner
- **Dependency graph**, **syntax-highlighted evidence + GitHub links**, severity bar,
  sticky summary, motion, and a **precision improvement** (0.55 → 0.63, F1 0.70 → 0.75)

Each milestone was verified in isolation; the V1 diagram flow still works throughout.

---

## Safety

- Uploaded/fetched code is **analyzed in memory and never executed**
- Secrets (`.env`, keys) and noise (`node_modules`, `dist`) are stripped at intake
- Path-traversal and oversized archives are rejected
- The model is told to treat all repository content as **untrusted data**, never as
  instructions (prompt-injection hardening)
