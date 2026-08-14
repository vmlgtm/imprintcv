import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { generateObject } from 'ai';
import { z } from 'zod';
import { type MasterResume } from '../types/resume.js';
import { parseResumeFile } from './parsers.js';
import { sanitizeText, restoreText } from '../privacy/sanitizer.js';
import { computeVaultHash } from '../utils/hash.js';
import { generateMasterMarkdown } from './markdown-generator.js';
import { getLanguageModel, type ProviderType } from '../utils/llm.js';
import { createSpinner, success, info, warn } from '../utils/logger.js';

export interface InitOptions {
  fromPath: string;
  vaultPath?: string;
  provider?: ProviderType;
}

export function getDefaultVaultDir(): string {
  const envPath = process.env.IMPRINTCV_VAULT_PATH;
  if (envPath) return path.resolve(envPath);
  return path.join(os.homedir(), 'career');
}

const ExtractionResumeSchema = z.object({
  basics: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string().optional(),
    location: z.string().optional(),
    website: z.string().optional(),
    linkedin: z.string().optional(),
    github: z.string().optional(),
    summary: z.string().optional(),
  }),
  experience: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      location: z.string().optional(),
      startDate: z.string().nullable().optional(),
      endDate: z.string().nullable().optional(),
      bullets: z.array(z.string()).describe('All achievements, bullet points, and impact statements under this role'),
      technologies: z.array(z.string()).default([]),
    })
  ),
  skills: z.array(
    z.object({
      name: z.string(),
      canonical: z.string().optional(),
    })
  ),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string(),
      field: z.string().optional(),
      startDate: z.string().nullable().optional(),
      endDate: z.string().nullable().optional(),
    })
  ),
  projects: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      technologies: z.array(z.string()).default([]),
      url: z.string().optional(),
      bullets: z.array(z.string()).default([]),
    })
  ),
});

type ExtractedData = z.infer<typeof ExtractionResumeSchema>;

function normalizeDate(d?: string | null): string {
  if (!d || /present|current|now/i.test(d)) return '';
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const parts = d.trim().toLowerCase().split(/[\s\-,\/]+/);
  if (parts.length >= 2) {
    const m = parts[0].slice(0, 3);
    const y = parts[1];
    if (months[m] && /^\d{4}$/.test(y)) return `${y}-${months[m]}`;
    if (/^\d{4}$/.test(parts[0]) && months[parts[1].slice(0, 3)]) return `${parts[0]}-${months[parts[1].slice(0, 3)]}`;
  }
  const yearMatch = d.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) return yearMatch[1];
  return d;
}

function assignStableIds(rawResume: Partial<ExtractedData>): MasterResume {
  const sanitizeId = (str: string) =>
    str
      .toLowerCase()
      .trim()
      .replace(/[^\w]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'item';

  const experience = (rawResume.experience || []).map((exp, expIdx) => {
    const compSlug = sanitizeId(exp.company || `exp_${expIdx}`);
    const titleSlug = sanitizeId(exp.title || 'role');
    const expId = `exp_${compSlug}_${titleSlug}`;
    
    const highlights = (exp.bullets || []).map((bText, hIdx) => {
      const numStr = String(hIdx + 1).padStart(2, '0');
      return {
        id: `bullet_${compSlug}_${titleSlug}_${numStr}`,
        text: bText,
        technologies: exp.technologies || [],
      };
    });

    const normStart = normalizeDate(exp.startDate) || '2020-01';
    const normEnd = exp.endDate && !/present|current|now/i.test(exp.endDate) ? normalizeDate(exp.endDate) : null;

    return {
      id: expId,
      company: exp.company || 'Unknown Company',
      title: exp.title || 'Software Engineer',
      location: exp.location,
      startDate: normStart,
      endDate: normEnd,
      highlights,
      technologies: exp.technologies || [],
    };
  });

  const skills = (rawResume.skills || []).map((s, idx) => {
    const name = s.name || `Skill ${idx}`;
    const slug = sanitizeId(name);
    return {
      id: `skill_${slug}`,
      name,
      canonical: (s.canonical || name).toLowerCase(),
    };
  });

  const education = (rawResume.education || []).map((edu, idx) => {
    const instSlug = sanitizeId(edu.institution || `edu_${idx}`);
    return {
      id: `edu_${instSlug}`,
      institution: edu.institution || 'University',
      degree: edu.degree || 'Bachelor of Science',
      field: edu.field,
      startDate: edu.startDate ? normalizeDate(edu.startDate) : undefined,
      endDate: edu.endDate ? normalizeDate(edu.endDate) : undefined,
    };
  });

  const projects = (rawResume.projects || []).map((proj, idx) => {
    const projSlug = sanitizeId(proj.name || `proj_${idx}`);
    return {
      id: `proj_${projSlug}`,
      name: proj.name || `Project ${idx}`,
      description: proj.description || '',
      technologies: proj.technologies || [],
      url: proj.url,
      highlights: proj.bullets || [],
    };
  });

  const resumeWithoutMeta = {
    basics: {
      name: rawResume.basics?.name || 'Candidate',
      email: rawResume.basics?.email || 'candidate@example.com',
      phone: rawResume.basics?.phone,
      location: rawResume.basics?.location,
      website: rawResume.basics?.website,
      linkedin: rawResume.basics?.linkedin,
      github: rawResume.basics?.github,
      summary: rawResume.basics?.summary,
    },
    experience,
    skills,
    education,
    projects,
  };

  const hash = computeVaultHash(resumeWithoutMeta as unknown as MasterResume);

  return {
    metadata: {
      schemaVersion: '2.1.0',
      vaultVersion: 1,
      vaultHash: hash,
      lastUpdated: new Date().toISOString(),
    },
    ...resumeWithoutMeta,
  };
}

export async function bootstrapCareerVault(options: InitOptions): Promise<{
  vaultDir: string;
  jsonPath: string;
  mdPath: string;
  masterResume: MasterResume;
}> {
  const spinner = createSpinner('Reading and parsing resume document...');
  const rawText = await parseResumeFile(options.fromPath);
  
  if (spinner) spinner.text = 'Sanitizing PII before processing...';
  const { sanitized, replacements } = sanitizeText(rawText);

  if (spinner) spinner.text = 'Extracting structured career facts with AI...';
  let extractedResume: Partial<ExtractedData>;

  try {
    const model = getLanguageModel({ provider: options.provider });
    const { object } = await generateObject({
      model,
      schema: ExtractionResumeSchema,
      prompt: `You are an expert career data extractor. Parse the following sanitized resume text into structured data.

CRITICAL INSTRUCTION: For every work experience entry, extract every single achievement, bullet point, or responsibility into the \`bullets\` array as a list of strings. Include all bullet points under any subheadings (e.g. "AI & Platform Impact", "Full-Stack & System Design", "Product Velocity", "Platform & Reliability", "Leadership"). Never leave \`bullets\` empty.

Extract candidate full name, contact info, professional summary, complete work experiences, skills, education, and projects.
Ensure start and end dates (e.g. "Apr 2024", "Jan 2022", "Sep 2020", "Mar 2017", "Present") are captured accurately.

RESUME TEXT:
${sanitized}`,
    });
    extractedResume = object;
  } catch (err) {
    if (spinner) spinner.warn(`AI extraction warning: ${(err as Error).message}`);
    extractedResume = {
      basics: {
        name: 'Extracted Candidate',
        email: 'candidate@example.com',
        summary: sanitized.slice(0, 300),
      },
      experience: [],
      skills: [],
      education: [],
      projects: [],
    };
  }

  // Restore PII placeholders
  if (extractedResume.basics) {
    if (extractedResume.basics.email) {
      extractedResume.basics.email = restoreText(extractedResume.basics.email, replacements);
    }
    if (extractedResume.basics.phone) {
      extractedResume.basics.phone = restoreText(extractedResume.basics.phone, replacements);
    }
    if (extractedResume.basics.summary) {
      extractedResume.basics.summary = restoreText(extractedResume.basics.summary, replacements);
    }
  }

  // Restore PII across experience and highlights
  for (const exp of extractedResume.experience || []) {
    for (let i = 0; i < (exp.bullets || []).length; i++) {
      exp.bullets[i] = restoreText(exp.bullets[i], replacements);
    }
  }

  const masterResume = assignStableIds(extractedResume);

  const vaultDir = options.vaultPath ? path.resolve(options.vaultPath) : getDefaultVaultDir();
  await fs.mkdir(vaultDir, { recursive: true });

  const jsonPath = path.join(vaultDir, 'master_resume.json');
  const mdPath = path.join(vaultDir, 'master_resume.md');

  await fs.writeFile(jsonPath, JSON.stringify(masterResume, null, 2), 'utf-8');
  await fs.writeFile(mdPath, generateMasterMarkdown(masterResume), 'utf-8');

  if (spinner) spinner.succeed(`Career Vault bootstrapped successfully at ${vaultDir}`);

  return {
    vaultDir,
    jsonPath,
    mdPath,
    masterResume,
  };
}
