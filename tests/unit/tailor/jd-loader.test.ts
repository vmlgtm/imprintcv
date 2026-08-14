import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { loadJD, extractTextFromHtml } from '../../../src/tailor/jd-loader.js';

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

  it('loads JD from a local text file path', async () => {
    const fixturePath = path.resolve(__dirname, '../../fixtures/sample_resume.txt');
    const content = await loadJD(fixturePath);
    expect(content).toContain('John Doe');
  });
});
