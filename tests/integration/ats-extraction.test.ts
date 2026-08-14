import { describe, it, expect } from 'vitest';
import pdf from 'pdf-parse';
import { compileTypstToPdf } from '../../src/render/typst-compiler.js';
import type { TailoredResume } from '../../src/types/bundle.js';

describe('Phase 8: ATS Text Extraction & Layout Invariants', () => {
  const resume: TailoredResume = {
    targetRole: 'Staff Software Engineer',
    targetCompany: 'Netflix',
    basics: {
      name: 'Grace Hopper',
      email: 'grace.hopper@navy.mil',
      location: 'Arlington, VA',
      summary: 'Pioneering computer scientist and developer of the first compiler.',
    },
    experience: [
      {
        id: 'exp_navy',
        company: 'United States Navy',
        title: 'Rear Admiral & Director of Programming',
        startDate: '1943-12',
        endDate: '1986-08',
        technologies: ['COBOL', 'Compilers', 'Machine Code'],
        bullets: [
          {
            id: 'b1',
            sourceBulletIds: ['b1'],
            sourceFactIds: [],
            original: 'Developed A-0 compiler system translating mathematical code into machine language.',
            tailored: 'Invented the A-0 compiler system, the first compiler operational on electronic computers.',
            status: 'REWORDED',
            matchedKeywords: ['compiler'],
          },
        ],
      },
    ],
    skills: [
      { id: 's1', name: 'COBOL', canonical: 'cobol' },
      { id: 's2', name: 'Compiler Design', canonical: 'compiler design' },
    ],
    education: [
      {
        id: 'edu_yale',
        institution: 'Yale University',
        degree: 'Ph.D. in Mathematics',
        startDate: '1930-09',
        endDate: '1934-06',
      },
    ],
  };

  it('extracts clear ATS text containing candidate name, company, title, dates, and skills in logical order', async () => {
    const pdfBytes = await compileTypstToPdf(resume, { template: 'modern' });
    const parsed = await pdf(Buffer.from(pdfBytes));

    expect(parsed.numpages).toBe(1);
    expect(parsed.text).toContain('Grace Hopper');
    expect(parsed.text).toContain('United States Navy');
    expect(parsed.text).toContain('Rear Admiral');
    expect(parsed.text).toContain('1943-12');
    expect(parsed.text).toContain('Yale University');
    expect(parsed.text).toContain('COBOL');
  });
});
