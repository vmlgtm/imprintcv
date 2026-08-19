import { createHash } from 'node:crypto';
import type { MasterResume } from '../types/resume.js';
import type { StructuredFacts, CareerFact } from '../types/facts.js';
import { computeVaultHash } from '../utils/hash.js';

function extractMetricsFromText(text: string): string[] {
  // Matches numbers with units/qualifiers: e.g. 50,000, 28%, $10M, 40 microservices, 2ms, 10+ years
  const metricRegex = /(?:\$\s*\d+(?:\.\d+)?[kKmMbB]?|\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:%|x|X|k|K|M|B|\+|req\/sec|qps|QPS|ms|microservices|teams|engineers|users|customers|projects|percent|seconds|minutes|hours|days|months|years)?)/g;
  const rawMatches = text.match(metricRegex) || [];
  const results: string[] = [];

  for (const m of rawMatches) {
    const trimmed = m.trim();
    if (trimmed.length > 0 && /\d/.test(trimmed)) {
      // Filter out isolated years like 2020 if they are just dates
      results.push(trimmed);
    }
  }

  return Array.from(new Set(results));
}

export function calculateYearsExperience(experience: MasterResume['experience']): number {
  if (!experience || experience.length === 0) return 0;

  // 1. Convert each experience to a [startMonth, endMonth] interval (using months since epoch)
  const intervals: [number, number][] = [];

  for (const exp of experience) {
    const startParts = exp.startDate.split('-').map(Number);
    const startYear = startParts[0] || 2020;
    const startMonth = startParts[1] || 1;
    const startTotalMonths = startYear * 12 + startMonth;

    let endYear = new Date().getFullYear();
    let endMonth = new Date().getMonth() + 1;

    if (exp.endDate) {
      const endParts = exp.endDate.split('-').map(Number);
      endYear = endParts[0] || endYear;
      endMonth = endParts[1] || endMonth;
    }

    const endTotalMonths = endYear * 12 + endMonth;
    if (endTotalMonths > startTotalMonths) {
      intervals.push([startTotalMonths, endTotalMonths]);
    }
  }

  if (intervals.length === 0) return 0;

  // 2. Sort intervals by start
  intervals.sort((a, b) => a[0] - b[0]);

  // 3. Merge overlapping intervals
  const merged: [number, number][] = [intervals[0]];
  for (let i = 1; i < intervals.length; i++) {
    const curr = intervals[i];
    const last = merged[merged.length - 1];
    if (curr[0] <= last[1]) {
      last[1] = Math.max(last[1], curr[1]);
    } else {
      merged.push([...curr]);
    }
  }

  // 4. Sum merged intervals' durations
  let totalMonths = 0;
  for (const [start, end] of merged) {
    totalMonths += end - start;
  }

  return Math.max(1, Math.round((totalMonths / 12) * 10) / 10);
}

export function extractFacts(resume: MasterResume): StructuredFacts {
  const vaultHash = resume.metadata?.vaultHash || computeVaultHash(resume);
  const facts: CareerFact[] = [];
  const metricsList: Array<{ value: string; context: string; factId: string }> = [];

  let totalBulletCount = 0;

  // Process Experience
  const companies = (resume.experience || []).map((exp) => {
    const normalizedName = exp.company.toLowerCase().trim();
    
    // Add date/role fact
    const roleFactId = `fact_role_${createHash('md5').update(`${exp.id}_role`).digest('hex').slice(0, 8)}`;
    facts.push({
      id: roleFactId,
      companyId: exp.id,
      sourceBulletId: exp.id,
      sourceText: `${exp.title} at ${exp.company} (${exp.startDate} - ${exp.endDate || 'Present'})`,
      type: 'role',
      subject: exp.company,
      predicate: 'employed_as',
      object: exp.title,
      qualifiers: [exp.startDate, exp.endDate || 'Present'],
      confidence: 'explicit',
    });

    for (const highlight of exp.highlights || []) {
      totalBulletCount++;
      const bulletId = highlight.id;
      const text = highlight.text;

      // Extract metrics
      const foundMetrics = extractMetricsFromText(text);
      for (const m of foundMetrics) {
        const metricFactId = `fact_metric_${createHash('md5').update(`${bulletId}_${m}`).digest('hex').slice(0, 8)}`;
        facts.push({
          id: metricFactId,
          companyId: exp.id,
          sourceBulletId: bulletId,
          sourceText: text,
          type: 'metric',
          subject: exp.company,
          predicate: 'achieved_metric',
          object: m,
          qualifiers: [text],
          confidence: 'explicit',
        });

        metricsList.push({
          value: m,
          context: text,
          factId: metricFactId,
        });
      }

      // Extract technologies in bullet
      for (const tech of highlight.technologies || []) {
        const techFactId = `fact_tech_${createHash('md5').update(`${bulletId}_${tech}`).digest('hex').slice(0, 8)}`;
        facts.push({
          id: techFactId,
          companyId: exp.id,
          sourceBulletId: bulletId,
          sourceText: text,
          type: 'technology',
          subject: exp.company,
          predicate: 'used_technology',
          object: tech,
          qualifiers: [text],
          confidence: 'explicit',
        });
      }

      // Responsibility / Achievement fact for bullet
      const bulletFactId = `fact_achieve_${createHash('md5').update(`${bulletId}_text`).digest('hex').slice(0, 8)}`;
      facts.push({
        id: bulletFactId,
        companyId: exp.id,
        sourceBulletId: bulletId,
        sourceText: text,
        type: 'achievement',
        subject: exp.company,
        predicate: 'accomplished',
        object: text,
        qualifiers: foundMetrics,
        confidence: 'explicit',
      });
    }

    return {
      id: exp.id,
      name: exp.company,
      normalizedName,
      titles: [exp.title],
      startDate: exp.startDate,
      endDate: exp.endDate,
    };
  });

  // Extract skills
  const skillsSet = new Set<string>();
  for (const skill of resume.skills || []) {
    skillsSet.add(skill.name.toLowerCase());
    if (skill.canonical) {
      skillsSet.add(skill.canonical.toLowerCase());
    }
  }
  for (const exp of resume.experience || []) {
    for (const tech of exp.technologies || []) {
      skillsSet.add(tech.toLowerCase());
    }
  }
  for (const proj of resume.projects || []) {
    for (const tech of proj.technologies || []) {
      skillsSet.add(tech.toLowerCase());
    }
    totalBulletCount += (proj.highlights || []).length;
  }

  const totalYearsExperience = calculateYearsExperience(resume.experience);

  return {
    vaultHash,
    facts,
    companies,
    skills: Array.from(skillsSet),
    metrics: metricsList,
    totalYearsExperience,
    totalBulletCount,
  };
}
