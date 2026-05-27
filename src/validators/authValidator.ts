import { z } from "zod";

const imageSchema = z
  .string()
  .trim()
  .max(3_000_000, "Image is too large")
  .optional()
  .or(z.literal(""))
  .refine(
    (value) =>
      !value || value.startsWith("data:image/") || /^https?:\/\/.+/i.test(value),
    { message: "Invalid image format" }
  );

export const registerSchema = z.object({
  firstName: z.string().trim().min(2, "First name must be at least 2 characters"),
  lastName: z.string().trim().min(2, "Last name must be at least 2 characters"),
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  image: imageSchema,
  role: z.enum(["user", "recruiter"]).default("user"),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
});

export const verifyOtpSchema = z.object({
  otp: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d+$/, "OTP must contain only digits"),
  purpose: z.enum(["email_verification", "password_reset"]),
  email: z.string().trim().email("Invalid email address").optional(),
});

export const resendOtpSchema = z.object({
  purpose: z.enum(["email_verification", "password_reset"]),
  email: z.string().trim().email("Invalid email address").optional(),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm password is required"),
    resetToken: z.string().min(1, "Reset token is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(2, "First name must be at least 2 characters").optional(),
  lastName: z.string().trim().min(2, "Last name must be at least 2 characters").optional(),
  email: z.string().trim().email("Invalid email address").optional(),
  image: imageSchema,
  bio: z.string().trim().max(500, "Bio must be at most 500 characters").optional().or(z.literal("")),
  phone: z.string().trim().max(30, "Phone must be at most 30 characters").optional().or(z.literal("")),
  location: z.string().trim().max(100, "Location must be at most 100 characters").optional().or(z.literal("")),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm password is required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ResendOtpInput = z.infer<typeof resendOtpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
