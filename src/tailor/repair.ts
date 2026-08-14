import { generateObject } from 'ai';
import { z } from 'zod';
import type { MasterResume } from '../types/resume.js';
import type { StructuredFacts } from '../types/facts.js';
import type { TailoringPlan } from '../types/plan.js';
import type { TailoredResume, VerificationReport } from '../types/bundle.js';
import { verify } from '../verifier/index.js';
import { draftTailoredOutput } from './draft.js';
import { getLanguageModel, type ProviderType } from '../utils/llm.js';
import { info, warn } from '../utils/logger.js';

export interface TailorWithRepairOptions {
  provider?: ProviderType;
  maxRepairAttempts?: number;
}

export interface TailoringResult {
  tailoredResume: TailoredResume;
  coverLetter: string;
  verificationReport: VerificationReport;
  attempts: number;
}

const RepairedBulletsSchema = z.object({
  fixedBullets: z.array(
    z.object({
      bulletId: z.string(),
      tailored: z.string().describe('Factual drop-in replacement bullet'),
    })
  ),
  fixedCoverLetter: z.string().optional(),
});

export async function tailorWithRepair(
  masterResume: MasterResume,
  masterFacts: StructuredFacts,
  plan: TailoringPlan,
  jdText: string,
  options: TailorWithRepairOptions = {}
): Promise<TailoringResult> {
  const maxAttempts = options.maxRepairAttempts ?? 3;
  let attempts = 1;

  // Initial draft
  let { tailoredResume, coverLetter } = await draftTailoredOutput(
    masterResume,
    masterFacts,
    plan,
    jdText,
    { provider: options.provider }
  );

  let verificationReport = verify(masterResume, tailoredResume, coverLetter, masterFacts);

  while (verificationReport.status === 'FAIL' && attempts < maxAttempts) {
    attempts++;
    info(`Verification returned FAIL (Attempt ${attempts - 1}/${maxAttempts - 1}). Running self-repair loop...`);

    const errorIssues = verificationReport.issues.filter((i) => i.severity === 'ERROR');
    const repairActions = errorIssues.map((i) => `[${i.field}] Claim: "${i.claim}" -> Action: ${i.repairAction}`);

    try {
      const model = getLanguageModel({ provider: options.provider });
      const { object } = await generateObject({
        model,
        schema: RepairedBulletsSchema,
        prompt: `You are correcting factual hallucination errors in a tailored resume draft.

ISSUES TO FIX:
${repairActions.join('\n')}

Please regenerate only the flagged bullets with 100% adherence to original Career Vault facts.
Preserve exact metrics, numbers, and scope without escalation.`,
      });

      const fixMap = new Map(object.fixedBullets.map((b) => [b.bulletId, b.tailored]));
      for (const exp of tailoredResume.experience) {
        for (const b of exp.bullets) {
          if (fixMap.has(b.id)) {
            b.tailored = fixMap.get(b.id)!;
          }
        }
      }
      if (object.fixedCoverLetter) {
        coverLetter = object.fixedCoverLetter;
      }
    } catch (err) {
      warn(`Self-repair prompt warning: ${(err as Error).message}. Reverting flagged bullets to exact original text.`);
      for (const exp of tailoredResume.experience) {
        for (const b of exp.bullets) {
          const isFlagged = errorIssues.some((issue) => issue.field.includes(b.id));
          if (isFlagged && b.original) {
            b.tailored = b.original;
          }
        }
      }
    }

    verificationReport = verify(masterResume, tailoredResume, coverLetter, masterFacts);
  }

  // If still failing after max attempts, deterministically revert remaining error bullets to original
  if (verificationReport.status === 'FAIL') {
    const finalErrors = verificationReport.issues.filter((i) => i.severity === 'ERROR');
    for (const exp of tailoredResume.experience) {
      for (const b of exp.bullets) {
        const isFlagged = finalErrors.some((issue) => issue.field.includes(b.id));
        if (isFlagged && b.original) {
          b.tailored = b.original;
        }
      }
    }
    verificationReport = verify(masterResume, tailoredResume, coverLetter, masterFacts);
  }

  return {
    tailoredResume,
    coverLetter,
    verificationReport,
    attempts,
  };
}
