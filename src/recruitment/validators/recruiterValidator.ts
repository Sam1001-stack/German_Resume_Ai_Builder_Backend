import { z } from "zod";

export const createJobSchema = z.object({
  title: z.string().trim().min(2).max(200),
  company: z.string().trim().min(1).max(200),
  description: z.string().trim().min(20).max(20000),
  requiredSkills: z.array(z.string().trim().min(1)).max(50).optional().default([]),
  experienceLevel: z
    .enum(["intern", "junior", "mid", "senior", "lead", "executive"])
    .optional()
    .default("mid"),
  certifications: z.array(z.string().trim()).max(30).optional().default([]),
  languages: z.array(z.string().trim()).max(20).optional().default([]),
});

export const jobIdParamSchema = z.object({
  jobId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid job ID"),
});

export const resumeIdParamSchema = z.object({
  jobId: z.string().regex(/^[a-f\d]{24}$/i),
  resumeId: z.string().regex(/^[a-f\d]{24}$/i),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
