import type { Document, Types } from "mongoose";
import type { CoverLetterContent } from "./coverLetter";

export type ResumeLocale = "en" | "de";

export interface IUserResume {
  userId: Types.ObjectId;
  clientId: string;
  locale: ResumeLocale;
  title: string;
  content: Record<string, unknown>;
  pdfPath: string;
  jobDescription?: string;
  companyName?: string;
  targetRole?: string;
  coverLetter?: CoverLetterContent;
  coverLetterPdfPath?: string;
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
  hasCoverLetter: boolean;
  coverLetter?: CoverLetterContent;
}
