import { unzipSync } from "fflate";
import type { IntakeFile, IntakeResult, SkippedEntry } from "@/types";

/**
 * Module A — Repository Intake.
 *
 * Safely turns an uploaded ZIP into a clean list of TypeScript/JavaScript
 * source files. Everything happens in memory: we never write to disk and we
 * NEVER execute uploaded code. The output is the raw material for Module B.
 */

export const INTAKE_LIMITS = {
  maxZipBytes: 20 * 1024 * 1024, // 20 MB compressed upload
  maxFiles: 2000, // accepted source files
  maxFileBytes: 1024 * 1024, // 1 MB per source file
  maxTotalSourceBytes: 12 * 1024 * 1024, // 12 MB of decoded source total
} as const;

/** Thrown for user-facing intake failures (bad ZIP, too big, empty, etc.). */
export class IntakeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntakeError";
  }
}

// One language family, done well (plan §2.5).
const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);

// Directory names whose entire subtree is noise and must be skipped.
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "out",
  "coverage",
  ".turbo",
  ".vercel",
  ".cache",
  "vendor",
  "__MACOSX",
]);

/** Secret-bearing files must never reach the model context (plan §2.4). */
function isSecretFile(base: string): boolean {
  return (
    base === ".env" ||
    base.startsWith(".env.") ||
    base.endsWith(".pem") ||
    base.endsWith(".key") ||
    base.endsWith(".p12") ||
    base.endsWith(".pfx") ||
    base === "id_rsa"
  );
}

/**
 * Parse and filter a repository ZIP.
 *
 * @param zip Raw bytes of the uploaded `.zip`.
 * @throws IntakeError on empty/oversized/corrupt archives or when no source is found.
 */
export function readRepoZip(zip: Uint8Array): IntakeResult {
  if (zip.byteLength === 0) {
    throw new IntakeError("Uploaded file is empty.");
  }
  if (zip.byteLength > INTAKE_LIMITS.maxZipBytes) {
    throw new IntakeError(`ZIP exceeds the ${mb(INTAKE_LIMITS.maxZipBytes)} limit.`);
  }

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zip);
  } catch {
    throw new IntakeError("Could not read ZIP — it may be corrupt or not a ZIP archive.");
  }

  const rawPaths = Object.keys(entries);
  const rootPrefix = commonRootPrefix(rawPaths);

  const files: IntakeFile[] = [];
  const skipped: SkippedEntry[] = [];
  const warnings: string[] = [];
  let totalBytes = 0;
  let truncated = false;

  const decoder = new TextDecoder("utf-8", { fatal: false });

  for (const rawPath of rawPaths) {
    if (rawPath.endsWith("/")) continue; // directory entry, no content

    const data = entries[rawPath];
    const rel = stripPrefix(normalizePath(rawPath), rootPrefix);

    const safety = pathSafety(rel);
    if (!safety.ok) {
      skipped.push({ path: rawPath, reason: safety.reason });
      continue;
    }

    const segments = rel.split("/");
    const base = segments[segments.length - 1];

    if (segments.slice(0, -1).some((s) => IGNORED_DIRS.has(s))) {
      skipped.push({ path: rel, reason: "ignored directory" });
      continue;
    }
    if (isSecretFile(base)) {
      skipped.push({ path: rel, reason: "secret file" });
      continue;
    }
    if (base.endsWith(".d.ts")) {
      skipped.push({ path: rel, reason: "declaration file" });
      continue;
    }

    const ext = extname(base);
    if (!SOURCE_EXTENSIONS.has(ext)) {
      skipped.push({ path: rel, reason: "non-source file" });
      continue;
    }
    if (data.byteLength > INTAKE_LIMITS.maxFileBytes) {
      skipped.push({ path: rel, reason: "file too large" });
      continue;
    }
    if (looksBinary(data)) {
      skipped.push({ path: rel, reason: "binary content" });
      continue;
    }

    if (files.length >= INTAKE_LIMITS.maxFiles) {
      truncated = true;
      break;
    }
    if (totalBytes + data.byteLength > INTAKE_LIMITS.maxTotalSourceBytes) {
      truncated = true;
      break;
    }

    files.push({
      path: rel,
      content: decoder.decode(data),
      bytes: data.byteLength,
      ext,
    });
    totalBytes += data.byteLength;
  }

  if (truncated) {
    warnings.push(
      `Repository is large — analysis was limited to the first ${files.length} source files.`
    );
  }
  if (files.length === 0) {
    throw new IntakeError("No TypeScript/JavaScript source files found in the ZIP.");
  }

  return {
    files,
    skipped,
    warnings,
    stats: {
      totalEntries: rawPaths.length,
      acceptedFiles: files.length,
      skippedFiles: skipped.length,
      totalBytes,
    },
  };
}

// ─── Path helpers ──────────────────────────────────────────────

function normalizePath(p: string): string {
  return p
    .replace(/\\/g, "/") // Windows separators
    .replace(/^\.\//, "") // leading "./"
    .replace(/\/{2,}/g, "/"); // collapse repeated slashes
}

/**
 * GitHub / `zip` often wrap everything in a single top-level folder
 * (e.g. `my-repo-main/`). Detect and strip it so paths are repo-relative.
 * Returns "" when there is no single shared root.
 */
function commonRootPrefix(paths: string[]): string {
  const cleaned = paths
    .map(normalizePath)
    .filter((p) => p && !p.startsWith("/") && !p.startsWith("__MACOSX/"));
  if (cleaned.length === 0) return "";

  const firstSeg = cleaned[0].split("/")[0];
  if (!firstSeg) return "";
  const prefix = firstSeg + "/";
  return cleaned.every((p) => p.startsWith(prefix)) ? prefix : "";
}

function stripPrefix(path: string, prefix: string): string {
  return prefix && path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

function pathSafety(rel: string): { ok: true } | { ok: false; reason: string } {
  if (!rel) return { ok: false, reason: "empty path" };
  if (rel.startsWith("/")) return { ok: false, reason: "absolute path" };
  if (/^[a-zA-Z]:/.test(rel)) return { ok: false, reason: "windows drive path" };
  if (rel.split("/").includes("..")) return { ok: false, reason: "path traversal" };
  return { ok: true };
}

function extname(base: string): string {
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot).toLowerCase();
}

/** Cheap binary sniff: a NUL byte in the first chunk means "not source". */
function looksBinary(data: Uint8Array): boolean {
  const n = Math.min(data.length, 8000);
  for (let i = 0; i < n; i++) {
    if (data[i] === 0) return true;
  }
  return false;
}

function mb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
