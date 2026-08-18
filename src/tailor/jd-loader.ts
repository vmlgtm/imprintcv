import fs from 'node:fs/promises';
import { APP_VERSION } from '../utils/version.js';

export function extractTextFromHtml(html: string): string {
  // Strip script and style tags
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
  // Replace line breaks and block elements with newlines
  text = text.replace(/<\/(div|p|h[1-6]|li|tr)>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  // Strip all other HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // Collapse whitespace
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

export async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      resolve(data);
    });
    process.stdin.on('error', (err) => {
      reject(err);
    });
  });
}

export async function loadJD(source: string): Promise<string> {
  const trimmed = source.trim();

  // 1. Stdin
  if (trimmed === '-') {
    return await readStdin();
  }

  // 2. Live Web URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const res = await fetch(trimmed, {
      headers: {
        'User-Agent': `Mozilla/5.0 (compatible; ImprintCV/${APP_VERSION}; +https://imprintcv.org)`,
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch job description URL: ${res.status} ${res.statusText}`);
    }
    const html = await res.text();
    return extractTextFromHtml(html);
  }

  // 3. Local File Path
  return await fs.readFile(trimmed, 'utf-8');
}
