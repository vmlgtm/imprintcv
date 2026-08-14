import { z } from 'zod';

export const CareerVaultMetadataSchema = z.object({
  schemaVersion: z.string().default('2.1.0'),
  vaultVersion: z.number().default(1),
  vaultHash: z.string(), // SHA256 of master content
  lastUpdated: z.string(),
});

export const WorkExperienceSchema = z.object({
  id: z.string(), // e.g. "exp_stripe"
  company: z.string(),
  title: z.string(),
  location: z.string().optional(),
  startDate: z.string(), // "YYYY-MM"
  endDate: z.string().nullable(), // null = "Present"
  highlights: z.array(
    z.object({
      id: z.string(), // e.g. "bullet_stripe_01"
      text: z.string(),
      technologies: z.array(z.string()).default([]),
    })
  ),
  technologies: z.array(z.string()).default([]),
});

export const MasterResumeSchema = z.object({
  metadata: CareerVaultMetadataSchema,
  basics: z.object({
    name: z.string(),
    email: z.string().email(),
    phone: z.string().optional(),
    location: z.string().optional(),
    website: z.string().optional(),
    linkedin: z.string().optional(),
    github: z.string().optional(),
    summary: z.string().optional(),
  }),
  experience: z.array(WorkExperienceSchema),
  skills: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      canonical: z.string(),
    })
  ),
  education: z.array(
    z.object({
      id: z.string(),
      institution: z.string(),
      degree: z.string(),
      field: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })
  ),
  projects: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        technologies: z.array(z.string()),
        url: z.string().optional(),
        highlights: z.array(z.string()).default([]),
      })
    )
    .default([]),
});

export type CareerVaultMetadata = z.infer<typeof CareerVaultMetadataSchema>;
export type WorkExperience = z.infer<typeof WorkExperienceSchema>;
export type MasterResume = z.infer<typeof MasterResumeSchema>;
