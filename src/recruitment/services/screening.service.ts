import { Types } from "mongoose";
import { RecruiterJob } from "../models/RecruiterJob";
import { RecruiterResume } from "../models/RecruiterResume";
import { ScreeningResult } from "../models/ScreeningResult";
import { ScanSession } from "../models/ScanSession";
import { ApiError } from "../../utils/apiError";
import { embeddingService } from "./ai/embedding.service";
import { openRouterRecruitmentService } from "./ai/openrouter.service";
import { pineconeRecruitmentService } from "./ai/pinecone.service";
import { pdfExtractService, parseCandidateFromText } from "./pdfExtract.service";
import type { IScreeningResult } from "../models/ScreeningResult";
import type { IRecruiterResume } from "../models/RecruiterResume";
import {
  buildRejectionInsights,
  computeWeightedMatchScore,
  recommendationFromScore,
  recommendationSortOrder,
  SHORTLIST_MIN_SCORE,
} from "../utils/scoring";
import {
  emitScanComplete,
  emitScanError,
  emitScanProgress,
} from "../socket";
import type {
  CandidateAnalysisResult,
  DashboardAnalytics,
  RejectedCandidateResult,
} from "../types/recruitment";

const activeScans = new Set<string>();

function mapScreeningToCandidate(
  r: IScreeningResult,
  resume: IRecruiterResume | undefined,
  idx: number
): CandidateAnalysisResult {
  return {
    rank: r.rank || idx + 1,
    candidateName: r.candidateName,
    email: r.email,
    phone: r.phone,
    location: r.location,
    matchScore: r.matchScore,
    vectorSimilarity: r.vectorSimilarity,
    experienceYears: r.experienceYears,
    currentRole: r.currentRole,
    skillsMatched: r.skillsMatched,
    missingSkills: r.missingSkills,
    education: r.education,
    languages: r.languages,
    certifications: r.certifications,
    summary: r.summary,
    strengths: r.strengths,
    weaknesses: r.weaknesses,
    rejectionReasons: r.rejectionReasons ?? [],
    loopholes: r.loopholes ?? [],
    recommendation: r.recommendation,
    resumeFile: resume?.fileName ?? "",
    resumeId: r.resumeId.toString(),
    interviewQuestions: r.interviewQuestions,
    scoreBreakdown: r.scoreBreakdown,
  };
}

export const screeningService = {
  async runJobScan(jobId: string, recruiterId: string): Promise<void> {
    if (activeScans.has(jobId)) {
      throw new ApiError(409, "Scan already in progress for this job");
    }

    const job = await RecruiterJob.findOne({ _id: jobId, recruiterId });
    if (!job) throw new ApiError(404, "Job not found");

    const resumes = await RecruiterResume.find({
      jobId,
      status: { $in: ["uploaded", "failed"] },
    });

    if (!resumes.length) {
      throw new ApiError(400, "No resumes to scan. Upload PDFs first.");
    }

    activeScans.add(jobId);

    const session = await ScanSession.create({
      jobId,
      recruiterId,
      status: "running",
      total: resumes.length,
      processed: 0,
      failed: 0,
      startedAt: new Date(),
    });

    emitScanProgress(jobId, {
      status: "running",
      total: resumes.length,
      processed: 0,
      failed: 0,
      message: "Starting AI resume scan...",
    });

    try {
      const jdText = [
        job.title,
        job.company,
        job.description,
        job.requiredSkills.join(" "),
        job.experienceLevel,
      ].join("\n");

      const jdEmbedding = await embeddingService.embedDocument(jdText);
      await pineconeRecruitmentService.upsertJobDescription({
        jobId: job._id.toString(),
        recruiterId,
        text: jdText,
      });

      let processed = 0;
      let failed = 0;

      for (const resume of resumes) {
        emitScanProgress(jobId, {
          status: "running",
          total: resumes.length,
          processed,
          failed,
          currentFile: resume.fileName,
          message: `Analyzing ${resume.fileName}...`,
        });

        try {
          await RecruiterResume.updateOne(
            { _id: resume._id },
            { status: "processing", errorMessage: undefined }
          );

          let rawText = resume.rawText;
          let fileHash = resume.fileHash;

          if (!rawText) {
            const extracted = await pdfExtractService.extractFromFile(resume.filePath);
            rawText = extracted.text;
            fileHash = extracted.hash;
          }

          const parsed = parseCandidateFromText(rawText);
          const resumeEmbedding = await embeddingService.embedDocument(rawText);
          const vectorSimilarity = embeddingService.similarity(jdEmbedding, resumeEmbedding);

          const pineconeId = await pineconeRecruitmentService.upsertResumeVector({
            id: resume._id.toString(),
            jobId: job._id.toString(),
            recruiterId,
            embedding: resumeEmbedding,
            metadata: {
              fileName: resume.fileName,
              type: "resume",
            },
          });

          const ai = await openRouterRecruitmentService.analyzeResumeAgainstJob({
            jobTitle: job.title,
            jobDescription: job.description,
            requiredSkills: job.requiredSkills,
            experienceLevel: job.experienceLevel,
            certifications: job.certifications,
            languages: job.languages,
            resumeText: rawText,
            vectorSimilarity,
          });

          const breakdown = {
            skills: ai.scoreBreakdown?.skills ?? Math.round(vectorSimilarity * 100),
            experience: ai.scoreBreakdown?.experience ?? 50,
            summary: ai.scoreBreakdown?.summary ?? 50,
            education: ai.scoreBreakdown?.education ?? 50,
            certifications: ai.scoreBreakdown?.certifications ?? 50,
            languages: ai.scoreBreakdown?.languages ?? 50,
          };

          const matchScore = computeWeightedMatchScore(breakdown);
          const recommendation = recommendationFromScore(matchScore);
          const { rejectionReasons, loopholes } = buildRejectionInsights({
            matchScore,
            recommendation,
            missingSkills: ai.missingSkills ?? [],
            weaknesses: ai.weaknesses ?? [],
            scoreBreakdown: breakdown,
            hiringRisk: ai.hiringRisk,
            rejectionReasons: ai.rejectionReasons,
            loopholes: ai.loopholes,
          });

          await RecruiterResume.updateOne(
            { _id: resume._id },
            {
              rawText,
              fileHash,
              parsedCandidate: {
                ...parsed,
                candidateName: ai.candidateName ?? parsed.candidateName,
                email: ai.email ?? parsed.email,
                phone: ai.phone ?? parsed.phone,
              },
              embedding: resumeEmbedding,
              pineconeId: pineconeId ?? undefined,
              vectorSimilarity,
              status: "analyzed",
            }
          );

          await ScreeningResult.findOneAndUpdate(
            { resumeId: resume._id },
            {
              jobId: job._id,
              recruiterId,
              matchScore,
              vectorSimilarity: Math.round(vectorSimilarity * 100),
              candidateName: ai.candidateName ?? parsed.candidateName,
              email: ai.email ?? parsed.email ?? "",
              phone: ai.phone ?? parsed.phone ?? "",
              location: ai.location ?? parsed.location ?? "",
              experienceYears: ai.experienceYears ?? parsed.experienceYears ?? 0,
              currentRole: ai.currentRole ?? parsed.currentRole ?? "",
              skillsMatched: ai.skillsMatched ?? [],
              missingSkills: ai.missingSkills ?? [],
              education: ai.education ?? parsed.education ?? "",
              languages: ai.languages ?? parsed.languages ?? [],
              certifications: ai.certifications ?? parsed.certifications ?? [],
              summary: ai.summary ?? parsed.summary ?? "",
              strengths: ai.strengths ?? [],
              weaknesses: ai.weaknesses ?? [],
              rejectionReasons,
              loopholes,
              recommendation,
              interviewQuestions: ai.interviewQuestions ?? [],
              scoreBreakdown: breakdown,
              aiRaw: ai as Record<string, unknown>,
            },
            { upsert: true, new: true }
          );

          processed++;
        } catch (error) {
          failed++;
          const message = error instanceof Error ? error.message : "Scan failed";
          await RecruiterResume.updateOne(
            { _id: resume._id },
            { status: "failed", errorMessage: message }
          );
          console.error(`[screening] Failed resume ${resume._id}:`, error);
        }

        session.processed = processed;
        session.failed = failed;
        await session.save();

        emitScanProgress(jobId, {
          status: "running",
          total: resumes.length,
          processed,
          failed,
        });
      }

      await this.assignRanks(jobId);

      session.status = "completed";
      session.completedAt = new Date();
      await session.save();

      const topCount = await ScreeningResult.countDocuments({ jobId });

      emitScanComplete(jobId, {
        topCount: Math.min(topCount, 10),
        message: "AI screening completed",
      });
    } catch (error) {
      session.status = "failed";
      session.message = error instanceof Error ? error.message : "Scan failed";
      await session.save();
      emitScanError(jobId, session.message);
      throw error;
    } finally {
      activeScans.delete(jobId);
    }
  },

  async assignRanks(jobId: string | Types.ObjectId): Promise<void> {
    const results = await ScreeningResult.find({ jobId }).sort({ matchScore: -1 });
    await Promise.all(
      results.map((r, index) =>
        ScreeningResult.updateOne({ _id: r._id }, { rank: index + 1 })
      )
    );
  },

  async getTopCandidates(
    jobId: string,
    recruiterId: string,
    limit = 10
  ): Promise<CandidateAnalysisResult[]> {
    const job = await RecruiterJob.findOne({ _id: jobId, recruiterId });
    if (!job) throw new ApiError(404, "Job not found");

    const results = await ScreeningResult.find({
      jobId,
      matchScore: { $gte: SHORTLIST_MIN_SCORE },
      recommendation: { $ne: "Not Recommended" },
    }).lean();

    const sorted = results.sort((a, b) => {
      const byRec =
        recommendationSortOrder(a.recommendation) - recommendationSortOrder(b.recommendation);
      if (byRec !== 0) return byRec;
      return b.matchScore - a.matchScore;
    });

    const top = sorted.slice(0, limit);
    const resumeIds = top.map((r) => r.resumeId);
    const resumes = await RecruiterResume.find({ _id: { $in: resumeIds } }).lean();
    const resumeMap = new Map(resumes.map((r) => [r._id.toString(), r]));

    return top.map((r, idx) =>
      mapScreeningToCandidate(r, resumeMap.get(r.resumeId.toString()), idx)
    );
  },

  async getRejectedCandidates(
    jobId: string,
    recruiterId: string
  ): Promise<RejectedCandidateResult[]> {
    const job = await RecruiterJob.findOne({ _id: jobId, recruiterId });
    if (!job) throw new ApiError(404, "Job not found");

    const [screenedRejected, failedResumes] = await Promise.all([
      ScreeningResult.find({
        jobId,
        $or: [{ matchScore: { $lt: SHORTLIST_MIN_SCORE } }, { recommendation: "Not Recommended" }],
      })
        .sort({ matchScore: 1 })
        .lean(),
      RecruiterResume.find({ jobId, status: "failed" }).lean(),
    ]);

    const resumeIds = screenedRejected.map((r) => r.resumeId);
    const resumes = await RecruiterResume.find({
      _id: { $in: [...resumeIds, ...failedResumes.map((f) => f._id)] },
    }).lean();
    const resumeMap = new Map(resumes.map((r) => [r._id.toString(), r]));

    const fromScreening: RejectedCandidateResult[] = screenedRejected.map((r, idx) => {
      const base = mapScreeningToCandidate(r, resumeMap.get(r.resumeId.toString()), idx);
      const insights =
        r.rejectionReasons?.length && r.loopholes?.length
          ? { rejectionReasons: r.rejectionReasons, loopholes: r.loopholes }
          : buildRejectionInsights({
              matchScore: r.matchScore,
              recommendation: r.recommendation,
              missingSkills: r.missingSkills,
              weaknesses: r.weaknesses,
              scoreBreakdown: r.scoreBreakdown,
              hiringRisk:
                typeof r.aiRaw?.hiringRisk === "string" ? r.aiRaw.hiringRisk : undefined,
            });

      return {
        ...base,
        rejectionReasons: insights.rejectionReasons,
        loopholes: insights.loopholes,
        scanFailed: false,
      };
    });

    const failedIds = new Set(screenedRejected.map((r) => r.resumeId.toString()));
    const fromFailed: RejectedCandidateResult[] = failedResumes
      .filter((f) => !failedIds.has(f._id.toString()))
      .map((f, idx) => ({
        rank: 0,
        candidateName: f.fileName.replace(/\.pdf$/i, ""),
        email: "",
        phone: "",
        location: "",
        matchScore: 0,
        vectorSimilarity: 0,
        experienceYears: 0,
        currentRole: "",
        skillsMatched: [],
        missingSkills: [],
        education: "",
        languages: [],
        certifications: [],
        summary: "",
        strengths: [],
        weaknesses: [],
        rejectionReasons: [
          "Resume could not be processed by the AI screening pipeline.",
          f.errorMessage ? `System error: ${f.errorMessage}` : "PDF parsing or analysis failed.",
        ],
        loopholes: [
          "Corrupted, scanned, or unreadable PDF content.",
          "Insufficient extractable text for ATS evaluation.",
        ],
        recommendation: "Not Recommended",
        resumeFile: f.fileName,
        resumeId: f._id.toString(),
        interviewQuestions: [],
        scoreBreakdown: {
          skills: 0,
          experience: 0,
          summary: 0,
          education: 0,
          certifications: 0,
          languages: 0,
        },
        scanFailed: true,
      }));

    return [...fromFailed, ...fromScreening];
  },

  async getAnalytics(jobId: string, recruiterId: string): Promise<DashboardAnalytics> {
    const job = await RecruiterJob.findOne({ _id: jobId, recruiterId });
    if (!job) throw new ApiError(404, "Job not found");

    const [totalResumes, results] = await Promise.all([
      RecruiterResume.countDocuments({ jobId }),
      ScreeningResult.find({ jobId }).lean(),
    ]);

    const skillDistribution: Record<string, number> = {};
    const experienceDistribution: Record<string, number> = {};
    const recommendationBreakdown: Record<string, number> = {};

    let scoreSum = 0;
    for (const r of results) {
      scoreSum += r.matchScore;
      recommendationBreakdown[r.recommendation] =
        (recommendationBreakdown[r.recommendation] ?? 0) + 1;

      const bucket =
        r.experienceYears >= 8
          ? "8+ years"
          : r.experienceYears >= 5
            ? "5-7 years"
            : r.experienceYears >= 2
              ? "2-4 years"
              : "0-1 years";
      experienceDistribution[bucket] = (experienceDistribution[bucket] ?? 0) + 1;

      for (const skill of r.skillsMatched) {
        skillDistribution[skill] = (skillDistribution[skill] ?? 0) + 1;
      }
    }

    return {
      totalResumes,
      analyzedResumes: results.length,
      averageScore: results.length ? Math.round(scoreSum / results.length) : 0,
      skillDistribution,
      experienceDistribution,
      recommendationBreakdown,
    };
  },
};
