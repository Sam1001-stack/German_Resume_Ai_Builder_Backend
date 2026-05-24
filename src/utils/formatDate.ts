import type { ResumeLocale } from "../types/userResume";

export function formatMonthYear(value: string, locale: ResumeLocale): string {
  if (!value) return "";
  const [year, month] = value.split("-");
  if (!year) return value;
  if (!month) return year;
  const date = new Date(Number(year), Number(month) - 1);
  const loc = locale === "de" ? "de-DE" : "en-US";
  return date.toLocaleDateString(loc, { month: "short", year: "numeric" });
}
