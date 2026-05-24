import jwt from "jsonwebtoken";
import { ApiError } from "./apiError";

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new ApiError(500, "JWT_SECRET is not configured");
  }
  return secret;
};

export const signAuthToken = (userId: string): string =>
  jwt.sign({ sub: userId }, getJwtSecret(), { expiresIn: "7d" });

export const signResetToken = (userId: string): string =>
  jwt.sign({ sub: userId, purpose: "password_reset" }, getJwtSecret(), {
    expiresIn: "15m",
  });

export const verifyAuthToken = (token: string): { sub: string } => {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as { sub: string };
    return payload;
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }
};

export const verifyResetToken = (token: string): { sub: string } => {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as {
      sub: string;
      purpose?: string;
    };
    if (payload.purpose !== "password_reset") {
      throw new ApiError(401, "Invalid reset token");
    }
    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, "Invalid or expired reset token");
  }
};
