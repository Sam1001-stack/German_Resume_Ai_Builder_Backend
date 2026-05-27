import { z } from "zod";
import type { GenerateCoverLetterInput } from "../types/coverLetter";
import type { TailorFromJobInput } from "../validators/aiValidator";
import { ApiError } from "../utils/apiError";
import { createChatCompletion } from "./openAiService";

const tailorResponseSchema = z.object({
  summary: z.string().trim().min(40).max(1200),
  skills: z.array(z.string().trim().min(1).max(80)).min(4).max(16),
});

const coverLetterResponseSchema = z.object({
  subject: z.string().trim().min(5).max(200),
  salutation: z.string().trim().min(5).max(200),
  paragraphs: z.array(z.string().trim().min(20).max(1200)).min(2).max(5),
  closing: z.string().trim().min(5).max(120),
});

const localeInstructions = {
  en: "Write all content in English.",
  de: "Write all content in German (Deutsch).",
} as const;

const resumeTypeInstructions = {
  professional: "Target a full-time professional role in the German job market.",
  werkstudent: "Target a Werkstudent (working student) role in Germany. Emphasize learning ability, availability, and relevant student/project experience tone.",
} as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function summarizeResumeForCoverLetter(content: Record<string, unknown>): string {
  const personal = asRecord(content.personal);
  const experience = asArray<Record<string, unknown>>(content.experience);
  const education = asArray<Record<string, unknown>>(content.education);
  const skills = asArray<string>(content.skills).filter(Boolean);

  const lines = [
    `Name: ${String(personal.firstName ?? "")} ${String(personal.lastName ?? "")}`.trim(),
    personal.headline ? `Headline: ${personal.headline}` : null,
    personal.city || personal.country
      ? `Location: ${[personal.city, personal.country].filter(Boolean).join(", ")}`
      : null,
    content.summary ? `Summary: ${content.summary}` : null,
    skills.length ? `Skills: ${skills.join(", ")}` : null,
  ].filter(Boolean);

  if (experience.length) {
    lines.push("Experience:");
    for (const exp of experience.slice(0, 4)) {
      const bullets = asArray<string>(exp.bullets).filter(Boolean).slice(0, 3);
      lines.push(
        `- ${exp.position} at ${exp.company}${bullets.length ? `: ${bullets.join("; ")}` : ""}`
      );
    }
  }

  if (education.length) {
    lines.push("Education:");
    for (const edu of education.slice(0, 2)) {
      lines.push(`- ${edu.degree}${edu.field ? ` in ${edu.field}` : ""} — ${edu.institution}`);
    }
  }

  return lines.join("\n");
}

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

  async generateCoverLetter(input: GenerateCoverLetterInput) {
    const resumeSummary = summarizeResumeForCoverLetter(input.resumeContent);
    const systemPrompt = [
      "You are an expert cover letter writer for the German job market.",
      localeInstructions[input.locale],
      resumeTypeInstructions[input.resumeType],
      "Write a professional, specific cover letter tailored to the job description and the candidate resume.",
      "Extract the target company and role from the job description if they are not explicitly provided.",
      "Use 3-4 body paragraphs: motivation, relevant experience with concrete examples, value fit, and closing interest.",
      "Do not invent employers, degrees, or metrics not supported by the resume.",
      'Return JSON only: {"subject":"...","salutation":"...","paragraphs":["...","..."],"closing":"..."}',
    ].join("\n");

    const userPrompt = [
      `Job description:\n"""${input.jobDescription}"""`,
      input.companyName ? `Target company: ${input.companyName}` : null,
      input.targetRole ? `Target role: ${input.targetRole}` : null,
      `Candidate resume:\n${resumeSummary}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const raw = await createChatCompletion([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ApiError(502, "Failed to parse cover letter AI response");
    }

    const result = coverLetterResponseSchema.safeParse(parsed);
    if (!result.success) {
      throw new ApiError(502, "Cover letter AI response did not match expected format");
    }

    return {
      subject: result.data.subject,
      salutation: result.data.salutation,
      paragraphs: result.data.paragraphs,
      closing: result.data.closing,
      companyName: input.companyName,
      targetRole: input.targetRole,
      jobDescription: input.jobDescription,
      generatedAt: new Date().toISOString(),
    };
  },
};
