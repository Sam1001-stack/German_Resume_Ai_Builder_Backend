import { Pinecone } from "@pinecone-database/pinecone";
import { embeddingService } from "./embedding.service";

const NAMESPACE = "recruiter-resumes";

let pineconeClient: Pinecone | null = null;

function isConfigured(): boolean {
  return Boolean(process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX);
}

function getClient(): Pinecone | null {
  if (!isConfigured()) return null;
  if (!pineconeClient) {
    pineconeClient = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  }
  return pineconeClient;
}

function indexName(): string {
  return process.env.PINECONE_INDEX!;
}

export const pineconeRecruitmentService = {
  isEnabled(): boolean {
    return isConfigured();
  },

  async upsertResumeVector(input: {
    id: string;
    jobId: string;
    recruiterId: string;
    embedding: number[];
    metadata: Record<string, string | number>;
  }): Promise<string | null> {
    const client = getClient();
    if (!client) return null;

    try {
      const index = client.index(indexName());
      await index.namespace(NAMESPACE).upsert({
        records: [
          {
            id: input.id,
            values: input.embedding,
            metadata: {
              jobId: input.jobId,
              recruiterId: input.recruiterId,
              ...input.metadata,
            },
          },
        ],
      });
      return input.id;
    } catch (error) {
      console.error("[pinecone] upsert failed:", error);
      return null;
    }
  },

  async upsertJobDescription(input: {
    jobId: string;
    recruiterId: string;
    text: string;
  }): Promise<string | null> {
    const embedding = await embeddingService.embedDocument(input.text);
    const id = `job-${input.jobId}`;
    return this.upsertResumeVector({
      id,
      jobId: input.jobId,
      recruiterId: input.recruiterId,
      embedding,
      metadata: { type: "job_description" },
    });
  },

  async querySimilarResumes(input: {
    jobId: string;
    embedding: number[];
    topK?: number;
  }): Promise<Array<{ id: string; score: number }>> {
    const client = getClient();
    if (!client) return [];

    try {
      const index = client.index(indexName());
      const result = await index.namespace(NAMESPACE).query({
        vector: input.embedding,
        topK: input.topK ?? 20,
        filter: { jobId: input.jobId },
        includeMetadata: true,
      });

      return (
        result.matches?.map((m) => ({
          id: m.id ?? "",
          score: m.score ?? 0,
        })) ?? []
      );
    } catch (error) {
      console.error("[pinecone] query failed:", error);
      return [];
    }
  },
};
