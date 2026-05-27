import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../../middleware/authMiddleware";
import { ApiError } from "../../utils/apiError";

export function requireRecruiter(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  const user = req.user;
  if (!user) {
    next(new ApiError(401, "Authentication required"));
    return;
  }
  if (user.role !== "recruiter" && user.role !== "admin") {
    next(new ApiError(403, "Recruiter access required"));
    return;
  }
  next();
}
