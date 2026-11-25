"use client";

import { useMemo, useState } from "react";
import type { ReportGraph, GraphNode } from "@/types";

const COL_GAP = 170;
const ROW_GAP = 44;
const PAD_X = 28;
const PAD_Y = 28;
const NODE_R = 6;
const LABEL_ROOM = 150;

// Node fill by state.
function nodeFill(n: GraphNode): string {
  if (!n.flagged) return "#ffffff";
  if (n.severity === "high") return "#ef4444"; // red-500
  if (n.severity === "medium") return "#f59e0b"; // amber-500
  return "#a1a1aa"; // zinc-400
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

/**
 * Blast-radius graph: files laid out in columns by hops from a seed
 * (seeds/targets on the left → dependents to the right), edges = imports.
 */
export function DependencyGraph({ graph }: { graph: ReportGraph }) {
  const [hovered, setHovered] = useState<GraphNode | null>(null);

  const { positions, width, height, columns } = useMemo(() => {
    const byDist = new Map<number, GraphNode[]>();
    for (const node of graph.nodes) {
      const list = byDist.get(node.distance);
      if (list) list.push(node);
      else byDist.set(node.distance, [node]);
    }
    const dists = [...byDist.keys()].sort((a, b) => a - b);
    const pos = new Map<string, { x: number; y: number }>();
    let maxRows = 0;
    dists.forEach((d, col) => {
      const nodes = byDist.get(d)!;
      maxRows = Math.max(maxRows, nodes.length);
      nodes.forEach((nd, row) => {
        pos.set(nd.file, { x: PAD_X + col * COL_GAP + NODE_R, y: PAD_Y + row * ROW_GAP });
      });
    });
    return {
      positions: pos,
      columns: dists.map((d, col) => ({ d, x: PAD_X + col * COL_GAP + NODE_R, label: d === 0 ? "target" : `${d} hop${d > 1 ? "s" : ""}` })),
      width: PAD_X * 2 + (dists.length - 1) * COL_GAP + LABEL_ROOM,
      height: PAD_Y * 2 + Math.max(0, maxRows - 1) * ROW_GAP + 16,
    };
  }, [graph]);

  if (graph.nodes.length === 0) {
    return <p className="text-xs text-zinc-400">No graph available for this change.</p>;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <svg width={width} height={Math.max(height, 70)} className="select-none">
          {/* Column captions */}
          {columns.map((c) => (
            <text key={c.d} x={c.x - NODE_R} y={14} className="fill-zinc-400" style={{ fontSize: 10 }}>
              {c.label}
            </text>
          ))}

          {/* Edges */}
          {graph.edges.map((e, i) => {
            const a = positions.get(e.from);
            const b = positions.get(e.to);
            if (!a || !b) return null;
            const active = hovered && (hovered.file === e.from || hovered.file === e.to);
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={active ? "#7c3aed" : "#d4d4d8"}
                strokeWidth={active ? 1.5 : 1}
                opacity={hovered && !active ? 0.3 : 0.8}
              />
            );
          })}

          {/* Nodes */}
          {graph.nodes.map((n) => {
            const p = positions.get(n.file);
            if (!p) return null;
            return (
              <g
                key={n.file}
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "default" }}
              >
                <title>{`${n.file}${n.reason ? ` — ${n.reason}` : ""}`}</title>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={n.flagged ? NODE_R + 1 : NODE_R}
                  fill={nodeFill(n)}
                  stroke={n.relation === "seed" ? "#7c3aed" : "#d4d4d8"}
                  strokeWidth={n.relation === "seed" ? 2.5 : 1}
                />
                <text x={p.x + NODE_R + 6} y={p.y + 3} className="fill-zinc-600" style={{ fontSize: 11 }}>
                  {basename(n.file)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Hover caption */}
      <p className="mt-1 h-4 text-[11px] text-zinc-500">
        {hovered ? (
          <>
            <span className="font-medium text-zinc-700">{hovered.file}</span>
            {hovered.reason ? ` — ${hovered.reason}` : hovered.flagged ? "" : " — in blast radius (not flagged)"}
          </>
        ) : (
          ""
        )}
      </p>

      {/* Legend */}
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-zinc-400">
        <LegendDot color="#ef4444" label="high" />
        <LegendDot color="#f59e0b" label="medium" />
        <LegendDot color="#a1a1aa" label="low" />
        <LegendDot color="#ffffff" ring="#d4d4d8" label="in radius, not flagged" />
        <LegendDot color="#ffffff" ring="#7c3aed" label="seed (change target)" />
        {graph.truncated && <span className="text-amber-600">graph truncated to closest files</span>}
      </div>
    </div>
  );
}

function LegendDot({ color, ring, label }: { color: string; ring?: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <svg width={12} height={12}>
        <circle cx={6} cy={6} r={4} fill={color} stroke={ring ?? color} strokeWidth={ring ? 1.5 : 0} />
      </svg>
      {label}
    </span>
  );
}
