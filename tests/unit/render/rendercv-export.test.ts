import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { exportRenderCV } from '../../../src/render/rendercv-export.js';
import type { TailoredResume } from '../../../src/types/bundle.js';

describe('Phase 5: RenderCV Export', () => {
  const tailoredResume: TailoredResume = {
    targetRole: 'Senior SWE',
    targetCompany: 'Google',
    basics: {
      name: 'Linus Torvalds',
      email: 'linus@kernel.org',
      github: 'https://github.com/torvalds',
    },
    experience: [
      {
        id: 'exp_linux',
        company: 'Linux Foundation',
        title: 'Principal Fellow',
        startDate: '1991-08',
        endDate: null,
        technologies: ['C', 'Git', 'Linux'],
        bullets: [
          {
            id: 'b1',
            sourceBulletIds: ['b1'],
            sourceFactIds: [],
            original: 'Created Linux kernel',
            tailored: 'Created Linux kernel supporting millions of servers globally.',
            status: 'REWORDED',
            matchedKeywords: ['Linux'],
          },
        ],
      },
    ],
    skills: [{ id: 's1', name: 'C', canonical: 'c' }],
    education: [
      {
        id: 'edu_helsinki',
        institution: 'University of Helsinki',
        degree: 'M.S. in Computer Science',
      },
    ],
  };

  it('exports valid YAML conforming to RenderCV structure', () => {
    const yamlString = exportRenderCV(tailoredResume);
    expect(yamlString).toContain('cv:');
    expect(yamlString).toContain('name: Linus Torvalds');

    const parsed = yaml.load(yamlString) as any;
    expect(parsed.cv.name).toBe('Linus Torvalds');
    expect(parsed.cv.sections.experience).toHaveLength(1);
    expect(parsed.cv.sections.experience[0].company).toBe('Linux Foundation');
  });
});
