import { describe, it, expect } from 'vitest';
import { runLayer3ModifierChecks } from '../../../src/verifier/layer3-modifiers.js';
import type { MasterResume } from '../../../src/types/resume.js';
import type { TailoredResume } from '../../../src/types/bundle.js';

describe('Phase 3: Layer 3 Claim Modifier Checks', () => {
  const master: MasterResume = {
    metadata: {
      schemaVersion: '2.1.0',
      vaultVersion: 1,
      vaultHash: 'hash',
      lastUpdated: '2026-08-14T00:00:00Z',
    },
    basics: {
      name: 'Alice',
      email: 'alice@example.com',
    },
    experience: [
      {
        id: 'exp_stripe',
        company: 'Stripe',
        title: 'Software Engineer',
        startDate: '2020-01',
        endDate: '2023-01',
        highlights: [
          {
            id: 'bullet_stripe_01',
            text: 'Contributed to the internal payments routing service using Go.',
            technologies: ['Go'],
          },
        ],
        technologies: ['Go'],
      },
    ],
    skills: [],
    education: [],
    projects: [],
  };

  it('detects unverified leadership inflation ("Contributed" -> "Led 20 teams") as WARNING', () => {
    const tailored: TailoredResume = {
      targetRole: 'Engineering Manager',
      targetCompany: 'Uber',
      basics: master.basics,
      experience: [
        {
          id: 'exp_stripe',
          company: 'Stripe',
          title: 'Software Engineer',
          startDate: '2020-01',
          endDate: '2023-01',
          technologies: ['Go'],
          bullets: [
            {
              id: 'bullet_stripe_01',
              sourceBulletIds: ['bullet_stripe_01'],
              sourceFactIds: [],
              original: master.experience[0].highlights[0].text,
              tailored: 'Led 20 teams across the company to build payments routing in Go.',
              status: 'REWORDED',
              matchedKeywords: [],
            },
          ],
        },
      ],
      skills: [],
      education: [],
    };

    const issues = runLayer3ModifierChecks(master, tailored);
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues.every((i) => i.severity === 'WARNING')).toBe(true);
    expect(issues.some((i) => i.reason === 'UNSUPPORTED_CLAIM_MODIFIER')).toBe(true);
  });

  it('allows valid rephrasing without modifier escalation', () => {
    const tailored: TailoredResume = {
      targetRole: 'Software Engineer',
      targetCompany: 'Uber',
      basics: master.basics,
      experience: [
        {
          id: 'exp_stripe',
          company: 'Stripe',
          title: 'Software Engineer',
          startDate: '2020-01',
          endDate: '2023-01',
          technologies: ['Go'],
          bullets: [
            {
              id: 'bullet_stripe_01',
              sourceBulletIds: ['bullet_stripe_01'],
              sourceFactIds: [],
              original: master.experience[0].highlights[0].text,
              tailored: 'Engineered backend payment routing services with Go.',
              status: 'REWORDED',
              matchedKeywords: [],
            },
          ],
        },
      ],
      skills: [],
      education: [],
    };

    const issues = runLayer3ModifierChecks(master, tailored);
    expect(issues).toHaveLength(0);
  });
});
