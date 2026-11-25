import { strToU8, zipSync } from "fflate";
import { readRepoZip } from "../lib/zip-reader";
import { indexRepo } from "../lib/code-indexer";
import { buildRepoGraph } from "../lib/repo-graph";
import { retrieveCandidates } from "../lib/repo-graph";
import { assessRisk, recommendTests } from "../lib/risk-heuristic";
import { assembleReport, exportMarkdown, exportJson } from "../lib/repo-report";
import type { ValidatedFinding, ValidationResult } from "../types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
}

const repo: Record<string, string> = {
  "shop-main/src/utils/math.ts":
    "export function add(a: number, b: number) { return a + b; }\nexport const PI = 3.14;\n",
  "shop-main/src/checkout/coupon.ts":
    'import { add } from "../utils/math";\nexport function applyCoupon(total: number, pct: number) { return add(total, -total * pct); }\n',
  "shop-main/src/checkout/cart.ts":
    'import { applyCoupon } from "./coupon";\nexport class Cart { total = 0; checkout(pct: number) { return applyCoupon(this.total, pct); } }\n',
  "shop-main/src/index.ts":
    'import { Cart } from "./checkout/cart";\nexport function main() { return new Cart(); }\n',
  "shop-main/src/index.test.ts": 'import { main } from "./index";\ndescribe("main", () => {});\n',
};
const u8: Record<string, Uint8Array> = {};
for (const [k, v] of Object.entries(repo)) u8[k] = strToU8(v);
const index = indexRepo(readRepoZip(zipSync(u8)));
const graph = buildRepoGraph(index);

function vf(
  file: string,
  severity: "high" | "medium" | "low",
  impact: "direct" | "indirect" | "potential" = "direct"
): ValidatedFinding {
  return { file, impact, severity, confidence: "high", reason: "r", evidence: "e", verified: true, issues: [] };
}
function wrap(findings: ValidatedFinding[]): ValidationResult {
  return {
    summary: "s",
    findings,
    rejected: [],
    tests: [],
    assumptions: [],
    limitations: [],
    stats: { total: findings.length, verified: findings.length, flagged: 0, rejected: 0, evidenceCoverage: 1 },
  };
}

// ── High-risk scenario: sensitive (checkout) files + required changes ──
const high = wrap([
  vf("src/checkout/coupon.ts", "high"),
  vf("src/checkout/cart.ts", "high"),
  vf("src/index.ts", "medium", "indirect"),
]);
const riskHigh = assessRisk(high, index, graph, "Add percentage coupons to checkout");
console.log("── RISK (high scenario) ──");
console.log("level:", riskHigh.level, "score:", riskHigh.score);
for (const f of riskHigh.factors) console.log(`  +${f.weight}  ${f.label}: ${f.detail}`);

assert(riskHigh.level === "high", "sensitive + required change → high");
assert(riskHigh.score >= 65, "score crosses the high threshold");
assert(riskHigh.factors.some((f) => f.label === "Sensitive modules"), "sensitive factor present");
assert(riskHigh.factors.some((f) => f.label === "Floor rule"), "floor-rule override recorded");

const recs = recommendTests(high, index, graph);
console.log("\n── TEST RECOMMENDATIONS ──");
for (const r of recs) console.log(`  ${r.file}  existingTest=${r.existingTest}`);
assert(recs.length === 3, "one rec per impacted non-test file");
assert(recs[0].file.startsWith("src/checkout/"), "high-severity files recommended first");
const indexRec = recs.find((r) => r.file === "src/index.ts");
assert(indexRec?.existingTest === "src/index.test.ts", "existing covering test detected");
const couponRec = recs.find((r) => r.file === "src/checkout/coupon.ts");
assert(couponRec?.existingTest === null, "uncovered file reports no existing test");

// ── Module G: assemble + export ──
const retrieval = retrieveCandidates(index, "Add percentage coupons to checkout");
const report = assembleReport({
  changeRequest: "Add percentage coupons to checkout",
  retrieval,
  validated: high,
  risk: riskHigh,
  testRecommendations: recs,
});
const md = exportMarkdown(report);
const json = exportJson(report);
console.log("\n── MARKDOWN EXPORT ──\n" + md);

assert(md.includes("# ImpactIQ Report"), "markdown has title");
assert(md.includes("Risk:** HIGH"), "markdown shows risk level");
assert(md.includes("src/checkout/coupon.ts"), "markdown lists an impacted file");
assert(md.includes("## Recommended tests"), "markdown has tests section");
assert(JSON.parse(json).risk.level === "high", "json round-trips");

// ── Low-risk scenario: one low-severity, non-sensitive finding ──
const low = wrap([vf("src/utils/math.ts", "low", "potential")]);
const riskLow = assessRisk(low, index, graph, "tidy up a helper");
console.log("\n── RISK (low scenario) ──");
console.log("level:", riskLow.level, "score:", riskLow.score);
assert(riskLow.level === "low", "small non-sensitive change → low");

console.log("\n✅ ALL M4 (Modules F + G) ASSERTIONS PASSED");
