import type { Request, Response } from "express";
import { aiService } from "../services/aiService";
import { asyncHandler } from "../utils/asyncHandler";

export const tailorFromJobDescription = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await aiService.tailorFromJobDescription(req.body);
    res.json(result);
  }
);
