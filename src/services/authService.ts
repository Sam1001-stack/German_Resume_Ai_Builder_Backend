import { User } from "../models/User";
import type { IUserDocument, PublicUser } from "../types/user";
import { ApiError } from "../utils/apiError";
import { signAuthToken, signResetToken, verifyResetToken } from "../utils/jwt";
import { generateOtp, hashOtp, verifyOtpValue } from "../utils/otp";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  ResendOtpInput,
  UpdateProfileInput,
  VerifyOtpInput,
} from "../validators/authValidator";
import { sendOtpEmail } from "./emailService";
import { agentDebugLog } from "../utils/agentDebugLog";

const OTP_EXPIRY_MS = 10 * 60 * 1000;

const toPublicUser = (user: IUserDocument): PublicUser => ({
  id: user._id.toString(),
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  image: user.image,
  bio: user.bio,
  phone: user.phone,
  location: user.location,
  emailVerified: user.emailVerified,
  createdAt: user.createdAt.toISOString(),
});

const clearEmailVerificationOtp = (user: IUserDocument) => {
  user.emailVerificationOtp = null;
  user.emailVerificationOtpExpires = null;
};

const clearPasswordResetOtp = (user: IUserDocument) => {
  user.passwordResetOtp = null;
  user.passwordResetOtpExpires = null;
};

const setEmailVerificationOtp = async (user: IUserDocument): Promise<string> => {
  const otp = generateOtp();
  user.emailVerificationOtp = otp;
  user.emailVerificationOtpExpires = new Date(Date.now() + OTP_EXPIRY_MS);
  await user.save();
  await sendOtpEmail(user.email, otp, "email_verification");
  return otp;
};

const setPasswordResetOtp = async (user: IUserDocument): Promise<string> => {
  const otp = generateOtp();
  user.passwordResetOtp = otp;
  user.passwordResetOtpExpires = new Date(Date.now() + OTP_EXPIRY_MS);
  user.passwordResetToken = undefined;
  user.passwordResetTokenExpires = undefined;
  await user.save();
  await sendOtpEmail(user.email, otp, "password_reset");
  return otp;
};

export const authService = {
  async register(input: RegisterInput) {
    // #region agent log
    agentDebugLog({
      location: "authService.ts:register:entry",
      message: "Register started",
      hypothesisId: "H3",
      data: { emailDomain: input.email.split("@")[1] ?? "unknown" },
    });
    // #endregion

    const existing = await User.findOne({ email: input.email.toLowerCase() });
    if (existing) {
      throw new ApiError(409, "Email is already registered");
    }

    const user = await User.create({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email.toLowerCase(),
      password: input.password,
      image: input.image || undefined,
      emailVerified: false,
    });

    // #region agent log
    agentDebugLog({
      location: "authService.ts:register:afterCreate",
      message: "User created",
      hypothesisId: "H4",
      data: { userId: user._id.toString() },
    });
    // #endregion

    await setEmailVerificationOtp(user);

    const token = signAuthToken(user._id.toString());

    // #region agent log
    agentDebugLog({
      location: "authService.ts:register:success",
      message: "Register completed",
      hypothesisId: "H5",
    });
    // #endregion

    return {
      user: toPublicUser(user),
      token,
      message: "Registration successful. Please verify your email with the OTP sent.",
    };
  },

  async login(input: LoginInput) {
    const user = await User.findOne({ email: input.email.toLowerCase() }).select(
      "+password"
    );

    if (!user || !(await user.comparePassword(input.password))) {
      throw new ApiError(401, "Invalid email or password");
    }

    const token = signAuthToken(user._id.toString());

    return {
      user: toPublicUser(user),
      token,
    };
  },

  async forgotPassword(input: ForgotPasswordInput) {
    const user = await User.findOne({ email: input.email.toLowerCase() });

    if (!user) {
      return {
        message: "If an account exists for this email, an OTP has been sent.",
      };
    }

    await setPasswordResetOtp(user);

    return {
      message: "If an account exists for this email, an OTP has been sent.",
    };
  },

  async verifyOtp(input: VerifyOtpInput, authUser?: IUserDocument) {
    if (input.purpose === "email_verification") {
      const user = authUser;
      if (!user) {
        throw new ApiError(401, "Authentication required for email verification");
      }

      const userWithOtp = await User.findById(user._id).select(
        "+emailVerificationOtp +emailVerificationOtpExpires"
      );

      if (!userWithOtp) {
        throw new ApiError(404, "User not found");
      }

      if (
        !userWithOtp.emailVerificationOtpExpires ||
        userWithOtp.emailVerificationOtpExpires < new Date()
      ) {
        clearEmailVerificationOtp(userWithOtp);
        await userWithOtp.save();
        throw new ApiError(400, "OTP has expired. Please request a new one.");
      }

      if (!verifyOtpValue(input.otp, userWithOtp.emailVerificationOtp)) {
        clearEmailVerificationOtp(userWithOtp);
        await userWithOtp.save();
        throw new ApiError(400, "Invalid OTP");
      }

      userWithOtp.emailVerified = true;
      clearEmailVerificationOtp(userWithOtp);
      await userWithOtp.save();

      return {
        user: toPublicUser(userWithOtp),
        message: "Email verified successfully",
      };
    }

    const email = input.email?.toLowerCase();
    if (!email) {
      throw new ApiError(400, "Email is required for password reset verification");
    }

    const user = await User.findOne({ email }).select(
      "+passwordResetOtp +passwordResetOtpExpires"
    );

    if (!user) {
      throw new ApiError(400, "Invalid OTP");
    }

    if (!user.passwordResetOtpExpires || user.passwordResetOtpExpires < new Date()) {
      clearPasswordResetOtp(user);
      await user.save();
      throw new ApiError(400, "OTP has expired. Please request a new one.");
    }

    if (!verifyOtpValue(input.otp, user.passwordResetOtp)) {
      clearPasswordResetOtp(user);
      await user.save();
      throw new ApiError(400, "Invalid OTP");
    }

    const resetToken = signResetToken(user._id.toString());
    clearPasswordResetOtp(user);
    user.passwordResetToken = hashOtp(resetToken);
    user.passwordResetTokenExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    return {
      resetToken,
      message: "OTP verified. You can now reset your password.",
    };
  },

  async resendOtp(input: ResendOtpInput, authUser?: IUserDocument) {
    if (input.purpose === "email_verification") {
      const user = authUser;
      if (!user) {
        throw new ApiError(401, "Authentication required");
      }

      if (user.emailVerified) {
        throw new ApiError(400, "Email is already verified");
      }

      const userWithOtp = await User.findById(user._id).select(
        "+emailVerificationOtp +emailVerificationOtpExpires"
      );

      if (!userWithOtp) {
        throw new ApiError(404, "User not found");
      }

      clearEmailVerificationOtp(userWithOtp);
      await setEmailVerificationOtp(userWithOtp);

      return { message: "Verification OTP sent" };
    }

    const email = input.email?.toLowerCase();
    if (!email) {
      throw new ApiError(400, "Email is required");
    }

    const user = await User.findOne({ email }).select(
      "+passwordResetOtp +passwordResetOtpExpires"
    );

    if (!user) {
      return { message: "If an account exists for this email, an OTP has been sent." };
    }

    clearPasswordResetOtp(user);
    await setPasswordResetOtp(user);

    return { message: "If an account exists for this email, an OTP has been sent." };
  },

  async resetPassword(input: ResetPasswordInput) {
    const payload = verifyResetToken(input.resetToken);
    const user = await User.findById(payload.sub).select(
      "+passwordResetToken +passwordResetTokenExpires +password"
    );

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    if (
      !user.passwordResetTokenExpires ||
      user.passwordResetTokenExpires < new Date() ||
      hashOtp(input.resetToken) !== user.passwordResetToken
    ) {
      throw new ApiError(400, "Reset token is invalid or expired");
    }

    user.password = input.password;
    user.passwordResetToken = undefined;
    user.passwordResetTokenExpires = undefined;
    await user.save();

    return { message: "Password reset successfully" };
  },

  async getProfile(userId: string) {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    return toPublicUser(user);
  },

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    if (input.email && input.email.toLowerCase() !== user.email) {
      const existing = await User.findOne({ email: input.email.toLowerCase() });
      if (existing) {
        throw new ApiError(409, "Email is already in use");
      }
      user.email = input.email.toLowerCase();
      user.emailVerified = false;
      clearEmailVerificationOtp(user);
      await setEmailVerificationOtp(user);
    }

    if (input.firstName !== undefined) user.firstName = input.firstName;
    if (input.lastName !== undefined) user.lastName = input.lastName;
    if (input.image !== undefined) {
      user.image = input.image || undefined;
    }
    if (input.bio !== undefined) user.bio = input.bio || undefined;
    if (input.phone !== undefined) user.phone = input.phone || undefined;
    if (input.location !== undefined) user.location = input.location || undefined;

    await user.save();

    return {
      user: toPublicUser(user),
      message: "Profile updated successfully",
    };
  },

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await User.findById(userId).select("+password");
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const isValid = await user.comparePassword(input.currentPassword);
    if (!isValid) {
      throw new ApiError(400, "Current password is incorrect");
    }

    user.password = input.newPassword;
    await user.save();

    return { message: "Password changed successfully" };
  },
};
