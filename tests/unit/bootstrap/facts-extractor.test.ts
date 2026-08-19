import { describe, it, expect } from 'vitest';
import { extractFacts, calculateYearsExperience } from '../../../src/bootstrap/facts-extractor.js';
import type { MasterResume } from '../../../src/types/resume.js';

describe('Phase 2: Facts Extractor', () => {
  const masterResume: MasterResume = {
    metadata: {
      schemaVersion: '2.1.0',
      vaultVersion: 1,
      vaultHash: 'hash_12345',
      lastUpdated: '2026-08-14T00:00:00Z',
    },
    basics: {
      name: 'Sarah Connor',
      email: 'sarah@cyberdyne.com',
    },
    experience: [
      {
        id: 'exp_cyberdyne',
        company: 'Cyberdyne Systems',
        title: 'Lead Systems Architect',
        startDate: '2020-01',
        endDate: '2024-06',
        highlights: [
          {
            id: 'bullet_cyberdyne_01',
            text: 'Scaled distributed pipeline to 100,000 req/sec while cutting cloud costs by 35%.',
            technologies: ['Rust', 'AWS', 'gRPC'],
          },
          {
            id: 'bullet_cyberdyne_02',
            text: 'Managed migration of 50 databases to CockroachDB with zero downtime.',
            technologies: ['CockroachDB', 'Kubernetes'],
          },
        ],
        technologies: ['Rust', 'AWS', 'CockroachDB', 'Kubernetes'],
      },
    ],
    skills: [
      { id: 'skill_rust', name: 'Rust', canonical: 'rust' },
      { id: 'skill_k8s', name: 'Kubernetes', canonical: 'kubernetes' },
    ],
    education: [
      {
        id: 'edu_mit',
        institution: 'MIT',
        degree: 'M.S. in Computer Science',
      },
    ],
    projects: [],
  };

  it('extracts structured facts including metrics, technologies, and roles', () => {
    const structuredFacts = extractFacts(masterResume);

    expect(structuredFacts.vaultHash).toBe('hash_12345');
    expect(structuredFacts.companies).toHaveLength(1);
    expect(structuredFacts.companies[0].name).toBe('Cyberdyne Systems');
    expect(structuredFacts.totalBulletCount).toBe(2);
    expect(structuredFacts.totalYearsExperience).toBeGreaterThanOrEqual(4);

    // Verify metrics extracted
    const metricValues = structuredFacts.metrics.map((m) => m.value);
    expect(metricValues.some((v) => v.includes('100,000 req/sec'))).toBe(true);
    expect(metricValues.some((v) => v.includes('35%'))).toBe(true);

    // Verify facts list
    const techFacts = structuredFacts.facts.filter((f) => f.type === 'technology');
    expect(techFacts.length).toBeGreaterThanOrEqual(3);
    const roleFacts = structuredFacts.facts.filter((f) => f.type === 'role');
    expect(roleFacts.length).toBe(1);
  });

  it('merges overlapping experience intervals instead of naively summing durations', () => {
    // 4 roles that all had endDate: null (or Present), simulating Bug 6
    const overlappingPresentRoles = [
      {
        id: 'exp_lead',
        company: 'Tata 1mg',
        title: 'Lead Software Engineer',
        startDate: '2024-04',
        endDate: null, // Present
        highlights: [],
        technologies: [],
      },
      {
        id: 'exp_sse',
        company: 'Tata 1mg',
        title: 'Senior Software Engineer',
        startDate: '2022-01',
        endDate: null, // Overlaps completely with 2017-03..Present
        highlights: [],
        technologies: [],
      },
      {
        id: 'exp_sapient',
        company: 'Publicis Sapient',
        title: 'Associate L2 Frontend Engineer',
        startDate: '2020-09',
        endDate: null,
        highlights: [],
        technologies: [],
      },
      {
        id: 'exp_ustraa',
        company: 'USTRAA',
        title: 'Senior Software Developer',
        startDate: '2017-03',
        endDate: null,
        highlights: [],
        technologies: [],
      },
    ];

    // Naive sum would be ~22.2 years. Merged interval from 2017-03 to Current Year is ~9.4 years.
    const years = calculateYearsExperience(overlappingPresentRoles);
    expect(years).toBeGreaterThanOrEqual(8.5);
    expect(years).toBeLessThan(12.0);
  });
});
