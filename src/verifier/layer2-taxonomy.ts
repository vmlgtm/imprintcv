import type { MasterResume } from '../types/resume.js';
import type { TailoredResume, VerificationIssue } from '../types/bundle.js';
import { canonicalizeSkill, areSkillsEquivalent } from '../utils/skill-taxonomy.js';

export function runLayer2TaxonomyChecks(
  masterResume: MasterResume,
  tailoredResume: TailoredResume
): { issues: VerificationIssue[]; skillsMatched: string[] } {
  const issues: VerificationIssue[] = [];
  const skillsMatchedSet = new Set<string>();

  // Collect canonical master skills
  const masterCanonicalSkills = new Set<string>();
  for (const s of masterResume.skills || []) {
    masterCanonicalSkills.add(canonicalizeSkill(s.name));
    if (s.canonical) masterCanonicalSkills.add(canonicalizeSkill(s.canonical));
  }
  for (const exp of masterResume.experience || []) {
    for (const t of exp.technologies || []) {
      masterCanonicalSkills.add(canonicalizeSkill(t));
    }
    for (const h of exp.highlights || []) {
      for (const t of h.technologies || []) {
        masterCanonicalSkills.add(canonicalizeSkill(t));
      }
    }
  }
  for (const p of masterResume.projects || []) {
    for (const t of p.technologies || []) {
      masterCanonicalSkills.add(canonicalizeSkill(t));
    }
  }

  // Check tailored skills
  for (const tSkill of tailoredResume.skills || []) {
    const canonical = canonicalizeSkill(tSkill.name);
    const isSupported = Array.from(masterCanonicalSkills).some((mSkill) =>
      areSkillsEquivalent(mSkill, canonical)
    );

    if (isSupported) {
      skillsMatchedSet.add(tSkill.name);
    } else {
      issues.push({
        field: `skills[${tSkill.id || tSkill.name}]`,
        claim: tSkill.name,
        reason: 'UNSUPPORTED_SKILL',
        factsOriginal: 'Not in Master Skills or Experience',
        severity: 'WARNING',
        repairAction: `Verify whether candidate possesses skill "${tSkill.name}" or replace with verified skill from Career Vault: ${Array.from(masterCanonicalSkills).slice(0, 5).join(', ')}`,
      });
    }
  }

  // Check technologies declared in tailored experiences
  for (const tExp of tailoredResume.experience || []) {
    for (const tech of tExp.technologies || []) {
      const canonical = canonicalizeSkill(tech);
      const isSupported = Array.from(masterCanonicalSkills).some((mSkill) =>
        areSkillsEquivalent(mSkill, canonical)
      );

      if (isSupported) {
        skillsMatchedSet.add(tech);
      } else {
        issues.push({
          field: `experience[${tExp.id}].technologies[${tech}]`,
          claim: tech,
          reason: 'UNSUPPORTED_SKILL',
          factsOriginal: 'Not in Master Skills or Experience',
          severity: 'WARNING',
          repairAction: `Replace unverified technology "${tech}" with a canonical skill from master vault`,
        });
      }
    }
  }

  return {
    issues,
    skillsMatched: Array.from(skillsMatchedSet),
  };
}
