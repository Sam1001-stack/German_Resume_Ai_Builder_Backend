import type { CoverLetterContent } from "../types/coverLetter";
import type { ResumeLocale } from "../types/userResume";

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function formatDate(locale: ResumeLocale): string {
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

export function buildCoverLetterHtml(
  coverLetter: CoverLetterContent,
  resumeContent: Record<string, unknown>,
  locale: ResumeLocale
): string {
  const personal = asRecord(resumeContent.personal);
  const fullName =
    `${String(personal.firstName ?? "")} ${String(personal.lastName ?? "")}`.trim() || "Applicant";
  const city = String(personal.city ?? "").trim();
  const email = String(personal.email ?? "").trim();
  const phone = String(personal.phone ?? "").trim();
  const dateLabel = formatDate(locale);

  const contactLines = [fullName, city, email, phone].filter(Boolean);

  let body = "";
  body += `<div style="margin-bottom:24px;font-size:11px;line-height:1.6;color:#52525b;">`;
  for (const line of contactLines) {
    body += `<div>${esc(line)}</div>`;
  }
  body += `<div style="margin-top:12px;">${esc(dateLabel)}</div>`;
  body += `</div>`;

  if (coverLetter.companyName) {
    body += `<div style="margin-bottom:20px;font-size:11px;color:#3f3f46;">`;
    body += `<div style="font-weight:600;">${esc(coverLetter.companyName)}</div>`;
    if (coverLetter.targetRole) {
      body += `<div style="margin-top:2px;color:#71717a;">${esc(coverLetter.targetRole)}</div>`;
    }
    body += `</div>`;
  }

  body += `<p style="margin:0 0 16px;font-size:11px;font-weight:600;color:#18181b;">${esc(coverLetter.subject)}</p>`;
  body += `<p style="margin:0 0 16px;font-size:11px;color:#3f3f46;">${esc(coverLetter.salutation)}</p>`;

  for (const paragraph of coverLetter.paragraphs) {
    body += `<p style="margin:0 0 14px;font-size:11px;line-height:1.7;color:#3f3f46;text-align:justify;">${esc(paragraph)}</p>`;
  }

  body += `<p style="margin:20px 0 8px;font-size:11px;color:#3f3f46;">${esc(coverLetter.closing)}</p>`;
  body += `<p style="margin:0;font-size:11px;font-weight:600;color:#18181b;">${esc(fullName)}</p>`;

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8" />
  <style>
    @page { size: A4; margin: 20mm; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; background: #fff; }
  </style>
</head>
<body>
  <article style="width:210mm;min-height:297mm;padding:20mm;font-family:Inter,Segoe UI,Arial,sans-serif;color:#18181b;background:#fff;">
    ${body}
  </article>
</body>
</html>`;
}
