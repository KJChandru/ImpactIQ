import { z } from "zod";

export const ExtractRequestSchema = z
  .object({
    image: z.string().optional(),
    mediaType: z
      .enum(["image/jpeg", "image/png", "image/gif", "image/webp"])
      .optional(),
    mermaid: z.string().optional(),
  })
  .refine((data) => data.image || data.mermaid, {
    message: "Either 'image' (base64) or 'mermaid' (code string) is required",
  });

const DependencySchema = z.object({
  from: z.string(),
  to: z.string(),
  type: z.string().optional(),
});

const ArchitectureSchema = z.object({
  modules: z.array(z.string()),
  dependencies: z.array(DependencySchema),
});

export const AnalyzeRequestSchema = z.object({
  architecture: ArchitectureSchema,
  feature: z.string().min(1, "Feature description is required"),
});

export type ExtractRequest = z.infer<typeof ExtractRequestSchema>;
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
export type Architecture = z.infer<typeof ArchitectureSchema>;
export type Dependency = z.infer<typeof DependencySchema>;

// ─── V2: repo-analysis model output (Module D) ─────────────────

const RepoFindingSchema = z.object({
  file: z.string(),
  symbol: z.string().optional(),
  line: z.number().int().positive().optional(),
  impact: z.enum(["direct", "indirect", "potential"]),
  severity: z.enum(["high", "medium", "low"]),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  reason: z.string(),
  evidence: z.string(),
});

const RepoTestRecSchema = z.object({
  file: z.string(),
  cases: z.array(z.string()),
  existingTest: z.string().nullable().optional(),
});

export const RepoAnalysisSchema = z.object({
  summary: z.string(),
  findings: z.array(RepoFindingSchema),
  tests: z.array(RepoTestRecSchema).default([]),
  assumptions: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([]),
});

// Request body for the repo-mode API route (Module H): a ZIP or a GitHub URL.
export const AnalyzeRepoRequestSchema = z
  .object({
    zipBase64: z.string().optional(),
    githubUrl: z.string().optional(),
    changeRequest: z.string().min(1, "A change description is required"),
  })
  .refine((d) => Boolean(d.zipBase64 || d.githubUrl), {
    message: "Provide either a ZIP upload or a GitHub repository URL.",
  });

export type AnalyzeRepoRequest = z.infer<typeof AnalyzeRepoRequestSchema>;
