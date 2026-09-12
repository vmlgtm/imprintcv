import type { MasterResume } from '../types/resume.js';
import type { TailoredResume } from '../types/bundle.js';
import { canonicalizeSkill, areSkillsEquivalent, SKILL_ALIASES } from '../utils/skill-taxonomy.js';

export interface JdMatchResult {
  score: number; // 0 - 100
  rating: 'STRONG_FIT' | 'MODERATE_FIT' | 'SIGNIFICANT_GAPS';
  summary: string;
  totalJdSkillsCount: number;
  coveredCount: number;
  coveredSkills: string[];
  untappedVaultSkills: string[];
  trueSkillGaps: string[];
  recommendations: string[];
}

/**
 * Extracts skills and technical keywords from raw job description text.
 */
export function extractJdSkills(jdText: string): string[] {
  if (!jdText) return [];
  const foundSkills = new Set<string>();

  // 1. Check all canonical keys and aliases in our taxonomy
  for (const [alias, canonical] of Object.entries(SKILL_ALIASES)) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[^a-zA-Z0-9_+#])${escaped}([^a-zA-Z0-9_+#]|$)`, 'i');
    if (regex.test(jdText)) {
      foundSkills.add(canonical);
    }
  }

  // 2. Extract capitalized technology tokens (e.g. Kubernetes, Snowflake, GraphQL)
  const commonTech = [
    'kubernetes', 'docker', 'terraform', 'aws', 'gcp', 'azure', 'graphql', 'rest',
    'postgresql', 'mysql', 'mongodb', 'redis', 'kafka', 'grpc', 'typescript', 'javascript',
    'python', 'golang', 'rust', 'java', 'c++', 'c#', 'react', 'next.js', 'vue', 'angular',
    'node.js', 'fastapi', 'django', 'spring boot', 'ci/cd', 'microservices', 'distributed systems',
    'linux', 'ebpf', 'prometheus', 'opentelemetry', 'argocd', 'security', 'llm', 'rag', 'pytorch',
  ];

  for (const tech of commonTech) {
    const canonical = canonicalizeSkill(tech);
    const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[^a-zA-Z0-9_+#])${escaped}([^a-zA-Z0-9_+#]|$)`, 'i');
    if (regex.test(jdText)) {
      foundSkills.add(canonical);
    }
  }

  return Array.from(foundSkills);
}

/**
 * Collects all unique skills present across all experiences, highlights, projects, and skills in the vault.
 */
export function getAllVaultSkills(vault: MasterResume): Set<string> {
  const vaultSkills = new Set<string>();

  // Explicit skills list
  for (const s of vault.skills || []) {
    vaultSkills.add(canonicalizeSkill(s.name));
    if (s.canonical) vaultSkills.add(canonicalizeSkill(s.canonical));
  }

  // Experience technologies & highlights
  for (const exp of vault.experience || []) {
    for (const t of exp.technologies || []) {
      vaultSkills.add(canonicalizeSkill(t));
    }
    for (const h of exp.highlights || []) {
      for (const t of h.technologies || []) {
        vaultSkills.add(canonicalizeSkill(t));
      }
    }
  }

  // Projects technologies
  for (const proj of vault.projects || []) {
    for (const t of proj.technologies || []) {
      vaultSkills.add(canonicalizeSkill(t));
    }
  }

  return vaultSkills;
}

/**
 * Analyzes JD compatibility against the candidate's Career Vault and optional tailored draft.
 */
export function analyzeJdCompatibility(
  masterResume: MasterResume,
  jdText: string,
  tailoredResume?: TailoredResume
): JdMatchResult {
  const jdSkills = extractJdSkills(jdText);
  const vaultSkills = getAllVaultSkills(masterResume);

  const draftSkills = new Set<string>();
  if (tailoredResume) {
    for (const s of tailoredResume.skills || []) {
      draftSkills.add(canonicalizeSkill(s.name));
    }
    for (const exp of tailoredResume.experience || []) {
      for (const t of exp.technologies || []) {
        draftSkills.add(canonicalizeSkill(t));
      }
      for (const b of exp.bullets || []) {
        for (const kw of b.matchedKeywords || []) {
          draftSkills.add(canonicalizeSkill(kw));
        }
      }
    }
  }

  const coveredSkills: string[] = [];
  const untappedVaultSkills: string[] = [];
  const trueSkillGaps: string[] = [];

  for (const skill of jdSkills) {
    const isPresentInVault = Array.from(vaultSkills).some((vs) => areSkillsEquivalent(vs, skill));

    if (isPresentInVault) {
      if (tailoredResume) {
        const isPresentInDraft = Array.from(draftSkills).some((ds) => areSkillsEquivalent(ds, skill));
        if (isPresentInDraft) {
          coveredSkills.push(skill);
        } else {
          untappedVaultSkills.push(skill);
        }
      } else {
        coveredSkills.push(skill);
      }
    } else {
      trueSkillGaps.push(skill);
    }
  }

  const totalJdSkillsCount = Math.max(1, jdSkills.length);
  const totalVaultMatches = coveredSkills.length + (tailoredResume ? untappedVaultSkills.length : 0);
  const score = Math.min(100, Math.round((totalVaultMatches / totalJdSkillsCount) * 100));

  let rating: JdMatchResult['rating'] = 'SIGNIFICANT_GAPS';
  if (score >= 75) {
    rating = 'STRONG_FIT';
  } else if (score >= 45) {
    rating = 'MODERATE_FIT';
  }

  const recommendations: string[] = [];
  if (untappedVaultSkills.length > 0) {
    recommendations.push(
      `Consider swapping in vault bullets highlighting: ${untappedVaultSkills.join(', ')}.`
    );
  }
  if (trueSkillGaps.length > 0) {
    recommendations.push(
      `Job requires skills not verified in your vault: ${trueSkillGaps.join(', ')}. Keep answers honest and do not fabricate claims.`
    );
  }
  if (score >= 80) {
    recommendations.push('Strong match profile. Focus your summary on high-impact quantitative achievements.');
  }

  const summary = `Match Score: ${score}% (${rating}) | Covered: ${coveredSkills.length}, Untapped in Vault: ${untappedVaultSkills.length}, Missing Gaps: ${trueSkillGaps.length}`;

  return {
    score,
    rating,
    summary,
    totalJdSkillsCount: jdSkills.length,
    coveredCount: coveredSkills.length,
    coveredSkills,
    untappedVaultSkills,
    trueSkillGaps,
    recommendations,
  };
}
