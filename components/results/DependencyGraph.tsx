"use client";

import { useMemo, useState } from "react";
import type { ReportGraph, GraphNode } from "@/types";

// Layout constants (tuned so pills never overlap).
const PAD = 16;
const ROW_H = 34; // vertical spacing between pills in a column
const COL_GAP = 48; // horizontal gap between columns (room for edges)
const PILL_H = 24;
const CHAR_W = 6.7; // approx monospace-ish width per char at 12px
const PILL_PAD = 26; // dot + left/right padding inside a pill
const MAX_LABEL = 22;

function sevColor(n: GraphNode): string {
  if (!n.flagged) return "#d4d4d8"; // zinc-300 — in radius, not flagged
  if (n.severity === "high") return "#ef4444";
  if (n.severity === "medium") return "#f59e0b";
  return "#a1a1aa";
}

function label(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.length > MAX_LABEL ? base.slice(0, MAX_LABEL - 1) + "…" : base;
}

interface Placed {
  node: GraphNode;
  x: number;
  y: number;
  w: number;
}

/**
 * Blast-radius graph: files as pills in columns by hops from a seed
 * (targets on the left → dependents to the right), edges = imports.
 */
export function DependencyGraph({ graph }: { graph: ReportGraph }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const { placed, byFile, edges, width, height } = useMemo(() => {
    // Group by distance → columns.
    const byDist = new Map<number, GraphNode[]>();
    for (const node of graph.nodes) {
      const list = byDist.get(node.distance);
      if (list) list.push(node);
      else byDist.set(node.distance, [node]);
    }
    const dists = [...byDist.keys()].sort((a, b) => a - b);

    const placed: Placed[] = [];
    const byFile = new Map<string, Placed>();
    let colX = PAD;
    let maxRows = 0;

    for (const d of dists) {
      const nodes = byDist.get(d)!;
      maxRows = Math.max(maxRows, nodes.length);
      const colW = Math.max(...nodes.map((n) => label(n.file).length * CHAR_W + PILL_PAD));
      nodes.forEach((node, row) => {
        const p: Placed = { node, x: colX, y: PAD + 16 + row * ROW_H, w: colW };
        placed.push(p);
        byFile.set(node.file, p);
      });
      colX += colW + COL_GAP;
    }

    const edges = graph.edges
      .map((e) => ({ a: byFile.get(e.from), b: byFile.get(e.to) }))
      .filter((e): e is { a: Placed; b: Placed } => Boolean(e.a && e.b));

    return {
      placed,
      byFile,
      edges,
      width: colX - COL_GAP + PAD,
      height: PAD * 2 + 16 + Math.max(0, maxRows - 1) * ROW_H + PILL_H,
    };
  }, [graph]);

  if (graph.nodes.length === 0) {
    return <p className="text-xs text-zinc-400">No graph available for this change.</p>;
  }

  const connected = (file: string) =>
    !hovered ||
    hovered === file ||
    edges.some((e) => (e.a.node.file === hovered && e.b.node.file === file) || (e.b.node.file === hovered && e.a.node.file === file));

  return (
    <div>
      <div className="overflow-x-auto">
        <svg width={width} height={Math.max(height, 60)} className="select-none">
          {/* column captions */}
          {[...new Set(placed.map((p) => p.node.distance))]
            .sort((a, b) => a - b)
            .map((d) => {
              const p = placed.find((pl) => pl.node.distance === d)!;
              return (
                <text key={d} x={p.x} y={PAD + 2} className="fill-zinc-300" style={{ fontSize: 9 }}>
                  {d === 0 ? "TARGET" : `${d} HOP${d > 1 ? "S" : ""}`}
                </text>
              );
            })}

          {/* edges */}
          {edges.map((e, i) => {
            const left = e.a.x < e.b.x ? e.a : e.b;
            const right = e.a.x < e.b.x ? e.b : e.a;
            const x1 = left.x + left.w;
            const y1 = left.y + PILL_H / 2;
            const x2 = right.x;
            const y2 = right.y + PILL_H / 2;
            const mx = (x1 + x2) / 2;
            const active = hovered && (e.a.node.file === hovered || e.b.node.file === hovered);
            return (
              <path
                key={i}
                d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={active ? "#7c3aed" : "#e4e4e7"}
                strokeWidth={active ? 1.5 : 1}
                opacity={hovered && !active ? 0.25 : 1}
              />
            );
          })}

          {/* pills */}
          {placed.map((p) => {
            const n = p.node;
            const dim = hovered && !connected(n.file);
            return (
              <g
                key={n.file}
                onMouseEnter={() => setHovered(n.file)}
                onMouseLeave={() => setHovered(null)}
                opacity={dim ? 0.4 : 1}
              >
                <title>{`${n.file}${n.reason ? ` — ${n.reason}` : ""}`}</title>
                <rect
                  x={p.x}
                  y={p.y}
                  width={p.w}
                  height={PILL_H}
                  rx={6}
                  fill="#ffffff"
                  stroke={n.relation === "seed" ? "#7c3aed" : "#e4e4e7"}
                  strokeWidth={n.relation === "seed" ? 1.5 : 1}
                />
                <circle cx={p.x + 12} cy={p.y + PILL_H / 2} r={3.5} fill={sevColor(n)} />
                <text x={p.x + 22} y={p.y + PILL_H / 2 + 4} className="fill-zinc-700" style={{ fontSize: 12 }}>
                  {label(n.file)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* hover caption */}
      <p className="mt-2 h-4 truncate text-[11px] text-zinc-500">
        {hovered ? (
          <>
            <span className="font-medium text-zinc-700">{hovered}</span>
            {byFile.get(hovered)?.node.reason
              ? ` — ${byFile.get(hovered)!.node.reason}`
              : byFile.get(hovered)?.node.flagged
                ? ""
                : " — in blast radius (not flagged)"}
          </>
        ) : (
          ""
        )}
      </p>

      {/* legend */}
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-zinc-400">
        <Legend dot="#ef4444" label="high" />
        <Legend dot="#f59e0b" label="medium" />
        <Legend dot="#a1a1aa" label="low" />
        <Legend dot="#d4d4d8" label="in radius, not flagged" />
        <Legend ring label="seed (change target)" />
        {graph.truncated && <span className="text-amber-600">truncated to closest files</span>}
      </div>
    </div>
  );
}

function Legend({ dot, ring, label }: { dot?: string; ring?: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width={14} height={14}>
        {ring ? (
          <rect x={2} y={3} width={10} height={8} rx={2} fill="#fff" stroke="#7c3aed" strokeWidth={1.5} />
        ) : (
          <circle cx={7} cy={7} r={3.5} fill={dot} />
        )}
      </svg>
      {label}
    </span>
  );
}
