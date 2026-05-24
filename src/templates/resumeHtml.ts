import type { ResumeLocale } from "../types/userResume";
import { formatMonthYear } from "../utils/formatDate";

type ResumeContent = Record<string, unknown>;

const labels = {
  summary: { en: "Summary", de: "Profil" },
  skills: { en: "Skills", de: "Fähigkeiten" },
  experience: { en: "Experience", de: "Berufserfahrung" },
  education: { en: "Education", de: "Ausbildung" },
  projects: { en: "Projects", de: "Projekte" },
  languages: { en: "Languages", de: "Sprachen" },
  certifications: { en: "Certifications", de: "Zertifikate" },
  present: { en: "Present", de: "heute" },
  resumeTypeProfessional: { en: "Professional Resume", de: "Professioneller Lebenslauf" },
  resumeTypeWerkstudent: { en: "Werkstudent Resume", de: "Werkstudent-Lebenslauf" },
  werkstudent: { en: "Werkstudent Information", de: "Werkstudent-Angaben" },
  visaStatus: { en: "Visa / Work Permit", de: "Visum / Arbeitserlaubnis" },
  taxId: { en: "Tax ID (Steuer-ID)", de: "Steuer-ID" },
  socialSecurityNo: { en: "Social Security No.", de: "Sozialversicherungsnummer" },
  availability: { en: "Availability", de: "Verfügbarkeit" },
  enrollment: { en: "University Enrollment", de: "Hochschuleinschreibung" },
} as const;

function label(locale: ResumeLocale, key: keyof typeof labels): string {
  return labels[key][locale];
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function templatePadding(templateId: string): string {
  switch (templateId) {
    case "minimal":
      return "48px";
    case "creative":
      return "32px";
    default:
      return "40px";
  }
}

function templateExtras(templateId: string, primary: string, accent: string): string {
  if (templateId === "corporate") {
    return `<div style="height:4px;width:64px;border-radius:4px;background:${esc(primary)};margin-bottom:24px;"></div>`;
  }
  if (templateId === "startup") {
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
      <div style="width:8px;height:8px;border-radius:50%;background:${esc(accent)};"></div>
      <span style="font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;color:#71717a;">Resume</span>
    </div>`;
  }
  return "";
}

function articleStyle(templateId: string, primary: string): string {
  const base =
    "width:210mm;min-height:297mm;background:#fff;color:#18181b;box-sizing:border-box;font-family:Inter,Segoe UI,Arial,sans-serif;";
  const padding = `padding:${templatePadding(templateId)};`;
  const corporate = templateId === "corporate" ? "background:#fafafa;" : "";
  const creative =
    templateId === "creative" ? `border-left:8px solid ${esc(primary)};` : "";
  const minimal = templateId === "minimal" ? "font-weight:300;" : "";
  return base + padding + corporate + creative + minimal;
}

function sectionTitle(primary: string, text: string): string {
  return `<h2 style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${esc(primary)};">${esc(text)}</h2>`;
}

export function buildResumeHtml(content: ResumeContent, locale: ResumeLocale): string {
  const personal = asRecord(content.personal);
  const theme = asRecord(content.theme);
  const werkstudent = asRecord(content.werkstudent);
  const templateId = String(content.templateId ?? "german-ats");
  const resumeType = String(content.resumeType ?? "professional");
  const primary = String(theme.primary ?? "#312e81");
  const accent = String(theme.accent ?? "#4f46e5");
  const fullName = `${String(personal.firstName ?? "")} ${String(personal.lastName ?? "")}`.trim();
  const typeLabel =
    resumeType === "werkstudent"
      ? label(locale, "resumeTypeWerkstudent")
      : label(locale, "resumeTypeProfessional");
  const dateFmt = (d: string) => formatMonthYear(d, locale);

  const locationLine = [personal.address, personal.city, personal.country]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .join(", ");

  const werkstudentRows = [
    { label: label(locale, "visaStatus"), value: String(werkstudent.visaStatus ?? "") },
    { label: label(locale, "taxId"), value: String(werkstudent.taxId ?? "") },
    { label: label(locale, "socialSecurityNo"), value: String(werkstudent.socialSecurityNo ?? "") },
    { label: label(locale, "availability"), value: String(werkstudent.availability ?? "") },
    { label: label(locale, "enrollment"), value: String(werkstudent.universityEnrollment ?? "") },
  ];

  let body = "";

  body += `<header style="border-bottom:2px solid ${esc(primary)};padding-bottom:16px;">`;
  body += `<h1 style="margin:0;font-size:24px;font-weight:700;color:${esc(primary)};">${esc(fullName || "Your Name")}</h1>`;
  if (personal.headline) {
    body += `<p style="margin:4px 0 0;font-size:14px;font-weight:500;color:#52525b;">${esc(personal.headline)}</p>`;
  }
  body += `<p style="margin:8px 0 0;display:inline-block;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:600;text-transform:uppercase;background:${esc(primary)}18;color:${esc(primary)};">${esc(typeLabel)}</p>`;
  body += `<div style="margin-top:8px;font-size:12px;color:#52525b;">`;
  if (personal.email || personal.phone) {
    body += `<div style="display:flex;flex-wrap:wrap;gap:16px;">`;
    if (personal.email) body += `<span>${esc(personal.email)}</span>`;
    if (personal.phone) body += `<span>${esc(personal.phone)}</span>`;
    body += `</div>`;
  }
  if (locationLine) body += `<div>${esc(locationLine)}</div>`;
  body += `</div></header>`;

  if (resumeType === "werkstudent") {
    body += `<section style="margin-top:16px;">${sectionTitle(primary, label(locale, "werkstudent"))}`;
    body += `<dl style="margin:0;font-size:10px;color:#3f3f46;">`;
    for (const row of werkstudentRows) {
      body += `<div style="display:flex;gap:8px;margin-bottom:4px;"><dt style="min-width:7rem;font-weight:600;color:#52525b;">${esc(row.label)}:</dt><dd style="margin:0;">${row.value.trim() ? esc(row.value) : "—"}</dd></div>`;
    }
    body += `</dl></section>`;
  }

  const summary = String(content.summary ?? "");
  if (summary) {
    body += `<section style="margin-top:20px;">${sectionTitle(primary, label(locale, "summary"))}`;
    body += `<p style="margin:0;font-size:11px;line-height:1.6;color:#3f3f46;">${esc(summary)}</p></section>`;
  }

  const skills = asArray<string>(content.skills).filter(Boolean);
  if (skills.length) {
    body += `<section style="margin-top:20px;">${sectionTitle(primary, label(locale, "skills"))}`;
    body += `<p style="margin:0;font-size:11px;color:#3f3f46;">${esc(skills.join(" · "))}</p></section>`;
  }

  const experience = asArray<Record<string, unknown>>(content.experience);
  if (experience.length) {
    body += `<section style="margin-top:20px;">${sectionTitle(primary, label(locale, "experience"))}<div>`;
    for (const exp of experience) {
      const bullets = asArray<string>(exp.bullets).filter(Boolean);
      body += `<div style="margin-bottom:16px;">`;
      body += `<div style="display:flex;justify-content:space-between;gap:8px;">`;
      body += `<div><p style="margin:0;font-size:11px;font-weight:600;">${esc(exp.position)}</p>`;
      body += `<p style="margin:0;font-size:10px;color:#52525b;">${esc(exp.company)}${exp.location ? ` · ${esc(exp.location)}` : ""}</p></div>`;
      body += `<p style="margin:0;font-size:10px;color:#71717a;white-space:nowrap;">${esc(dateFmt(String(exp.startDate ?? "")))} – ${exp.current ? esc(label(locale, "present")) : esc(dateFmt(String(exp.endDate ?? "")))}</p>`;
      body += `</div>`;
      if (bullets.length) {
        body += `<ul style="margin:4px 0 0;padding-left:16px;font-size:10px;line-height:1.5;color:#3f3f46;">`;
        for (const b of bullets) body += `<li>${esc(b)}</li>`;
        body += `</ul>`;
      }
      body += `</div>`;
    }
    body += `</div></section>`;
  }

  const education = asArray<Record<string, unknown>>(content.education);
  if (education.length) {
    body += `<section style="margin-top:20px;">${sectionTitle(primary, label(locale, "education"))}`;
    for (const edu of education) {
      const start = dateFmt(String(edu.startDate ?? ""));
      const end = dateFmt(String(edu.endDate ?? ""));
      const dateRange = start && end ? `${start} – ${end}` : start || end || "";
      body += `<div style="margin-bottom:8px;">`;
      body += `<p style="margin:0;font-size:11px;font-weight:600;">${esc(edu.degree)}${edu.field ? ` — ${esc(edu.field)}` : ""}</p>`;
      body += `<p style="margin:0;font-size:10px;color:#52525b;">${esc(edu.institution)}${dateRange ? ` · ${esc(dateRange)}` : ""}</p>`;
      body += `</div>`;
    }
    body += `</section>`;
  }

  const projects = asArray<Record<string, unknown>>(content.projects);
  if (projects.length) {
    body += `<section style="margin-top:20px;">${sectionTitle(primary, label(locale, "projects"))}`;
    for (const p of projects) {
      const tech = asArray<string>(p.technologies).filter(Boolean);
      body += `<div style="margin-bottom:8px;"><p style="margin:0;font-size:11px;font-weight:600;">${esc(p.name)}</p>`;
      if (p.description) body += `<p style="margin:0;font-size:10px;color:#3f3f46;">${esc(p.description)}</p>`;
      if (tech.length) body += `<p style="margin:0;font-size:9px;color:#71717a;">${esc(tech.join(", "))}</p>`;
      body += `</div>`;
    }
    body += `</section>`;
  }

  const languages = asArray<Record<string, unknown>>(content.languages);
  const certifications = asArray<Record<string, unknown>>(content.certifications);
  if (languages.length || certifications.length) {
    body += `<section style="margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:16px;">`;
    if (languages.length) {
      body += `<div>${sectionTitle(primary, label(locale, "languages"))}`;
      for (const l of languages) {
        body += `<p style="margin:0;font-size:10px;">${esc(l.name)} — ${esc(l.level)}</p>`;
      }
      body += `</div>`;
    }
    if (certifications.length) {
      body += `<div>${sectionTitle(primary, label(locale, "certifications"))}`;
      for (const c of certifications) {
        body += `<p style="margin:0;font-size:10px;">${esc(c.name)} — ${esc(c.issuer)}</p>`;
      }
      body += `</div>`;
    }
    body += `</section>`;
  }

  const socialLinks = asArray<Record<string, unknown>>(content.socialLinks);
  if (socialLinks.length) {
    body += `<section style="margin-top:20px;border-top:1px solid #e4e4e7;padding-top:12px;font-size:9px;color:#71717a;">`;
    for (const s of socialLinks) {
      const url = String(s.url ?? "").replace(/^https?:\/\//, "");
      body += `<span style="margin-right:12px;">${esc(s.platform)}: ${esc(url)}</span>`;
    }
    body += `</section>`;
  }

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8" />
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; background: #fff; }
  </style>
</head>
<body>
  <article style="${articleStyle(templateId, primary)}">
    ${templateExtras(templateId, primary, accent)}
    ${body}
  </article>
</body>
</html>`;
}
