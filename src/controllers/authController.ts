import type { Response } from "express";
import type { AuthRequest } from "../middleware/authMiddleware";
import { authService } from "../services/authService";
import { asyncHandler } from "../utils/asyncHandler";

export const register = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await authService.register(req.body);
  res.status(201).json(result);
});

export const login = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await authService.login(req.body);
  res.json(result);
});

export const forgotPassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await authService.forgotPassword(req.body);
  res.json(result);
});

export const verifyOtp = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await authService.verifyOtp(req.body, req.user);
  res.json(result);
});

export const resendOtp = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await authService.resendOtp(req.body, req.user);
  res.json(result);
});

export const resetPassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await authService.resetPassword(req.body);
  res.json(result);
});

export const getProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await authService.getProfile(req.user!._id.toString());
  res.json({ user });
});

export const updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await authService.updateProfile(req.user!._id.toString(), req.body);
  res.json(result);
});

export const changePassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await authService.changePassword(req.user!._id.toString(), req.body);
  res.json(result);
});
