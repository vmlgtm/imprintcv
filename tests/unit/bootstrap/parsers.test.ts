import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { parseResumeFile, parseTXT } from '../../../src/bootstrap/parsers.js';

describe('Phase 2: Document Parsers', () => {
  const fixturePath = path.resolve(__dirname, '../../fixtures/sample_resume.txt');

  it('parses plain text resume file', async () => {
    const content = await parseTXT(fixturePath);
    expect(content).toContain('John Doe');
    expect(content).toContain('Stripe');
    expect(content).toContain('20,000 tx/sec');
  });

  it('auto-detects .txt extension with parseResumeFile', async () => {
    const content = await parseResumeFile(fixturePath);
    expect(content).toContain('john.doe@example.com');
  });

  it('throws for unsupported extensions', async () => {
    await expect(parseResumeFile('unsupported.xyz')).rejects.toThrow('Unsupported file extension');
  });
});
