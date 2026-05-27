import mongoose, { Schema, type Model } from "mongoose";
import type { ParsedCandidate, ResumeProcessingStatus } from "../types/recruitment";

export interface IRecruiterResume {
  jobId: mongoose.Types.ObjectId;
  recruiterId: mongoose.Types.ObjectId;
  fileName: string;
  filePath: string;
  fileHash: string;
  fileSize: number;
  rawText?: string;
  parsedCandidate?: ParsedCandidate;
  embedding?: number[];
  pineconeId?: string;
  vectorSimilarity?: number;
  status: ResumeProcessingStatus;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const recruiterResumeSchema = new Schema<IRecruiterResume>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "RecruiterJob", required: true, index: true },
    recruiterId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    fileHash: { type: String, required: true, index: true },
    fileSize: { type: Number, required: true },
    rawText: { type: String },
    parsedCandidate: { type: Schema.Types.Mixed },
    embedding: { type: [Number], select: false },
    pineconeId: { type: String },
    vectorSimilarity: { type: Number },
    status: {
      type: String,
      enum: ["uploaded", "processing", "analyzed", "failed"],
      default: "uploaded",
    },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

recruiterResumeSchema.index({ jobId: 1, fileHash: 1 }, { unique: true });

export const RecruiterResume =
  (mongoose.models.RecruiterResume as Model<IRecruiterResume> | undefined) ??
  mongoose.model<IRecruiterResume>("RecruiterResume", recruiterResumeSchema);
