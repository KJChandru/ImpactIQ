import { strToU8, zipSync } from "fflate";
import { readRepoZip } from "../lib/zip-reader";
import { indexRepo } from "../lib/code-indexer";
import { buildRepoGraph, retrieveCandidates } from "../lib/repo-graph";

// A small layered repo: math ← coupon ← cart ← index ← index.test
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

console.log("── GRAPH ──");
console.log("modules:", graph.modules);
console.log("architecture.dependencies:", graph.architecture.dependencies);

const result = retrieveCandidates(index, "Add percentage coupons to checkout");
console.log("\n── RETRIEVAL (change: 'Add percentage coupons to checkout') ──");
console.log("seeds:", result.seeds);
console.log("stats:", result.stats);
for (const c of result.candidates) {
  console.log(`  [${c.relation}] ${c.file}  (dist ${c.distance})  via ${c.via.join(" → ")}`);
}
console.log("notes:", result.notes);

// ── Assertions ──
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
}

// Projection feeds the reused { modules, dependencies } shape.
assert(graph.modules.length === 5, "all 5 files in the graph");
assert(
  graph.architecture.dependencies.some(
    (d) => d.from === "src/checkout/cart.ts" && d.to === "src/checkout/coupon.ts"
  ),
  "cart → coupon dependency projected"
);
assert(
  (graph.dependents.get("src/checkout/coupon.ts") ?? []).includes("src/checkout/cart.ts"),
  "coupon's dependents include cart"
);

// Lexical retrieval picks the checkout/coupon files as seeds.
assert(result.seeds.includes("src/checkout/coupon.ts"), "coupon.ts selected as a seed");

// Blast radius reaches index.ts and the test, each with an explaining path to a seed.
const indexCand = result.candidates.find((c) => c.file === "src/index.ts");
assert(!!indexCand && indexCand.relation !== "seed", "index.ts is an impacted dependent");
assert(result.seeds.includes(indexCand!.via[indexCand!.via.length - 1]), "index.ts path ends at a seed");
const testCand = result.candidates.find((c) => c.file === "src/index.test.ts");
assert(!!testCand && testCand.relation === "transitive-dependent", "test is a transitive dependent");
assert(result.stats.blastRadius >= 2, "blast radius covers the downstream chain");

console.log("\n✅ ALL M2 ASSERTIONS PASSED");
