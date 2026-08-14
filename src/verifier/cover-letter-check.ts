import type { StructuredFacts } from '../types/facts.js';
import type { MasterResume } from '../types/resume.js';
import type { VerificationIssue } from '../types/bundle.js';
import { extractNumericTokens } from './layer1-hard.js';

export function runCoverLetterChecks(
  coverLetterText: string,
  masterFacts: StructuredFacts,
  masterResume: MasterResume
): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  if (!coverLetterText || coverLetterText.trim().length === 0) {
    return issues;
  }

  // 1. Check Metrics mentioned in cover letter
  const clMetrics = extractNumericTokens(coverLetterText);
  const factMetrics = masterFacts.metrics.map((m) => m.value.toLowerCase());
  const allMasterText = [
    ...masterResume.experience.flatMap((e) => e.highlights.map((h) => h.text)),
    ...masterResume.education.map((e) => e.degree),
  ].join(' ');

  for (const mToken of clMetrics) {
    const isKnownMetric =
      factMetrics.some((fm) => fm.includes(mToken.toLowerCase()) || mToken.toLowerCase().includes(fm)) ||
      allMasterText.includes(mToken);

    if (!isKnownMetric) {
      issues.push({
        field: 'cover_letter',
        claim: mToken,
        reason: 'METRIC_CONTRADICTED',
        factsOriginal: 'Not found in Career Vault facts',
        severity: 'ERROR',
        repairAction: `Remove unverified metric "${mToken}" from cover letter or align with verified Career Vault facts`,
      });
    }
  }

  return issues;
}
