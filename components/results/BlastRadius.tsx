"use client";

interface Props {
  count: number;
  total: number;
}

function getSeverityColor(ratio: number) {
  if (ratio >= 0.7) return { ring: "ring-red-200", border: "border-red-300", text: "text-red-600", label: "Critical", dot: "bg-red-500" };
  if (ratio >= 0.4) return { ring: "ring-amber-200", border: "border-amber-300", text: "text-amber-600", label: "High", dot: "bg-amber-500" };
  if (ratio >= 0.2) return { ring: "ring-yellow-200", border: "border-yellow-300", text: "text-yellow-600", label: "Medium", dot: "bg-yellow-500" };
  return { ring: "ring-emerald-200", border: "border-emerald-300", text: "text-emerald-600", label: "Low", dot: "bg-emerald-500" };
}

export function BlastRadius({ count, total }: Props) {
  const ratio = total > 0 ? count / total : 0;
  const c = getSeverityColor(ratio);
  const pct = Math.round(ratio * 100);

  return (
    <div className={`flex flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white shadow-sm p-8 ring-1 ${c.ring}`}>
      <div className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Blast Radius</div>

      {/* Circular badge */}
      <div className={`relative w-32 h-32 rounded-full border-4 ${c.border} flex flex-col items-center justify-center`}>
        <span className={`text-5xl font-black ${c.text}`}>{count}</span>
        <span className="text-xs text-zinc-400 mt-0.5">modules</span>
      </div>

      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${c.dot} animate-pulse`} />
        <span className={`text-sm font-semibold ${c.text}`}>{c.label} Impact</span>
        <span className="text-sm text-zinc-400">— {pct}% of system affected</span>
      </div>
    </div>
  );
}
