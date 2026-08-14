import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { MasterResumeSchema, type MasterResume } from '../../src/types/resume.js';
import { extractFacts } from '../../src/bootstrap/facts-extractor.js';
import { createFallbackPlan } from '../../src/tailor/plan.js';
import { tailorWithRepair } from '../../src/tailor/repair.js';
import { compileTypstToPdf } from '../../src/render/typst-compiler.js';

describe('Phase 8: Golden Integration Fixtures Pipeline', () => {
  const fixtures = [
    'senior-frontend',
    'backend',
    'engineering-manager',
    'fresh-grad',
    'career-switch',
  ];

  for (const fixture of fixtures) {
    it(`executes full tailoring, verification, and PDF compilation for "${fixture}" fixture`, async () => {
      const fixtureDir = path.resolve(__dirname, '../fixtures', fixture);
      const masterRaw = await fs.readFile(path.join(fixtureDir, 'master_resume.json'), 'utf-8');
      const masterResume = MasterResumeSchema.parse(JSON.parse(masterRaw));
      const jdText = await fs.readFile(path.join(fixtureDir, 'job_description.txt'), 'utf-8');
      const expectedVerif = JSON.parse(
        await fs.readFile(path.join(fixtureDir, 'expected_verification.json'), 'utf-8')
      );

      const facts = extractFacts(masterResume);
      expect(facts.vaultHash).toBeDefined();

      const plan = createFallbackPlan(masterResume, jdText, 'Target Role', 'Target Company');
      const { tailoredResume, verificationReport, coverLetter } = await tailorWithRepair(
        masterResume,
        facts,
        plan,
        jdText
      );

      expect(verificationReport.status).toBe(expectedVerif.status);
      expect(verificationReport.errorCount).toBe(expectedVerif.errorCount);
      expect(coverLetter.length).toBeGreaterThan(100);

      // Verify in-memory PDF compilation
      const pdfBytes = await compileTypstToPdf(tailoredResume, { template: 'modern' });
      expect(pdfBytes).toBeInstanceOf(Uint8Array);
      expect(pdfBytes.length).toBeGreaterThan(500);

      const header = Buffer.from(pdfBytes.slice(0, 5)).toString('ascii');
      expect(header).toBe('%PDF-');
    });
  }
});
