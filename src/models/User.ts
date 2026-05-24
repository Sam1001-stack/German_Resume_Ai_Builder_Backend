import bcrypt from "bcryptjs";
import mongoose, { Schema, model } from "mongoose";
import type { IUserDocument } from "../types/user";

const userSchema = new Schema<IUserDocument>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    image: { type: String, trim: true },
    bio: { type: String, trim: true, maxlength: 500 },
    phone: { type: String, trim: true, maxlength: 30 },
    location: { type: String, trim: true, maxlength: 100 },
    emailVerified: { type: Boolean, default: false },
    emailVerificationOtp: { type: String, default: null, select: false },
    emailVerificationOtpExpires: { type: Date, default: null, select: false },
    passwordResetOtp: { type: String, default: null, select: false },
    passwordResetOtpExpires: { type: Date, default: null, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetTokenExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function comparePassword(
  candidate: string
): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export const User =
  mongoose.models.User ?? model<IUserDocument>("User", userSchema);
