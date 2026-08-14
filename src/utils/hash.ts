import { createHash } from 'node:crypto';
import type { MasterResume } from '../types/resume.js';

function deepSortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(deepSortKeys);
  }
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = deepSortKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

export function computeVaultHash(resume: Omit<MasterResume, 'metadata'> | MasterResume): string {
  // Hash content deterministically without circular dependency on metadata
  const cleanData = {
    basics: resume.basics,
    experience: resume.experience,
    skills: resume.skills,
    education: resume.education,
    projects: resume.projects,
  };
  const normalized = deepSortKeys(cleanData);
  const jsonStr = JSON.stringify(normalized);
  return createHash('sha256').update(jsonStr).digest('hex');
}
