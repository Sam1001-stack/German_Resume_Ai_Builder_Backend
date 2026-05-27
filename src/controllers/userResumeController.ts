import type { Response } from "express";
import type { AuthRequest } from "../middleware/authMiddleware";
import { userResumeService } from "../services/userResumeService";
import { asyncHandler } from "../utils/asyncHandler";

export const saveUserResume = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await userResumeService.save(req.user!._id.toString(), req.body);
  res.status(201).json(result);
});

export const listUserResumes = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await userResumeService.list(req.user!._id.toString());
  res.json(result);
});

export const getUserResume = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await userResumeService.getById(req.user!._id.toString(), String(req.params.id));
  res.json(result);
});

export const downloadUserResumePdf = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { buffer, title } = await userResumeService.getPdf(
    req.user!._id.toString(),
    String(req.params.id)
  );
  const safeName = title.replace(/[^\w\-]+/g, "_") || "resume";
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}.pdf"`);
  res.send(buffer);
});

export const downloadUserResumeCoverLetterPdf = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { buffer, title } = await userResumeService.getCoverLetterPdf(
      req.user!._id.toString(),
      String(req.params.id)
    );
    const safeName = title.replace(/[^\w\-]+/g, "_") || "cover_letter";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.pdf"`);
    res.send(buffer);
  }
);

export const deleteUserResume = asyncHandler(async (req: AuthRequest, res: Response) => {
  await userResumeService.remove(req.user!._id.toString(), String(req.params.id));
  res.json({ message: "Resume deleted" });
});
