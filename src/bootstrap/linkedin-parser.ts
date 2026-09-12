import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import AdmZip from 'adm-zip';
import type { MasterResume } from '../types/resume.js';
import { computeVaultHash } from '../utils/hash.js';

export interface LinkedInExportFiles {
  positionsCsv?: string;
  educationCsv?: string;
  skillsCsv?: string;
  projectsCsv?: string;
  profileCsv?: string;
  certificationsCsv?: string;
}

/**
 * Standard RFC-4180 compliant CSV parser that supports multiline fields, quotes, and commas.
 */
export function parseCsv(csvText: string): Array<Record<string, string>> {
  const cleanText = csvText.replace(/^\uFEFF/, ''); // strip BOM
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r') {
        if (nextChar === '\n') i++;
        currentRow.push(currentField.trim());
        if (currentRow.some((f) => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some((f) => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const data: Array<Record<string, string>> = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const item: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      if (header) {
        item[header] = row[c] !== undefined ? row[c] : '';
      }
    }
    data.push(item);
  }

  return data;
}

export function matchTechKeyword(text: string, tech: string): boolean {
  if (!tech || !text) return false;
  const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const startBound = /^\w/.test(tech) ? '\\b' : '';
  const endBound = /\w$/.test(tech) ? '\\b' : '';
  const regex = new RegExp(`${startBound}${escaped}${endBound}`, 'i');
  return regex.test(text);
}

function normalizeLinkedInDate(d?: string | null): string {
  if (!d || /present|current|now/i.test(d)) return '';
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04', may_long: '05', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
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
  return d.trim();
}

function sanitizeId(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'item';
}

function parseBulletsFromDescription(description: string): string[] {
  if (!description) return [];

  // Split by line breaks or explicit bullet delimiters
  const rawLines = description
    .split(/\r?\n|•|\u2022|\u25E6|\u25AA|\u2013|\u2014/)
    .map((l) => l.replace(/^[\s\-*–—\d.)]+/, '').trim())
    .filter((l) => l.length > 10); // filter out tiny fragments

  if (rawLines.length > 0) {
    return rawLines;
  }

  // If no newlines or bullets, check if description is a single block
  const trimmed = description.trim();
  return trimmed.length > 0 ? [trimmed] : [];
}

/**
 * Loads LinkedIn CSV contents from either a .zip file or an unzipped directory.
 */
export async function loadLinkedInFiles(sourcePath: string): Promise<LinkedInExportFiles> {
  const resolved = sourcePath.startsWith('~') ? path.join(os.homedir(), sourcePath.slice(1)) : path.resolve(sourcePath);
  const stat = await fs.stat(resolved);

  const files: LinkedInExportFiles = {};

  if (stat.isFile() && path.extname(resolved).toLowerCase() === '.zip') {
    const zip = new AdmZip(resolved);
    const zipEntries = zip.getEntries();

    for (const entry of zipEntries) {
      const entryName = path.basename(entry.entryName).toLowerCase();
      const text = entry.getData().toString('utf8');

      if (entryName === 'positions.csv') files.positionsCsv = text;
      else if (entryName === 'education.csv') files.educationCsv = text;
      else if (entryName === 'skills.csv') files.skillsCsv = text;
      else if (entryName === 'projects.csv') files.projectsCsv = text;
      else if (entryName === 'profile.csv') files.profileCsv = text;
      else if (entryName === 'certifications.csv') files.certificationsCsv = text;
    }
  } else if (stat.isDirectory()) {
    const entries = await fs.readdir(resolved);
    for (const file of entries) {
      const fileName = file.toLowerCase();
      const filePath = path.join(resolved, file);
      const text = await fs.readFile(filePath, 'utf8');

      if (fileName === 'positions.csv') files.positionsCsv = text;
      else if (fileName === 'education.csv') files.educationCsv = text;
      else if (fileName === 'skills.csv') files.skillsCsv = text;
      else if (fileName === 'projects.csv') files.projectsCsv = text;
      else if (fileName === 'profile.csv') files.profileCsv = text;
      else if (fileName === 'certifications.csv') files.certificationsCsv = text;
    }
  } else {
    throw new Error(`Invalid LinkedIn archive path: ${sourcePath}. Expected a .zip archive or export directory.`);
  }

  return files;
}

/**
 * Deterministically parses official LinkedIn export files into a validated MasterResume.
 */
export function parseLinkedInToMasterResume(files: LinkedInExportFiles): MasterResume {
  // 1. Profile / Basics
  let basics = {
    name: 'Candidate',
    email: 'candidate@example.com',
    phone: undefined as string | undefined,
    location: undefined as string | undefined,
    website: undefined as string | undefined,
    linkedin: undefined as string | undefined,
    github: undefined as string | undefined,
    summary: undefined as string | undefined,
  };

  if (files.profileCsv) {
    const profileRows = parseCsv(files.profileCsv);
    if (profileRows.length > 0) {
      const p = profileRows[0];
      const firstName = p.firstname || '';
      const lastName = p.lastname || '';
      if (firstName || lastName) {
        basics.name = `${firstName} ${lastName}`.trim();
      }
      basics.summary = p.summary || p.headline || undefined;
      const locParts = [p.geolocation || p.location, p.zipcode].filter(Boolean);
      if (locParts.length > 0) {
        basics.location = locParts.join(', ');
      }
      if (p.websites) {
        const sites = p.websites.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
        for (const s of sites) {
          if (/github\.com/i.test(s)) basics.github = s;
          else if (/linkedin\.com/i.test(s)) basics.linkedin = s;
          else if (!basics.website) basics.website = s;
        }
      }
    }
  }

  // 2. Skills
  const skillsList: Array<{ id: string; name: string; canonical: string }> = [];
  const seenSkillNames = new Set<string>();

  if (files.skillsCsv) {
    const skillRows = parseCsv(files.skillsCsv);
    for (const row of skillRows) {
      const name = row.name || Object.values(row)[0] || '';
      if (name && !seenSkillNames.has(name.toLowerCase())) {
        seenSkillNames.add(name.toLowerCase());
        const slug = sanitizeId(name);
        skillsList.push({
          id: `skill_${slug}`,
          name,
          canonical: name.toLowerCase(),
        });
      }
    }
  }

  const allSkillNames = skillsList.map((s) => s.name);

  // 3. Experience / Positions
  const experienceList: MasterResume['experience'] = [];

  if (files.positionsCsv) {
    const positionRows = parseCsv(files.positionsCsv);
    for (let idx = 0; idx < positionRows.length; idx++) {
      const pos = positionRows[idx];
      const company = pos.companyname || pos.company || 'Unknown Company';
      const title = pos.title || 'Software Engineer';
      const location = pos.location || undefined;
      const compSlug = sanitizeId(company);
      const titleSlug = sanitizeId(title);
      const expId = `exp_${compSlug}_${titleSlug}_${idx + 1}`;

      const rawBullets = parseBulletsFromDescription(pos.description || '');
      const bullets = rawBullets.map((bText, bIdx) => {
        const numStr = String(bIdx + 1).padStart(2, '0');
        const matchedTechs = allSkillNames.filter((tech) => matchTechKeyword(bText, tech));
        return {
          id: `bullet_${compSlug}_${titleSlug}_${numStr}`,
          text: bText,
          technologies: matchedTechs,
        };
      });

      const startNorm = normalizeLinkedInDate(pos.startedon || pos.startdate) || '2020-01';
      const endRaw = pos.finishedon || pos.enddate;
      const endNorm = endRaw && !/present|current|now/i.test(endRaw) ? normalizeLinkedInDate(endRaw) : null;

      const experienceTechs = Array.from(
        new Set([
          ...bullets.flatMap((b) => b.technologies),
          ...allSkillNames.filter((tech) => matchTechKeyword(`${title} ${pos.description || ''}`, tech)),
        ])
      );

      experienceList.push({
        id: expId,
        company,
        title,
        location,
        startDate: startNorm,
        endDate: endNorm,
        highlights: bullets.length > 0 ? bullets : [
          {
            id: `bullet_${compSlug}_${titleSlug}_01`,
            text: `Served as ${title} at ${company}.`,
            technologies: experienceTechs,
          }
        ],
        technologies: experienceTechs,
      });
    }
  }

  // 4. Education
  const educationList: MasterResume['education'] = [];

  if (files.educationCsv) {
    const eduRows = parseCsv(files.educationCsv);
    for (let idx = 0; idx < eduRows.length; idx++) {
      const row = eduRows[idx];
      const institution = row.schoolname || row.school || row.institution || 'University';
      const degree = row.degreename || row.degree || 'Bachelor of Science';
      const field = row.notes || row.activitiesandsocieties || undefined;
      const instSlug = sanitizeId(institution);

      educationList.push({
        id: `edu_${instSlug}_${idx + 1}`,
        institution,
        degree,
        field,
        startDate: normalizeLinkedInDate(row.startdate || row.startedon) || undefined,
        endDate: normalizeLinkedInDate(row.enddate || row.finishedon) || undefined,
      });
    }
  }

  // 5. Projects
  const projectsList: MasterResume['projects'] = [];

  if (files.projectsCsv) {
    const projRows = parseCsv(files.projectsCsv);
    for (let idx = 0; idx < projRows.length; idx++) {
      const row = projRows[idx];
      const name = row.title || row.name || `Project ${idx + 1}`;
      const description = row.description || '';
      const projSlug = sanitizeId(name);
      const matchedTechs = allSkillNames.filter((tech) => matchTechKeyword(`${name} ${description}`, tech));
      const bullets = parseBulletsFromDescription(description);

      projectsList.push({
        id: `proj_${projSlug}`,
        name,
        description,
        technologies: matchedTechs,
        url: row.url || undefined,
        highlights: bullets,
      });
    }
  }

  const resumeWithoutMeta = {
    basics,
    experience: experienceList,
    skills: skillsList,
    education: educationList,
    projects: projectsList,
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
