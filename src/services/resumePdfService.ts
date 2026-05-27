import fs from "fs/promises";
import path from "path";
import puppeteer, { type Browser } from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import type { ResumeLocale } from "../types/userResume";
import { buildResumeHtml } from "../templates/resumeHtml";
import { buildCoverLetterHtml } from "../templates/coverLetterHtml";
import type { CoverLetterContent } from "../types/coverLetter";
import { ApiError } from "../utils/apiError";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads", "resumes");

function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.RAILWAY_ENVIRONMENT) ||
    Boolean(process.env.VERCEL)
  );
}

async function resolveExecutablePath(): Promise<string> {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  if (isProductionRuntime()) {
    return chromium.executablePath();
  }

  if (process.platform === "win32") {
    return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  }
  if (process.platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }

  return "/usr/bin/google-chrome-stable";
}

/** Lazily launch Puppeteer only when a PDF is requested (save or download). */
async function launchBrowser(): Promise<Browser> {
  const executablePath = await resolveExecutablePath();
  const useBundledChromium = isProductionRuntime();

  console.log("[pdf] Starting Puppeteer for resume PDF generation...");

  return puppeteer.launch({
    headless: true,
    executablePath,
    args: useBundledChromium
      ? chromium.args
      : ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    defaultViewport: { width: 1024, height: 1440 },
  });
}

async function ensureUploadDir(userId: string): Promise<string> {
  const dir = path.join(UPLOAD_ROOT, userId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function generatePdfFromHtml(html: string, label: string): Promise<Buffer> {
  let browser: Browser | undefined;

  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    console.log(`[pdf] ${label} generated successfully`);
    return Buffer.from(pdf);
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF generation failed";
    console.error(`[pdf] ${label} generation failed:`, message);
    throw new ApiError(500, message);
  } finally {
    await browser?.close();
  }
}

export async function generateResumePdf(
  content: Record<string, unknown>,
  locale: ResumeLocale
): Promise<Buffer> {
  const html = buildResumeHtml(content, locale);
  return generatePdfFromHtml(html, "Resume PDF");
}

export async function generateCoverLetterPdf(
  coverLetter: CoverLetterContent,
  resumeContent: Record<string, unknown>,
  locale: ResumeLocale
): Promise<Buffer> {
  const html = buildCoverLetterHtml(coverLetter, resumeContent, locale);
  return generatePdfFromHtml(html, "Cover letter PDF");
}

export async function saveCoverLetterPdf(
  userId: string,
  resumeId: string,
  coverLetter: CoverLetterContent,
  resumeContent: Record<string, unknown>,
  locale: ResumeLocale
): Promise<string> {
  const dir = await ensureUploadDir(userId);
  const fullPath = path.join(dir, `${resumeId}-cover-letter.pdf`);
  const pdfBuffer = await generateCoverLetterPdf(coverLetter, resumeContent, locale);
  await fs.writeFile(fullPath, pdfBuffer);
  return fullPath;
}

export async function resolveCoverLetterPdf(
  userId: string,
  resumeId: string,
  coverLetter: CoverLetterContent,
  resumeContent: Record<string, unknown>,
  locale: ResumeLocale,
  existingPath?: string | null
): Promise<{ buffer: Buffer; pdfPath: string }> {
  if (existingPath) {
    try {
      const buffer = await readResumePdf(existingPath);
      return { buffer, pdfPath: existingPath };
    } catch {
      console.log("[pdf] Cached cover letter PDF missing — regenerating...");
    }
  }

  const pdfPath = await saveCoverLetterPdf(
    userId,
    resumeId,
    coverLetter,
    resumeContent,
    locale
  );
  const buffer = await readResumePdf(pdfPath);
  return { buffer, pdfPath };
}

export async function saveResumePdf(
  userId: string,
  resumeId: string,
  content: Record<string, unknown>,
  locale: ResumeLocale
): Promise<string> {
  const dir = await ensureUploadDir(userId);
  const filename = `${resumeId}.pdf`;
  const fullPath = path.join(dir, filename);
  const pdfBuffer = await generateResumePdf(content, locale);
  await fs.writeFile(fullPath, pdfBuffer);
  return fullPath;
}

export async function resolveResumePdf(
  userId: string,
  resumeId: string,
  content: Record<string, unknown>,
  locale: ResumeLocale,
  existingPath?: string | null
): Promise<{ buffer: Buffer; pdfPath: string }> {
  if (existingPath) {
    try {
      const buffer = await readResumePdf(existingPath);
      return { buffer, pdfPath: existingPath };
    } catch {
      console.log("[pdf] Cached PDF missing — regenerating with Puppeteer...");
    }
  }

  const dir = await ensureUploadDir(userId);
  const pdfPath = path.join(dir, `${resumeId}.pdf`);
  const buffer = await generateResumePdf(content, locale);
  await fs.writeFile(pdfPath, buffer);
  return { buffer, pdfPath };
}

export async function readResumePdf(pdfPath: string): Promise<Buffer> {
  try {
    return await fs.readFile(pdfPath);
  } catch {
    throw new ApiError(404, "PDF file not found");
  }
}

export async function deleteResumePdf(pdfPath: string): Promise<void> {
  try {
    await fs.unlink(pdfPath);
  } catch {
    /* ignore missing file */
  }
}
