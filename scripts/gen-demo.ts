/**
 * Demo generator — produces `public/demo/report.json`, the cached report the
 * "Try the demo" button loads instantly (no API key, no network).
 *
 * Everything except the AI reasoning step runs the REAL pipeline (intake →
 * index → retrieval → validation → reconciliation → risk → report → snippets),
 * so the demo output has the exact shape of a live run. Only Module D (the
 * Claude call) is replaced by a fixed, hand-authored analysis whose every
 * citation is verified against the real sample index below. Deterministic by
 * design, so it can be regenerated anytime without a key.
 *
 * Run: npm run gen:demo
 */
import { strToU8, zipSync } from "fflate";
import * as fs from "fs";
import * as path from "path";
import { readRepoZip } from "../lib/zip-reader";
import { indexRepo } from "../lib/code-indexer";
import { retrieveCandidates, buildRepoGraph } from "../lib/repo-graph";
import { validateAnalysis } from "../lib/evidence-validator";
import { assessRisk, recommendTests } from "../lib/risk-heuristic";
import {
  assembleReport,
  buildReportGraph,
  buildRepoHealth,
  reconcileFindings,
} from "../lib/repo-report";
import { attachSnippets, attachPathSnippets } from "../lib/report-format";
import type { RepoAnalysis } from "../types";

const DEMO_NAME = "sample/checkout-demo";
// Phrased so retrieval seeds on the discount logic alone (only
// DiscountCalculator lexically matches). That makes every other file an
// INDIRECT finding and lets CheckoutPage show the full 4-level clickable
// dependency path down to the change target.
const CHANGE_REQUEST = "Update the discount calculation logic.";

// ── A tiny, realistic sample repo (GitHub-style top folder, stripped on intake).
// Import chain: CheckoutPage → CartService → PricingService → DiscountCalculator.
const repo: Record<string, string> = {
  "checkout-demo-main/src/pricing/DiscountCalculator.ts": `export interface DiscountRule {
  code: string;
  rate: number;
}

const RULES: DiscountRule[] = [
  { code: "SAVE10", rate: 0.1 },
  { code: "HALFOFF", rate: 0.5 },
];

/** Return the absolute discount (in cents) for a code and subtotal. */
export function calculateDiscount(code: string, subtotal: number): number {
  const rule = RULES.find((r) => r.code === code);
  if (!rule) return 0;
  return Math.round(subtotal * rule.rate);
}
`,
  "checkout-demo-main/src/pricing/PricingService.ts": `import { calculateDiscount } from "./DiscountCalculator";

export interface LineItem {
  name: string;
  price: number;
  qty: number;
}

/** Price a cart: subtotal minus any discount from the applied code. */
export function priceCart(items: LineItem[], discountCode: string): number {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discount = calculateDiscount(discountCode, subtotal);
  return subtotal - discount;
}
`,
  "checkout-demo-main/src/checkout/CartService.ts": `import { priceCart, LineItem } from "../pricing/PricingService";

export class CartService {
  private items: LineItem[] = [];

  add(item: LineItem): void {
    this.items.push(item);
  }

  /** Current payable total after discounts are applied. */
  total(discountCode: string): number {
    return priceCart(this.items, discountCode);
  }
}
`,
  "checkout-demo-main/src/checkout/CheckoutPage.tsx": `import { CartService } from "./CartService";

/** Renders the order summary and the final amount owed to the shopper. */
export function CheckoutPage(discountCode: string): string {
  const cart = new CartService();
  cart.add({ name: "Widget", price: 2000, qty: 2 });
  const total = cart.total(discountCode);
  return \`Total due: $\${(total / 100).toFixed(2)}\`;
}
`,
  "checkout-demo-main/src/pricing/PricingService.test.ts": `import { priceCart } from "./PricingService";

describe("priceCart", () => {
  it("subtracts the discount from the subtotal", () => {
    const items = [{ name: "Widget", price: 2000, qty: 1 }];
    expect(priceCart(items, "SAVE10")).toBe(1800);
  });
});
`,
  "checkout-demo-main/README.md": "# checkout-demo\n\nSample repository for the ImpactIQ demo.\n",
};

/** 1-based line of the first occurrence of `needle`, for snippet focus. */
function lineOf(content: string, needle: string): number | undefined {
  const idx = content.split("\n").findIndex((l) => l.includes(needle));
  return idx >= 0 ? idx + 1 : undefined;
}

function main() {
  // Real deterministic pipeline: A → B → C.
  const u8: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(repo)) u8[k] = strToU8(v);
  const intake = readRepoZip(zipSync(u8));
  const index = indexRepo(intake);
  const retrieval = retrieveCandidates(index, CHANGE_REQUEST);

  const src = (p: string) => intake.files.find((f) => f.path === p)!.content;

  // Fixed stand-in for Module D. Every file/symbol/line exists in the index, so
  // validation marks them verified — exactly like a clean live run would.
  const analysis: RepoAnalysis = {
    summary:
      "Updating the discount calculation touches the pricing core and ripples through the cart and the checkout total shown to shoppers.",
    findings: [
      {
        file: "src/pricing/DiscountCalculator.ts",
        symbol: "calculateDiscount",
        line: lineOf(src("src/pricing/DiscountCalculator.ts"), "export function calculateDiscount"),
        impact: "direct",
        severity: "high",
        confidence: "high",
        reason: "Holds the discount formula — changing how discounts are computed starts here.",
        evidence: "calculateDiscount() multiplies the subtotal by the matched rule's rate.",
      },
      {
        file: "src/pricing/PricingService.ts",
        symbol: "priceCart",
        line: lineOf(src("src/pricing/PricingService.ts"), "export function priceCart"),
        impact: "indirect",
        severity: "high",
        confidence: "high",
        reason: "Applies the discount to the cart subtotal; a formula change flows through priceCart().",
        evidence: "priceCart() calls calculateDiscount() and subtracts the result from the subtotal.",
      },
      {
        file: "src/checkout/CartService.ts",
        symbol: "CartService",
        line: lineOf(src("src/checkout/CartService.ts"), "export class CartService"),
        impact: "indirect",
        severity: "medium",
        confidence: "medium",
        reason: "Exposes the payable total, which is derived from the discounted price.",
        evidence: "CartService.total() delegates to priceCart().",
      },
      {
        file: "src/checkout/CheckoutPage.tsx",
        symbol: "CheckoutPage",
        line: lineOf(src("src/checkout/CheckoutPage.tsx"), "export function CheckoutPage"),
        impact: "indirect",
        severity: "medium",
        confidence: "medium",
        reason: "Displays the final amount owed, so the shopper-facing total reflects the new discount.",
        evidence: "CheckoutPage() reads cart.total(discountCode) and formats it.",
      },
    ],
    tests: [],
    assumptions: [
      "The discount rules in DiscountCalculator are the single source of truth for discount rates.",
    ],
    limitations: [
      "This is a small sample repository; a real codebase may surface additional discount call sites.",
    ],
  };

  // Real: E → reconcile → F → G + snippets.
  const validated = validateAnalysis(analysis, index);
  reconcileFindings(validated.findings, retrieval);
  const graph = buildRepoGraph(index);
  const risk = assessRisk(validated, index, graph, CHANGE_REQUEST);
  const testRecommendations = recommendTests(validated, index, graph);
  const report = assembleReport({
    changeRequest: CHANGE_REQUEST,
    retrieval,
    validated,
    risk,
    testRecommendations,
  });

  report.repo = {
    name: DEMO_NAME,
    fileCount: index.stats.fileCount,
    languages: [...new Set(index.files.map((f) => f.language))],
    truncated: intake.warnings.length > 0,
    warnings: intake.warnings,
  };
  report.health = buildRepoHealth(index, intake);
  report.graph = buildReportGraph(index, retrieval, validated);
  const contents = new Map(intake.files.map((f) => [f.path, f.content]));
  attachSnippets(report, contents);
  attachPathSnippets(report, contents);

  const outDir = path.join(process.cwd(), "public", "demo");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "report.json");
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

  console.log(`✅ Wrote ${outFile}`);
  console.log(`   seeds: ${retrieval.seeds.join(", ") || "(none)"}`);
  console.log(
    `   findings: ${report.findings
      .map((f) => `${f.impact}:${f.file.split("/").pop()}`)
      .join(", ")}`
  );
}

main();
