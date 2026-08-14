import { describe, it, expect } from 'vitest';
import { computeSyncDiff } from '../../../src/sync/reverse-sync.js';
import type { MasterResume } from '../../../src/types/resume.js';
import type { TailoredResume } from '../../../src/types/bundle.js';

describe('Phase 6: Reverse Sync & Safety Gate', () => {
  const master: MasterResume = {
    metadata: {
      schemaVersion: '2.1.0',
      vaultVersion: 1,
      vaultHash: 'hash_sync',
      lastUpdated: '2026-08-14T00:00:00Z',
    },
    basics: {
      name: 'Sam',
      email: 'sam@example.com',
    },
    experience: [
      {
        id: 'exp_stripe',
        company: 'Stripe',
        title: 'Engineer',
        startDate: '2020-01',
        endDate: null,
        highlights: [
          {
            id: 'bullet_stripe_01',
            text: 'Scaled microservices to 10,000 req/sec.',
            technologies: ['Go'],
          },
        ],
        technologies: ['Go'],
      },
    ],
    skills: [{ id: 'skill_go', name: 'Go', canonical: 'go' }],
    education: [],
    projects: [],
  };

  it('allows syncing non-contradictory bullet refinements and new skills', async () => {
    const tailored: TailoredResume = {
      targetRole: 'Senior SWE',
      targetCompany: 'Uber',
      basics: master.basics,
      experience: [
        {
          id: 'exp_stripe',
          company: 'Stripe',
          title: 'Engineer',
          startDate: '2020-01',
          endDate: null,
          technologies: ['Go'],
          bullets: [
            {
              id: 'bullet_stripe_01',
              sourceBulletIds: ['bullet_stripe_01'],
              sourceFactIds: [],
              original: master.experience[0].highlights[0].text,
              tailored: 'Architected high-scale backend services in Go handling 10,000 req/sec.',
              status: 'REWORDED',
              matchedKeywords: ['Go'],
            },
          ],
        },
      ],
      skills: [
        { id: 'skill_go', name: 'Go', canonical: 'go' },
        { id: 'skill_rust', name: 'Rust', canonical: 'rust' },
      ],
      education: [],
    };

    const result = await computeSyncDiff(master, tailored);
    expect(result.allowed).toBe(true);
    expect(result.diffs.length).toBeGreaterThanOrEqual(1);
    expect(result.diffs.some((d) => d.type === 'REFINED_BULLET')).toBe(true);
    expect(result.diffs.some((d) => d.type === 'ADDED_SKILL')).toBe(true);
  });

  it('blocks syncing contradictory metrics via Safety Gate', async () => {
    const tailored: TailoredResume = {
      targetRole: 'Senior SWE',
      targetCompany: 'Uber',
      basics: master.basics,
      experience: [
        {
          id: 'exp_stripe',
          company: 'Stripe',
          title: 'Engineer',
          startDate: '2020-01',
          endDate: null,
          technologies: ['Go'],
          bullets: [
            {
              id: 'bullet_stripe_01',
              sourceBulletIds: ['bullet_stripe_01'],
              sourceFactIds: [],
              original: master.experience[0].highlights[0].text,
              tailored: 'Scaled microservices to 100,000 req/sec.', // 10x metric inflation
              status: 'REWORDED',
              matchedKeywords: ['Go'],
            },
          ],
        },
      ],
      skills: master.skills,
      education: [],
    };

    const result = await computeSyncDiff(master, tailored);
    expect(result.allowed).toBe(false);
    expect(result.blockReason).toContain('Safety Gate Blocked');
  });
});
