import { describe, it, expect } from 'vitest';
import { analyzeJdCompatibility, extractJdSkills } from '../../../src/tailor/jd-matcher.js';
import type { MasterResume } from '../../../src/types/resume.js';
import type { TailoredResume } from '../../../src/types/bundle.js';

describe('Phase 1: Deterministic JD Compatibility & Gap Analysis', () => {
  const masterResume: MasterResume = {
    metadata: {
      schemaVersion: '2.1.0',
      vaultVersion: 1,
      vaultHash: 'hash123',
      lastUpdated: '2026-08-25',
    },
    basics: {
      name: 'Alex Mercer',
      email: 'alex@example.com',
      summary: 'Staff Infrastructure Engineer specializing in Kubernetes, Go, and Distributed Systems.',
    },
    experience: [
      {
        id: 'exp1',
        company: 'Stripe',
        title: 'Staff Engineer',
        startDate: '2021-01',
        endDate: null,
        technologies: ['Kubernetes', 'Go', 'AWS', 'Kafka'],
        highlights: [
          {
            id: 'b1',
            text: 'Scaled Kubernetes clusters to 5,000 nodes using Go controllers.',
            technologies: ['Kubernetes', 'Go'],
          },
          {
            id: 'b2',
            text: 'Built high-throughput Kafka streaming pipelines on AWS.',
            technologies: ['Kafka', 'AWS'],
          },
        ],
      },
    ],
    skills: [
      { id: 's1', name: 'Go', canonical: 'go' },
      { id: 's2', name: 'Kubernetes', canonical: 'kubernetes' },
      { id: 's3', name: 'AWS', canonical: 'amazon web services' },
      { id: 's4', name: 'Kafka', canonical: 'apache kafka' },
      { id: 's5', name: 'Terraform', canonical: 'terraform' },
      { id: 's6', name: 'Rust', canonical: 'rust' },
    ],
    education: [],
    projects: [],
  };

  const jdText = `
We are looking for a Principal Systems Engineer with:
- Deep experience in Kubernetes and Go
- Cloud infrastructure experience on AWS or GCP
- Event streaming with Apache Kafka
- Strong background in Rust and GraphQL
- Mobile iOS development with Swift (Must have)
`;

  it('extracts technical skills from JD text', () => {
    const skills = extractJdSkills(jdText);
    expect(skills).toContain('kubernetes');
    expect(skills).toContain('go');
    expect(skills).toContain('amazon web services');
    expect(skills).toContain('apache kafka');
    expect(skills).toContain('rust');
    expect(skills).toContain('swift');
  });

  it('computes 3-tier gap analysis against Master Vault', () => {
    const result = analyzeJdCompatibility(masterResume, jdText);
    expect(result.score).toBeGreaterThan(60);
    expect(result.rating).toBe('MODERATE_FIT');

    // Covered: Go, Kubernetes, AWS, Kafka, Rust
    expect(result.coveredSkills).toContain('go');
    expect(result.coveredSkills).toContain('kubernetes');
    expect(result.coveredSkills).toContain('apache kafka');

    // True Gap: Swift (missing from vault)
    expect(result.trueSkillGaps).toContain('swift');
    expect(result.recommendations.some((r) => r.includes('swift'))).toBe(true);
  });

  it('distinguishes between covered and untapped vault skills when tailored draft is provided', () => {
    const tailoredResume: TailoredResume = {
      basics: { name: 'Alex Mercer', email: 'alex@example.com' },
      skills: [{ name: 'Go' }, { name: 'Kubernetes' }, { name: 'AWS' }],
      experience: [
        {
          company: 'Stripe',
          title: 'Staff Engineer',
          startDate: '2021-01',
          endDate: null,
          bullets: [
            {
              id: 'b1',
              original: 'Scaled Kubernetes clusters.',
              tailored: 'Scaled Kubernetes clusters to 5,000 nodes.',
              technologies: ['Kubernetes', 'Go'],
              provenance: 'VERIFIED_VAULT',
            },
          ],
        },
      ],
      education: [],
      projects: [],
    };

    const result = analyzeJdCompatibility(masterResume, jdText, tailoredResume);
    // Draft has Go and Kubernetes
    expect(result.coveredSkills).toContain('go');
    expect(result.coveredSkills).toContain('kubernetes');

    // Vault has Kafka, Rust, Terraform, but draft didn't include them
    expect(result.untappedVaultSkills).toContain('apache kafka');
    expect(result.untappedVaultSkills).toContain('rust');

    // True gap is still Swift
    expect(result.trueSkillGaps).toContain('swift');
  });
});
