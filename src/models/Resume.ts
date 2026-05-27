import mongoose, { Schema, type Model } from "mongoose";
import type { IResumeDocument } from "../types/resume";

const resumeSchema = new Schema<IResumeDocument>(
  {
    title: { type: String, required: true, trim: true },
    personalInfo: {
      firstName: String,
      lastName: String,
      email: String,
      phone: String,
      address: String,
      city: String,
      country: String,
    },
    summary: String,
    experience: [
      {
        company: String,
        position: String,
        startDate: String,
        endDate: String,
        description: String,
      },
    ],
    education: [
      {
        institution: String,
        degree: String,
        startDate: String,
        endDate: String,
      },
    ],
    skills: [String],
    languages: [
      {
        name: String,
        level: String,
      },
    ],
  },
  { timestamps: true }
);

export const Resume =
  (mongoose.models.Resume as Model<IResumeDocument> | undefined) ??
  mongoose.model<IResumeDocument>("Resume", resumeSchema);
