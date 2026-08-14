import type { MasterResume } from '../types/resume.js';
import type { StructuredFacts } from '../types/facts.js';
import type { TailoredResume, VerificationReport, VerificationStatus, VerificationIssue } from '../types/bundle.js';
import { runLayer1HardChecks } from './layer1-hard.js';
import { checkProvenance } from './provenance.js';
import { checkClaimEscalation } from './claim-escalation.js';
import { runLayer2TaxonomyChecks } from './layer2-taxonomy.js';
import { runLayer3ModifierChecks } from './layer3-modifiers.js';
import { runCoverLetterChecks } from './cover-letter-check.js';
import { extractFacts } from '../bootstrap/facts-extractor.js';

export function verify(
  masterResume: MasterResume,
  tailoredResume: TailoredResume,
  coverLetter?: string,
  providedFacts?: StructuredFacts
): VerificationReport {
  const masterFacts = providedFacts || extractFacts(masterResume);
  const issues: VerificationIssue[] = [];

  // 1. Layer 1: Hard Checks (Dates, Companies, Titles, Degrees, Metrics)
  const layer1Issues = runLayer1HardChecks(masterResume, tailoredResume);
  issues.push(...layer1Issues);

  // 2. Provenance Validation (ERROR: PROVENANCE_MISMATCH)
  const provenanceIssues = checkProvenance(masterResume, tailoredResume);
  issues.push(...provenanceIssues);

  // 3. Claim Escalation (ERROR: CLAIM_STRENGTH_ESCALATION, CLAIM_SCOPE_ESCALATION, UNSUPPORTED_TECH_CLAIM)
  const escalationIssues = checkClaimEscalation(masterResume, tailoredResume);
  issues.push(...escalationIssues);

  // 4. Layer 2: Taxonomy Checks (WARNING)
  const { issues: layer2Issues, skillsMatched } = runLayer2TaxonomyChecks(masterResume, tailoredResume);
  issues.push(...layer2Issues);

  // 5. Layer 3: Claim Modifiers (WARNING)
  const layer3Issues = runLayer3ModifierChecks(masterResume, tailoredResume);
  issues.push(...layer3Issues);

  // 6. Cover letter check
  if (coverLetter) {
    const clIssues = runCoverLetterChecks(coverLetter, masterFacts, masterResume);
    issues.push(...clIssues);
  }

  const errorCount = issues.filter((i) => i.severity === 'ERROR').length;
  const warningCount = issues.filter((i) => i.severity === 'WARNING').length;

  let status: VerificationStatus = 'PASS';
  if (errorCount > 0) {
    status = 'FAIL';
  } else if (warningCount > 0) {
    status = 'PASS_WITH_WARNINGS';
  }

  return {
    status,
    errorCount,
    warningCount,
    issues,
    metricsVerified: masterFacts.metrics.length,
    skillsMatched,
  };
}

export * from './layer1-hard.js';
export * from './provenance.js';
export * from './claim-escalation.js';
export * from './layer2-taxonomy.js';
export * from './layer3-modifiers.js';
export * from './cover-letter-check.js';
