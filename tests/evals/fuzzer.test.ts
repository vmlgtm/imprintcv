import { describe, it, expect } from 'vitest';
import { verify } from '../../src/verifier/index.js';
import type { MasterResume } from '../../src/types/resume.js';
import type { TailoredResume } from '../../src/types/bundle.js';

describe('Phase 8: 15-Category Adversarial Fuzzer', () => {
  const baseMaster: MasterResume = {
    metadata: {
      schemaVersion: '2.1.0',
      vaultVersion: 1,
      vaultHash: 'hash_fuzzer',
      lastUpdated: '2026-08-14T00:00:00Z',
    },
    basics: {
      name: 'Alex Developer',
      email: 'alex@dev.io',
      location: 'San Francisco, CA',
    },
    experience: [
      {
        id: 'exp_stripe',
        company: 'Stripe',
        title: 'Senior Software Engineer',
        location: 'San Francisco, CA',
        startDate: '2021-03',
        endDate: null,
        highlights: [
          {
            id: 'bullet_01',
            text: 'Engineered payment routing engine handling 25,000 req/sec, reducing latency by 35%.',
            technologies: ['Go', 'Kafka', 'Redis'],
          },
          {
            id: 'bullet_02',
            text: 'Assisted in migration of 15 services to Kubernetes cluster.',
            technologies: ['Kubernetes', 'AWS'],
          },
        ],
        technologies: ['Go', 'Kafka', 'Redis', 'Kubernetes', 'AWS'],
      },
    ],
    skills: [
      { id: 's1', name: 'Go', canonical: 'go' },
      { id: 's2', name: 'Kafka', canonical: 'apache kafka' },
      { id: 's3', name: 'Kubernetes', canonical: 'kubernetes' },
    ],
    education: [
      {
        id: 'edu_ucb',
        institution: 'UC Berkeley',
        degree: 'B.S. in Computer Science',
        startDate: '2015-08',
        endDate: '2019-05',
      },
    ],
    projects: [],
  };

  function getBaseTailored(): TailoredResume {
    return {
      targetRole: 'Senior Backend Engineer',
      targetCompany: 'Uber',
      basics: baseMaster.basics,
      experience: [
        {
          id: 'exp_stripe',
          company: 'Stripe',
          title: 'Senior Software Engineer',
          location: 'San Francisco, CA',
          startDate: '2021-03',
          endDate: null,
          technologies: ['Go', 'Kafka', 'Redis'],
          bullets: [
            {
              id: 'bullet_01',
              sourceBulletIds: ['bullet_01'],
              sourceFactIds: [],
              original: baseMaster.experience[0].highlights[0].text,
              tailored: 'Engineered high-scale payment routing engine in Go handling 25,000 req/sec with 35% latency reduction.',
              status: 'REWORDED',
              matchedKeywords: ['Go', 'latency'],
            },
            {
              id: 'bullet_02',
              sourceBulletIds: ['bullet_02'],
              sourceFactIds: [],
              original: baseMaster.experience[0].highlights[1].text,
              tailored: 'Contributed to migration of 15 services to Kubernetes on AWS.',
              status: 'REWORDED',
              matchedKeywords: ['Kubernetes'],
            },
          ],
        },
      ],
      skills: baseMaster.skills.map((s) => ({ ...s })),
      education: baseMaster.education.map((e) => ({ ...e })),
    };
  }

  // 1. False Positive Rate on Valid Paraphrases
  it('achieves 0% False Positive Rate on valid factual paraphrases (contract: FPR <= 2%)', () => {
    const validParaphrasesBullet01 = [
      'Architected payment routing pipeline processing 25,000 req/sec while cutting latency by 35%.',
      'Improved payment routing throughput to 25,000 req/sec and reduced latency by 35% using Go and Kafka.',
      'Led technical implementation of payment routing (25,000 req/sec, 35% lower latency).',
    ];

    for (const paraphrase of validParaphrasesBullet01) {
      const tailored = getBaseTailored();
      tailored.experience[0].bullets[0].tailored = paraphrase;
      const report = verify(baseMaster, tailored);
      expect(report.errorCount).toBe(0);
    }

    const validParaphrasesBullet02 = [
      'Supported migration of 15 services into production Kubernetes infrastructure.',
      'Assisted team with Kubernetes migration across 15 services on AWS.',
    ];

    for (const paraphrase of validParaphrasesBullet02) {
      const tailored = getBaseTailored();
      tailored.experience[0].bullets[1].tailored = paraphrase;
      const report = verify(baseMaster, tailored);
      expect(report.errorCount).toBe(0);
    }
  });

  // 2. 15-Category Synthetic Mutations
  const mutationCategories = [
    { name: 'METRIC_INFLATION', mutate: (t: TailoredResume) => { t.experience[0].bullets[0].tailored = 'Engineered routing engine handling 250,000 req/sec, reducing latency by 35%.'; }, expectError: true },
    { name: 'METRIC_CHANGE', mutate: (t: TailoredResume) => { t.experience[0].bullets[0].tailored = 'Engineered routing engine handling 25,000 req/sec, reducing latency by 90%.'; }, expectError: true },
    { name: 'DATE_CHANGE', mutate: (t: TailoredResume) => { t.experience[0].startDate = '2017-01'; }, expectError: true },
    { name: 'TITLE_CHANGE', mutate: (t: TailoredResume) => { t.experience[0].title = 'VP of Infrastructure'; }, expectError: true },
    { name: 'COMPANY_CHANGE', mutate: (t: TailoredResume) => { t.experience[0].company = 'Google LLC'; }, expectError: true },
    { name: 'NEW_DEGREE', mutate: (t: TailoredResume) => { t.education[0] = { id: 'edu_ucb', degree: 'Ph.D. in Artificial Intelligence', institution: 'UC Berkeley' }; }, expectError: true },
    { name: 'DEGREE_INSTITUTION_CHANGE', mutate: (t: TailoredResume) => { t.education[0] = { id: 'edu_ucb', degree: 'B.S. in Computer Science', institution: 'Stanford University' }; }, expectError: true },
    { name: 'NEW_SKILL', mutate: (t: TailoredResume) => { t.skills.push({ id: 's99', name: 'Solidity', canonical: 'solidity' }); }, expectWarning: true },
    { name: 'NEW_TECHNOLOGY', mutate: (t: TailoredResume) => { t.experience[0].technologies.push('Haskell'); }, expectWarning: true },
    { name: 'NEW_LEADERSHIP_CLAIM', mutate: (t: TailoredResume) => { t.experience[0].bullets[1].tailored = 'Led 20 teams across company to migrate 15 services to Kubernetes.'; }, expectWarning: true },
    { name: 'NEW_SCALE_CLAIM', mutate: (t: TailoredResume) => { t.experience[0].bullets[0].tailored = 'Spearheaded company-wide payment routing for 25,000 req/sec.'; }, expectWarning: true },
    { name: 'NEW_TEAM_SIZE', mutate: (t: TailoredResume) => { t.experience[0].bullets[1].tailored = 'Managed 50 direct reports migrating services to Kubernetes.'; }, expectWarning: true },
    { name: 'NEW_CUSTOMER_CLAIM', mutate: (t: TailoredResume) => { t.experience[0].bullets[0].tailored = 'Engineered payment routing for 5,000,000 enterprise customers handling 25,000 req/sec.'; }, expectError: true },
    { name: 'UNSUPPORTED_METRIC_PERCENT', mutate: (t: TailoredResume) => { t.experience[0].bullets[0].tailored = 'Increased annual revenue by 400% processing 25,000 req/sec.'; }, expectError: true },
    { name: 'UNSUPPORTED_CURRENCY', mutate: (t: TailoredResume) => { t.experience[0].bullets[0].tailored = 'Managed $50M infrastructure budget processing 25,000 req/sec.'; }, expectError: true },
  ];

  it('detects 100% of adversarial mutations (contract: Mutation Recall >= 98%)', () => {
    let detectedCount = 0;

    for (const cat of mutationCategories) {
      const tailored = getBaseTailored();
      cat.mutate(tailored);
      const report = verify(baseMaster, tailored);

      const detected =
        (cat.expectError && report.errorCount > 0) ||
        (cat.expectWarning && report.warningCount > 0) ||
        report.issues.length > 0;

      if (!detected) {
        console.error('FAILED TO DETECT:', cat.name, 'Issues:', report.issues);
      } else {
        detectedCount++;
      }
    }

    const recall = (detectedCount / mutationCategories.length) * 100;
    expect(recall).toBeGreaterThanOrEqual(98);
  });
});
