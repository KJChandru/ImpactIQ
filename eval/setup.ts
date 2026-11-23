import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local (Vitest doesn't) so the first, uncached run can reach Claude.
try {
  const txt = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  /* no .env.local — eval will skip if there's also no cache */
}

// Cache model responses so re-runs are free and deterministic.
process.env.IMPACTIQ_CACHE_DIR ||= resolve(process.cwd(), "eval/.cache");
