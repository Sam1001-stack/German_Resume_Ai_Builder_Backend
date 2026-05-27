import { Types } from "mongoose";
import { UserResume } from "../models/UserResume";
import type { CoverLetterContent } from "../types/coverLetter";
import type { ResumeLocale, SavedUserResumeResponse } from "../types/userResume";
import { ApiError } from "../utils/apiError";
import type { SaveUserResumeInput } from "../validators/userResumeValidator";
import { aiService } from "./aiService";
import {
  deleteResumePdf,
  resolveCoverLetterPdf,
  resolveResumePdf,
  saveCoverLetterPdf,
  saveResumePdf,
} from "./resumePdfService";

function toResponse(doc: {
  _id: Types.ObjectId;
  clientId: string;
  title: string;
  locale: ResumeLocale;
  content: Record<string, unknown>;
  coverLetter?: CoverLetterContent;
  updatedAt: Date;
  createdAt: Date;
}): SavedUserResumeResponse {
  return {
    _id: doc._id.toString(),
    clientId: doc.clientId,
    title: doc.title,
    locale: doc.locale,
    content: doc.content,
    updatedAt: doc.updatedAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    hasCoverLetter: Boolean(doc.coverLetter),
    coverLetter: doc.coverLetter,
  };
}

function getClientId(content: Record<string, unknown>): string {
  const id = content.id;
  if (typeof id === "string" && id.trim()) return id.trim();
  throw new ApiError(400, "Resume content must include an id");
}

function getTitle(content: Record<string, unknown>): string {
  const title = content.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  return "Untitled Resume";
}

function getResumeType(content: Record<string, unknown>): "professional" | "werkstudent" {
  return content.resumeType === "werkstudent" ? "werkstudent" : "professional";
}

async function maybeGenerateCoverLetter(
  userId: string,
  docId: string,
  input: SaveUserResumeInput,
  existingCoverLetterPdfPath?: string | null
): Promise<{ coverLetter?: CoverLetterContent; coverLetterPdfPath?: string }> {
  const jobDescription = input.jobDescription?.trim();
  if (!jobDescription || jobDescription.length < 20) {
    return {};
  }

  try {
    const coverLetter = await aiService.generateCoverLetter({
      locale: input.locale,
      resumeType: getResumeType(input.content),
      jobDescription,
      companyName: input.companyName?.trim() || undefined,
      targetRole: input.targetRole?.trim() || undefined,
      resumeContent: input.content,
    });

    if (existingCoverLetterPdfPath) {
      await deleteResumePdf(existingCoverLetterPdfPath);
    }

    const coverLetterPdfPath = await saveCoverLetterPdf(
      userId,
      docId,
      coverLetter,
      input.content,
      input.locale
    );

    return { coverLetter, coverLetterPdfPath };
  } catch (error) {
    console.error("[cover-letter] Failed to generate cover letter on save:", error);
    return {};
  }
}

export const userResumeService = {
  async save(userId: string, input: SaveUserResumeInput): Promise<SavedUserResumeResponse> {
    const clientId = getClientId(input.content);
    const title = getTitle(input.content);
    const serverId =
      typeof input.content.serverId === "string" ? input.content.serverId : undefined;

    let existing = serverId
      ? await UserResume.findOne({ _id: serverId, userId })
      : await UserResume.findOne({ userId, clientId });

    const docId = existing?._id ?? new Types.ObjectId();
    const pdfPath = await saveResumePdf(
      userId,
      docId.toString(),
      input.content,
      input.locale
    );

    const coverLetterResult = await maybeGenerateCoverLetter(
      userId,
      docId.toString(),
      input,
      existing?.coverLetterPdfPath
    );

    const sharedFields = {
      title,
      locale: input.locale,
      content: input.content,
      pdfPath,
      jobDescription: input.jobDescription?.trim() || undefined,
      companyName: input.companyName?.trim() || undefined,
      targetRole: input.targetRole?.trim() || undefined,
      ...(coverLetterResult.coverLetter
        ? {
            coverLetter: coverLetterResult.coverLetter,
            coverLetterPdfPath: coverLetterResult.coverLetterPdfPath,
          }
        : {}),
    };

    if (existing) {
      if (existing.pdfPath && existing.pdfPath !== pdfPath) {
        await deleteResumePdf(existing.pdfPath);
      }
      Object.assign(existing, sharedFields);
      await existing.save();
      return toResponse(existing);
    }

    const created = await UserResume.create({
      _id: docId,
      userId,
      clientId,
      ...sharedFields,
    });

    return toResponse(created);
  },

  async list(userId: string): Promise<SavedUserResumeResponse[]> {
    const docs = await UserResume.find({ userId }).sort({ updatedAt: -1 });
    return docs.map(toResponse);
  },

  async getById(userId: string, id: string): Promise<SavedUserResumeResponse> {
    const doc = await UserResume.findOne({ _id: id, userId });
    if (!doc) throw new ApiError(404, "Resume not found");
    return toResponse(doc);
  },

  async getPdf(userId: string, id: string): Promise<{ buffer: Buffer; title: string }> {
    const doc = await UserResume.findOne({ _id: id, userId });
    if (!doc) throw new ApiError(404, "Resume not found");

    const { buffer, pdfPath } = await resolveResumePdf(
      userId,
      doc._id.toString(),
      doc.content,
      doc.locale,
      doc.pdfPath
    );

    if (doc.pdfPath !== pdfPath) {
      doc.pdfPath = pdfPath;
      await doc.save();
    }

    return { buffer, title: doc.title };
  },

  async getCoverLetterPdf(
    userId: string,
    id: string
  ): Promise<{ buffer: Buffer; title: string }> {
    const doc = await UserResume.findOne({ _id: id, userId });
    if (!doc) throw new ApiError(404, "Resume not found");
    if (!doc.coverLetter) {
      throw new ApiError(404, "Cover letter not found. Save the resume with a job description first.");
    }

    const { buffer, pdfPath } = await resolveCoverLetterPdf(
      userId,
      doc._id.toString(),
      doc.coverLetter,
      doc.content,
      doc.locale,
      doc.coverLetterPdfPath
    );

    if (doc.coverLetterPdfPath !== pdfPath) {
      doc.coverLetterPdfPath = pdfPath;
      await doc.save();
    }

    return { buffer, title: `${doc.title} - Cover Letter` };
  },

  async remove(userId: string, id: string): Promise<void> {
    const doc = await UserResume.findOneAndDelete({ _id: id, userId });
    if (!doc) throw new ApiError(404, "Resume not found");
    await deleteResumePdf(doc.pdfPath);
    if (doc.coverLetterPdfPath) {
      await deleteResumePdf(doc.coverLetterPdfPath);
    }
  },
};
