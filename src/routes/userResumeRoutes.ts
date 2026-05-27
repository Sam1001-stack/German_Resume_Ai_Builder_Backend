import { Router } from "express";
import {
  deleteUserResume,
  downloadUserResumeCoverLetterPdf,
  downloadUserResumePdf,
  getUserResume,
  listUserResumes,
  saveUserResume,
} from "../controllers/userResumeController";
import { authenticate } from "../middleware/authMiddleware";
import { validate } from "../middleware/validateMiddleware";
import { saveUserResumeSchema } from "../validators/userResumeValidator";

const router = Router();

router.use(authenticate);

router.post("/", validate(saveUserResumeSchema), saveUserResume);
router.get("/", listUserResumes);
router.get("/:id/cover-letter/pdf", downloadUserResumeCoverLetterPdf);
router.get("/:id/pdf", downloadUserResumePdf);
router.get("/:id", getUserResume);
router.delete("/:id", deleteUserResume);

export default router;
