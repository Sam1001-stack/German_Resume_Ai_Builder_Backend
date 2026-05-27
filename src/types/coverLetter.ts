export interface CoverLetterContent {
  subject: string;
  salutation: string;
  paragraphs: string[];
  closing: string;
  companyName?: string;
  targetRole?: string;
  jobDescription?: string;
  generatedAt: string;
}

export interface GenerateCoverLetterInput {
  locale: "en" | "de";
  resumeType: "professional" | "werkstudent";
  jobDescription: string;
  companyName?: string;
  targetRole?: string;
  resumeContent: Record<string, unknown>;
}
