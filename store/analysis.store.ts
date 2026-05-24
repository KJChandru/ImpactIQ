"use client";

import { create } from "zustand";
import type { Architecture, ImpactReport, IterationLog, Step } from "@/types";

interface AnalysisState {
  step: Step;
  // Upload
  uploadedImage: string | null;
  uploadedImageType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" | null;
  mermaidCode: string;
  // Extracted architecture
  architecture: Architecture | null;
  // Feature input
  featureDescription: string;
  // Final report
  report: ImpactReport | null;
  // Error
  error: string | null;
  // Agent progress (live during analysis)
  iterationLogs: IterationLog[];
  agentConfidence: number;
  currentIteration: number;

  // Actions
  setStep: (step: Step) => void;
  setUploadedImage: (base64: string, type: "image/jpeg" | "image/png" | "image/gif" | "image/webp") => void;
  setMermaidCode: (code: string) => void;
  setArchitecture: (arch: Architecture) => void;
  setFeatureDescription: (desc: string) => void;
  setReport: (report: ImpactReport) => void;
  setError: (err: string | null) => void;
  addIterationLog: (log: IterationLog) => void;
  setAgentProgress: (iteration: number, confidence: number) => void;
  reset: () => void;
}

const initialState = {
  step: "upload" as Step,
  uploadedImage: null,
  uploadedImageType: null,
  mermaidCode: "",
  architecture: null,
  featureDescription: "",
  report: null,
  error: null,
  iterationLogs: [],
  agentConfidence: 0,
  currentIteration: 0,
};

export const useAnalysisStore = create<AnalysisState>((set) => ({
  ...initialState,

  setStep: (step) => set({ step, error: null }),
  setUploadedImage: (base64, type) => set({ uploadedImage: base64, uploadedImageType: type }),
  setMermaidCode: (code) => set({ mermaidCode: code }),
  setArchitecture: (architecture) => set({ architecture }),
  setFeatureDescription: (featureDescription) => set({ featureDescription }),
  setReport: (report) => set({ report }),
  setError: (error) => set({ error }),
  addIterationLog: (log) =>
    set((state) => ({ iterationLogs: [...state.iterationLogs, log] })),
  setAgentProgress: (currentIteration, agentConfidence) =>
    set({ currentIteration, agentConfidence }),
  reset: () => set(initialState),
}));
