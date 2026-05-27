import fs from "fs/promises";
import { createHash } from "crypto";
import { ApiError } from "../../utils/apiError";
import type { ParsedCandidate } from "../types/recruitment";

async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return (result.text ?? "").replace(/\s+/g, " ").trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown PDF error";
    throw new ApiError(400, `Failed to parse PDF: ${message}`);
  }
}

function extractField(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

export function parseCandidateFromText(text: string): ParsedCandidate {
  const email =
    extractField(text, [/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/]) ?? "";
  const phone =
    extractField(text, [
      /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/,
    ]) ?? "";

  const lines = text
    .split(/\n|(?=[A-Z][a-z]+ )/)
    .map((l) => l.trim())
    .filter(Boolean);
  const candidateName = lines[0]?.slice(0, 80) ?? "Unknown Candidate";

  const skillKeywords = [
    "react",
    "node",
    "mongodb",
    "postgresql",
    "typescript",
    "javascript",
    "aws",
    "docker",
    "kubernetes",
    "redis",
    "socket",
    "express",
    "next.js",
    "mern",
    "pern",
    "python",
    "java",
    "graphql",
    "terraform",
    "ci/cd",
  ];

  const lower = text.toLowerCase();
  const skills = skillKeywords.filter((s) => lower.includes(s));

  const yearsMatch = text.match(/(\d{1,2})\+?\s*(?:years|yrs)/i);
  const experienceYears = yearsMatch ? Number(yearsMatch[1]) : undefined;

  return {
    candidateName,
    email: email || undefined,
    phone: phone || undefined,
    location: extractField(text, [/([A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*,\s*(?:Germany|DE|Berlin|Munich))/i]),
    currentRole: lines[1]?.slice(0, 120),
    experienceYears,
    education: extractField(text, [/(B\.?Sc|M\.?Sc|Bachelor|Master|PhD)[^\n]{0,80}/i]),
    languages: ["English", "German"].filter((l) => lower.includes(l.toLowerCase())),
    certifications: ["AWS", "Azure", "GCP", "Google Cloud"].filter((c) =>
      lower.includes(c.toLowerCase())
    ),
    skills,
    summary: text.slice(0, 500),
  };
}

export const pdfExtractService = {
  hashBuffer(buffer: Buffer): string {
    return createHash("sha256").update(buffer).digest("hex");
  },

  async extractFromFile(filePath: string): Promise<{ text: string; hash: string }> {
    const buffer = await fs.readFile(filePath);
    if (buffer.length < 50) {
      throw new ApiError(400, "PDF file is empty or corrupted");
    }
    const hash = this.hashBuffer(buffer);
    const text = await parsePdfBuffer(buffer);
    if (!text || text.length < 30) {
      throw new ApiError(400, "Could not extract meaningful text from PDF");
    }
    return { text, hash };
  },
};
