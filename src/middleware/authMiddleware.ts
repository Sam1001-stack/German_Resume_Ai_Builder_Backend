import type { NextFunction, Request, Response } from "express";
import { User } from "../models/User";
import type { IUserDocument } from "../types/user";
import { ApiError } from "../utils/apiError";
import { verifyAuthToken } from "../utils/jwt";

export interface AuthRequest extends Request {
  user?: IUserDocument;
}

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new ApiError(401, "Authentication required");
    }

    const token = header.slice(7);
    const payload = verifyAuthToken(token);
    const user = await User.findById(payload.sub);

    if (!user) {
      throw new ApiError(401, "User not found");
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
