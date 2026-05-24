import type { NextFunction, Response } from "express";
import { User } from "../models/User";
import type { AuthRequest } from "../middleware/authMiddleware";
import { verifyAuthToken } from "../utils/jwt";

export const optionalAuthenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      next();
      return;
    }

    const token = header.slice(7);
    const payload = verifyAuthToken(token);
    const user = await User.findById(payload.sub);

    if (user) {
      req.user = user;
    }

    next();
  } catch {
    next();
  }
};
