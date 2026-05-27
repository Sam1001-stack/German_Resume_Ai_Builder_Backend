import mongoose, { Schema, type Model } from "mongoose";

export interface IScoreBreakdown {
  skills: number;
  experience: number;
  summary: number;
  education: number;
  certifications: number;
  languages: number;
}

export interface IScreeningResult {
  jobId: mongoose.Types.ObjectId;
  resumeId: mongoose.Types.ObjectId;
  recruiterId: mongoose.Types.ObjectId;
  rank: number;
  matchScore: number;
  vectorSimilarity: number;
  candidateName: string;
  email: string;
  phone: string;
  location: string;
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
  interviewQuestions: string[];
  scoreBreakdown: IScoreBreakdown;
  aiRaw?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const screeningResultSchema = new Schema<IScreeningResult>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "RecruiterJob", required: true, index: true },
    resumeId: {
      type: Schema.Types.ObjectId,
      ref: "RecruiterResume",
      required: true,
      unique: true,
    },
    recruiterId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    rank: { type: Number, default: 0 },
    matchScore: { type: Number, required: true, index: true },
    vectorSimilarity: { type: Number, default: 0 },
    candidateName: { type: String, default: "Unknown" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    location: { type: String, default: "" },
    experienceYears: { type: Number, default: 0 },
    currentRole: { type: String, default: "" },
    skillsMatched: { type: [String], default: [] },
    missingSkills: { type: [String], default: [] },
    education: { type: String, default: "" },
    languages: { type: [String], default: [] },
    certifications: { type: [String], default: [] },
    summary: { type: String, default: "" },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    rejectionReasons: { type: [String], default: [] },
    loopholes: { type: [String], default: [] },
    recommendation: { type: String, default: "Not Recommended" },
    interviewQuestions: { type: [String], default: [] },
    scoreBreakdown: {
      skills: { type: Number, default: 0 },
      experience: { type: Number, default: 0 },
      summary: { type: Number, default: 0 },
      education: { type: Number, default: 0 },
      certifications: { type: Number, default: 0 },
      languages: { type: Number, default: 0 },
    },
    aiRaw: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

screeningResultSchema.index({ jobId: 1, rank: 1 });
screeningResultSchema.index({ jobId: 1, matchScore: -1 });

export const ScreeningResult =
  (mongoose.models.ScreeningResult as Model<IScreeningResult> | undefined) ??
  mongoose.model<IScreeningResult>("ScreeningResult", screeningResultSchema);
