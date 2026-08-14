import type { MasterResume } from '../types/resume.js';
import type { TailoredResume, VerificationIssue } from '../types/bundle.js';

interface MetricToken {
  raw: string;
  normalizedNumber: number;
  unit: string;
  period?: 'annually' | 'monthly' | 'weekly' | 'daily';
}

function extractPeriod(str: string): 'annually' | 'monthly' | 'weekly' | 'daily' | undefined {
  const lower = str.toLowerCase();
  if (/\b(?:annual|annually|per\s+year|yearly|a\s+year)\b/.test(lower)) return 'annually';
  if (/\b(?:monthly|per\s+month|a\s+month)\b/.test(lower)) return 'monthly';
  if (/\b(?:weekly|per\s+week|a\s+week)\b/.test(lower)) return 'weekly';
  if (/\b(?:daily|per\s+day|a\s+day)\b/.test(lower)) return 'daily';
  return undefined;
}

export function parseMetricToken(str: string): MetricToken | null {
  const clean = str.replace(/,/g, '').trim().toLowerCase();
  const period = extractPeriod(str);
  
  // Percentage: e.g. 25%, 28 percent
  const pctMatch = clean.match(/^(\d+(?:\.\d+)?)\s*(?:%|percent)$/);
  if (pctMatch) {
    return { raw: str, normalizedNumber: parseFloat(pctMatch[1]), unit: 'percent', period };
  }

  // Multiplier: e.g. 2x, 10x
  const multMatch = clean.match(/^(\d+(?:\.\d+)?)\s*x$/);
  if (multMatch) {
    return { raw: str, normalizedNumber: parseFloat(multMatch[1]), unit: 'multiplier', period };
  }

  // Currency: e.g. $10m, $500k, $2.5b, 500 usd, ₹62 lakh
  if (str.includes('$') || str.includes('₹') || clean.includes('usd') || clean.includes('dollars') || clean.includes('lakh') || clean.includes('crore')) {
    const currMatch = clean.match(/^(?:\$|₹)?\s*(\d+(?:\.\d+)?)\s*([kmbt]|lakh|crore)?(?:\s*(?:usd|dollars|inr|rupees))?$/);
    if (currMatch) {
      let val = parseFloat(currMatch[1]);
      const mult = currMatch[2];
      if (mult === 'k') val *= 1_000;
      if (mult === 'm') val *= 1_000_000;
      if (mult === 'b') val *= 1_000_000_000;
      if (mult === 't') val *= 1_000_000_000_000;
      if (mult === 'lakh') val *= 100_000;
      if (mult === 'crore') val *= 10_000_000;
      return { raw: str, normalizedNumber: val, unit: 'currency', period };
    }
  }

  // Standalone multiplier suffix (e.g., 50k, 10M, 2B)
  const suffixedMatch = clean.match(/^(\d+(?:\.\d+)?)\s*([kmbt])$/);
  if (suffixedMatch) {
    let val = parseFloat(suffixedMatch[1]);
    const mult = suffixedMatch[2];
    if (mult === 'k') val *= 1_000;
    if (mult === 'm') val *= 1_000_000;
    if (mult === 'b') val *= 1_000_000_000;
    if (mult === 't') val *= 1_000_000_000_000;
    return { raw: str, normalizedNumber: val, unit: 'count', period };
  }

  // Generic number with unit word (e.g. 50000 req/sec, 100k qps, 40 microservices, 2ms, 15 services)
  const numMatch = clean.match(/^(\d+(?:\.\d+)?)(?:\s+([a-z\/_\-+]+))?$/);
  if (numMatch) {
    const val = parseFloat(numMatch[1]);
    const unit = numMatch[2] || 'count';
    return { raw: str, normalizedNumber: val, unit, period };
  }

  return null;
}

export function extractNumericTokens(text: string): string[] {
  const regex = /(?:(?:\$|₹)\s*\d+(?:,\d{3})*(?:\.\d+)?\s*(?:[kKmMbBtT]|lakh|crore)?|\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:%|x|X|k|K|M|B|T|\+|req\/sec|qps|QPS|ms|microservices|services|teams|engineers|users|customers|projects|percent|seconds|minutes|hours|days|months|years|stores|centres)?\b)/g;
  const rawMatches = text.match(regex) || [];
  const results: string[] = [];

  for (const m of rawMatches) {
    const trimmed = m.trim();
    if (trimmed.length > 0 && /\d/.test(trimmed) && !/^(?:19|20)\d{2}$/.test(trimmed)) {
      results.push(trimmed);
    }
  }

  return Array.from(new Set(results));
}

function areUnitsCompatible(unitA: string, unitB: string): boolean {
  if (unitA === unitB) return true;
  const strictUnits = ['currency', 'percent', 'multiplier'];
  if (strictUnits.includes(unitA) || strictUnits.includes(unitB)) {
    return unitA === unitB;
  }
  return true;
}

export function checkMetricsContradiction(
  originalTexts: string[],
  tailoredText: string,
  field: string
): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  const tailoredTokens = extractNumericTokens(tailoredText);
  if (tailoredTokens.length === 0) return issues;

  const originalTokens = originalTexts.flatMap((t) => extractNumericTokens(t));
  const origCombined = originalTexts.join(' ');
  const origSentencePeriod = extractPeriod(origCombined);
  const tailoredSentencePeriod = extractPeriod(tailoredText);

  // Check sentence-level frequency/period contradiction
  if (origSentencePeriod && tailoredSentencePeriod && origSentencePeriod !== tailoredSentencePeriod) {
    issues.push({
      field,
      claim: `${tailoredTokens.join(', ')} (${tailoredSentencePeriod})`,
      reason: 'METRIC_CONTRADICTED',
      factsOriginal: `${origCombined} (${origSentencePeriod})`,
      severity: 'ERROR',
      repairAction: `Restore exact metric timeframe/frequency "${origSentencePeriod}" rather than altered "${tailoredSentencePeriod}"`,
    });
    return issues;
  }

  const originalParsed = originalTokens
    .map((tok) => {
      const p = parseMetricToken(tok);
      if (p) {
        p.period = p.period || origSentencePeriod;
      }
      return p;
    })
    .filter((t): t is MetricToken => t !== null);

  for (const tTokenStr of tailoredTokens) {
    const tParsed = parseMetricToken(tTokenStr);
    if (!tParsed) continue;

    tParsed.period = tParsed.period || tailoredSentencePeriod;

    const matchesOriginal = originalParsed.some((orig) => {
      if (!areUnitsCompatible(orig.unit, tParsed.unit)) {
        return false;
      }
      if (orig.period && tParsed.period && orig.period !== tParsed.period) {
        return false;
      }
      return Math.abs(orig.normalizedNumber - tParsed.normalizedNumber) < 0.001;
    });

    const exactSubMatch =
      originalTokens.some((origStr) => origStr.toLowerCase() === tTokenStr.toLowerCase()) &&
      (!origSentencePeriod || !tailoredSentencePeriod || origSentencePeriod === tailoredSentencePeriod);

    if (!matchesOriginal && !exactSubMatch) {
      issues.push({
        field,
        claim: tTokenStr + (tParsed.period ? ` (${tParsed.period})` : ''),
        reason: 'METRIC_CONTRADICTED',
        factsOriginal: originalTokens.join(', ') || 'No metrics in source bullet',
        severity: 'ERROR',
        repairAction: `Remove or revert contradictory metric "${tTokenStr}" to match original source fact: ${originalTokens.join(', ') || 'None'}`,
      });
    }
  }

  return issues;
}

function findMasterExperience(masterResume: MasterResume, tExp: { id: string; company: string; title: string }) {
  // 1. Exact ID match
  const byId = masterResume.experience.find((e) => e.id === tExp.id);
  if (byId) return byId;

  // 2. Exact Company + Title match
  const byCompAndTitle = masterResume.experience.find(
    (e) =>
      e.company.toLowerCase().trim() === tExp.company.toLowerCase().trim() &&
      e.title.toLowerCase().trim() === tExp.title.toLowerCase().trim()
  );
  if (byCompAndTitle) return byCompAndTitle;

  // 3. Fallback: single company match only if company is unique in master
  const matchingCompanies = masterResume.experience.filter(
    (e) => e.company.toLowerCase().trim() === tExp.company.toLowerCase().trim()
  );
  if (matchingCompanies.length === 1) {
    return matchingCompanies[0];
  }

  return undefined;
}

export function checkDates(masterResume: MasterResume, tailoredResume: TailoredResume): VerificationIssue[] {
  const issues: VerificationIssue[] = [];

  for (const tExp of tailoredResume.experience) {
    const mExp = findMasterExperience(masterResume, tExp);

    if (mExp) {
      if (mExp.startDate !== tExp.startDate || mExp.endDate !== tExp.endDate) {
        issues.push({
          field: `experience[${tExp.id}].dates`,
          claim: `${tExp.startDate} - ${tExp.endDate || 'Present'}`,
          reason: 'DATE_ALTERED',
          factsOriginal: `${mExp.startDate} - ${mExp.endDate || 'Present'}`,
          severity: 'ERROR',
          repairAction: `Restore exact career vault employment dates for ${tExp.company}: ${mExp.startDate} to ${mExp.endDate || 'Present'}`,
        });
      }
    }
  }

  return issues;
}

export function checkCompanies(masterResume: MasterResume, tailoredResume: TailoredResume): VerificationIssue[] {
  const issues: VerificationIssue[] = [];

  for (const tExp of tailoredResume.experience) {
    const mExp = findMasterExperience(masterResume, tExp);
    if (mExp) {
      const origComp = mExp.company.toLowerCase().trim();
      const tailComp = tExp.company.toLowerCase().trim();
      if (origComp !== tailComp) {
        issues.push({
          field: `experience[${tExp.id}].company`,
          claim: tExp.company,
          reason: 'COMPANY_ALTERED',
          factsOriginal: mExp.company,
          severity: 'ERROR',
          repairAction: `Restore exact company name "${mExp.company}" for experience ID ${tExp.id}`,
        });
      }
    } else {
      const existsByName = masterResume.experience.some(
        (e) => e.company.toLowerCase().trim() === tExp.company.toLowerCase().trim()
      );
      if (!existsByName) {
        issues.push({
          field: `experience[${tExp.id}].company`,
          claim: tExp.company,
          reason: 'COMPANY_ALTERED',
          factsOriginal: 'Not in Career Vault',
          severity: 'ERROR',
          repairAction: `Remove unverified company "${tExp.company}" not present in master career vault`,
        });
      }
    }
  }

  return issues;
}

export function checkTitles(masterResume: MasterResume, tailoredResume: TailoredResume): VerificationIssue[] {
  const issues: VerificationIssue[] = [];

  for (const tExp of tailoredResume.experience) {
    const mExp = findMasterExperience(masterResume, tExp);
    if (mExp) {
      const origTitle = mExp.title.toLowerCase().trim();
      const tailTitle = tExp.title.toLowerCase().trim();
      if (origTitle !== tailTitle) {
        issues.push({
          field: `experience[${tExp.id}].title`,
          claim: tExp.title,
          reason: 'TITLE_ALTERED',
          factsOriginal: mExp.title,
          severity: 'ERROR',
          repairAction: `Restore exact verified job title "${mExp.title}" for ${mExp.company}`,
        });
      }
    }
  }

  return issues;
}

export function checkDegrees(masterResume: MasterResume, tailoredResume: TailoredResume): VerificationIssue[] {
  const issues: VerificationIssue[] = [];

  for (const tEdu of tailoredResume.education) {
    const mEdu = masterResume.education.find((e) => e.id === tEdu.id);
    if (mEdu) {
      const origDeg = `${mEdu.degree} from ${mEdu.institution}`.toLowerCase().trim();
      const tailDeg = `${tEdu.degree} from ${tEdu.institution}`.toLowerCase().trim();
      if (origDeg !== tailDeg) {
        issues.push({
          field: `education[${tEdu.id}]`,
          claim: `${tEdu.degree} at ${tEdu.institution}`,
          reason: 'DEGREE_ALTERED',
          factsOriginal: `${mEdu.degree} at ${mEdu.institution}`,
          severity: 'ERROR',
          repairAction: `Restore exact degree and institution "${mEdu.degree} at ${mEdu.institution}"`,
        });
      }
    } else {
      const exists = masterResume.education.some(
        (e) => e.institution.toLowerCase().trim() === tEdu.institution.toLowerCase().trim()
      );
      if (!exists) {
        issues.push({
          field: `education[${tEdu.id}]`,
          claim: `${tEdu.degree} at ${tEdu.institution}`,
          reason: 'DEGREE_ALTERED',
          factsOriginal: 'Not in Career Vault',
          severity: 'ERROR',
          repairAction: `Remove unverified education degree "${tEdu.degree} at ${tEdu.institution}"`,
        });
      }
    }
  }

  return issues;
}

export function runLayer1HardChecks(
  masterResume: MasterResume,
  tailoredResume: TailoredResume
): VerificationIssue[] {
  const issues: VerificationIssue[] = [];

  // 1. Check Dates, Companies, Titles, Degrees
  issues.push(...checkDates(masterResume, tailoredResume));
  issues.push(...checkCompanies(masterResume, tailoredResume));
  issues.push(...checkTitles(masterResume, tailoredResume));
  issues.push(...checkDegrees(masterResume, tailoredResume));

  // 2. Check Metrics in each bullet
  const allMasterBullets = new Map<string, string>();
  for (const exp of masterResume.experience) {
    for (const h of exp.highlights) {
      allMasterBullets.set(h.id, h.text);
    }
  }
  for (const proj of masterResume.projects || []) {
    for (const h of proj.highlights || []) {
      allMasterBullets.set(`${proj.id}_highlight`, h);
    }
  }

  for (const tExp of tailoredResume.experience) {
    for (const bullet of tExp.bullets) {
      const sourceTexts: string[] = [];
      for (const sId of bullet.sourceBulletIds || []) {
        const text = allMasterBullets.get(sId);
        if (text) sourceTexts.push(text);
      }
      if (sourceTexts.length === 0 && bullet.original) {
        sourceTexts.push(bullet.original);
      }

      const metricIssues = checkMetricsContradiction(
        sourceTexts,
        bullet.tailored,
        `experience[${tExp.id}].bullets[${bullet.id}]`
      );
      issues.push(...metricIssues);
    }
  }

  return issues;
}
