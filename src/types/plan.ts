import { z } from 'zod';

export const TailoringPlanSchema = z.object({
  targetRole: z.string(),
  targetCompany: z.string(),
  strategySummary: z.string(),
  experiencePlan: z.array(
    z.object({
      companyId: z.string(),
      reorder: z.array(z.string()).describe('Bullet IDs in priority order'),
      rewrite: z.array(z.string()).describe('Bullet IDs to rephrase for keywords'),
      compress: z.array(z.string()).describe('Bullet IDs to shorten'),
      remove: z.array(z.string()).describe('Bullet IDs omitted due to low relevance'),
      combine: z
        .array(
          z.object({
            sourceIds: z.array(z.string()).describe('Array of 2 bullet IDs to combine'),
            focus: z.string(),
          })
        )
        .optional(),
    })
  ),
  emphasizedSkills: z.array(z.string()),
  omittedSkills: z.array(z.string()),
});

export type TailoringPlan = z.infer<typeof TailoringPlanSchema>;
