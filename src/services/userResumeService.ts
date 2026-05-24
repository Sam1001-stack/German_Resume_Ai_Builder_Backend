import { Types } from "mongoose";
import { UserResume } from "../models/UserResume";
import type { ResumeLocale, SavedUserResumeResponse } from "../types/userResume";
import { ApiError } from "../utils/apiError";
import type { SaveUserResumeInput } from "../validators/userResumeValidator";
import { deleteResumePdf, readResumePdf, saveResumePdf } from "./resumePdfService";

function toResponse(doc: {
  _id: Types.ObjectId;
  clientId: string;
  title: string;
  locale: ResumeLocale;
  content: Record<string, unknown>;
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

    if (existing) {
      if (existing.pdfPath && existing.pdfPath !== pdfPath) {
        await deleteResumePdf(existing.pdfPath);
      }
      existing.title = title;
      existing.locale = input.locale;
      existing.content = input.content;
      existing.pdfPath = pdfPath;
      await existing.save();
      return toResponse(existing);
    }

    const created = await UserResume.create({
      _id: docId,
      userId,
      clientId,
      title,
      locale: input.locale,
      content: input.content,
      pdfPath,
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
    const buffer = await readResumePdf(doc.pdfPath);
    return { buffer, title: doc.title };
  },

  async remove(userId: string, id: string): Promise<void> {
    const doc = await UserResume.findOneAndDelete({ _id: id, userId });
    if (!doc) throw new ApiError(404, "Resume not found");
    await deleteResumePdf(doc.pdfPath);
  },
};
