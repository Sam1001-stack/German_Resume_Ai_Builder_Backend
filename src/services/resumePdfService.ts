import { execSync } from "child_process";
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

const WIN_BROWSER_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ...(process.env.LOCALAPPDATA
    ? [path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe")]
    : []),
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

const MAC_BROWSER_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const CONTAINER_LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--headless=new",
  "--single-process",
];
function isRailway(): boolean {
  return Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_NAME);
}

function isServerlessRuntime(): boolean {
  return Boolean(process.env.VERCEL) || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function fileIsExecutable(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, constants.X_OK);
    return true;
  } catch {
    return await fileExists(filePath);
  }
}

async function resolveFirstExistingPath(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }
  return null;
}

async function resolveSystemChromiumPath(): Promise<string | null> {
  for (const candidate of SYSTEM_CHROMIUM_PATHS) {
    if (await fileIsExecutable(candidate)) return candidate;
  }
  return null;
}

function resolveLinuxBrowserFromPath(): string | null {
  if (process.platform === "win32") return null;
  try {
    const result = execSync(
      "which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome 2>/dev/null",
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    ).trim();
    return result || null;
  } catch {
    return null;
  }
}

async function resolveExecutablePath(): Promise<string> {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (envPath) {
    if (await fileExists(envPath)) return envPath;
    throw new ApiError(503, `PUPPETEER_EXECUTABLE_PATH not found: ${envPath}`);
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

  if (process.platform === "win32") {
    const winPath = await resolveFirstExistingPath(WIN_BROWSER_PATHS);
    if (winPath) return winPath;
    throw new ApiError(
      503,
      "Chrome or Edge not found. Install Google Chrome or set PUPPETEER_EXECUTABLE_PATH in server/.env"
    );
  }

  if (process.platform === "darwin") {
    if (await fileExists(MAC_BROWSER_PATH)) return MAC_BROWSER_PATH;
    throw new ApiError(
      503,
      "Google Chrome not found. Install Chrome or set PUPPETEER_EXECUTABLE_PATH."
    );
  }

  const systemPath = await resolveSystemChromiumPath();
  if (systemPath) return systemPath;

  const fromPath = resolveLinuxBrowserFromPath();
  if (fromPath && (await fileExists(fromPath))) return fromPath;

  if (process.env.NODE_ENV === "production") {
    return chromium.executablePath();
  }

  throw new ApiError(
    503,
    "Chromium/Chrome not found. Install Chrome or set PUPPETEER_EXECUTABLE_PATH in server/.env"
  );
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
