"use client";

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 animate-pulse">
      <div className="h-4 bg-zinc-800 rounded w-1/3 mb-4" />
      <div className="space-y-2">
        <div className="h-3 bg-zinc-800 rounded w-full" />
        <div className="h-3 bg-zinc-800 rounded w-4/5" />
        <div className="h-3 bg-zinc-800 rounded w-2/3" />
      </div>
    </div>
  );
}
