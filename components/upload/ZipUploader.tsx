"use client";

import { useCallback, useState } from "react";

interface Props {
  /** Called with the raw base64 (no data-URL prefix) and the file name. */
  onLoaded: (zipBase64: string, fileName: string, sizeKb: number) => void;
  fileName: string | null;
}

const MAX_MB = 20;

export function ZipUploader({ onLoaded, fileName }: Props) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(
    (file: File) => {
      const isZip =
        file.type === "application/zip" ||
        file.type === "application/x-zip-compressed" ||
        file.name.toLowerCase().endsWith(".zip");
      if (!isZip) {
        setError("Please upload a .zip of your repository.");
        return;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        setError(`ZIP is too large (max ${MAX_MB} MB).`);
        return;
      }
      setError(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const base64 = result.split(",")[1];
        onLoaded(base64, file.name, Math.round(file.size / 1024));
      };
      reader.readAsDataURL(file);
    },
    [onLoaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  return (
    <div className="flex flex-col gap-3">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-all duration-200 ${
          dragging
            ? "border-violet-500 bg-violet-50"
            : fileName
              ? "border-emerald-400 bg-emerald-50"
              : "border-zinc-300 hover:border-violet-400 hover:bg-violet-50"
        }`}
      >
        <input
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processFile(file);
          }}
        />
        <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
        </div>
        {fileName ? (
          <span className="text-sm text-emerald-700 font-medium">
            {fileName} — click to replace
          </span>
        ) : (
          <div className="text-center">
            <p className="text-sm text-zinc-700">Drop your repository .zip here</p>
            <p className="text-xs text-zinc-400 mt-1">
              TypeScript / JavaScript · max {MAX_MB} MB · code never executed
            </p>
          </div>
        )}
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
