import fs from "fs/promises";
import { constants } from "fs";


import path from "path";
import puppeteer, { type Browser } from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import type { ResumeLocale } from "../types/userResume";
import { buildResumeHtml } from "../templates/resumeHtml";
import { buildCoverLetterHtml } from "../templates/coverLetterHtml";
import type { CoverLetterContent } from "../types/coverLetter";
import { ApiError } from "../utils/apiError";
import { agentDebugLog } from "../utils/agentDebugLog";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads", "resumes");

const SYSTEM_CHROMIUM_PATHS = [
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome-stable",
];

const CONTAINER_LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--headless=new",
  "--single-process",
];

import { execSync } from "child_process";

try {
  console.log("chromium:");
  console.log(execSync("which chromium").toString());
} catch (e) {
  console.log("chromium NOT found");
}

try {
  console.log("chromium-browser:");
  console.log(execSync("which chromium-browser").toString());
} catch (e) {
  console.log("chromium-browser NOT found");
}

try {
  console.log("google-chrome:");
  console.log(execSync("which google-chrome").toString());
} catch (e) {
  console.log("google-chrome NOT found");
}

function isRailway(): boolean {
  return Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_NAME);
}

function isServerlessRuntime(): boolean {
  return Boolean(process.env.VERCEL) || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
}

async function fileIsExecutable(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveSystemChromiumPath(): Promise<string | null> {
  for (const candidate of SYSTEM_CHROMIUM_PATHS) {
    if (await fileIsExecutable(candidate)) return candidate;
  }
  return null;
}

async function resolveExecutablePath(): Promise<string> {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  // Railway: use apt-installed Chromium (see nixpacks.toml), not @sparticuz /tmp binary
  if (isRailway()) {
    const systemPath = await resolveSystemChromiumPath();
    if (systemPath) return systemPath;
    throw new ApiError(
      503,
      "Chromium is not installed on the server. Redeploy after adding nixpacks.toml or set PUPPETEER_EXECUTABLE_PATH."
    );
  }

  if (isServerlessRuntime()) {
    return chromium.executablePath();
  }

  if (process.env.NODE_ENV === "production") {
    const systemPath = await resolveSystemChromiumPath();
    if (systemPath) return systemPath;
    return chromium.executablePath();
  }

  if (process.platform === "win32") {
    return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  }
  if (process.platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }

  const systemPath = await resolveSystemChromiumPath();
  return systemPath ?? "/usr/bin/google-chrome-stable";
}

/** Lazily launch Puppeteer only when a PDF is requested (save or download). */
async function launchBrowser(): Promise<Browser> {
  const useSparticuz = isServerlessRuntime() && !isRailway();

  if (useSparticuz) {
    chromium.setGraphicsMode = false;
  }

  const executablePath = await resolveExecutablePath();
  const launchArgs = useSparticuz
    ? [...chromium.args, ...CONTAINER_LAUNCH_ARGS]
    : CONTAINER_LAUNCH_ARGS;

  console.log(`[pdf] Launching Puppeteer (${executablePath})...`);

  // #region agent log
  agentDebugLog({
    location: "resumePdfService.ts:launchBrowser",
    message: "Puppeteer launch config",
    hypothesisId: "PDF-RAILWAY",
    data: {
      executablePath,
      isRailway: isRailway(),
      useSparticuz,
      argCount: launchArgs.length,
    },
  });
  // #endregion

  return puppeteer.launch({
    headless: true,
    executablePath,
    args: launchArgs,
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
