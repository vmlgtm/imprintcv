import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

declare const __PACKAGE_VERSION__: string | undefined;

function getFallbackVersion(): string {
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const candidatePaths = [
      path.resolve(__dirname, '../../package.json'),
      path.resolve(__dirname, '../package.json'),
      path.resolve(__dirname, '../../../package.json'),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
        if (parsed.version) return parsed.version;
      }
    }
  } catch {}
  return '0.1.1';
}

export const APP_VERSION: string =
  typeof __PACKAGE_VERSION__ !== 'undefined' ? __PACKAGE_VERSION__ : getFallbackVersion();
