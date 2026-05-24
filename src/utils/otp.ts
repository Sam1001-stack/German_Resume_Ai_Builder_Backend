import crypto from "crypto";

export const generateOtp = (): string =>
  crypto.randomInt(100000, 999999).toString();

export const hashOtp = (otp: string): string =>
  crypto.createHash("sha256").update(otp).digest("hex");

export const verifyOtpValue = (input: string, stored?: string | null): boolean => {
  if (!stored) return false;
  return input === stored;
};
