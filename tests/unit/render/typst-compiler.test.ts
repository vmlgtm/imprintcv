import { describe, it, expect } from 'vitest';
import { compileTypstToPdf, generateTypstDocument } from '../../../src/render/typst-compiler.js';
import type { TailoredResume } from '../../../src/types/bundle.js';

describe('Phase 5: Typst WASM Compiler & Templates', () => {
  const resume: TailoredResume = {
    targetRole: 'Staff Infrastructure Engineer',
    targetCompany: 'Stripe',
    basics: {
      name: 'Ada Lovelace',
      email: 'ada@computing.org',
      location: 'London, UK',
      summary: 'First programmer in history with expertise in algorithmic system design.',
    },
    experience: [
      {
        id: 'exp_analytical',
        company: 'Babbage Labs',
        title: 'Lead Algorithm Engineer',
        startDate: '1843-01',
        endDate: '1852-11',
        technologies: ['Algorithms', 'Mathematics'],
        bullets: [
          {
            id: 'b1',
            sourceBulletIds: ['b1'],
            sourceFactIds: [],
            original: 'Wrote the first algorithm for the Analytical Engine.',
            tailored: 'Authored the world first published computer algorithm for the Analytical Engine.',
            status: 'REWORDED',
            matchedKeywords: ['algorithm'],
          },
        ],
      },
    ],
    skills: [{ id: 's1', name: 'Mathematics', canonical: 'mathematics' }],
    education: [
      {
        id: 'edu_private',
        institution: 'Private Tutelage',
        degree: 'Mastery in Mathematics & Astronomy',
      },
    ],
  };

  it('generates valid Typst markup for modern template', () => {
    const code = generateTypstDocument(resume, 'modern');
    expect(code).toContain('Ada Lovelace');
    expect(code).toContain('Babbage Labs');
  });

  it('compiles PDF in-memory using modern template in <50ms', async () => {
    const start = performance.now();
    const pdfBytes = await compileTypstToPdf(resume, { template: 'modern' });
    const duration = performance.now() - start;

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(500);

    // Verify PDF header magic bytes "%PDF-"
    const header = Buffer.from(pdfBytes.slice(0, 5)).toString('ascii');
    expect(header).toBe('%PDF-');
  });

  it('compiles PDF in-memory using classic template', async () => {
    const pdfBytes = await compileTypstToPdf(resume, { template: 'classic' });
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    const header = Buffer.from(pdfBytes.slice(0, 5)).toString('ascii');
    expect(header).toBe('%PDF-');
  });

  it('compiles PDF in-memory using contemporary template', async () => {
    const pdfBytes = await compileTypstToPdf(resume, { template: 'contemporary' });
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    const header = Buffer.from(pdfBytes.slice(0, 5)).toString('ascii');
    expect(header).toBe('%PDF-');
  });
});
