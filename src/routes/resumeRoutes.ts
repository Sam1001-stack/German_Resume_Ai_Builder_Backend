import { Router, type Request, type Response } from "express";
import { Resume } from "../models/Resume";

const router = Router();

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";

router.get("/", async (_req: Request, res: Response) => {
  try {
    const resumes = await Resume.find().sort({ updatedAt: -1 });
    res.json(resumes);
  } catch (error) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const resume = await Resume.findById(req.params.id);
    if (!resume) {
      res.status(404).json({ message: "Resume not found" });
      return;
    }
    res.json(resume);
  } catch (error) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const resume = await Resume.create(req.body);
    res.status(201).json(resume);
  } catch (error) {
    res.status(400).json({ message: getErrorMessage(error) });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const resume = await Resume.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!resume) {
      res.status(404).json({ message: "Resume not found" });
      return;
    }
    res.json(resume);
  } catch (error) {
    res.status(400).json({ message: getErrorMessage(error) });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const resume = await Resume.findByIdAndDelete(req.params.id);
    if (!resume) {
      res.status(404).json({ message: "Resume not found" });
      return;
    }
    res.json({ message: "Resume deleted" });
  } catch (error) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
});

export default router;
