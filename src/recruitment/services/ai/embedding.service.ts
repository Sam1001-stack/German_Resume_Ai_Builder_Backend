import { createHash } from "crypto";
import { ApiError } from "../../../utils/apiError";
import { cosineSimilarity } from "../../utils/scoring";

const EMBEDDING_DIM = 384;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/** Deterministic local embedding fallback when OpenAI is unavailable */
function localEmbedding(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIM).fill(0);
  const tokens = tokenize(text);
  for (const token of tokens) {
    const hash = createHash("sha256").update(token).digest();
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      const byte = hash[i % hash.length]!;
      vector[i]! += (byte / 255 - 0.5) * 2;
    }
  }
  const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}

async function openAiEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ApiError(503, "OPENAI_API_KEY not set");
  }

  const model = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: text.slice(0, 8000),
    }),
  });

  const data = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new ApiError(502, data.error?.message ?? "OpenAI embedding request failed");
  }

  const embedding = data.data?.[0]?.embedding;
  if (!embedding?.length) {
    throw new ApiError(502, "OpenAI returned empty embedding");
  }

  return embedding;
}

export const embeddingService = {
  async generateEmbedding(text: string): Promise<number[]> {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) return localEmbedding("empty");

    try {
      return await openAiEmbedding(normalized);
    } catch (error) {
      console.warn("[embedding] OpenAI unavailable, using local fallback:", error);
      return localEmbedding(normalized);
    }
  },

  similarity(a: number[], b: number[]): number {
    return cosineSimilarity(a, b);
  },

  chunkText(text: string, chunkSize = 1500, overlap = 200): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      chunks.push(text.slice(start, start + chunkSize));
      start += chunkSize - overlap;
    }
    return chunks.length ? chunks : [text];
  },

  async embedDocument(text: string): Promise<number[]> {
    const chunks = this.chunkText(text);
    const vectors = await Promise.all(chunks.map((c) => this.generateEmbedding(c)));
    if (vectors.length === 1) return vectors[0]!;

    const dim = vectors[0]!.length;
    const merged = new Array<number>(dim).fill(0);
    for (const vec of vectors) {
      for (let i = 0; i < dim; i++) merged[i]! += vec[i]!;
    }
    const norm = Math.sqrt(merged.reduce((s, v) => s + v * v, 0)) || 1;
    return merged.map((v) => v / vectors.length / norm);
  },
};
