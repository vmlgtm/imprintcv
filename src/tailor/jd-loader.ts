import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { APP_VERSION } from '../utils/version.js';
import { parseResumeFile } from '../bootstrap/parsers.js';

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

export function resolveFilePath(filePath: string): string {
  if (filePath === '~') {
    return os.homedir();
  }
  if (filePath.startsWith('~/') || filePath.startsWith('~\\')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  if (/^~[a-zA-Z0-9_.-]+[/\\]/.test(filePath)) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return path.resolve(filePath);
}

async function readJdFile(resolvedPath: string, originalPath: string): Promise<string> {
  const ext = path.extname(resolvedPath).toLowerCase();
  try {
    if (ext === '.html' || ext === '.htm') {
      const html = await fs.readFile(resolvedPath, 'utf-8');
      return extractTextFromHtml(html);
    }
    if (['.pdf', '.docx', '.txt', '.md'].includes(ext)) {
      return await parseResumeFile(resolvedPath);
    }
    return await fs.readFile(resolvedPath, 'utf-8');
  } catch (err) {
    throw new Error(`Failed to parse job description file "${originalPath}": ${(err as Error).message}`);
  }
}

export async function loadJD(source: string): Promise<string> {
  const trimmed = (source || '').trim();
  if (!trimmed) {
    return '';
  }

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

  // 3. File Path or Raw Text
  const looksLikeFilePath =
    !trimmed.includes('\n') &&
    !trimmed.includes('\r') &&
    (trimmed === '.' ||
      trimmed === '..' ||
      trimmed === '~' ||
      trimmed.startsWith('/') ||
      trimmed.startsWith('~/') ||
      trimmed.startsWith('~\\') ||
      /^~[a-zA-Z0-9_.-]+[/\\]/.test(trimmed) ||
      trimmed.startsWith('./') ||
      trimmed.startsWith('.\\') ||
      trimmed.startsWith('../') ||
      trimmed.startsWith('..\\') ||
      trimmed.endsWith('/') ||
      trimmed.endsWith('\\') ||
      /^[a-zA-Z]:[\\/]/.test(trimmed) ||
      /\.(pdf|docx|txt|md|html?)$/i.test(trimmed));

  if (looksLikeFilePath) {
    const resolvedPath = resolveFilePath(trimmed);
    let stat;
    try {
      stat = await fs.stat(resolvedPath);
    } catch {
      throw new Error(`Job description file not found: ${trimmed} (resolved to ${resolvedPath})`);
    }

    if (!stat.isFile()) {
      throw new Error(`Job description file not found: ${trimmed} (resolved to ${resolvedPath} which is not a file)`);
    }

    return await readJdFile(resolvedPath, trimmed);
  }

  // Fallback: If it's a single line without newlines under 500 chars, it could still be an existing file
  if (!trimmed.includes('\n') && !trimmed.includes('\r') && trimmed.length < 500) {
    try {
      const resolvedPath = resolveFilePath(trimmed);
      const stat = await fs.stat(resolvedPath);
      if (stat.isDirectory()) {
        throw new Error(`Job description file not found: ${trimmed} (resolved to ${resolvedPath} which is not a file)`);
      }
      if (stat.isFile()) {
        return await readJdFile(resolvedPath, trimmed);
      }
    } catch (err) {
      if (
        (err as Error).message.includes('Job description file not found') ||
        (err as Error).message.includes('Failed to parse job description file')
      ) {
        throw err;
      }
      // Not an existing file on disk, treat as raw text
    }
  }

  return trimmed;
}
