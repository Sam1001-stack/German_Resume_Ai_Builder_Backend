import { z } from "zod";

export const saveUserResumeSchema = z.object({
  locale: z.enum(["en", "de"]).default("en"),
  content: z.record(z.string(), z.unknown()),
});

export type SaveUserResumeInput = z.infer<typeof saveUserResumeSchema>;
