import mongoose, { Schema, type Model } from "mongoose";
import type { ExperienceLevel } from "../types/recruitment";

export interface IRecruiterJob {
  recruiterId: mongoose.Types.ObjectId;
  title: string;
  company: string;
  description: string;
  requiredSkills: string[];
  experienceLevel: ExperienceLevel;
  certifications: string[];
  languages: string[];
  status: "draft" | "open" | "closed";
  jdContentHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const recruiterJobSchema = new Schema<IRecruiterJob>(
  {
    recruiterId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    requiredSkills: { type: [String], default: [] },
    experienceLevel: {
      type: String,
      enum: ["intern", "junior", "mid", "senior", "lead", "executive"],
      default: "mid",
    },
    certifications: { type: [String], default: [] },
    languages: { type: [String], default: [] },
    status: { type: String, enum: ["draft", "open", "closed"], default: "open" },
    jdContentHash: { type: String },
  },
  { timestamps: true }
);

recruiterJobSchema.index({ recruiterId: 1, createdAt: -1 });

export const RecruiterJob =
  (mongoose.models.RecruiterJob as Model<IRecruiterJob> | undefined) ??
  mongoose.model<IRecruiterJob>("RecruiterJob", recruiterJobSchema);
