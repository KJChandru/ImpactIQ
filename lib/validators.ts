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
