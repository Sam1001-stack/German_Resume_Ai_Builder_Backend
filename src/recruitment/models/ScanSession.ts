import mongoose, { Schema, type Model } from "mongoose";
import type { ScanSessionStatus } from "../types/recruitment";

export interface IScanSession {
  jobId: mongoose.Types.ObjectId;
  recruiterId: mongoose.Types.ObjectId;
  status: ScanSessionStatus;
  total: number;
  processed: number;
  failed: number;
  message?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const scanSessionSchema = new Schema<IScanSession>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "RecruiterJob", required: true, index: true },
    recruiterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["idle", "running", "completed", "failed"],
      default: "idle",
    },
    total: { type: Number, default: 0 },
    processed: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    message: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

export const ScanSession =
  (mongoose.models.ScanSession as Model<IScanSession> | undefined) ??
  mongoose.model<IScanSession>("ScanSession", scanSessionSchema);
