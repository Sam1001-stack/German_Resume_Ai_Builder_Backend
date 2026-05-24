import { z } from "zod";

export const tailorFromJobSchema = z.object({
  jobDescription: z
    .string()
    .trim()
    .min(20, "Job description must be at least 20 characters")
    .max(8000, "Job description is too long"),
  locale: z.enum(["en", "de"]).default("en"),
  resumeType: z.enum(["professional", "werkstudent"]).default("professional"),
  headline: z.string().trim().max(200).optional(),
  currentSummary: z.string().trim().max(2000).optional(),
  currentSkills: z.array(z.string().trim().max(80)).max(30).optional(),
});

export type TailorFromJobInput = z.infer<typeof tailorFromJobSchema>;
