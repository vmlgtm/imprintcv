import type { MasterResume } from '../types/resume.js';
import type { TailoredResume, VerificationIssue } from '../types/bundle.js';

// Absolute / ungrounded claim patterns that escalate beyond source facts
const STRENGTH_ESCALATION_PATTERNS = [
  { pattern: /\bzero\s+downtime\b/i, label: 'zero downtime', requiredSource: /zero\s+downtime/i },
  { pattern: /\b100%\s+uptime\b/i, label: '100% uptime', requiredSource: /100%\s+uptime/i },
  { pattern: /\bzero\s+latency\b/i, label: 'zero latency', requiredSource: /zero\s+latency/i },
  { pattern: /\bzero\s+bugs\b/i, label: 'zero bugs', requiredSource: /zero\s+bugs/i },
];

const SCOPE_ESCALATION_PATTERNS = [
  { pattern: /\bprincipal\s+architect\b/i, label: 'Principal Architect' },
  { pattern: /\bchief\s+architect\b/i, label: 'Chief Architect' },
  { pattern: /\bvice\s+president\b|\bvp\s+of\b/i, label: 'VP / Vice President' },
  { pattern: /\bdirector\s+of\s+engineering\b/i, label: 'Director of Engineering' },
  { pattern: /\bhead\s+of\s+engineering\b/i, label: 'Head of Engineering' },
];

const PROHIBITED_INFERRED_TECHS = [
  { pattern: /\bazure\b/i, name: 'Azure' },
  { pattern: /\bc#|\b\.net\b/i, name: 'C# / .NET' },
];

export function checkClaimEscalation(
  masterResume: MasterResume,
  tailoredResume: TailoredResume
): VerificationIssue[] {
  const issues: VerificationIssue[] = [];

  // Build full master corpus text
  const allMasterText = JSON.stringify(masterResume).toLowerCase();

  // Check all master titles & tech
  const masterTitles = masterResume.experience.map((e) => e.title.toLowerCase());
  const masterTechs = new Set<string>();
  for (const s of masterResume.skills) masterTechs.add(s.name.toLowerCase());
  for (const exp of masterResume.experience) {
    for (const t of exp.technologies || []) masterTechs.add(t.toLowerCase());
  }
  for (const proj of masterResume.projects || []) {
    for (const t of proj.technologies || []) masterTechs.add(t.toLowerCase());
  }

  // Build lookup of all master bullets
  const masterBulletMap = new Map<string, string>();
  for (const exp of masterResume.experience) {
    for (const h of exp.highlights) {
      masterBulletMap.set(h.id, h.text);
    }
  }

  for (const tExp of tailoredResume.experience) {
    for (const bullet of tExp.bullets) {
      const field = `experience[${tExp.id}].bullets[${bullet.id}]`;
      const tailoredLower = bullet.tailored.toLowerCase();

      // Collect source texts for this bullet
      const sourceTexts = (bullet.sourceBulletIds || [])
        .map((sId) => masterBulletMap.get(sId) || '')
        .join(' ')
        .toLowerCase();

      // 1. Check Strength Escalations (e.g. "zero downtime")
      for (const { pattern, label, requiredSource } of STRENGTH_ESCALATION_PATTERNS) {
        if (pattern.test(tailoredLower)) {
          if (!requiredSource.test(sourceTexts) && !requiredSource.test(allMasterText)) {
            issues.push({
              field,
              claim: label,
              reason: 'CLAIM_STRENGTH_ESCALATION',
              factsOriginal: sourceTexts || 'Career Vault does not claim zero downtime',
              severity: 'ERROR',
              repairAction: `Downgrade absolute claim "${label}" to match canonical source fact (e.g. high resilience / outage tolerance)`,
            });
          }
        }
      }

      // 2. Check Scope Escalations (e.g. "Principal Architect")
      for (const { pattern, label } of SCOPE_ESCALATION_PATTERNS) {
        if (pattern.test(tailoredLower)) {
          const supportedInMaster = masterTitles.some((t) => pattern.test(t)) || pattern.test(sourceTexts);
          if (!supportedInMaster) {
            issues.push({
              field,
              claim: label,
              reason: 'CLAIM_SCOPE_ESCALATION',
              factsOriginal: masterTitles.join(', '),
              severity: 'ERROR',
              repairAction: `Remove unverified title/scope escalation "${label}" not present in candidate's Career Vault history`,
            });
          }
        }
      }

      // 3. Check Unsupported Inferred Technologies (e.g. Azure, C#, .NET)
      for (const { pattern, name } of PROHIBITED_INFERRED_TECHS) {
        if (pattern.test(tailoredLower)) {
          const existsInVault = pattern.test(allMasterText);
          if (!existsInVault) {
            issues.push({
              field,
              claim: name,
              reason: 'UNSUPPORTED_TECH_CLAIM',
              factsOriginal: 'Not in Career Vault',
              severity: 'ERROR',
              repairAction: `Remove ungrounded technology claim "${name}" not present in candidate's Career Vault`,
            });
          }
        }
      }

      // 4. Check Microservices claim when source specifies services
      if (/\bmicroservices\b/i.test(tailoredLower)) {
        const sourceHasMicroservices = /\bmicroservices\b/i.test(sourceTexts) || /\bmicroservices\b/i.test(allMasterText);
        if (!sourceHasMicroservices && /\bservices\b/i.test(sourceTexts)) {
          issues.push({
            field,
            claim: 'microservices',
            reason: 'CLAIM_STRENGTH_ESCALATION',
            factsOriginal: 'Node.js-based services',
            severity: 'ERROR',
            repairAction: `Use exact canonical terminology "Node.js-based services" rather than unverified "Node.js microservices"`,
          });
        }
      }
    }
  }

  return issues;
}
