import { Router } from "express";
import {
  changePassword,
  forgotPassword,
  getProfile,
  login,
  register,
  resendOtp,
  resetPassword,
  updateProfile,
  verifyOtp,
} from "../controllers/authController";
import { authenticate } from "../middleware/authMiddleware";
import { optionalAuthenticate } from "../middleware/optionalAuthMiddleware";
import { validate } from "../middleware/validateMiddleware";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendOtpSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyOtpSchema,
} from "../validators/authValidator";

const router = Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
router.post("/verify-otp", optionalAuthenticate, validate(verifyOtpSchema), verifyOtp);
router.post("/resend-otp", optionalAuthenticate, validate(resendOtpSchema), resendOtp);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);

router.get("/profile", authenticate, getProfile);
router.put("/profile", authenticate, validate(updateProfileSchema), updateProfile);
router.put("/change-password", authenticate, validate(changePasswordSchema), changePassword);

export default router;
