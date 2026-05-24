"use client";

import { useCallback, useState } from "react";
import { useAnalysisStore } from "@/store/analysis.store";

interface Props {
  onReady: () => void;
}

type AllowedType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
const ALLOWED: AllowedType[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export function ImageUploader({ onReady }: Props) {
  const { setUploadedImage } = useAnalysisStore();
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(
    (file: File) => {
      if (!ALLOWED.includes(file.type as AllowedType)) {
        setError("Please upload a PNG, JPEG, GIF, or WebP image.");
        return;
      }
      setError(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        // Strip the data URL prefix — API expects raw base64
        const base64 = result.split(",")[1];
        setUploadedImage(base64, file.type as AllowedType);
        setPreview(result);
      };
      reader.readAsDataURL(file);
    },
    [setUploadedImage]
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div className="flex flex-col gap-4">
      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-all duration-200 ${
          dragging
            ? "border-violet-500 bg-violet-50"
            : preview
            ? "border-emerald-400 bg-emerald-50"
            : "border-zinc-300 hover:border-violet-400 hover:bg-violet-50"
        }`}
      >
        <input type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />

        {preview ? (
          <>
            <img src={preview} alt="Uploaded diagram" className="max-h-48 rounded-lg object-contain" />
            <span className="text-xs text-emerald-600 font-medium">Diagram loaded — click to replace</span>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm text-zinc-700">Drop your architecture diagram here</p>
              <p className="text-xs text-zinc-400 mt-1">PNG, JPEG, WebP — any architecture diagram works</p>
            </div>
          </>
        )}
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {preview && (
        <button
          onClick={onReady}
          className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors"
        >
          Extract Architecture from Diagram
        </button>
      )}
    </div>
  );
}
