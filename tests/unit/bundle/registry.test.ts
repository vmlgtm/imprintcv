import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  registerApplication,
  listApplications,
  findApplication,
  type ApplicationRecord,
} from '../../../src/bundle/registry.js';

describe('Phase 1: Application Catalog Registry', () => {
  it('registers and lists applications in isolated registry.json', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'imprintcv-registry-test-'));
    try {
      const regPath = path.join(tempDir, 'registry.json');
      const record1: ApplicationRecord = {
        id: 'openai-research-engineer',
        company: 'OpenAI',
        role: 'Research Engineer',
        createdAt: new Date().toISOString(),
        status: 'PASS',
        template: 'modern',
        targetPages: 1,
        bundleDir: path.join(tempDir, 'openai-research-engineer'),
        pdfPath: path.join(tempDir, 'openai-research-engineer', 'resume.pdf'),
        jsonPath: path.join(tempDir, 'openai-research-engineer', 'resume.json'),
        mdPath: path.join(tempDir, 'openai-research-engineer', 'resume.md'),
      };

      await registerApplication(record1, regPath);

      const list1 = await listApplications(tempDir);
      expect(list1).toHaveLength(1);
      expect(list1[0].id).toBe('openai-research-engineer');
      expect(list1[0].company).toBe('OpenAI');

      const record2: ApplicationRecord = {
        id: 'anthropic-systems-lead',
        company: 'Anthropic',
        role: 'Systems Lead',
        createdAt: new Date().toISOString(),
        status: 'PASS',
        template: 'executive',
        targetPages: 1,
        bundleDir: path.join(tempDir, 'anthropic-systems-lead'),
        pdfPath: path.join(tempDir, 'anthropic-systems-lead', 'resume.pdf'),
        jsonPath: path.join(tempDir, 'anthropic-systems-lead', 'resume.json'),
        mdPath: path.join(tempDir, 'anthropic-systems-lead', 'resume.md'),
      };

      await registerApplication(record2, regPath);

      const list2 = await listApplications(tempDir);
      expect(list2).toHaveLength(2);
      expect(list2[0].id).toBe('anthropic-systems-lead'); // Most recent first

      // Lookup
      const found = await findApplication('openai', tempDir);
      expect(found).not.toBeNull();
      expect(found?.id).toBe('openai-research-engineer');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
