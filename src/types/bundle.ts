import { z } from 'zod';
import type { TailoringPlan } from './plan.js';
import type { MasterResume } from './resume.js';

export type VerificationStatus = 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL';

export const BulletStatusSchema = z.enum([
  'UNCHANGED',
  'REWORDED',
  'REPHRASED',
  'REORDERED',
  'COMPRESSED',
  'COMBINED',
  'UNSUPPORTED',
]);
export type BulletStatus = z.infer<typeof BulletStatusSchema>;

export const TailoredBulletSchema = z.object({
  id: z.string().describe('Bullet identifier (matches master bullet ID if originating from one)'),
  sourceBulletIds: z.array(z.string()).default([]).describe('Provenance IDs from master highlights'),
  sourceFactIds: z.array(z.string()).default([]).describe('Provenance fact IDs'),
  original: z.string().default('').describe('Original bullet text before tailoring'),
  tailored: z.string().describe('Tailored bullet text'),
  status: BulletStatusSchema.default('UNCHANGED').describe('Transformation status'),
  matchedKeywords: z.array(z.string()).default([]).describe('Keywords matched from job description'),
});
export type TailoredBullet = z.infer<typeof TailoredBulletSchema>;

export const HighlightItemSchema = z.union([
  z.string(),
  z.object({
    id: z.string().optional(),
    text: z.string(),
    technologies: z.array(z.string()).optional(),
  }),
]);
export type HighlightItem = z.infer<typeof HighlightItemSchema>;

export const TailoredExperienceSchema = z
  .object({
    id: z.string().describe('Experience ID matching Career Vault (e.g. exp_stripe)'),
    company: z.string().describe('Company name'),
    title: z.string().describe('Job title'),
    location: z.string().optional(),
    startDate: z.string().describe('Start date (YYYY-MM)'),
    endDate: z.string().nullable().optional().default(null).describe('End date (YYYY-MM or null for Present)'),
    technologies: z.array(z.string()).default([]),
    bullets: z.array(TailoredBulletSchema).optional().default([]).describe('Tailored bullet points with provenance'),
    highlights: z.array(HighlightItemSchema).optional().describe('Legacy highlights format; automatically normalized into bullets'),
  })
  .transform((exp): TailoredExperience => {
    let bullets: TailoredBullet[] = exp.bullets || [];

    // Auto-normalize highlights if bullets array is empty
    if (bullets.length === 0 && exp.highlights && exp.highlights.length > 0) {
      bullets = exp.highlights.map((h, idx) => {
        if (typeof h === 'string') {
          return {
            id: `bullet_${idx + 1}`,
            sourceBulletIds: [],
            sourceFactIds: [],
            original: h,
            tailored: h,
            status: 'UNCHANGED' as BulletStatus,
            matchedKeywords: [],
          };
        }
        const bId = h.id || `bullet_${idx + 1}`;
        return {
          id: bId,
          sourceBulletIds: h.id ? [h.id] : [],
          sourceFactIds: [],
          original: h.text,
          tailored: h.text,
          status: 'UNCHANGED' as BulletStatus,
          matchedKeywords: [],
        };
      });
    } else {
      // Ensure defaults for any incomplete bullet items
      bullets = bullets.map((b) => ({
        id: b.id,
        sourceBulletIds: b.sourceBulletIds && b.sourceBulletIds.length > 0 ? b.sourceBulletIds : (b.id ? [b.id] : []),
        sourceFactIds: b.sourceFactIds || [],
        original: b.original || b.tailored,
        tailored: b.tailored,
        status: b.status || 'UNCHANGED',
        matchedKeywords: b.matchedKeywords || [],
      }));
    }

    const res: TailoredExperience = {
      id: exp.id,
      company: exp.company,
      title: exp.title,
      startDate: exp.startDate,
      endDate: exp.endDate ?? null,
      technologies: exp.technologies || [],
      bullets,
    };
    if (exp.location !== undefined) res.location = exp.location;
    return res;
  });

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

export const TailoredSkillItemSchema = z
  .union([
    z.string(),
    z.object({
      id: z.string().optional(),
      name: z.string(),
      canonical: z.string().optional(),
    }),
  ])
  .transform((s): { id: string; name: string; canonical: string } => {
    if (typeof s === 'string') {
      const slug = s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      return {
        id: `skill_${slug || 'item'}`,
        name: s,
        canonical: s.toLowerCase().trim(),
      };
    }
    const slug = (s.canonical || s.name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return {
      id: s.id || `skill_${slug || 'item'}`,
      name: s.name,
      canonical: s.canonical || s.name.toLowerCase().trim(),
    };
  });
export type TailoredSkillItem = z.infer<typeof TailoredSkillItemSchema>;

export interface TailoredEducationItem {
  id: string;
  institution: string;
  degree: string;
  field?: string;
  startDate?: string;
  endDate?: string;
}

export const TailoredEducationItemSchema = z
  .object({
    id: z.string().optional(),
    institution: z.string(),
    degree: z.string(),
    field: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .transform((edu): TailoredEducationItem => {
    const res: TailoredEducationItem = {
      id: edu.id || `edu_${edu.institution.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item'}`,
      institution: edu.institution,
      degree: edu.degree,
    };
    if (edu.field !== undefined) res.field = edu.field;
    if (edu.startDate !== undefined) res.startDate = edu.startDate;
    if (edu.endDate !== undefined) res.endDate = edu.endDate;
    return res;
  });

export interface TailoredProjectItem {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  url?: string;
  highlights: string[];
}

export const TailoredProjectItemSchema = z
  .object({
    id: z.string().optional(),
    name: z.string(),
    description: z.string().default(''),
    technologies: z.array(z.string()).default([]),
    url: z.string().optional(),
    highlights: z.array(z.string()).default([]),
  })
  .transform((proj): TailoredProjectItem => {
    const res: TailoredProjectItem = {
      id: proj.id || `proj_${proj.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item'}`,
      name: proj.name,
      description: proj.description,
      technologies: proj.technologies,
      highlights: proj.highlights,
    };
    if (proj.url !== undefined) res.url = proj.url;
    return res;
  });

export const TailoredBasicsSchema = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string().optional(),
  location: z.string().optional(),
  website: z.string().optional(),
  linkedin: z.string().optional(),
  github: z.string().optional(),
  summary: z.string().optional(),
});
export type TailoredBasics = z.infer<typeof TailoredBasicsSchema>;

export const TailoredResumeSchema = z.object({
  targetRole: z.string().describe('Target job title / role applied for'),
  targetCompany: z.string().describe('Target company name'),
  basics: TailoredBasicsSchema,
  experience: z.array(TailoredExperienceSchema).default([]),
  skills: z.array(TailoredSkillItemSchema).default([]),
  education: z.array(TailoredEducationItemSchema).default([]),
  projects: z.array(TailoredProjectItemSchema).optional().default([]),
});
export type TailoredResume = z.infer<typeof TailoredResumeSchema>;

export function normalizeTailoredResume(
  raw: unknown,
  masterResume?: MasterResume
): TailoredResume {
  const parsed = TailoredResumeSchema.parse(raw);

  // If masterResume is provided, enrich bullets with missing provenance
  if (masterResume) {
    const masterBulletMap = new Map<string, string>();
    for (const exp of masterResume.experience || []) {
      for (const h of exp.highlights || []) {
        masterBulletMap.set(h.id, h.text);
      }
    }

    for (const exp of parsed.experience) {
      for (const bullet of exp.bullets) {
        if ((!bullet.sourceBulletIds || bullet.sourceBulletIds.length === 0) && masterBulletMap.has(bullet.id)) {
          bullet.sourceBulletIds = [bullet.id];
        }
        if ((!bullet.original || bullet.original === bullet.tailored) && masterBulletMap.has(bullet.id)) {
          const masterText = masterBulletMap.get(bullet.id);
          if (masterText) {
            bullet.original = masterText;
          }
        }
      }
    }
  }

  return parsed;
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
