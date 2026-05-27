import mongoose, { Schema, model } from "mongoose";
import type { IUserResumeDocument } from "../types/userResume";

const userResumeSchema = new Schema<IUserResumeDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    clientId: { type: String, required: true, trim: true, index: true },
    locale: { type: String, enum: ["en", "de"], default: "en" },
    title: { type: String, required: true, trim: true },
    content: { type: Schema.Types.Mixed, required: true },
    pdfPath: { type: String, required: true },
    jobDescription: { type: String, trim: true },
    companyName: { type: String, trim: true },
    targetRole: { type: String, trim: true },
    coverLetter: { type: Schema.Types.Mixed },
    coverLetterPdfPath: { type: String },
  },
  { timestamps: true }
);

userResumeSchema.index({ userId: 1, clientId: 1 }, { unique: true });

export const UserResume =
  mongoose.models.UserResume ??
  model<IUserResumeDocument>("UserResume", userResumeSchema);
