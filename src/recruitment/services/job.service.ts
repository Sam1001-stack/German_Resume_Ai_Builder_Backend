import path from "path";
import fs from "fs/promises";
import { Types } from "mongoose";
import { RecruiterJob } from "../models/RecruiterJob";
import { RecruiterResume } from "../models/RecruiterResume";
import { ScreeningResult } from "../models/ScreeningResult";
import { ScanSession } from "../models/ScanSession";
import { ApiError } from "../../utils/apiError";
import { pdfExtractService } from "./pdfExtract.service";
import type { CreateJobInput } from "../validators/recruiterValidator";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads", "recruiter-resumes");

export const recruiterJobService = {
  async createJob(recruiterId: string, input: CreateJobInput) {
    return RecruiterJob.create({
      recruiterId,
      title: input.title,
      company: input.company,
      description: input.description,
      requiredSkills: input.requiredSkills ?? [],
      experienceLevel: input.experienceLevel ?? "mid",
      certifications: input.certifications ?? [],
      languages: input.languages ?? [],
      status: "open",
    });
  },

  async listJobs(recruiterId: string) {
    return RecruiterJob.find({ recruiterId }).sort({ updatedAt: -1 }).lean();
  },

  async getJob(jobId: string, recruiterId: string) {
    const job = await RecruiterJob.findOne({ _id: jobId, recruiterId }).lean();
    if (!job) throw new ApiError(404, "Job not found");
    return job;
  },

  async deleteJob(jobId: string, recruiterId: string) {
    const job = await RecruiterJob.findOneAndDelete({ _id: jobId, recruiterId });
    if (!job) throw new ApiError(404, "Job not found");

    const resumes = await RecruiterResume.find({ jobId });
    await Promise.all(
      resumes.map(async (r) => {
        try {
          await fs.unlink(r.filePath);
        } catch {
          /* ignore */
        }
      })
    );

    await Promise.all([
      RecruiterResume.deleteMany({ jobId }),
      ScreeningResult.deleteMany({ jobId }),
      ScanSession.deleteMany({ jobId }),
    ]);
  },

  async uploadResumes(
    jobId: string,
    recruiterId: string,
    files: Express.Multer.File[]
  ) {
    const job = await RecruiterJob.findOne({ _id: jobId, recruiterId });
    if (!job) throw new ApiError(404, "Job not found");

    const jobDir = path.join(UPLOAD_ROOT, recruiterId, jobId);
    await fs.mkdir(jobDir, { recursive: true });

    const uploaded: Array<{ id: string; fileName: string; duplicate: boolean }> = [];
    const duplicates: string[] = [];

    for (const file of files) {
      const buffer = await fs.readFile(file.path);
      const hash = pdfExtractService.hashBuffer(buffer);

      const existing = await RecruiterResume.findOne({ jobId, fileHash: hash });
      if (existing) {
        duplicates.push(file.originalname);
        await fs.unlink(file.path).catch(() => undefined);
        uploaded.push({
          id: existing._id.toString(),
          fileName: file.originalname,
          duplicate: true,
        });
        continue;
      }

      const destPath = path.join(
        jobDir,
        `${Date.now()}-${file.originalname.replace(/[^\w.\-]+/g, "_")}`
      );
      await fs.rename(file.path, destPath);

      const doc = await RecruiterResume.create({
        jobId: new Types.ObjectId(jobId),
        recruiterId: new Types.ObjectId(recruiterId),
        fileName: file.originalname,
        filePath: destPath,
        fileHash: hash,
        fileSize: file.size,
        status: "uploaded",
      });

      uploaded.push({
        id: doc._id.toString(),
        fileName: file.originalname,
        duplicate: false,
      });
    }

    return { uploaded, duplicates };
  },

  async listResumes(jobId: string, recruiterId: string) {
    const job = await RecruiterJob.findOne({ _id: jobId, recruiterId });
    if (!job) throw new ApiError(404, "Job not found");
    return RecruiterResume.find({ jobId }).sort({ createdAt: -1 }).lean();
  },

  async getResumeFile(jobId: string, resumeId: string, recruiterId: string) {
    const resume = await RecruiterResume.findOne({ _id: resumeId, jobId, recruiterId });
    if (!resume) throw new ApiError(404, "Resume not found");
    return resume;
  },

  async getScanSession(jobId: string, recruiterId: string) {
    return ScanSession.findOne({ jobId, recruiterId }).sort({ createdAt: -1 }).lean();
  },
};
