import { describe, it, expect } from 'vitest';
import { verify } from '../../src/verifier/index.js';
import type { MasterResume } from '../../src/types/resume.js';
import type { TailoredResume } from '../../src/types/bundle.js';

describe('Microsoft Feedback Regression Suite (imprintcv_mcp_cli_feedback.md §15)', () => {
  const masterResume: MasterResume = {
    metadata: {
      schemaVersion: '2.1.0',
      vaultVersion: 1,
      vaultHash: 'hash_ms_regression',
      lastUpdated: '2026-08-14T00:00:00Z',
    },
    basics: {
      name: 'Vaibhav Misra',
      email: 'vaibhav@example.com',
      location: 'Gurgaon, India',
    },
    experience: [
      {
        id: 'exp_tata_1mg_lead',
        company: 'Tata 1mg',
        title: 'Lead Software Engineer (Frontend)',
        startDate: '2024-04',
        endDate: null,
        highlights: [
          {
            id: 'bullet_pwa_01',
            text: 'Built offline-first PWA using IndexedDB for resilience during backend outages.',
            technologies: ['PWA', 'IndexedDB'],
          },
          {
            id: 'bullet_lead_01',
            text: 'Technical lead for a first-party in-house retail platform enabling unified omnichannel retail experience.',
            technologies: ['React', 'TypeScript'],
          },
          {
            id: 'bullet_node_01',
            text: 'Contributed to backend integrations and Node.js-based services supporting real-time workflows.',
            technologies: ['Node.js'],
          },
          {
            id: 'bullet_savings_01',
            text: 'Designed and shipped remote printing system saving ~₹62 lakh annually.',
            technologies: ['Node.js'],
          },
          {
            id: 'bullet_team_01',
            text: 'Lead and mentor a team of 9 frontend engineers across multiple platforms.',
            technologies: [],
          },
        ],
        technologies: ['React', 'TypeScript', 'Node.js', 'PWA', 'IndexedDB'],
      },
      {
        id: 'exp_tata_1mg_sse',
        company: 'Tata 1mg',
        title: 'Senior Software Engineer',
        startDate: '2022-01',
        endDate: '2024-03',
        highlights: [
          {
            id: 'bullet_marketing_01',
            text: 'Owned performance marketing frontend infrastructure ensuring correctness of high-scale tracking systems.',
            technologies: ['TypeScript'],
          },
        ],
        technologies: ['TypeScript'],
      },
      {
        id: 'exp_ustraa',
        company: 'USTRAA',
        title: 'Senior Software Developer',
        startDate: '2017-03',
        endDate: '2020-09',
        highlights: [
          {
            id: 'bullet_aws_01',
            text: 'Owned full-stack feature development including Node.js services and AWS deployments for a D2C e-commerce platform.',
            technologies: ['Node.js', 'AWS'],
          },
        ],
        technologies: ['Node.js', 'AWS'],
      },
    ],
    skills: [
      { id: 's_react', name: 'React', canonical: 'react' },
      { id: 's_node', name: 'Node.js', canonical: 'nodejs' },
      { id: 's_aws', name: 'AWS', canonical: 'aws' },
    ],
    education: [],
    projects: [],
  };

  function getValidTailored(): TailoredResume {
    return {
      targetRole: 'Principal Software Engineer',
      targetCompany: 'Microsoft',
      basics: masterResume.basics,
      experience: [
        {
          id: 'exp_tata_1mg_lead',
          company: 'Tata 1mg',
          title: 'Lead Software Engineer (Frontend)',
          startDate: '2024-04',
          endDate: null,
          technologies: ['React', 'TypeScript', 'Node.js'],
          bullets: [
            {
              id: 'b1',
              sourceBulletIds: ['bullet_pwa_01'],
              sourceFactIds: [],
              original: masterResume.experience[0].highlights[0].text,
              tailored: 'Architected offline-first PWA leveraging IndexedDB to ensure high resilience and continuity during backend outages.',
              status: 'REWORDED',
              matchedKeywords: ['PWA'],
            },
            {
              id: 'b2',
              sourceBulletIds: ['bullet_team_01'],
              sourceFactIds: [],
              original: masterResume.experience[0].highlights[4].text,
              tailored: 'Lead and mentor an engineering team of 9 frontend engineers driving technical excellence across platforms.',
              status: 'REWORDED',
              matchedKeywords: ['leadership'],
            },
          ],
        },
      ],
      skills: masterResume.skills,
      education: [],
    };
  }

  it('1. Rejects "zero downtime" claim escalation when source only claims outage resilience', () => {
    const tailored = getValidTailored();
    tailored.experience[0].bullets[0].tailored = 'Built offline-first PWA ensuring zero downtime during backend outages.';
    const report = verify(masterResume, tailored);

    expect(report.status).toBe('FAIL');
    expect(report.issues.some((i) => i.reason === 'CLAIM_STRENGTH_ESCALATION')).toBe(true);
  });

  it('2. Rejects "Principal Architect" scope escalation when candidate history is Lead / Senior', () => {
    const tailored = getValidTailored();
    tailored.experience[0].bullets[0].tailored = 'Served as Principal Architect for retail platform and offline-first PWA.';
    const report = verify(masterResume, tailored);

    expect(report.status).toBe('FAIL');
    expect(report.issues.some((i) => i.reason === 'CLAIM_SCOPE_ESCALATION')).toBe(true);
  });

  it('3. Rejects unsupported "microservices" claim when source specifies Node.js-based services', () => {
    const tailored = getValidTailored();
    tailored.experience[0].bullets.push({
      id: 'b3',
      sourceBulletIds: ['bullet_node_01'],
      sourceFactIds: [],
      original: masterResume.experience[0].highlights[2].text,
      tailored: 'Designed Node.js microservices supporting real-time operational workflows.',
      status: 'REWORDED',
      matchedKeywords: [],
    });
    const report = verify(masterResume, tailored);

    expect(report.status).toBe('FAIL');
    expect(report.issues.some((i) => i.reason === 'CLAIM_STRENGTH_ESCALATION')).toBe(true);
  });

  it('4. Rejects provenance mismatch when bullet text has zero semantic relation to declared source', () => {
    const tailored = getValidTailored();
    tailored.experience[0].bullets.push({
      id: 'b4',
      sourceBulletIds: ['bullet_marketing_01'], // Source is Performance marketing
      sourceFactIds: [],
      original: masterResume.experience[1].highlights[0].text,
      tailored: 'Engineered AI-assisted document processing pipelines integrating OCR and ML models for prescription digitization.', // Unrelated fact
      status: 'REWORDED',
      matchedKeywords: [],
    });
    const report = verify(masterResume, tailored);

    expect(report.status).toBe('FAIL');
    expect(report.issues.some((i) => i.reason === 'PROVENANCE_MISMATCH')).toBe(true);
  });

  it('5. Rejects ungrounded Azure cloud claim not present in Career Vault', () => {
    const tailored = getValidTailored();
    tailored.experience[0].bullets.push({
      id: 'b5',
      sourceBulletIds: ['bullet_aws_01'],
      sourceFactIds: [],
      original: masterResume.experience[2].highlights[0].text,
      tailored: 'Managed cloud architecture and deployments on Microsoft Azure for high-scale platform.',
      status: 'REWORDED',
      matchedKeywords: [],
    });
    const report = verify(masterResume, tailored);

    expect(report.status).toBe('FAIL');
    expect(report.issues.some((i) => i.reason === 'UNSUPPORTED_TECH_CLAIM')).toBe(true);
  });

  it('6. Rejects ungrounded C# / .NET claim not present in Career Vault', () => {
    const tailored = getValidTailored();
    tailored.experience[0].bullets.push({
      id: 'b6',
      sourceBulletIds: ['bullet_node_01'],
      sourceFactIds: [],
      original: masterResume.experience[0].highlights[2].text,
      tailored: 'Built scalable backend services using C# and .NET Core for enterprise workflows.',
      status: 'REWORDED',
      matchedKeywords: [],
    });
    const report = verify(masterResume, tailored);

    expect(report.status).toBe('FAIL');
    expect(report.issues.some((i) => i.reason === 'UNSUPPORTED_TECH_CLAIM')).toBe(true);
  });

  it('7. Rejects metric period alteration from annually to monthly (~₹62 lakh annually -> monthly)', () => {
    const tailored = getValidTailored();
    tailored.experience[0].bullets.push({
      id: 'b7',
      sourceBulletIds: ['bullet_savings_01'],
      sourceFactIds: [],
      original: masterResume.experience[0].highlights[3].text,
      tailored: 'Delivered remote printing system yielding ₹62 lakh monthly savings.',
      status: 'REWORDED',
      matchedKeywords: [],
    });
    const report = verify(masterResume, tailored);

    expect(report.status).toBe('FAIL');
    expect(report.issues.some((i) => i.reason === 'METRIC_CONTRADICTED')).toBe(true);
  });

  it('8. Rejects metric team size inflation (9 engineers -> 20 engineers)', () => {
    const tailored = getValidTailored();
    tailored.experience[0].bullets[1].tailored = 'Lead and mentor an engineering team of 20 frontend engineers across platforms.';
    const report = verify(masterResume, tailored);

    expect(report.status).toBe('FAIL');
    expect(report.issues.some((i) => i.reason === 'METRIC_CONTRADICTED')).toBe(true);
  });

  it('9. Passes 100% on valid factual paraphrases and preserved provenance', () => {
    const valid = getValidTailored();
    const report = verify(masterResume, valid);

    expect(report.status).toBe('PASS');
    expect(report.errorCount).toBe(0);
    expect(report.warningCount).toBe(0);
  });
});
