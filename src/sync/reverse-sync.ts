import fs from 'node:fs/promises';
import path from 'node:path';
import type { MasterResume } from '../types/resume.js';
import type { TailoredResume } from '../types/bundle.js';
import { MasterResumeSchema } from '../types/resume.js';
import { getDefaultVaultDir } from '../bootstrap/init.js';
import { runLayer1HardChecks } from '../verifier/layer1-hard.js';
import { computeVaultHash } from '../utils/hash.js';
import { generateMasterMarkdown } from '../bootstrap/markdown-generator.js';

export interface SyncOptions {
  fromPath: string;
  vaultPath?: string;
  autoApprove?: boolean;
}

export interface SyncDiffItem {
  type: 'ADDED_SKILL' | 'REFINED_BULLET' | 'UPDATED_FIELD';
  description: string;
  original?: string;
  updated?: string;
}

export interface SyncResult {
  allowed: boolean;
  blockReason?: string;
  diffs: SyncDiffItem[];
  masterResume?: MasterResume;
  vaultDir: string;
}

export async function computeSyncDiff(
  masterResume: MasterResume,
  tailoredResume: TailoredResume
): Promise<{ allowed: boolean; blockReason?: string; diffs: SyncDiffItem[] }> {
  // 1. Run safety gate: check for metric contradictions
  const hardIssues = runLayer1HardChecks(masterResume, tailoredResume);
  const metricErrors = hardIssues.filter((i) => i.reason === 'METRIC_CONTRADICTED');

  if (metricErrors.length > 0) {
    return {
      allowed: false,
      blockReason: `Safety Gate Blocked: Sync contains contradictory/unverified metrics: ${metricErrors.map((e) => e.claim).join(', ')}`,
      diffs: [],
    };
  }

  const diffs: SyncDiffItem[] = [];

  // Compare skills
  const masterSkillNames = new Set(masterResume.skills.map((s) => s.name.toLowerCase()));
  for (const tSkill of tailoredResume.skills) {
    if (!masterSkillNames.has(tSkill.name.toLowerCase())) {
      diffs.push({
        type: 'ADDED_SKILL',
        description: `New skill added: ${tSkill.name}`,
        updated: tSkill.name,
      });
    }
  }

  // Compare bullets
  for (const tExp of tailoredResume.experience) {
    const mExp = masterResume.experience.find((e) => e.id === tExp.id);
    if (!mExp) continue;

    for (const tBullet of tExp.bullets) {
      const mBullet = mExp.highlights.find((h) => h.id === tBullet.id);
      if (mBullet && mBullet.text !== tBullet.tailored && tBullet.tailored.trim().length > 0) {
        diffs.push({
          type: 'REFINED_BULLET',
          description: `Refined bullet [${tBullet.id}] for ${tExp.company}`,
          original: mBullet.text,
          updated: tBullet.tailored,
        });
      }
    }
  }

  return {
    allowed: true,
    diffs,
  };
}

export async function performReverseSync(options: SyncOptions): Promise<SyncResult> {
  const vaultDir = options.vaultPath ? path.resolve(options.vaultPath) : getDefaultVaultDir();
  const masterPath = path.join(vaultDir, 'master_resume.json');

  let masterResume: MasterResume;
  try {
    const rawMaster = await fs.readFile(masterPath, 'utf-8');
    masterResume = MasterResumeSchema.parse(JSON.parse(rawMaster));
  } catch {
    throw new Error(`Cannot load Master Vault from ${masterPath}`);
  }

  // Load tailored resume from path (could be bundle folder or direct resume.json)
  let tailoredJsonPath = path.resolve(options.fromPath);
  try {
    const stat = await fs.stat(tailoredJsonPath);
    if (stat.isDirectory()) {
      tailoredJsonPath = path.join(tailoredJsonPath, 'resume.json');
    }
  } catch {
    throw new Error(`Path does not exist: ${options.fromPath}`);
  }

  const rawTailored = await fs.readFile(tailoredJsonPath, 'utf-8');
  const tailoredResume: TailoredResume = JSON.parse(rawTailored);

  const diffResult = await computeSyncDiff(masterResume, tailoredResume);
  if (!diffResult.allowed) {
    return {
      allowed: false,
      blockReason: diffResult.blockReason,
      diffs: [],
      vaultDir,
    };
  }

  if (options.autoApprove) {
    // Apply refined bullets to master
    for (const tExp of tailoredResume.experience) {
      const mExp = masterResume.experience.find((e) => e.id === tExp.id);
      if (!mExp) continue;

      for (const tBullet of tExp.bullets) {
        const mBullet = mExp.highlights.find((h) => h.id === tBullet.id);
        if (mBullet && tBullet.tailored.trim().length > 0) {
          mBullet.text = tBullet.tailored;
        }
      }
    }

    // Recompute metadata and hash
    const newHash = computeVaultHash(masterResume);
    masterResume.metadata = {
      schemaVersion: '2.1.0',
      vaultVersion: masterResume.metadata.vaultVersion + 1,
      vaultHash: newHash,
      lastUpdated: new Date().toISOString(),
    };

    await fs.writeFile(masterPath, JSON.stringify(masterResume, null, 2), 'utf-8');
    await fs.writeFile(path.join(vaultDir, 'master_resume.md'), generateMasterMarkdown(masterResume), 'utf-8');
  }

  return {
    allowed: true,
    diffs: diffResult.diffs,
    masterResume,
    vaultDir,
  };
}
