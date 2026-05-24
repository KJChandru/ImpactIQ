"use client";

interface Props {
  risks: string[];
}

export function DeploymentRisks({ risks }: Props) {
  if (risks.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <h3 className="text-sm font-semibold text-zinc-800">Deployment Risks</h3>
        <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
          {risks.length} item{risks.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="rounded-xl border border-red-200 bg-white shadow-sm overflow-hidden">
        {risks.map((risk, i) => (
          <div
            key={i}
            className={`flex items-start gap-4 px-4 py-3.5 ${i < risks.length - 1 ? "border-b border-red-100" : ""}`}
          >
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">{risk}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
