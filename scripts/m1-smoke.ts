import { strToU8, zipSync } from "fflate";
import { readRepoZip } from "../lib/zip-reader";
import { indexRepo } from "../lib/code-indexer";

// A tiny repo wrapped in a top-level folder (GitHub-style), plus adversarial
// entries we expect to be rejected: a secret, a node_modules file, and a
// path-traversal attempt.
const repo: Record<string, string> = {
  "myapp-main/src/utils/math.ts":
    "export function add(a: number, b: number) { return a + b; }\nexport const PI = 3.14;\n",
  "myapp-main/src/index.ts":
    'import { add, PI } from "./utils/math";\nimport React from "react";\nexport function main() { return add(PI, 1); }\n',
  "myapp-main/src/index.test.ts":
    'import { main } from "./index";\ndescribe("main", () => {});\n',
  "myapp-main/node_modules/left-pad/index.js": "module.exports = () => {};\n",
  "myapp-main/.env": "SECRET=supersecret\n",
  "myapp-main/evil/../../etc/passwd": "root:x:0:0\n",
  "myapp-main/README.md": "# hi\n",
};

const u8: Record<string, Uint8Array> = {};
for (const [k, v] of Object.entries(repo)) u8[k] = strToU8(v);
const zip = zipSync(u8);

const intake = readRepoZip(zip);
console.log("── INTAKE ──");
console.log("stats:", intake.stats);
console.log("accepted:", intake.files.map((f) => f.path));
console.log("skipped:", intake.skipped);

const index = indexRepo(intake);
console.log("\n── INDEX ──");
console.log("stats:", index.stats);
console.log("files:", index.files);
console.log("symbols:", index.symbols);
console.log("edges:", index.edges);

// Assertions — fail loudly if any invariant breaks.
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
}
assert(intake.files.length === 3, "should accept exactly 3 source files");
assert(!intake.files.some((f) => f.path.includes("node_modules")), "node_modules excluded");
assert(!intake.files.some((f) => f.path.includes(".env")), "secret excluded");
assert(intake.skipped.some((s) => s.reason === "path traversal"), "traversal rejected");

const localEdge = index.edges.find((e) => e.specifier === "./utils/math");
assert(!!localEdge && localEdge.to === "src/utils/math.ts", "relative import resolved to file");
assert(localEdge!.external === false, "relative import is internal");
const reactEdge = index.edges.find((e) => e.specifier === "react");
assert(!!reactEdge && reactEdge.external === true && reactEdge.to === null, "react is external");
assert(
  index.symbols.some((s) => s.name === "add" && s.kind === "function" && s.exported),
  "exported function 'add' indexed"
);
assert(
  index.symbols.some((s) => s.name === "PI" && s.kind === "const"),
  "const 'PI' indexed"
);
assert(index.files.some((f) => f.path.endsWith("index.test.ts") && f.isTest), "test file flagged");

console.log("\n✅ ALL M1 ASSERTIONS PASSED");
