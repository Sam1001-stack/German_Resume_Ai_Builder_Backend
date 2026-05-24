import { ApiError } from "../utils/apiError";

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

interface OpenRouterChatResponse {
  choices?: Array<{
    message?: { content?: string };
  }>;
  error?: { message?: string };
}

export async function createChatCompletion(
  messages: ChatMessage[],
  options?: { temperature?: number }
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new ApiError(
      503,
      "OpenRouter is not configured. Set OPENROUTER_API_KEY on the server."
    );
  }

  const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.CLIENT_URL || "http://localhost:3000",
      "X-Title": "German Resume AI Builder",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.6,
      response_format: { type: "json_object" },
    }),
  });

  const data = (await response.json()) as OpenRouterChatResponse;

  if (!response.ok) {
    const message =
      data.error?.message ?? `OpenRouter request failed (${response.status})`;
    throw new ApiError(502, message);
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new ApiError(502, "OpenRouter returned an empty response");
  }

  return content;
}
