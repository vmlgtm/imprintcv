import { describe, it, expect } from 'vitest';
import { verify } from '../../../src/verifier/index.js';
import type { MasterResume } from '../../../src/types/resume.js';
import type { TailoredResume } from '../../../src/types/bundle.js';

describe('Phase 3: Verifier Orchestrator & Status Contract', () => {
  const master: MasterResume = {
    metadata: {
      schemaVersion: '2.1.0',
      vaultVersion: 1,
      vaultHash: 'hash_xyz',
      lastUpdated: '2026-08-14T00:00:00Z',
    },
    basics: {
      name: 'Alex',
      email: 'alex@example.com',
    },
    experience: [
      {
        id: 'exp_stripe',
        company: 'Stripe',
        title: 'Staff Engineer',
        startDate: '2021-01',
        endDate: null,
        highlights: [
          {
            id: 'bullet_stripe_01',
            text: 'Built payment engine processing 50,000 req/sec in Go and Kafka.',
            technologies: ['Go', 'Kafka'],
          },
        ],
        technologies: ['Go', 'Kafka'],
      },
    ],
    skills: [
      { id: 'skill_go', name: 'Go', canonical: 'go' },
      { id: 'skill_kafka', name: 'Kafka', canonical: 'apache kafka' },
    ],
    education: [
      {
        id: 'edu_ucb',
        institution: 'UC Berkeley',
        degree: 'B.S. in CS',
      },
    ],
    projects: [],
  };

  it('returns PASS when errorCount === 0 and warningCount === 0', () => {
    const tailored: TailoredResume = {
      targetRole: 'Staff Backend Engineer',
      targetCompany: 'Uber',
      basics: master.basics,
      experience: [
        {
          id: 'exp_stripe',
          company: 'Stripe',
          title: 'Staff Engineer',
          startDate: '2021-01',
          endDate: null,
          technologies: ['Go', 'Kafka'],
          bullets: [
            {
              id: 'bullet_stripe_01',
              sourceBulletIds: ['bullet_stripe_01'],
              sourceFactIds: [],
              original: master.experience[0].highlights[0].text,
              tailored: 'Architected payment processing engine handling 50,000 req/sec using Go and Kafka.',
              status: 'REWORDED',
              matchedKeywords: ['Go', 'Kafka'],
            },
          ],
        },
      ],
      skills: master.skills,
      education: master.education,
    };

    const report = verify(master, tailored);
    expect(report.status).toBe('PASS');
    expect(report.errorCount).toBe(0);
    expect(report.warningCount).toBe(0);
    expect(report.issues).toHaveLength(0);
  });

  it('returns PASS_WITH_WARNINGS when errorCount === 0 and warningCount > 0', () => {
    const tailored: TailoredResume = {
      targetRole: 'Staff Backend Engineer',
      targetCompany: 'Uber',
      basics: master.basics,
      experience: [
        {
          id: 'exp_stripe',
          company: 'Stripe',
          title: 'Staff Engineer',
          startDate: '2021-01',
          endDate: null,
          technologies: ['Go', 'Rust'], // Rust is unmapped warning
          bullets: [
            {
              id: 'bullet_stripe_01',
              sourceBulletIds: ['bullet_stripe_01'],
              sourceFactIds: [],
              original: master.experience[0].highlights[0].text,
              tailored: 'Architected payment processing engine handling 50,000 req/sec using Go.',
              status: 'REWORDED',
              matchedKeywords: ['Go'],
            },
          ],
        },
      ],
      skills: master.skills,
      education: master.education,
    };

    const report = verify(master, tailored);
    expect(report.status).toBe('PASS_WITH_WARNINGS');
    expect(report.errorCount).toBe(0);
    expect(report.warningCount).toBeGreaterThan(0);
  });

  it('returns FAIL when errorCount > 0', () => {
    const tailored: TailoredResume = {
      targetRole: 'Staff Backend Engineer',
      targetCompany: 'Uber',
      basics: master.basics,
      experience: [
        {
          id: 'exp_stripe',
          company: 'Stripe',
          title: 'Staff Engineer',
          startDate: '2021-01',
          endDate: null,
          technologies: ['Go'],
          bullets: [
            {
              id: 'bullet_stripe_01',
              sourceBulletIds: ['bullet_stripe_01'],
              sourceFactIds: [],
              original: master.experience[0].highlights[0].text,
              tailored: 'Built payment engine processing 500,000 req/sec in Go.', // 10x metric inflation
              status: 'REWORDED',
              matchedKeywords: ['Go'],
            },
          ],
        },
      ],
      skills: master.skills,
      education: master.education,
    };

    const report = verify(master, tailored);
    expect(report.status).toBe('FAIL');
    expect(report.errorCount).toBeGreaterThan(0);
  });

  it('emits WARNING when a source bullet belongs to a different company experience section', () => {
    const tailored: TailoredResume = {
      targetRole: 'Staff Backend Engineer',
      targetCompany: 'Uber',
      basics: master.basics,
      experience: [
        {
          id: 'exp_google', // Target experience ID is exp_google, but bullet is from exp_stripe
          company: 'Google',
          title: 'Staff Engineer',
          startDate: '2021-01',
          endDate: null,
          technologies: ['Go', 'Kafka'],
          bullets: [
            {
              id: 'bullet_google_01',
              sourceBulletIds: ['bullet_stripe_01'], // Source belongs to exp_stripe
              sourceFactIds: [],
              original: master.experience[0].highlights[0].text,
              tailored: 'Architected payment processing engine handling 50,000 req/sec using Go and Kafka.',
              status: 'REWORDED',
              matchedKeywords: ['Go', 'Kafka'],
            },
          ],
        },
      ],
      skills: master.skills,
      education: master.education,
    };

    const report = verify(master, tailored);
    const mismatchWarning = report.issues.find(
      (i) => i.reason === 'PROVENANCE_MISMATCH' && i.severity === 'WARNING'
    );
    expect(mismatchWarning).toBeDefined();
    expect(mismatchWarning?.factsOriginal).toContain('belongs to "exp_stripe", not "exp_google"');
  });
});
