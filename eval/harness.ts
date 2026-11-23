import { strToU8, zipSync } from "fflate";
import { readRepoZip } from "@/lib/zip-reader";
import { indexRepo } from "@/lib/code-indexer";
import type { RepoIndex } from "@/types";

/** Build a RepoIndex from an in-memory fixture, exercising the real intake path. */
export function buildIndex(files: Record<string, string>): RepoIndex {
  const u8: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(files)) u8[k] = strToU8(v);
  return indexRepo(readRepoZip(zipSync(u8)));
}

export interface PRF {
  precision: number;
  recall: number;
  f1: number;
  tp: number;
}

export function prf(predicted: string[], expected: string[]): PRF {
  const exp = new Set(expected);
  const pred = new Set(predicted);
  let tp = 0;
  for (const p of pred) if (exp.has(p)) tp++;
  const precision = pred.size === 0 ? (exp.size === 0 ? 1 : 0) : tp / pred.size;
  const recall = exp.size === 0 ? 1 : tp / exp.size;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1, tp };
}
