import { describe, it, expect } from 'vitest';
import { MasterResumeSchema, type MasterResume } from '../../../src/types/resume.js';
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
});
