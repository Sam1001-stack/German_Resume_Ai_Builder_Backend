import { Router } from "express";
import { authenticate } from "../../middleware/authMiddleware";
import { validate } from "../../middleware/validateMiddleware";
import { requireRecruiter } from "../middleware/requireRecruiter";
import { uploadResumesMiddleware } from "../middleware/uploadResumes";
import { createJobSchema } from "../validators/recruiterValidator";
import {
  createJob,
  deleteJob,
  downloadResume,
  getDashboard,
  getJob,
  getScanStatus,
  getTopCandidates,
  listJobs,
  listResumes,
  startScan,
  uploadResumes,
} from "../controllers/recruiterController";

const router = Router();

router.use(authenticate, requireRecruiter);

router.post("/jobs", validate(createJobSchema), createJob);
router.get("/jobs", listJobs);
router.get("/jobs/:jobId", getJob);
router.delete("/jobs/:jobId", deleteJob);

router.post(
  "/jobs/:jobId/resumes",
  uploadResumesMiddleware.array("resumes", 25),
  uploadResumes
);

router.get("/jobs/:jobId/resumes", listResumes);
router.get("/jobs/:jobId/resumes/:resumeId/download", downloadResume);

router.post("/jobs/:jobId/scan", startScan);
router.get("/jobs/:jobId/scan/status", getScanStatus);
router.get("/jobs/:jobId/dashboard", getDashboard);
router.get("/jobs/:jobId/top-candidates", getTopCandidates);

export default router;
