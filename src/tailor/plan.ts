import { generateObject } from 'ai';
import type { MasterResume } from '../types/resume.js';
import { TailoringPlanSchema, type TailoringPlan } from '../types/plan.js';
import { getLanguageModel, type ProviderType } from '../utils/llm.js';
import { sanitizeText } from '../privacy/sanitizer.js';
import { warn } from '../utils/logger.js';

export interface PlanOptions {
  provider?: ProviderType;
  targetRole?: string;
  targetCompany?: string;
}

export function createFallbackPlan(
  masterResume: MasterResume,
  jdText: string,
  targetRole?: string,
  targetCompany?: string
): TailoringPlan {
  const jdLower = jdText.toLowerCase();

  const experiencePlan = masterResume.experience.map((exp) => {
    // Score bullets based on keyword overlap with JD
    const bullets = exp.highlights.map((h) => {
      let score = 0;
      for (const tech of h.technologies) {
        if (jdLower.includes(tech.toLowerCase())) score += 3;
      }
      const words = h.text.toLowerCase().split(/\W+/);
      for (const word of words) {
        if (word.length > 3 && jdLower.includes(word)) score += 1;
      }
      return { id: h.id, score };
    });

    // Reorder by score descending
    bullets.sort((a, b) => b.score - a.score);
    const reorderedIds = bullets.map((b) => b.id);

    return {
      companyId: exp.id,
      reorder: reorderedIds,
      rewrite: reorderedIds.slice(0, Math.min(2, reorderedIds.length)),
      compress: reorderedIds.slice(2),
      remove: [],
    };
  });

  const allSkills = masterResume.skills.map((s) => s.name);
  const emphasizedSkills = allSkills.filter((s) => jdLower.includes(s.toLowerCase()));

  return {
    targetRole: targetRole || 'Software Engineer',
    targetCompany: targetCompany || 'Target Company',
    strategySummary: 'Prioritized relevant technical highlights and high-impact metrics matching the job requirements.',
    experiencePlan,
    emphasizedSkills: emphasizedSkills.length > 0 ? emphasizedSkills : allSkills.slice(0, 5),
    omittedSkills: [],
  };
}

export async function generatePlan(
  masterResume: MasterResume,
  jdText: string,
  options: PlanOptions = {}
): Promise<TailoringPlan> {
  const sanitizedMaster = sanitizeText(JSON.stringify(masterResume, null, 2)).sanitized;

  try {
    const model = getLanguageModel({ provider: options.provider });
    const { object } = await generateObject({
      model,
      schema: TailoringPlanSchema,
      prompt: `You are an elite ATS resume strategist. Generate a structured TailoringPlan to tailor the candidate's master resume for the target job description.\n\nCRITICAL CONSTRAINTS:\n1. Use existing stable bullet IDs ONLY (e.g. "bullet_stripe_01"). Do not create new bullet IDs.\n2. Do NOT invent new facts, metrics, or technologies.\n3. Prioritize bullets with measurable achievements and relevant keywords.\n\nMASTER RESUME:\n${sanitizedMaster}\n\nTARGET JOB DESCRIPTION:\n${jdText}`,
    });
    return object;
  } catch (err) {
    warn(`AI plan generation warning: ${(err as Error).message}. Using deterministic fallback plan.`);
    return createFallbackPlan(masterResume, jdText, options.targetRole, options.targetCompany);
  }
}
