import type { IScoreBreakdown } from "../models/ScreeningResult";

const WEIGHTS = {
  skills: 0.35,
  experience: 0.3,
  summary: 0.15,
  education: 0.1,
  certifications: 0.05,
  languages: 0.05,
} as const;

export const RECOMMENDED_MIN_SCORE = 75;
/** Candidates at or above this score appear in the main shortlist (incl. Consider). */
export const SHORTLIST_MIN_SCORE = 60;

export function recommendationFromScore(score: number): string {
  if (score >= 90) return "Highly Recommended";
  if (score >= 75) return "Recommended";
  if (score >= 60) return "Consider";
  return "Not Recommended";
}

export function isRejectedCandidate(matchScore: number, recommendation: string): boolean {
  if (matchScore < SHORTLIST_MIN_SCORE) return true;
  return recommendation === "Not Recommended";
}

export function recommendationSortOrder(recommendation: string): number {
  if (recommendation.includes("Highly")) return 0;
  if (recommendation === "Recommended") return 1;
  if (recommendation === "Consider") return 2;
  return 3;
}

export function buildRejectionInsights(input: {
  matchScore: number;
  recommendation: string;
  missingSkills: string[];
  weaknesses: string[];
  scoreBreakdown: IScoreBreakdown;
  hiringRisk?: string;
  rejectionReasons?: string[];
  loopholes?: string[];
}): { rejectionReasons: string[]; loopholes: string[] } {
  if (input.rejectionReasons?.length) {
    return {
      rejectionReasons: input.rejectionReasons,
      loopholes: input.loopholes?.length ? input.loopholes : input.weaknesses.slice(0, 5),
    };
  }

  const reasons: string[] = [];
  const loopholes: string[] = [];

  if (input.matchScore < 60) {
    reasons.push("Overall match score is below the minimum hiring threshold (60%).");
  }
  if (input.recommendation === "Not Recommended") {
    reasons.push("AI classification: Not Recommended for this role.");
  }

  const { scoreBreakdown: b } = input;
  if (b.skills < 60) {
    reasons.push(`Weak skills alignment (${b.skills}% vs role requirements).`);
    loopholes.push("Critical technical skills gap versus the job description.");
  }
  if (b.experience < 60) {
    reasons.push(`Experience level mismatch (${b.experience}% fit).`);
    loopholes.push("Years of experience or role seniority does not match the opening.");
  }
  if (b.summary < 55) {
    loopholes.push("Professional summary lacks relevance to the target position.");
  }
  if (b.education < 50) {
    loopholes.push("Education background is weak or unrelated to role expectations.");
  }

  for (const skill of input.missingSkills.slice(0, 5)) {
    loopholes.push(`Missing required skill: ${skill}`);
  }

  for (const weakness of input.weaknesses.slice(0, 4)) {
    if (!loopholes.includes(weakness)) loopholes.push(weakness);
  }

  if (input.hiringRisk?.trim()) {
    reasons.push(input.hiringRisk.trim());
  }

  if (!reasons.length) {
    reasons.push("Did not meet shortlisted candidate criteria for this job.");
  }
  if (!loopholes.length) {
    loopholes.push("Insufficient evidence of role-specific impact in the resume.");
  }

  return { rejectionReasons: reasons, loopholes };
}

export function computeWeightedMatchScore(breakdown: IScoreBreakdown): number {
  const score =
    breakdown.skills * WEIGHTS.skills +
    breakdown.experience * WEIGHTS.experience +
    breakdown.summary * WEIGHTS.summary +
    breakdown.education * WEIGHTS.education +
    breakdown.certifications * WEIGHTS.certifications +
    breakdown.languages * WEIGHTS.languages;

  return Math.round(Math.min(100, Math.max(0, score)));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
