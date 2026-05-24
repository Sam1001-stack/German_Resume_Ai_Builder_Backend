import { Router } from "express";
import { tailorFromJobDescription } from "../controllers/aiController";
import { validate } from "../middleware/validateMiddleware";
import { tailorFromJobSchema } from "../validators/aiValidator";

const router = Router();

router.post(
  "/tailor-from-job",
  validate(tailorFromJobSchema),
  tailorFromJobDescription
);

export default router;
