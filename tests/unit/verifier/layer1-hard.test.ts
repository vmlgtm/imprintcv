import { describe, it, expect } from 'vitest';
import { runLayer1HardChecks, checkMetricsContradiction } from '../../../src/verifier/layer1-hard.js';
import type { MasterResume } from '../../../src/types/resume.js';
import type { TailoredResume } from '../../../src/types/bundle.js';

describe('Phase 3: Layer 1 Hard Contradiction Checks', () => {
  const master: MasterResume = {
    metadata: {
      schemaVersion: '2.1.0',
      vaultVersion: 1,
      vaultHash: 'hash',
      lastUpdated: '2026-08-14T00:00:00Z',
    },
    basics: {
      name: 'Jane Doe',
      email: 'jane@example.com',
    },
    experience: [
      {
        id: 'exp_stripe',
        company: 'Stripe',
        title: 'Senior Software Engineer',
        startDate: '2021-01',
        endDate: '2024-01',
        highlights: [
          {
            id: 'bullet_stripe_01',
            text: 'Reduced API response latency by 25% across 10 microservices processing 50,000 req/sec.',
            technologies: ['Go', 'Kafka'],
          },
        ],
        technologies: ['Go', 'Kafka'],
      },
    ],
    skills: [{ id: 'skill_go', name: 'Go', canonical: 'go' }],
    education: [
      {
        id: 'edu_mit',
        institution: 'MIT',
        degree: 'B.S. in Computer Science',
      },
    ],
    projects: [],
  };

  it('passes when tailored metrics and facts match original exactly or with valid rephrasing', () => {
    const tailored: TailoredResume = {
      targetRole: 'Backend Engineer',
      targetCompany: 'Acme',
      basics: master.basics,
      experience: [
        {
          id: 'exp_stripe',
          company: 'Stripe',
          title: 'Senior Software Engineer',
          startDate: '2021-01',
          endDate: '2024-01',
          technologies: ['Go', 'Kafka'],
          bullets: [
            {
              id: 'bullet_stripe_01',
              sourceBulletIds: ['bullet_stripe_01'],
              sourceFactIds: [],
              original: master.experience[0].highlights[0].text,
              tailored: 'Optimized high-throughput Go services (50,000 req/sec), achieving a 25% reduction in API response latency across 10 microservices.',
              status: 'REWORDED',
              matchedKeywords: ['Go', 'latency'],
            },
          ],
        },
      ],
      skills: master.skills,
      education: master.education,
    };

    const issues = runLayer1HardChecks(master, tailored);
    expect(issues).toHaveLength(0);
  });

  it('detects inflated or altered numeric metrics as ERROR', () => {
    const tailored: TailoredResume = {
      targetRole: 'Backend Engineer',
      targetCompany: 'Acme',
      basics: master.basics,
      experience: [
        {
          id: 'exp_stripe',
          company: 'Stripe',
          title: 'Senior Software Engineer',
          startDate: '2021-01',
          endDate: '2024-01',
          technologies: ['Go'],
          bullets: [
            {
              id: 'bullet_stripe_01',
              sourceBulletIds: ['bullet_stripe_01'],
              sourceFactIds: [],
              original: master.experience[0].highlights[0].text,
              tailored: 'Reduced latency by 50% across 20 microservices processing 100,000 req/sec.', // Inflated metrics!
              status: 'REWORDED',
              matchedKeywords: [],
            },
          ],
        },
      ],
      skills: master.skills,
      education: master.education,
    };

    const issues = runLayer1HardChecks(master, tailored);
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues.every((i) => i.severity === 'ERROR')).toBe(true);
    expect(issues.some((i) => i.reason === 'METRIC_CONTRADICTED')).toBe(true);
  });

  it('detects altered company name as ERROR', () => {
    const tailored: TailoredResume = {
      targetRole: 'Backend Engineer',
      targetCompany: 'Acme',
      basics: master.basics,
      experience: [
        {
          id: 'exp_stripe',
          company: 'Google', // Altered company!
          title: 'Senior Software Engineer',
          startDate: '2021-01',
          endDate: '2024-01',
          technologies: ['Go'],
          bullets: [],
        },
      ],
      skills: master.skills,
      education: master.education,
    };

    const issues = runLayer1HardChecks(master, tailored);
    expect(issues.some((i) => i.reason === 'COMPANY_ALTERED' && i.severity === 'ERROR')).toBe(true);
  });

  it('detects altered job title as ERROR', () => {
    const tailored: TailoredResume = {
      targetRole: 'Backend Engineer',
      targetCompany: 'Acme',
      basics: master.basics,
      experience: [
        {
          id: 'exp_stripe',
          company: 'Stripe',
          title: 'VP of Engineering', // Altered title!
          startDate: '2021-01',
          endDate: '2024-01',
          technologies: ['Go'],
          bullets: [],
        },
      ],
      skills: master.skills,
      education: master.education,
    };

    const issues = runLayer1HardChecks(master, tailored);
    expect(issues.some((i) => i.reason === 'TITLE_ALTERED' && i.severity === 'ERROR')).toBe(true);
  });

  it('detects altered employment dates as ERROR', () => {
    const tailored: TailoredResume = {
      targetRole: 'Backend Engineer',
      targetCompany: 'Acme',
      basics: master.basics,
      experience: [
        {
          id: 'exp_stripe',
          company: 'Stripe',
          title: 'Senior Software Engineer',
          startDate: '2019-01', // Altered start date!
          endDate: '2024-01',
          technologies: ['Go'],
          bullets: [],
        },
      ],
      skills: master.skills,
      education: master.education,
    };

    const issues = runLayer1HardChecks(master, tailored);
    expect(issues.some((i) => i.reason === 'DATE_ALTERED' && i.severity === 'ERROR')).toBe(true);
  });

  it('detects altered education degree as ERROR', () => {
    const tailored: TailoredResume = {
      targetRole: 'Backend Engineer',
      targetCompany: 'Acme',
      basics: master.basics,
      experience: [],
      skills: master.skills,
      education: [
        {
          id: 'edu_mit',
          institution: 'Stanford University', // Altered institution!
          degree: 'Ph.D. in Computer Science', // Altered degree!
        },
      ],
    };

    const issues = runLayer1HardChecks(master, tailored);
    expect(issues.some((i) => i.reason === 'DEGREE_ALTERED' && i.severity === 'ERROR')).toBe(true);
  });
});
