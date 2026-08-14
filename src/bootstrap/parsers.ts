import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import mammoth from 'mammoth';

// Dynamic import or subpath for pdf-parse to avoid test-runner triggers in Node ESM
async function getPdfParser() {
  try {
    const pdfModule = await import('pdf-parse');
    return (pdfModule.default || pdfModule) as (dataBuffer: Buffer) => Promise<{ text: string; numpages: number }>;
  } catch {
    // Fallback if needed
    const pdfSubModule = await import('pdf-parse/lib/pdf-parse.js' as string);
    return (pdfSubModule.default || pdfSubModule) as (dataBuffer: Buffer) => Promise<{ text: string; numpages: number }>;
  }
}

export async function parsePDF(filePath: string): Promise<string> {
  const resolved = filePath.startsWith('~') ? path.join(os.homedir(), filePath.slice(1)) : path.resolve(filePath);
  const buffer = await fs.readFile(resolved);
  const pdfParser = await getPdfParser();
  const data = await pdfParser(buffer);
  return data.text || '';
}

export async function parseDOCX(filePath: string): Promise<string> {
  const resolved = filePath.startsWith('~') ? path.join(os.homedir(), filePath.slice(1)) : path.resolve(filePath);
  const buffer = await fs.readFile(resolved);
  const textResult = await mammoth.extractRawText({ buffer });
  return textResult.value || '';
}

export async function parseTXT(filePath: string): Promise<string> {
  const resolved = filePath.startsWith('~') ? path.join(os.homedir(), filePath.slice(1)) : path.resolve(filePath);
  return await fs.readFile(resolved, 'utf-8');
}

export async function parseResumeFile(filePath: string): Promise<string> {
  const resolved = filePath.startsWith('~') ? path.join(os.homedir(), filePath.slice(1)) : path.resolve(filePath);
  const ext = path.extname(resolved).toLowerCase();
  switch (ext) {
    case '.pdf':
      return await parsePDF(resolved);
    case '.docx':
      return await parseDOCX(resolved);
    case '.txt':
    case '.md':
      return await parseTXT(resolved);
    default:
      throw new Error(`Unsupported file extension "${ext}". Supported: .pdf, .docx, .txt, .md`);
  }
}
