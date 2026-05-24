import type { Document, Types } from "mongoose";

export type OtpPurpose = "email_verification" | "password_reset";

export interface IUser {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  image?: string;
  bio?: string;
  phone?: string;
  location?: string;
  emailVerified: boolean;
  emailVerificationOtp?: string | null;
  emailVerificationOtpExpires?: Date | null;
  passwordResetOtp?: string | null;
  passwordResetOtpExpires?: Date | null;
  passwordResetToken?: string;
  passwordResetTokenExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document {
  _id: Types.ObjectId;
  comparePassword(candidate: string): Promise<boolean>;
}

export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  image?: string;
  bio?: string;
  phone?: string;
  location?: string;
  emailVerified: boolean;
  createdAt: string;
}
