import { z } from "zod";
import type { TailorFromJobInput } from "../validators/aiValidator";
import { ApiError } from "../utils/apiError";
import { createChatCompletion } from "./openAiService";

const tailorResponseSchema = z.object({
  summary: z.string().trim().min(40).max(1200),
  skills: z.array(z.string().trim().min(1).max(80)).min(4).max(16),
});

const localeInstructions = {
  en: "Write all content in English.",
  de: "Write all content in German (Deutsch).",
} as const;

const resumeTypeInstructions = {
  professional: "Target a full-time professional role in the German job market.",
  werkstudent: "Target a Werkstudent (working student) role in Germany. Emphasize learning ability, availability, and relevant student/project experience tone.",
} as const;

function buildPrompt(input: TailorFromJobInput): string {
  const parts = [
    `Job description:\n"""${input.jobDescription}"""`,
    input.headline ? `Candidate headline: ${input.headline}` : null,
    input.currentSummary
      ? `Current summary (improve/tailor, do not copy verbatim):\n${input.currentSummary}`
      : null,
    input.currentSkills?.length
      ? `Current skills (keep relevant ones, add missing job keywords):\n${input.currentSkills.join(", ")}`
      : null,
  ].filter(Boolean);

  return parts.join("\n\n");
}

export const aiService = {
  async tailorFromJobDescription(input: TailorFromJobInput) {
    const systemPrompt = [
      "You are an expert resume writer for the German job market and ATS systems.",
      localeInstructions[input.locale],
      resumeTypeInstructions[input.resumeType],
      "Based on the job description, produce:",
      "1) A tailored professional summary (2-4 sentences, specific, metrics-friendly, no generic fluff)",
      "2) A skills list (8-12 items) aligned with the job posting keywords",
      'Return JSON only with this exact shape: {"summary":"...","skills":["skill1","skill2"]}',
    ].join("\n");

    const raw = await createChatCompletion([
      { role: "system", content: systemPrompt },
      { role: "user", content: buildPrompt(input) },
    ]);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ApiError(502, "Failed to parse AI response");
    }

    const result = tailorResponseSchema.safeParse(parsed);
    if (!result.success) {
      throw new ApiError(502, "AI response did not match expected format");
    }

    return {
      summary: result.data.summary,
      skills: [...new Set(result.data.skills.map((s) => s.trim()))],
    };
  },
};
