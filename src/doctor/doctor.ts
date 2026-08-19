import fs from 'node:fs/promises';
import path from 'node:path';
import { getDefaultVaultDir } from '../bootstrap/init.js';
import { $typst } from '@myriaddreamin/typst.ts';

export interface DiagnosticCheck {
  name: string;
  passed: boolean;
  message: string;
}

export interface DiagnosticReport {
  status: 'OK' | 'WARNING' | 'ERROR';
  nodeVersion: string;
  platform: string;
  vaultPath: string;
  checks: DiagnosticCheck[];
}

export async function runDiagnostics(customVaultPath?: string): Promise<DiagnosticReport> {
  const checks: DiagnosticCheck[] = [];

  // 1. Node.js version >= 20
  const majorVersion = parseInt(process.version.slice(1).split('.')[0], 10);
  const nodePassed = majorVersion >= 20;
  checks.push({
    name: 'Node.js Runtime',
    passed: nodePassed,
    message: `Version ${process.version} (${nodePassed ? '>= 20 supported' : 'Requires Node.js 20+'})`,
  });

  // 2. Typst WASM compiler check
  let typstPassed = false;
  let typstMsg = '';
  try {
    const testPdf = await $typst.pdf({ mainContent: '= Test Document' });
    typstPassed = testPdf !== undefined && testPdf.length > 100;
    typstMsg = typstPassed ? 'Typst WASM in-memory compiler loaded and operational' : 'Failed to produce PDF';
  } catch (err) {
    typstMsg = `Typst WASM error: ${(err as Error).message}`;
  }
  checks.push({
    name: 'Typst WASM Compiler',
    passed: typstPassed,
    message: typstMsg,
  });

  // 3. Career Vault Directory & Hash Integrity
  const vaultDir = customVaultPath ? path.resolve(customVaultPath) : getDefaultVaultDir();
  let vaultPassed = false;
  let vaultMsg = '';
  let parsedResume: any = null;
  try {
    const jsonPath = path.join(vaultDir, 'master_resume.json');
    const content = await fs.readFile(jsonPath, 'utf-8');
    const parsed = JSON.parse(content);
    parsedResume = parsed;
    vaultPassed = parsed.metadata?.vaultHash !== undefined;
    vaultMsg = vaultPassed
      ? `Vault present at ${vaultDir} (Hash: ${parsed.metadata.vaultHash.slice(0, 8)}...)`
      : 'Vault missing metadata.vaultHash';
  } catch {
    vaultMsg = `No Career Vault found at ${vaultDir}. (Run "imprintcv init" to create one)`;
  }
  checks.push({
    name: 'Career Vault',
    passed: vaultPassed,
    message: vaultMsg,
  });

  // Data quality checks
  if (parsedResume) {
    if (Array.isArray(parsedResume.experience)) {
      // 3a. Warn if >1 experience has endDate: null (multiple "Present" roles)
      const activeRoles = parsedResume.experience.filter(
        (e: any) => !e.endDate || /present|current|now/i.test(e.endDate)
      );
      const singleActivePassed = activeRoles.length <= 1;
      checks.push({
        name: 'Vault Quality: Active Roles',
        passed: singleActivePassed,
        message: singleActivePassed
          ? `Single active role found (${activeRoles[0]?.company || 'None'})`
          : `Found ${activeRoles.length} roles marked as Present/active (${activeRoles.map((e: any) => e.company).join(', ')})`,
      });

      // 3b. Warn if any experience has empty technologies array
      const emptyTechRoles = parsedResume.experience.filter(
        (e: any) => !e.technologies || e.technologies.length === 0
      );
      const techPassed = emptyTechRoles.length === 0;
      checks.push({
        name: 'Vault Quality: Role Technologies',
        passed: techPassed,
        message: techPassed
          ? 'All experience entries specify technologies'
          : `Roles missing technologies: ${emptyTechRoles.map((e: any) => e.company || e.id).join(', ')}`,
      });

      // 3c. Warn if experiences are not in chronological order
      let chronologicalPassed = true;
      let chronoMsg = 'Experience entries are ordered chronologically';
      if (parsedResume.experience.length > 1) {
        for (let i = 0; i < parsedResume.experience.length - 1; i++) {
          const currStart = parsedResume.experience[i].startDate || '';
          const nextStart = parsedResume.experience[i + 1].startDate || '';
          if (currStart && nextStart && currStart < nextStart) {
            chronologicalPassed = false;
            chronoMsg = `Experience order mismatch: "${parsedResume.experience[i].company}" (${currStart}) is older than following role "${parsedResume.experience[i + 1].company}" (${nextStart})`;
            break;
          }
        }
      }
      checks.push({
        name: 'Vault Quality: Chronological Order',
        passed: chronologicalPassed,
        message: chronoMsg,
      });
    }

    // 3d. Warn if basics.email doesn't look like a valid email
    const email = parsedResume.basics?.email || '';
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,10}$/;
    const emailPassed = emailRegex.test(email);
    checks.push({
      name: 'Vault Quality: Email Format',
      passed: emailPassed,
      message: emailPassed
        ? `Valid email format (${email})`
        : `Malformed or missing candidate email: "${email}"`,
    });
  }

  // 4. LLM Provider API Keys & Local Endpoints
  const providersFound: string[] = [];
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY) providersFound.push('Gemini');
  if (process.env.OPENAI_API_KEY) providersFound.push('OpenAI');
  if (process.env.ANTHROPIC_API_KEY) providersFound.push('Anthropic');
  if (process.env.OPENROUTER_API_KEY) providersFound.push('OpenRouter');
  if (
    process.env.IMPRINTCV_PROVIDER?.toLowerCase() === 'ollama' ||
    process.env.OLLAMA_BASE_URL ||
    process.env.OLLAMA_MODEL
  ) {
    providersFound.push(`Ollama (${process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1'})`);
  }

  checks.push({
    name: 'LLM API Providers',
    passed: providersFound.length > 0,
    message:
      providersFound.length > 0
        ? `Configured providers: ${providersFound.join(', ')}`
        : 'No API keys set (fallback mode active; set GOOGLE_GENERATIVE_AI_API_KEY for free tier or run Ollama)',
  });

  const hasErrors = checks.filter(
    (c) =>
      !c.passed &&
      c.name !== 'LLM API Providers' &&
      c.name !== 'Career Vault' &&
      !c.name.startsWith('Vault Quality')
  ).length > 0;
  const status = hasErrors ? 'ERROR' : checks.some((c) => !c.passed) ? 'WARNING' : 'OK';

  return {
    status,
    nodeVersion: process.version,
    platform: process.platform,
    vaultPath: vaultDir,
    checks,
  };
}
