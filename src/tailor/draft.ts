import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import type { MasterResume } from '../types/resume.js';
import type { StructuredFacts } from '../types/facts.js';
import type { TailoringPlan } from '../types/plan.js';
import type { TailoredResume, TailoredBullet, TailoredExperience } from '../types/bundle.js';
import { getLanguageModel, type ProviderType } from '../utils/llm.js';
import { warn } from '../utils/logger.js';

export interface DraftOptions {
  provider?: ProviderType;
}

const DraftBulletsSchema = z.object({
  bullets: z.array(
    z.object({
      id: z.string().describe('Must match exact input bullet ID'),
      sourceBulletIds: z.array(z.string()).describe('Source bullet ID(s) derived from'),
      original: z.string(),
      tailored: z.string().describe('High-impact tailored bullet strictly grounded in the original bullet facts'),
      status: z.enum(['UNCHANGED', 'REWORDED', 'REORDERED', 'COMPRESSED', 'COMBINED', 'UNSUPPORTED']),
      matchedKeywords: z.array(z.string()),
    })
  ),
  coverLetter: z.string().describe('Targeted 3-paragraph cover letter'),
});

function fallbackDraft(
  masterResume: MasterResume,
  plan: TailoringPlan
): { tailoredResume: TailoredResume; coverLetter: string } {
  const tailoredExpList: TailoredExperience[] = [];

  for (const exp of masterResume.experience) {
    const expPlan = plan.experiencePlan.find((p) => p.companyId === exp.id);
    const highlightMap = new Map(exp.highlights.map((h) => [h.id, h]));

    const bulletOrder = expPlan && expPlan.reorder.length > 0
      ? expPlan.reorder
      : exp.highlights.map((h) => h.id);

    const tailoredBullets: TailoredBullet[] = [];
    for (const bId of bulletOrder) {
      const orig = highlightMap.get(bId);
      if (!orig) continue;

      let status: TailoredBullet['status'] = 'UNCHANGED';
      if (expPlan?.rewrite.includes(bId)) status = 'REWORDED';
      else if (expPlan?.compress.includes(bId)) status = 'COMPRESSED';
      else if (expPlan?.reorder.indexOf(bId) !== exp.highlights.findIndex((h) => h.id === bId)) {
        status = 'REORDERED';
      }

      tailoredBullets.push({
        id: bId,
        sourceBulletIds: [bId],
        sourceFactIds: [],
        original: orig.text,
        tailored: orig.text,
        status,
        matchedKeywords: orig.technologies,
      });
    }

    tailoredExpList.push({
      id: exp.id,
      company: exp.company,
      title: exp.title,
      location: exp.location,
      startDate: exp.startDate,
      endDate: exp.endDate,
      bullets: tailoredBullets,
      technologies: exp.technologies,
    });
  }

  const tailoredResume: TailoredResume = {
    targetRole: plan.targetRole,
    targetCompany: plan.targetCompany,
    basics: masterResume.basics,
    experience: tailoredExpList,
    skills: masterResume.skills,
    education: masterResume.education,
    projects: masterResume.projects,
  };

  const primaryExp = masterResume.experience[0];
  const primaryHighlight = primaryExp?.highlights[0]?.text || '';

  const coverLetter = `Dear Hiring Manager at ${plan.targetCompany},

I am writing to express my strong interest in the ${plan.targetRole} position. With a strong track record as ${primaryExp?.title || 'Software Engineer'} at ${primaryExp?.company || 'my previous company'}, I bring deep technical experience in ${plan.emphasizedSkills.slice(0, 3).join(', ')}.

Throughout my career, I have consistently focused on engineering excellence and measurable business results. Notably, ${primaryHighlight} My experience aligns directly with the requirements for this role.

I would welcome the opportunity to discuss how my background can support ${plan.targetCompany}'s engineering goals. Thank you for your time and consideration.

Sincerely,
${masterResume.basics.name}`;

  return { tailoredResume, coverLetter };
}

export async function draftTailoredOutput(
  masterResume: MasterResume,
  masterFacts: StructuredFacts,
  plan: TailoringPlan,
  jdText: string,
  options: DraftOptions = {}
): Promise<{ tailoredResume: TailoredResume; coverLetter: string }> {
  try {
    const model = getLanguageModel({ provider: options.provider });

    const allBulletsToDraft: Array<{
      id: string;
      company: string;
      role: string;
      original: string;
      technologies: string[];
      action: string;
    }> = [];

    for (const exp of masterResume.experience) {
      const expPlan = plan.experiencePlan.find((p) => p.companyId === exp.id);
      for (const h of exp.highlights) {
        let action = 'rephrase for keywords';
        if (expPlan?.compress.includes(h.id)) action = 'compress concisely';
        if (expPlan?.remove.includes(h.id)) continue;
        allBulletsToDraft.push({
          id: h.id,
          company: exp.company,
          role: exp.title,
          original: h.text,
          technologies: h.technologies,
          action,
        });
      }
    }

    const { object } = await generateObject({
      model,
      schema: DraftBulletsSchema,
      prompt: `You are an expert ATS resume editor executing a structured tailoring plan for ${plan.targetRole} at ${plan.targetCompany}.

CORE PRINCIPLE: The LLM is allowed to transform a career fact for keyword alignment; it is NEVER allowed to redefine the career fact.

CRITICAL CONSTRAINTS:
1. PROVENANCE INTEGRITY: For each bullet entry, you MUST tailor the text specifically for that bullet's original fact. Never swap text from other bullets.
2. NO CLAIM ESCALATION: Do NOT upgrade past role titles to "Principal Architect" or "VP". Do NOT upgrade "resilience during outages" to "zero downtime". Do NOT claim "microservices" unless the source explicitly specifies microservices.
3. NO UNGROUNDED TECH: Do NOT claim technologies (e.g. "Azure", "C#", ".NET") in candidate bullets unless present in the candidate's career data.
4. EXACT METRIC PRESERVATION: Preserve exact numbers, percentages, and currencies (e.g., "~300 retail stores", "400+ collection centres", "~₹62 lakh annually", "~3 days vs ~14 days", "9 frontend engineers").
5. Write a compelling 3-paragraph cover letter referencing only facts present in the candidate's career data.

JOB DESCRIPTION:
${jdText}

TARGET ROLE: ${plan.targetRole} at ${plan.targetCompany}

BULLETS TO EXECUTE:
${JSON.stringify(allBulletsToDraft, null, 2)}`,
    });

    const draftedBulletMap = new Map(object.bullets.map((b) => [b.id, b]));

    const tailoredExpList: TailoredExperience[] = masterResume.experience.map((exp) => {
      const expPlan = plan.experiencePlan.find((p) => p.companyId === exp.id);
      const bulletOrder = expPlan && expPlan.reorder.length > 0 ? expPlan.reorder : exp.highlights.map((h) => h.id);

      const bullets: TailoredBullet[] = [];
      for (const bId of bulletOrder) {
        const orig = exp.highlights.find((h) => h.id === bId);
        if (!orig) continue;
        const drafted = draftedBulletMap.get(bId);

        bullets.push({
          id: bId,
          sourceBulletIds: [bId],
          sourceFactIds: [],
          original: orig.text,
          tailored: drafted?.tailored || orig.text,
          status: drafted?.status || 'UNCHANGED',
          matchedKeywords: drafted?.matchedKeywords || orig.technologies,
        });
      }

      return {
        id: exp.id,
        company: exp.company,
        title: exp.title,
        location: exp.location,
        startDate: exp.startDate,
        endDate: exp.endDate,
        bullets,
        technologies: exp.technologies,
      };
    });

    const tailoredResume: TailoredResume = {
      targetRole: plan.targetRole,
      targetCompany: plan.targetCompany,
      basics: masterResume.basics,
      experience: tailoredExpList,
      skills: masterResume.skills,
      education: masterResume.education,
      projects: masterResume.projects,
    };

    return {
      tailoredResume,
      coverLetter: object.coverLetter,
    };
  } catch (err) {
    warn(`AI drafting warning: ${(err as Error).message}. Using deterministic fallback execution.`);
    return fallbackDraft(masterResume, plan);
  }
}
