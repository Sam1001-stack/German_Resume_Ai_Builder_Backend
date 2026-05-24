import type { Document, Types } from "mongoose";

export type ResumeLocale = "en" | "de";

export interface IUserResume {
  userId: Types.ObjectId;
  clientId: string;
  locale: ResumeLocale;
  title: string;
  content: Record<string, unknown>;
  pdfPath: string;
}

export interface IUserResumeDocument extends IUserResume, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavedUserResumeResponse {
  _id: string;
  clientId: string;
  title: string;
  locale: ResumeLocale;
  content: Record<string, unknown>;
  updatedAt: string;
  createdAt: string;
}
