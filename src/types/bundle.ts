import { z } from 'zod';
import type { TailoringPlan } from './plan.js';

export type VerificationStatus = 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL';

export type BulletStatus =
  | 'UNCHANGED'
  | 'REWORDED'
  | 'REORDERED'
  | 'COMPRESSED'
  | 'COMBINED'
  | 'UNSUPPORTED';

export interface TailoredBullet {
  id: string;
  sourceBulletIds: string[]; // Provenance IDs from master
  sourceFactIds: string[]; // Provenance fact IDs
  original: string;
  tailored: string;
  status: BulletStatus;
  matchedKeywords: string[];
}

export type VerificationIssueReason =
  | 'METRIC_CONTRADICTED'
  | 'DATE_ALTERED'
  | 'COMPANY_ALTERED'
  | 'TITLE_ALTERED'
  | 'DEGREE_ALTERED'
  | 'PROVENANCE_MISMATCH'
  | 'CLAIM_STRENGTH_ESCALATION'
  | 'CLAIM_SCOPE_ESCALATION'
  | 'UNSUPPORTED_TECH_CLAIM'
  | 'UNSUPPORTED_SKILL'
  | 'UNSUPPORTED_CLAIM_MODIFIER';

export interface VerificationIssue {
  field: string;
  claim: string;
  reason: VerificationIssueReason;
  factsOriginal?: string;
  severity: 'ERROR' | 'WARNING';
  repairAction: string; // Machine-readable instruction for self-repair loop
}

export interface VerificationReport {
  status: VerificationStatus;
  errorCount: number;
  warningCount: number;
  issues: VerificationIssue[];
  metricsVerified: number;
  skillsMatched: string[];
}

export interface TailoredExperience {
  id: string;
  company: string;
  title: string;
  location?: string;
  startDate: string;
  endDate: string | null;
  bullets: TailoredBullet[];
  technologies: string[];
}

export interface TailoredResume {
  targetRole: string;
  targetCompany: string;
  basics: {
    name: string;
    email: string;
    phone?: string;
    location?: string;
    website?: string;
    linkedin?: string;
    github?: string;
    summary?: string;
  };
  experience: TailoredExperience[];
  skills: Array<{
    id: string;
    name: string;
    canonical: string;
  }>;
  education: Array<{
    id: string;
    institution: string;
    degree: string;
    field?: string;
    startDate?: string;
    endDate?: string;
  }>;
  projects?: Array<{
    id: string;
    name: string;
    description: string;
    technologies: string[];
    url?: string;
    highlights: string[];
  }>;
}

export interface ApplicationBundle {
  bundleDir: string;
  pdfPath: string;
  jsonPath: string;
  mdPath: string;
  yamlPath: string;
  planPath: string;
  clPath: string;
  verifPath: string;
}
