import type { Document, Types } from "mongoose";

export interface IExperience {
  company?: string;
  position?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface IEducation {
  institution?: string;
  degree?: string;
  startDate?: string;
  endDate?: string;
}

export interface ILanguage {
  name?: string;
  level?: string;
}

export interface IPersonalInfo {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
}

export interface IResume {
  title: string;
  personalInfo?: IPersonalInfo;
  summary?: string;
  experience?: IExperience[];
  education?: IEducation[];
  skills?: string[];
  languages?: ILanguage[];
}

export interface IResumeDocument extends IResume, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
