import { describe, it, expect } from "vitest";
import { dataset } from "./dataset";
import { fixtures } from "./fixtures";
import { buildIndex, prf } from "./harness";
import { runRepoImpactAnalysis } from "@/lib/repo-analyzer";
import { getLastUsage } from "@/lib/claude";

// Approximate claude-sonnet-4-6 pricing ($/token) — for a ballpark cost figure.
const IN_PRICE = 3 / 1_000_000;
const OUT_PRICE = 15 / 1_000_000;

const fmt = (x: number) => x.toFixed(2).padStart(5);

describe("ImpactIQ evaluation", () => {
  it("runs the labeled dataset and reports precision / recall / coverage / cost", async () => {
    const n = dataset.length;
    const rows: {
      id: string;
      p: number;
      r: number;
      f1: number;
      cov: number;
      pred: number;
      exp: number;
      ms: number;
    }[] = [];

    let schemaValid = 0;
    let fabricated = 0;
    let allPredictedExist = true;
    let totalCost = 0;
    let totalMs = 0;
    let liveCalls = 0;
    const sum = { p: 0, r: 0, f1: 0, cov: 0 };

    for (const c of dataset) {
      const index = buildIndex(fixtures[c.fixture]);
      const known = new Set(index.files.map((f) => f.path));

      const t = Date.now();
      let ok = true;
      let confident: string[] = [];
      let coverage = 0;
      try {
        const { validated } = await runRepoImpactAnalysis(index, c.changeRequest);
        // "Confident" = direct + indirect (exclude speculative "potential").
        confident = [...new Set(validated.findings.filter((f) => f.impact !== "potential").map((f) => f.file))];
        coverage = validated.stats.evidenceCoverage;
        fabricated += validated.stats.rejected;
        for (const f of validated.findings) if (!known.has(f.file)) allPredictedExist = false;
      } catch {
        ok = false;
      }
      const ms = Date.now() - t;

      const u = getLastUsage();
      if (u && !u.cached) {
        totalCost += u.inputTokens * IN_PRICE + u.outputTokens * OUT_PRICE;
        totalMs += ms;
        liveCalls++;
      }
      if (ok) schemaValid++;

      const m = prf(confident, c.expectedFiles);
      sum.p += m.precision;
      sum.r += m.recall;
      sum.f1 += m.f1;
      sum.cov += coverage;
      rows.push({ id: c.id, p: m.precision, r: m.recall, f1: m.f1, cov: coverage, pred: confident.length, exp: c.expectedFiles.length, ms });
    }

    console.log(`\n=== ImpactIQ Evaluation — ${n} cases (confident findings vs ground truth) ===`);
    console.log(
      "case".padEnd(22),
      "P".padStart(5),
      "R".padStart(5),
      "F1".padStart(5),
      "cov".padStart(5),
      "pred/exp".padStart(9)
    );
    for (const r of rows) {
      console.log(r.id.padEnd(22), fmt(r.p), fmt(r.r), fmt(r.f1), fmt(r.cov), `${r.pred}/${r.exp}`.padStart(9));
    }
    console.log("-".repeat(60));
    console.log("MACRO AVG".padEnd(22), fmt(sum.p / n), fmt(sum.r / n), fmt(sum.f1 / n), fmt(sum.cov / n));
    console.log(`schema-validity : ${schemaValid}/${n} (${Math.round((100 * schemaValid) / n)}%)`);
    console.log(`fabricated paths rejected by validator : ${fabricated}`);
    console.log(
      `live API calls : ${liveCalls} · est. cost ~$${totalCost.toFixed(4)} · avg latency ${liveCalls ? Math.round(totalMs / liveCalls) : 0}ms`
    );

    // Hard invariants (design guarantees, NOT accuracy claims):
    expect(allPredictedExist).toBe(true); // validator never lets a fabricated path into the report
    expect(schemaValid).toBeGreaterThanOrEqual(Math.ceil(n * 0.9)); // output reliably parses
  });
});
