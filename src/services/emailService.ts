import type { OtpPurpose } from "../types/user";

const getSmtpConfig = () => ({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  email: process.env.SMTP_EMAIL,
  pass: process.env.SMTP_PASS,
});

const isSmtpConfigured = (): boolean => {
  const { host, email, pass } = getSmtpConfig();
  return Boolean(host && email && pass);
};

const logOtpToConsole = (email: string, otp: string, purpose: OtpPurpose) => {
  const label =
    purpose === "email_verification" ? "Email verification" : "Password reset";
  console.log(`[OTP] ${label} code for ${email}: ${otp}`);
};

const getEmailContent = (otp: string, purpose: OtpPurpose) => {
  const isVerification = purpose === "email_verification";

  const subject = isVerification
    ? "Verify your ResumeAI email"
    : "Reset your ResumeAI password";

  const heading = isVerification ? "Email Verification" : "Password Reset";
  const message = isVerification
    ? "Use the code below to verify your email address:"
    : "Use the code below to reset your password:";

  const text = `${heading}\n\n${message}\n\n${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, you can ignore this email.`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #6d28d9; margin-bottom: 8px;">${heading}</h2>
      <p style="color: #52525b; line-height: 1.5;">${message}</p>
      <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #18181b; margin: 24px 0;">${otp}</p>
      <p style="color: #71717a; font-size: 14px;">This code expires in 10 minutes.</p>
      <p style="color: #a1a1aa; font-size: 12px; margin-top: 24px;">If you did not request this, you can ignore this email.</p>
    </div>
  `;

  return { subject, text, html };
};

async function sendViaSmtp(
  to: string,
  otp: string,
  purpose: OtpPurpose
): Promise<boolean> {
  try {
    const nodemailer = await import("nodemailer");
    const { host, port, email, pass } = getSmtpConfig();
    const transporter = nodemailer.default.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user: email, pass },
    });
    const { subject, text, html } = getEmailContent(otp, purpose);

    await transporter.sendMail({
      from: `"ResumeAI" <${email}>`,
      to,
      subject,
      text,
      html,
    });

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn(`[OTP] Email send skipped (${message}). Using console fallback.`);
    return false;
  }
}

export const sendOtpEmail = async (
  email: string,
  otp: string,
  purpose: OtpPurpose
): Promise<void> => {
  if (isSmtpConfigured()) {
    const sent = await sendViaSmtp(email, otp, purpose);
    if (sent) {
      console.log(`[OTP] Email sent to ${email}`);
      return;
    }
  } else {
    console.warn("[OTP] SMTP not configured. OTP logged to console instead.");
  }

  logOtpToConsole(email, otp, purpose);
};
