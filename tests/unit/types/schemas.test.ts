import { describe, it, expect } from 'vitest';
import { MasterResumeSchema, type MasterResume } from '../../../src/types/resume.js';
import { TailoredResumeSchema, normalizeTailoredResume } from '../../../src/types/bundle.js';
import { computeVaultHash } from '../../../src/utils/hash.js';
import { generateJobSlug } from '../../../src/utils/slug.js';

describe('Phase 1: Schemas & Types', () => {
  const sampleResume: MasterResume = {
    metadata: {
      schemaVersion: '2.1.0',
      vaultVersion: 1,
      vaultHash: 'dummy-hash',
      lastUpdated: '2026-08-14T00:00:00Z',
    },
    basics: {
      name: 'Alex Mercer',
      email: 'alex@example.com',
      phone: '+1-555-0199',
      location: 'San Francisco, CA',
      website: 'https://alexmercer.dev',
      linkedin: 'https://linkedin.com/in/alexmercer',
      github: 'https://github.com/alexmercer',
      summary: 'Senior Staff Infrastructure Engineer with 10+ years scaling distributed systems.',
    },
    experience: [
      {
        id: 'exp_stripe',
        company: 'Stripe',
        title: 'Staff Software Engineer',
        location: 'San Francisco, CA',
        startDate: '2021-03',
        endDate: null,
        highlights: [
          {
            id: 'bullet_stripe_01',
            text: 'Architected real-time fraud detection pipeline processing 50,000 req/sec, reducing payment fraud losses by 28%.',
            technologies: ['Go', 'Kafka', 'Kubernetes'],
          },
          {
            id: 'bullet_stripe_02',
            text: 'Led migration of 40 microservices from legacy ECS to multi-region Kubernetes clusters.',
            technologies: ['Kubernetes', 'Terraform', 'AWS'],
          },
        ],
        technologies: ['Go', 'Kafka', 'Kubernetes', 'AWS'],
      },
    ],
    skills: [
      { id: 'skill_go', name: 'Go', canonical: 'go' },
      { id: 'skill_k8s', name: 'Kubernetes', canonical: 'kubernetes' },
      { id: 'skill_kafka', name: 'Kafka', canonical: 'apache kafka' },
    ],
    education: [
      {
        id: 'edu_ucb',
        institution: 'University of California, Berkeley',
        degree: 'B.S. in Computer Science',
        field: 'Computer Science',
        startDate: '2015-08',
        endDate: '2019-05',
      },
    ],
    projects: [
      {
        id: 'proj_distcache',
        name: 'DistCache',
        description: 'Distributed in-memory cache with Raft consensus in Go',
        technologies: ['Go', 'Raft', 'gRPC'],
        url: 'https://github.com/alexmercer/distcache',
        highlights: ['Supports 100k QPS with <2ms P99 latency'],
      },
    ],
  };

  it('validates a correct MasterResume object', () => {
    const parsed = MasterResumeSchema.parse(sampleResume);
    expect(parsed.basics.name).toBe('Alex Mercer');
    expect(parsed.experience).toHaveLength(1);
    expect(parsed.experience[0].highlights).toHaveLength(2);
  });

  it('rejects invalid email', () => {
    const invalid = {
      ...sampleResume,
      basics: {
        ...sampleResume.basics,
        email: 'invalid-email-address',
      },
    };
    expect(() => MasterResumeSchema.parse(invalid)).toThrow();
  });

  it('rejects missing required fields', () => {
    const invalid = { ...sampleResume };
    // @ts-expect-error test missing field
    delete invalid.basics;
    expect(() => MasterResumeSchema.parse(invalid)).toThrow();
  });

  it('computes deterministic SHA256 vault hashes', () => {
    const hash1 = computeVaultHash(sampleResume);
    const hash2 = computeVaultHash(sampleResume);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);

    const modifiedResume: MasterResume = {
      ...sampleResume,
      basics: {
        ...sampleResume.basics,
        name: 'Alex Mercer Jr.',
      },
    };
    const hashModified = computeVaultHash(modifiedResume);
    expect(hashModified).not.toBe(hash1);
  });

  it('generates clean kebab-case job slugs', () => {
    expect(generateJobSlug('Stripe, Inc.', 'Senior Backend Engineer')).toBe('stripe-inc-senior-backend-engineer');
    expect(generateJobSlug('Google', 'Staff SWE / Tech Lead')).toBe('google-staff-swe-tech-lead');
    expect(generateJobSlug('', '')).toBe('company-role');
  });

  it('validates and parses a compliant TailoredResume object', () => {
    const valid = {
      targetRole: 'Senior Infrastructure Engineer',
      targetCompany: 'Stripe',
      basics: {
        name: 'Alex Mercer',
        email: 'alex@example.com',
      },
      experience: [
        {
          id: 'exp_stripe',
          company: 'Stripe',
          title: 'Senior Software Engineer',
          startDate: '2021-03',
          endDate: null,
          technologies: ['Go', 'Kafka'],
          bullets: [
            {
              id: 'bullet_stripe_01',
              sourceBulletIds: ['bullet_stripe_01'],
              original: 'Old text',
              tailored: 'New tailored text',
              status: 'REWORDED',
            },
          ],
        },
      ],
      skills: [{ id: 'skill_go', name: 'Go', canonical: 'go' }],
      education: [{ id: 'edu_ucb', institution: 'UC Berkeley', degree: 'B.S.' }],
    };

    const parsed = TailoredResumeSchema.parse(valid);
    expect(parsed.targetRole).toBe('Senior Infrastructure Engineer');
    expect(parsed.experience[0].bullets[0].status).toBe('REWORDED');
    expect(parsed.experience[0].bullets[0].sourceBulletIds).toEqual(['bullet_stripe_01']);
    expect(parsed.experience[0].bullets[0].original).toBe('Old text');
  });

  it('normalizes legacy highlights into bullets with sensible defaults', () => {
    const legacy = {
      targetRole: 'Senior Backend Engineer',
      targetCompany: 'Stripe',
      basics: {
        name: 'Alex Mercer',
        email: 'alex@example.com',
      },
      experience: [
        {
          id: 'exp_stripe',
          company: 'Stripe',
          title: 'Senior Software Engineer',
          startDate: '2021-03',
          highlights: [
            {
              id: 'bullet_stripe_01',
              text: 'Architected high-throughput pipeline handling 25,000 req/sec.',
            },
          ],
        },
      ],
      skills: ['Go', 'Kubernetes'], // string skills
      education: [{ institution: 'UC Berkeley', degree: 'B.S.' }],
    };

    const parsed = TailoredResumeSchema.parse(legacy);
    expect(parsed.experience[0].bullets).toHaveLength(1);
    const b = parsed.experience[0].bullets[0];
    expect(b.id).toBe('bullet_stripe_01');
    expect(b.sourceBulletIds).toEqual(['bullet_stripe_01']);
    expect(b.original).toBe('Architected high-throughput pipeline handling 25,000 req/sec.');
    expect(b.tailored).toBe('Architected high-throughput pipeline handling 25,000 req/sec.');
    expect(b.status).toBe('UNCHANGED');

    // Verify skills were normalized from strings to structured objects
    expect(parsed.skills).toHaveLength(2);
    expect(parsed.skills[0]).toEqual({
      id: 'skill_go',
      name: 'Go',
      canonical: 'go',
    });
  });

  it('rejects invalid TailoredResume with detailed formatted errors', () => {
    const invalid = {
      // missing targetRole and targetCompany
      basics: {
        // missing name and email
      },
      experience: [
        {
          // missing company, title, startDate
          id: 'exp_1',
        },
      ],
    };

    const result = TailoredResumeSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = result.error.format();
      expect(formatted.targetRole).toBeDefined();
      expect(formatted.targetCompany).toBeDefined();
      expect(formatted.basics?.name).toBeDefined();
    }
  });

  it('enrichment via normalizeTailoredResume fills provenance from masterResume', () => {
    const raw = {
      targetRole: 'Staff SWE',
      targetCompany: 'Stripe',
      basics: sampleResume.basics,
      experience: [
        {
          id: 'exp_stripe',
          company: 'Stripe',
          title: 'Staff Software Engineer',
          startDate: '2021-03',
          endDate: null,
          bullets: [
            {
              id: 'bullet_stripe_01',
              // sourceBulletIds omitted or empty
              tailored: 'Tailored fraud pipeline handling 50,000 req/sec.',
            },
          ],
        },
      ],
    };

    const enriched = normalizeTailoredResume(raw, sampleResume);
    expect(enriched.experience[0].bullets[0].sourceBulletIds).toEqual(['bullet_stripe_01']);
    expect(enriched.experience[0].bullets[0].original).toBe(
      sampleResume.experience[0].highlights[0].text
    );
  });
});
