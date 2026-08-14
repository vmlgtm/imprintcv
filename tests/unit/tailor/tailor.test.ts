import { describe, it, expect } from 'vitest';
import { createFallbackPlan, generatePlan } from '../../../src/tailor/plan.js';
import { tailorWithRepair } from '../../../src/tailor/repair.js';
import { extractFacts } from '../../../src/bootstrap/facts-extractor.js';
import type { MasterResume } from '../../../src/types/resume.js';

describe('Phase 4: Tailoring Pipeline', () => {
  const master: MasterResume = {
    metadata: {
      schemaVersion: '2.1.0',
      vaultVersion: 1,
      vaultHash: 'hash_test',
      lastUpdated: '2026-08-14T00:00:00Z',
    },
    basics: {
      name: 'Sam Altman',
      email: 'sam@openai.com',
    },
    experience: [
      {
        id: 'exp_stripe',
        company: 'Stripe',
        title: 'Principal Engineer',
        startDate: '2020-01',
        endDate: null,
        highlights: [
          {
            id: 'bullet_stripe_01',
            text: 'Scaled Kafka cluster handling 100,000 msg/sec with zero message loss.',
            technologies: ['Kafka', 'Kubernetes'],
          },
          {
            id: 'bullet_stripe_02',
            text: 'Cut cloud compute costs by 30% through auto-scaling Kubernetes nodes.',
            technologies: ['Kubernetes', 'AWS'],
          },
        ],
        technologies: ['Kafka', 'Kubernetes', 'AWS'],
      },
    ],
    skills: [
      { id: 'skill_k8s', name: 'Kubernetes', canonical: 'kubernetes' },
      { id: 'skill_kafka', name: 'Kafka', canonical: 'apache kafka' },
    ],
    education: [],
    projects: [],
  };

  const facts = extractFacts(master);
  const jdText = 'Looking for a Senior Kafka & Kubernetes engineer to optimize large scale streaming pipelines.';

  it('generates a valid constrained tailoring plan referencing existing bullet IDs', async () => {
    const plan = await generatePlan(master, jdText, {
      targetRole: 'Senior Distributed Systems Engineer',
      targetCompany: 'Uber',
    });

    expect(plan.targetRole).toBeDefined();
    expect(plan.experiencePlan).toHaveLength(1);
    expect(plan.experiencePlan[0].reorder).toContain('bullet_stripe_01');
    expect(plan.experiencePlan[0].reorder).toContain('bullet_stripe_02');
  });

  it('executes tailoring and produces verified tailored bullets with provenance', async () => {
    const plan = createFallbackPlan(master, jdText, 'Senior Engineer', 'Uber');
    const result = await tailorWithRepair(master, facts, plan, jdText);

    expect(result.tailoredResume).toBeDefined();
    expect(result.coverLetter).toContain('Dear Hiring Manager');
    expect(result.verificationReport.status).toBe('PASS');
    expect(result.tailoredResume.experience[0].bullets[0].sourceBulletIds).toBeDefined();
    expect(result.tailoredResume.experience[0].bullets[0].sourceBulletIds).toHaveLength(1);
  });
});
