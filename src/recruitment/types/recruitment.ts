import type { Types } from "mongoose";

export type ExperienceLevel =
  | "intern"
  | "junior"
  | "mid"
  | "senior"
  | "lead"
  | "executive";

export type ResumeProcessingStatus =
  | "uploaded"
  | "processing"
  | "analyzed"
  | "failed";

export type ScanSessionStatus = "idle" | "running" | "completed" | "failed";

export interface ParsedCandidate {
  candidateName: string;
  email?: string;
  phone?: string;
  location?: string;
  currentRole?: string;
  experienceYears?: number;
  education?: string;
  languages: string[];
  certifications: string[];
  skills: string[];
  summary?: string;
}

export interface CandidateAnalysisResult {
  rank: number;
  candidateName: string;
  email: string;
  phone: string;
  location: string;
  matchScore: number;
  vectorSimilarity: number;
  experienceYears: number;
  currentRole: string;
  skillsMatched: string[];
  missingSkills: string[];
  education: string;
  languages: string[];
  certifications: string[];
  summary: string;
  strengths: string[];
  weaknesses: string[];
  rejectionReasons: string[];
  loopholes: string[];
  recommendation: string;
  resumeFile: string;
  resumeId: string;
  interviewQuestions: string[];
  scoreBreakdown: {
    skills: number;
    experience: number;
    summary: number;
    education: number;
    certifications: number;
    languages: number;
  };
}

export interface RejectedCandidateResult extends CandidateAnalysisResult {
  scanFailed?: boolean;
}

export interface DashboardAnalytics {
  totalResumes: number;
  analyzedResumes: number;
  averageScore: number;
  skillDistribution: Record<string, number>;
  experienceDistribution: Record<string, number>;
  recommendationBreakdown: Record<string, number>;
}

export interface RecruiterJobDocument {
  _id: Types.ObjectId;
  recruiterId: Types.ObjectId;
  title: string;
  company: string;
  description: string;
  requiredSkills: string[];
  experienceLevel: ExperienceLevel;
  certifications: string[];
  languages: string[];
  status: "draft" | "open" | "closed";
  createdAt: Date;
  updatedAt: Date;
}
