import { readFileSync } from "fs";
import { resolve } from "path";
import { strToU8, zipSync } from "fflate";
import { readRepoZip } from "../lib/zip-reader";

// Plain `node` doesn't read .env.local — load it so the live Module D call works.
function loadEnvLocal() {
  try {
    const txt = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* no .env.local — live call will simply be skipped */
  }
}
loadEnvLocal();
import { indexRepo } from "../lib/code-indexer";
import { retrieveCandidates } from "../lib/repo-graph";
import { buildRepoContext, extractJsonObject, analyzeRepoImpact } from "../lib/repo-analyzer";
import { validateAnalysis } from "../lib/evidence-validator";
import type { RepoAnalysis } from "../types";

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
const retrieval = retrieveCandidates(index, "Add percentage coupons to checkout");

// ── 1. buildRepoContext (Module D input) ──
const facts = buildRepoContext(index, retrieval);
console.log("── FACTS BLOCK ──\n" + facts);
assert(facts.includes("src/checkout/coupon.ts"), "context mentions seed file");
assert(facts.includes("applyCoupon"), "context lists exported symbol");
assert(facts.includes("imports:"), "context lists imports");

// ── 2. extractJsonObject tolerance ──
assert(
  JSON.stringify(extractJsonObject('```json\n{"a":1}\n```')) === '{"a":1}',
  "extracts fenced JSON"
);
assert(
  JSON.stringify(extractJsonObject('Sure! Here:\n{"b":2} done')) === '{"b":2}',
  "extracts JSON amid prose"
);

// ── 3. Module E: validation grounds every claim ──
const crafted: RepoAnalysis = {
  summary: "crafted analysis for validator test",
  findings: [
    { file: "src/checkout/coupon.ts", symbol: "applyCoupon", line: 2, impact: "direct", severity: "high", reason: "r", evidence: "e" }, // VERIFIED
    { file: "src/does/not/exist.ts", impact: "direct", severity: "high", reason: "r", evidence: "e" }, // REJECTED (fabricated file)
    { file: "src/checkout/cart.ts", line: 9999, impact: "indirect", severity: "medium", reason: "r", evidence: "e" }, // FLAGGED (bad line)
    { file: "src/index.ts", symbol: "ghostSymbol", impact: "potential", severity: "low", reason: "r", evidence: "e" }, // FLAGGED (bad symbol)
  ],
  tests: [
    { file: "src/index.test.ts", cases: ["a"] }, // kept
    { file: "ghost.test.ts", cases: ["b"] }, // dropped (unknown file)
  ],
  assumptions: [],
  limitations: [],
};

const validated = validateAnalysis(crafted, index);
console.log("\n── VALIDATION ──");
console.log("stats:", validated.stats);
console.log("rejected:", validated.rejected.map((r) => r.file));
console.log("flagged:", validated.findings.filter((f) => !f.verified).map((f) => ({ file: f.file, issues: f.issues })));

assert(validated.stats.rejected === 1 && validated.rejected[0].file === "src/does/not/exist.ts", "fabricated file rejected");
assert(validated.stats.verified === 1, "one fully-verified finding");
assert(validated.stats.flagged === 2, "two flagged (bad line + bad symbol)");
assert(validated.findings.length === 3, "rejected finding excluded from report");
assert(validated.tests.length === 1, "test with unknown file dropped");
assert(validated.stats.evidenceCoverage === 0.25, "evidence coverage = 1/4");
assert(
  validated.limitations.some((l) => l.includes("non-existent files")),
  "limitation notes dropped fabrication"
);

// ── 4. Live Claude call (only when a real key is present) ──
async function main() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === "your_key_here" || key.length < 20) {
    console.log("\n⏭  Skipping live Module D call (no real ANTHROPIC_API_KEY in env).");
    return;
  }
  console.log("\n── LIVE MODULE D (Claude) ──");
  const analysis = await analyzeRepoImpact(index, retrieval, "Add percentage coupons to checkout");
  const v = validateAnalysis(analysis, index);
  console.log("summary:", v.summary);
  console.log("stats:", v.stats);
  const { getLastUsage } = await import("../lib/claude");
  const u = getLastUsage();
  if (u) {
    const cost = (u.inputTokens * 3) / 1e6 + (u.outputTokens * 15) / 1e6;
    console.log(`usage: in=${u.inputTokens} out=${u.outputTokens} tok · est. cost ~$${cost.toFixed(4)} · cached=${u.cached}`);
  }
  assert(v.findings.every((f) => index.files.some((x) => x.path === f.file)), "no fabricated files in report");
  console.log("✅ live Module D produced evidence-grounded findings");
}

main()
  .then(() => console.log("\n✅ ALL M3 ASSERTIONS PASSED"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
