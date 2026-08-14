import { describe, it, expect } from 'vitest';
import { runLayer2TaxonomyChecks } from '../../../src/verifier/layer2-taxonomy.js';
import type { MasterResume } from '../../../src/types/resume.js';
import type { TailoredResume } from '../../../src/types/bundle.js';

describe('Phase 3: Layer 2 Skill Taxonomy Checks', () => {
  const master: MasterResume = {
    metadata: {
      schemaVersion: '2.1.0',
      vaultVersion: 1,
      vaultHash: 'hash',
      lastUpdated: '2026-08-14T00:00:00Z',
    },
    basics: {
      name: 'Bob Ross',
      email: 'bob@example.com',
    },
    experience: [
      {
        id: 'exp_acme',
        company: 'Acme',
        title: 'Developer',
        startDate: '2022-01',
        endDate: null,
        highlights: [],
        technologies: ['Kubernetes', 'PostgreSQL', 'TypeScript'],
      },
    ],
    skills: [
      { id: 'skill_k8s', name: 'Kubernetes', canonical: 'kubernetes' },
      { id: 'skill_postgres', name: 'PostgreSQL', canonical: 'postgresql' },
      { id: 'skill_ts', name: 'TypeScript', canonical: 'typescript' },
    ],
    education: [],
    projects: [],
  };

  it('normalizes skill aliases (e.g. k8s <-> kubernetes, psql <-> postgresql) with no issues', () => {
    const tailored: TailoredResume = {
      targetRole: 'DevOps Engineer',
      targetCompany: 'Corp',
      basics: master.basics,
      experience: [
        {
          id: 'exp_acme',
          company: 'Acme',
          title: 'Developer',
          startDate: '2022-01',
          endDate: null,
          technologies: ['k8s', 'psql', 'ts'], // Aliases of canonical skills
          bullets: [],
        },
      ],
      skills: [
        { id: 'skill_k8s', name: 'k8s', canonical: 'kubernetes' },
        { id: 'skill_psql', name: 'psql', canonical: 'postgresql' },
      ],
      education: [],
    };

    const { issues, skillsMatched } = runLayer2TaxonomyChecks(master, tailored);
    expect(issues).toHaveLength(0);
    expect(skillsMatched.length).toBeGreaterThanOrEqual(2);
  });

  it('flags unverified / unmapped skills as WARNING', () => {
    const tailored: TailoredResume = {
      targetRole: 'DevOps Engineer',
      targetCompany: 'Corp',
      basics: master.basics,
      experience: [
        {
          id: 'exp_acme',
          company: 'Acme',
          title: 'Developer',
          startDate: '2022-01',
          endDate: null,
          technologies: ['Rust', 'Solidity'], // Not in master skills
          bullets: [],
        },
      ],
      skills: [
        { id: 'skill_k8s', name: 'Kubernetes', canonical: 'kubernetes' },
        { id: 'skill_rust', name: 'Rust', canonical: 'rust' }, // Not in master
      ],
      education: [],
    };

    const { issues } = runLayer2TaxonomyChecks(master, tailored);
    expect(issues.length).toBeGreaterThanOrEqual(2);
    expect(issues.every((i) => i.severity === 'WARNING')).toBe(true);
    expect(issues.some((i) => i.reason === 'UNSUPPORTED_SKILL')).toBe(true);
  });
});
