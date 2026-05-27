import { z } from "zod";

export const saveUserResumeSchema = z.object({
  locale: z.enum(["en", "de"]).default("en"),
  content: z.record(z.string(), z.unknown()),
  jobDescription: z.string().trim().max(8000).optional(),
  companyName: z.string().trim().max(200).optional(),
  targetRole: z.string().trim().max(200).optional(),
});

export type SaveUserResumeInput = z.infer<typeof saveUserResumeSchema>;
