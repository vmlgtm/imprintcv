import type { MasterResume } from '../types/resume.js';
import type { TailoredResume, VerificationIssue } from '../types/bundle.js';

interface ModifierPattern {
  name: string;
  tailoredRegex: RegExp;
  sourceCheckRegex: RegExp;
  description: string;
}

const MODIFIER_PATTERNS: ModifierPattern[] = [
  {
    name: 'LEADERSHIP_ESCALATION',
    tailoredRegex: /\b(?:led\s+\d+|managed\s+\d+|directed\s+\d+|spearheaded\s+team\s+of|headed\s+\d+|oversaw\s+\d+)\b/i,
    sourceCheckRegex: /\b(?:led|managed|directed|spearheaded|headed|oversaw|leadership|lead)\b/i,
    description: 'Unsupported leadership scale claim introduced (e.g. "Led X teams/engineers")',
  },
  {
    name: 'ORGANIZATION_SCOPE_ESCALATION',
    tailoredRegex: /\b(?:company-wide|organization-wide|org-wide|enterprise-wide|across\s+the\s+entire\s+company)\b/i,
    sourceCheckRegex: /\b(?:company-wide|organization-wide|org-wide|enterprise-wide|entire\s+company)\b/i,
    description: 'Unsupported scope expansion to enterprise/company-wide',
  },
  {
    name: 'EXECUTIVE_ACTION_ESCALATION',
    tailoredRegex: /\b(?:spearheaded|orchestrated|founded|championed|solely\s+built|single-handedly)\b/i,
    sourceCheckRegex: /\b(?:spearheaded|orchestrated|founded|championed|solely|single-handedly|created|built|designed|led)\b/i,
    description: 'Significant escalation from contributory to solitary/executive ownership',
  },
];

export function runLayer3ModifierChecks(
  masterResume: MasterResume,
  tailoredResume: TailoredResume
): VerificationIssue[] {
  const issues: VerificationIssue[] = [];

  const allMasterBullets = new Map<string, string>();
  for (const exp of masterResume.experience) {
    for (const h of exp.highlights) {
      allMasterBullets.set(h.id, h.text);
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

      const combinedSources = sourceTexts.join(' ');

      for (const pattern of MODIFIER_PATTERNS) {
        const tailoredMatch = bullet.tailored.match(pattern.tailoredRegex);
        if (tailoredMatch) {
          const sourceHasEquivalent = pattern.sourceCheckRegex.test(combinedSources);
          if (!sourceHasEquivalent) {
            issues.push({
              field: `experience[${tExp.id}].bullets[${bullet.id}]`,
              claim: tailoredMatch[0],
              reason: 'UNSUPPORTED_CLAIM_MODIFIER',
              factsOriginal: combinedSources || 'No equivalent leadership/scale claim in master bullet',
              severity: 'WARNING',
              repairAction: `Tone down unverified modifier "${tailoredMatch[0]}" to match original wording without inflating leadership scope`,
            });
          }
        }
      }
    }
  }

  return issues;
}
