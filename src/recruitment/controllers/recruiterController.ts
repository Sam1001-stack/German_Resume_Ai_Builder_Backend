import type { Response } from "express";
import type { AuthRequest } from "../../middleware/authMiddleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/apiError";
import { recruiterJobService } from "../services/job.service";
import { screeningService } from "../services/screening.service";
import { routeParam } from "../utils/params";

export const createJob = asyncHandler(async (req: AuthRequest, res: Response) => {
  const job = await recruiterJobService.createJob(req.user!._id.toString(), req.body);
  res.status(201).json({ job });
});

export const listJobs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const jobs = await recruiterJobService.listJobs(req.user!._id.toString());
  res.json({ jobs });
});

export const getJob = asyncHandler(async (req: AuthRequest, res: Response) => {
  const jobId = routeParam(req.params.jobId);
  const job = await recruiterJobService.getJob(jobId, req.user!._id.toString());
  res.json({ job });
});

export const deleteJob = asyncHandler(async (req: AuthRequest, res: Response) => {
  const jobId = routeParam(req.params.jobId);
  await recruiterJobService.deleteJob(jobId, req.user!._id.toString());
  res.json({ message: "Job deleted" });
});

export const uploadResumes = asyncHandler(async (req: AuthRequest, res: Response) => {
  const jobId = routeParam(req.params.jobId);
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files?.length) {
    throw new ApiError(400, "No PDF files uploaded");
  }

  const result = await recruiterJobService.uploadResumes(
    jobId,
    req.user!._id.toString(),
    files
  );

  res.status(201).json(result);
});

export const listResumes = asyncHandler(async (req: AuthRequest, res: Response) => {
  const jobId = routeParam(req.params.jobId);
  const resumes = await recruiterJobService.listResumes(jobId, req.user!._id.toString());
  res.json({ resumes });
});

export const downloadResume = asyncHandler(async (req: AuthRequest, res: Response) => {
  const resume = await recruiterJobService.getResumeFile(
    routeParam(req.params.jobId),
    routeParam(req.params.resumeId),
    req.user!._id.toString()
  );

  res.download(resume.filePath, resume.fileName);
});

export const startScan = asyncHandler(async (req: AuthRequest, res: Response) => {
  const jobId = routeParam(req.params.jobId);
  const recruiterId = req.user!._id.toString();

  res.status(202).json({ message: "Scan started", jobId });

  setImmediate(() => {
    screeningService.runJobScan(jobId, recruiterId).catch((error) => {
      console.error("[recruiter] Background scan failed:", error);
    });
  });
});

export const getDashboard = asyncHandler(async (req: AuthRequest, res: Response) => {
  const jobId = routeParam(req.params.jobId);
  const recruiterId = req.user!._id.toString();

  const [job, topCandidates, rejectedCandidates, analytics, resumes, scanSession] =
    await Promise.all([
      recruiterJobService.getJob(jobId, recruiterId),
      screeningService.getTopCandidates(jobId, recruiterId, 50),
      screeningService.getRejectedCandidates(jobId, recruiterId),
      screeningService.getAnalytics(jobId, recruiterId),
      recruiterJobService.listResumes(jobId, recruiterId),
      recruiterJobService.getScanSession(jobId, recruiterId),
    ]);

  res.json({
    job,
    topCandidates,
    rejectedCandidates,
    analytics,
    resumes,
    scanSession,
  });
});

export const getTopCandidates = asyncHandler(async (req: AuthRequest, res: Response) => {
  const topCandidates = await screeningService.getTopCandidates(
    routeParam(req.params.jobId),
    req.user!._id.toString(),
    10
  );
  res.json({ topCandidates });
});

export const getScanStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const scanSession = await recruiterJobService.getScanSession(
    routeParam(req.params.jobId),
    req.user!._id.toString()
  );
  res.json({ scanSession });
});
