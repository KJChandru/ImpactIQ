import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": root }, // mirror tsconfig "@/*" → project root
  },
  test: {
    include: ["eval/**/*.test.ts"],
    setupFiles: ["./eval/setup.ts"],
    testTimeout: 600_000, // the eval makes real (first-run) API calls
    hookTimeout: 60_000,
    fileParallelism: false,
    disableConsoleIntercept: true, // let the metrics table print to stdout
  },
});
