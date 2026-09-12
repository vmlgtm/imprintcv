import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { loadJD, extractTextFromHtml, resolveFilePath } from '../../../src/tailor/jd-loader.js';

describe('Phase 4: JD Loader', () => {
  it('extracts clean text from HTML, stripping scripts, styles, and tags', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><style>body { color: red; }</style></head>
        <body>
          <script>console.log('secret');</script>
          <h1>Senior Infrastructure Engineer</h1>
          <p>We are looking for a Go &amp; Kubernetes expert.</p>
          <ul>
            <li>5+ years experience</li>
            <li>Distributed systems</li>
          </ul>
        </body>
      </html>
    `;

    const extracted = extractTextFromHtml(html);
    expect(extracted).not.toContain('color: red');
    expect(extracted).not.toContain('console.log');
    expect(extracted).toContain('Senior Infrastructure Engineer');
    expect(extracted).toContain('Go & Kubernetes expert');
    expect(extracted).toContain('5+ years experience');
  });

  describe('resolveFilePath', () => {
    it('expands tilde (~) prefix to user home directory', () => {
      const resolved = resolveFilePath('~/Downloads/job.pdf');
      expect(resolved).toBe(path.join(os.homedir(), 'Downloads/job.pdf'));
    });

    it('expands tilde without slash (~Downloads/job.pdf) to user home directory', () => {
      const resolved = resolveFilePath('~Downloads/job.pdf');
      expect(resolved).toBe(path.join(os.homedir(), 'Downloads/job.pdf'));
    });

    it('expands tilde alone (~) to user home directory', () => {
      const resolved = resolveFilePath('~');
      expect(resolved).toBe(os.homedir());
    });

    it('expands Windows-style tilde (~\\Downloads\\job.pdf) to user home directory', () => {
      const resolved = resolveFilePath('~\\Downloads\\job.pdf');
      expect(resolved).toBe(path.join(os.homedir(), 'Downloads\\job.pdf'));
    });

    it('does not expand tilde in raw text without path separators (~5 years of React)', () => {
      const resolved = resolveFilePath('~5 years of React');
      expect(resolved).toBe(path.resolve('~5 years of React'));
    });

    it('resolves relative path to absolute path', () => {
      const resolved = resolveFilePath('./fixtures/sample_resume.txt');
      expect(resolved).toBe(path.resolve('./fixtures/sample_resume.txt'));
    });
  });

  describe('multi-format file loading', () => {
    it('loads JD from a local text file (.txt)', async () => {
      const fixturePath = path.resolve(__dirname, '../../fixtures/sample_resume.txt');
      const content = await loadJD(fixturePath);
      expect(content).toContain('John Doe');
    });

    it('loads JD from a local Markdown file (.md)', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'imprintcv-md-test-'));
      const mdPath = path.join(tmpDir, 'job_description.md');
      await fs.writeFile(mdPath, '# Senior Backend Engineer\n\n- Rust\n- Distributed Systems', 'utf-8');

      try {
        const content = await loadJD(mdPath);
        expect(content).toContain('Senior Backend Engineer');
        expect(content).toContain('Rust');
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('loads and strips tags from a local HTML file (.html)', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'imprintcv-html-test-'));
      const htmlPath = path.join(tmpDir, 'job.html');
      await fs.writeFile(
        htmlPath,
        '<html><body><h1>Platform Lead</h1><script>evil()</script><p>Kubernetes &amp; Go</p></body></html>',
        'utf-8'
      );

      try {
        const content = await loadJD(htmlPath);
        expect(content).toContain('Platform Lead');
        expect(content).toContain('Kubernetes & Go');
        expect(content).not.toContain('evil');
        expect(content).not.toContain('<h1>');
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('loads and parses text from a binary PDF file (.pdf)', async () => {
      const fixturePath = path.resolve(__dirname, '../../fixtures/sample_jd.pdf');
      const content = await loadJD(fixturePath);
      expect(content).toContain('Senior Data Engineer');
      expect(content).toContain('Apache Spark');
    });

    it('loads and parses text from a binary DOCX file (.docx)', async () => {
      const fixturePath = path.resolve(__dirname, '../../fixtures/sample_jd.docx');
      const content = await loadJD(fixturePath);
      expect(content).toContain('Senior Cloud Architect JD in DOCX with AWS and Terraform');
    });

    it('loads JD from a tilde (~) path pointing to homedir', async () => {
      const testFileName = `.imprintcv_test_jd_${Date.now()}.txt`;
      const homeFilePath = path.join(os.homedir(), testFileName);
      await fs.writeFile(homeFilePath, 'Machine Learning Engineer with PyTorch & CUDA', 'utf-8');

      try {
        const content = await loadJD(`~/${testFileName}`);
        expect(content).toContain('Machine Learning Engineer with PyTorch & CUDA');
      } finally {
        await fs.unlink(homeFilePath).catch(() => {});
      }
    });
  });

  describe('error handling for missing files, directories, and corrupted files', () => {
    it('throws actionable error when a .pdf file path does not exist', async () => {
      await expect(loadJD('nonexistent_job_description.pdf')).rejects.toThrow(
        /Job description file not found: nonexistent_job_description\.pdf/
      );
    });

    it('throws actionable error when a .docx file path does not exist', async () => {
      await expect(loadJD('~/Downloads/nonexistent_spec.docx')).rejects.toThrow(
        /Job description file not found: ~\/Downloads\/nonexistent_spec\.docx/
      );
    });

    it('throws actionable error when a .txt file path does not exist', async () => {
      await expect(loadJD('./missing_jd.txt')).rejects.toThrow(
        /Job description file not found: \.\/missing_jd\.txt/
      );
    });

    it('throws actionable error when a directory is passed instead of a file', async () => {
      await expect(loadJD('.')).rejects.toThrow(/Job description file not found: \./);
    });

    it('throws actionable error when homedir directory (~) is passed instead of a file', async () => {
      await expect(loadJD('~')).rejects.toThrow(/Job description file not found: ~/);
    });

    it('throws actionable error when a corrupted PDF is loaded', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'imprintcv-corrupt-pdf-'));
      const corruptPath = path.join(tmpDir, 'corrupt.pdf');
      await fs.writeFile(corruptPath, 'not a valid pdf buffer', 'utf-8');

      try {
        await expect(loadJD(corruptPath)).rejects.toThrow(/Failed to parse job description file/);
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('throws actionable error when a corrupted DOCX is loaded', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'imprintcv-corrupt-docx-'));
      const corruptPath = path.join(tmpDir, 'corrupt.docx');
      await fs.writeFile(corruptPath, 'not a valid docx zip', 'utf-8');

      try {
        await expect(loadJD(corruptPath)).rejects.toThrow(/Failed to parse job description file/);
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('raw text preservation and empty string handling', () => {
    it('returns empty string when input is empty or only whitespace', async () => {
      expect(await loadJD('')).toBe('');
      expect(await loadJD('   ')).toBe('');
      expect(await loadJD('\n\n  \t ')).toBe('');
    });

    it('preserves single-line raw text starting with tilde (~5 years experience)', async () => {
      const rawJD = '~5 years of React & TypeScript experience';
      const content = await loadJD(rawJD);
      expect(content).toBe(rawJD);
    });

    it('preserves single-line raw text with spaced tilde (~ 10 years distributed systems)', async () => {
      const rawJD = '~ 10 years distributed systems experience in Go';
      const content = await loadJD(rawJD);
      expect(content).toBe(rawJD);
    });

    it('preserves multi-line raw text starting with tildes', async () => {
      const rawJD = `Requirements:\n~ 5 years experience in Go\n~ Deep Kubernetes knowledge`;
      const content = await loadJD(rawJD);
      expect(content).toBe(rawJD.trim());
    });

    it('preserves multi-line raw text without attempting file lookups', async () => {
      const rawJD = `Senior Backend Engineer\nResponsibilities:\n- Build microservices in Go\n- Manage Kafka topics`;
      const content = await loadJD(rawJD);
      expect(content).toBe(rawJD.trim());
    });

    it('preserves single-line raw text that does not look like a file and does not exist', async () => {
      const rawJD = `We are looking for a Senior Staff Engineer with extensive distributed systems experience`;
      const content = await loadJD(rawJD);
      expect(content).toBe(rawJD.trim());
    });
  });

  describe('URL fetching', () => {
    it('fetches JD from live URL and extracts text', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          text: async () => '<h1>Staff AI Engineer</h1><p>Expertise in LLMs &amp; Agents</p>',
        } as unknown as Response);

        const content = await loadJD('https://example.com/jobs/ai-lead');
        expect(content).toContain('Staff AI Engineer');
        expect(content).toContain('Expertise in LLMs & Agents');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('throws actionable error when live URL fetch fails', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        } as unknown as Response);

        await expect(loadJD('https://example.com/jobs/not-found')).rejects.toThrow(
          'Failed to fetch job description URL: 404 Not Found'
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
