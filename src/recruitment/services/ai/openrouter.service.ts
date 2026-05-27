import { z } from "zod";
import { ApiError } from "../../../utils/apiError";

export type OpenRouterModel =
  | "openai/gpt-4o"
  | "openai/gpt-4o-mini"
  | "anthropic/claude-3.7-sonnet"
  | "anthropic/claude-3.5-sonnet"
  | "deepseek/deepseek-chat"
  | "google/gemini-2.5-pro"
  | "mistralai/mistral-large"
  | "qwen/qwen-2.5-coder";

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

interface OpenRouterChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

/** Same default as the main resume tailor API — widely available on OpenRouter */
const DEFAULT_MODEL = "openai/gpt-4o-mini";
const FALLBACK_MODEL = "openai/gpt-4o-mini";
const MAX_RETRIES = 3;
const TIMEOUT_MS = 90_000;

const screeningResponseSchema = z.object({
  candidateName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  currentRole: z.string().optional(),
  experienceYears: z.number().optional(),
  skillsMatched: z.array(z.string()).optional(),
  missingSkills: z.array(z.string()).optional(),
  education: z.string().optional(),
  languages: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  summary: z.string().optional(),
  strengths: z.array(z.string()).optional(),
  weaknesses: z.array(z.string()).optional(),
  interviewQuestions: z.array(z.string()).optional(),
  scoreBreakdown: z
    .object({
      skills: z.number().min(0).max(100).optional(),
      experience: z.number().min(0).max(100).optional(),
      summary: z.number().min(0).max(100).optional(),
      education: z.number().min(0).max(100).optional(),
      certifications: z.number().min(0).max(100).optional(),
      languages: z.number().min(0).max(100).optional(),
    })
    .optional(),
  hiringRisk: z.string().optional(),
  leadershipIndicators: z.array(z.string()).optional(),
  rejectionReasons: z.array(z.string()).optional(),
  loopholes: z.array(z.string()).optional(),
});

export type ScreeningAiResponse = z.infer<typeof screeningResponseSchema>;

function resolveModel(): string {
  const env = (
    process.env.RECRUITER_OPENROUTER_MODEL ?? process.env.OPENROUTER_MODEL
  )?.trim();
  return env || DEFAULT_MODEL;
}

function isModelUnavailableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("no endpoints found") ||
    lower.includes("model not found") ||
    lower.includes("does not exist") ||
    lower.includes("not a valid model")
  );
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function requestCompletion(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number
): Promise<string> {
  const response = await fetchWithTimeout(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.CLIENT_URL || "http://localhost:3000",
        "X-Title": "AI Recruiter ATS",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      }),
    },
    TIMEOUT_MS
  );

  const data = (await response.json()) as OpenRouterChatResponse;

  if (!response.ok) {
    throw new ApiError(
      502,
      data.error?.message ?? `OpenRouter request failed (${response.status})`
    );
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new ApiError(502, "OpenRouter returned an empty response");
  }

  return content;
}

export const openRouterRecruitmentService = {
  async chatCompletion(
    messages: ChatMessage[],
    options?: { model?: string; temperature?: number; maxTokens?: number }
  ): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new ApiError(503, "OpenRouter is not configured. Set OPENROUTER_API_KEY.");
    }

    const primaryModel = options?.model ?? resolveModel();
    const temperature = options?.temperature ?? 0.2;
    const maxTokens = options?.maxTokens ?? 4000;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await requestCompletion(
          apiKey,
          primaryModel,
          messages,
          temperature,
          maxTokens
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (
          primaryModel !== FALLBACK_MODEL &&
          isModelUnavailableError(lastError.message)
        ) {
          console.warn(
            `[openrouter] Model "${primaryModel}" unavailable (${lastError.message}). Falling back to ${FALLBACK_MODEL}.`
          );
          try {
            return await requestCompletion(
              apiKey,
              FALLBACK_MODEL,
              messages,
              temperature,
              maxTokens
            );
          } catch (fallbackError) {
            lastError =
              fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError));
          }
        }

        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, attempt * 1000));
        }
      }
    }

    throw lastError ?? new ApiError(502, "OpenRouter request failed after retries");
  },

  async analyzeResumeAgainstJob(input: {
    jobTitle: string;
    jobDescription: string;
    requiredSkills: string[];
    experienceLevel: string;
    certifications: string[];
    languages: string[];
    resumeText: string;
    vectorSimilarity: number;
  }): Promise<ScreeningAiResponse> {
    const systemPrompt = `You are an expert AI recruitment screening engine for a modern ATS platform.
Analyze resumes against job descriptions for the German and international tech job market.
Return ONLY valid JSON matching the requested schema.
Score each breakdown category from 0-100.
Apply these weights mentally: skills 35%, experience 30%, summary 15%, education 10%, certifications 5%, languages 5%.
Detect semantic skill matches (e.g. React matches frontend), seniority fit, over/under qualification, and missing critical skills.
Generate 3-5 tailored technical interview questions.
For candidates who are NOT a strong fit, provide rejectionReasons (why they should not be hired) and loopholes (specific gaps, red flags, or missing evidence in the resume).`;

    const userPrompt = `JOB TITLE: ${input.jobTitle}

JOB DESCRIPTION:
"""${input.jobDescription}"""

REQUIRED SKILLS: ${input.requiredSkills.join(", ") || "Not specified"}
EXPERIENCE LEVEL: ${input.experienceLevel}
PREFERRED CERTIFICATIONS: ${input.certifications.join(", ") || "None"}
PREFERRED LANGUAGES: ${input.languages.join(", ") || "None"}
VECTOR SIMILARITY (0-1): ${input.vectorSimilarity.toFixed(4)}

RESUME TEXT:
"""${input.resumeText.slice(0, 12000)}"""

Return JSON:
{
  "candidateName": "",
  "email": "",
  "phone": "",
  "location": "",
  "currentRole": "",
  "experienceYears": 0,
  "skillsMatched": [],
  "missingSkills": [],
  "education": "",
  "languages": [],
  "certifications": [],
  "summary": "",
  "strengths": [],
  "weaknesses": [],
  "interviewQuestions": [],
  "scoreBreakdown": {
    "skills": 0,
    "experience": 0,
    "summary": 0,
    "education": 0,
    "certifications": 0,
    "languages": 0
  },
  "hiringRisk": "",
  "leadershipIndicators": [],
  "rejectionReasons": [],
  "loopholes": []
}`;

    const raw = await this.chatCompletion([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ApiError(502, "Failed to parse AI screening response");
    }

    const result = screeningResponseSchema.safeParse(parsed);
    if (!result.success) {
      throw new ApiError(502, "AI screening response did not match expected format");
    }

    return result.data;
  },
};
