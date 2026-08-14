import { describe, it, expect } from 'vitest';
import { runCoverLetterChecks } from '../../../src/verifier/cover-letter-check.js';
import { extractFacts } from '../../../src/bootstrap/facts-extractor.js';
import type { MasterResume } from '../../../src/types/resume.js';

describe('Phase 3: Cover Letter Checks', () => {
  const master: MasterResume = {
    metadata: {
      schemaVersion: '2.1.0',
      vaultVersion: 1,
      vaultHash: 'hash',
      lastUpdated: '2026-08-14T00:00:00Z',
    },
    basics: {
      name: 'John',
      email: 'john@example.com',
    },
    experience: [
      {
        id: 'exp_stripe',
        company: 'Stripe',
        title: 'Senior Engineer',
        startDate: '2021-01',
        endDate: null,
        highlights: [
          {
            id: 'bullet_stripe_01',
            text: 'Scaled microservices to 50,000 req/sec while maintaining 99.99% SLA.',
            technologies: ['Go', 'Kafka'],
          },
        ],
        technologies: ['Go', 'Kafka'],
      },
    ],
    skills: [],
    education: [
      {
        id: 'edu_mit',
        institution: 'MIT',
        degree: 'B.S. in Computer Science',
      },
    ],
    projects: [],
  };

  const facts = extractFacts(master);

  it('passes cover letter containing verified metrics and experience', () => {
    const cl = `Dear Hiring Manager,\n\nAt Stripe, I scaled microservices to 50,000 req/sec while maintaining a 99.99% SLA. I look forward to bringing this expertise to your team.`;
    const issues = runCoverLetterChecks(cl, facts, master);
    expect(issues).toHaveLength(0);
  });

  it('flags unverified metric claims in cover letter as ERROR', () => {
    const cl = `Dear Hiring Manager,\n\nI managed a $50M budget and increased company revenue by 300% across 500 engineers.`;
    const issues = runCoverLetterChecks(cl, facts, master);
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues.some((i) => i.reason === 'METRIC_CONTRADICTED')).toBe(true);
  });
});
