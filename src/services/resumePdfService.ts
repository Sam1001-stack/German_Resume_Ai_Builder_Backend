import fs from "fs/promises";
import path from "path";
import puppeteer from "puppeteer";
import type { ResumeLocale } from "../types/userResume";
import { buildResumeHtml } from "../templates/resumeHtml";
import { ApiError } from "../utils/apiError";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads", "resumes");

async function ensureUploadDir(userId: string): Promise<string> {
  const dir = path.join(UPLOAD_ROOT, userId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function generateResumePdf(
  content: Record<string, unknown>,
  locale: ResumeLocale
): Promise<Buffer> {
  const html = buildResumeHtml(content, locale);
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdf);
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF generation failed";
    throw new ApiError(500, message);
  } finally {
    await browser?.close();
  }
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
