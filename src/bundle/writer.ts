import fs from 'node:fs/promises';
import path from 'node:path';
import type { TailoredResume, VerificationReport } from '../types/bundle.js';
import type { TailoringPlan } from '../types/plan.js';
import { exportRenderCV } from '../render/rendercv-export.js';
import { compileWithBudget } from '../render/page-budget.js';
import type { TemplateName } from '../render/typst-compiler.js';
import { generateJobSlug } from '../utils/slug.js';
import { createSpinner } from '../utils/logger.js';
import { registerApplication } from './registry.js';

export interface WriteBundleOptions {
  outputBaseDir?: string;
  template?: TemplateName;
  targetPages?: number;
}

export function generateSideBySideDiffMarkdown(resume: TailoredResume, verification: VerificationReport): string {
  const lines: string[] = [];

  lines.push(`# Tailored Resume: ${resume.targetRole} at ${resume.targetCompany}`);
  lines.push(`**Verification Status**: \`${verification.status}\` | **Errors**: ${verification.errorCount} | **Warnings**: ${verification.warningCount}`);
  lines.push('');

  lines.push('## Experience & Bullet Transformations');
  lines.push('');

  for (const exp of resume.experience || []) {
    lines.push(`### ${exp.title} — ${exp.company} (${exp.startDate} - ${exp.endDate || 'Present'})`);
    lines.push('');
    for (const b of exp.bullets || []) {
      lines.push(`- **[${b.status}]** \`[${b.id}]\``);
      if (b.status !== 'UNCHANGED' && b.original !== b.tailored) {
        lines.push(`  - *Original*: ${b.original}`);
        lines.push(`  - *Tailored*: ${b.tailored}`);
      } else {
        lines.push(`  - ${b.tailored}`);
      }
    }
    lines.push('');
  }

  if (resume.skills && resume.skills.length > 0) {
    lines.push('## Skills');
    lines.push(resume.skills.map((s) => s.name).join(', '));
    lines.push('');
  }

  return lines.join('\n');
}

function synthesizePlanFromResume(resume: TailoredResume): TailoringPlan {
  return {
    targetRole: resume.targetRole,
    targetCompany: resume.targetCompany,
    strategySummary: `Tailored resume for ${resume.targetRole} at ${resume.targetCompany}`,
    experiencePlan: (resume.experience || []).map((exp) => ({
      companyId: exp.id,
      reorder: (exp.bullets || []).map((b) => b.id),
      rewrite: (exp.bullets || []).filter((b) => b.status === 'REWORDED' || (b.status as string) === 'REPHRASED').map((b) => b.id),
      compress: [],
      remove: [],
    })),
    emphasizedSkills: resume.skills.map((s) => s.name),
    omittedSkills: [],
  };
}

export async function writeApplicationBundle(
  tailoredResume: TailoredResume,
  tailoringPlan?: TailoringPlan,
  verificationReport?: VerificationReport,
  coverLetter?: string,
  options: WriteBundleOptions = {}
): Promise<{
  bundleDir: string;
  pdfPath: string;
  jsonPath: string;
  mdPath: string;
  yamlPath: string;
  clPath?: string;
  planPath: string;
  verifPath: string;
}> {
  const spinner = createSpinner('Compiling ATS PDF via Typst WASM and writing bundle...');
  const slug = generateJobSlug(tailoredResume.targetCompany, tailoredResume.targetRole);
  const baseDir = options.outputBaseDir || path.join(process.cwd(), 'applications');
  const bundleDir = path.join(baseDir, slug);

  await fs.mkdir(bundleDir, { recursive: true });

  const targetPages = options.targetPages || 1;
  const template = options.template || 'modern';

  // 1. Compile PDF with budget
  const { pdfBytes } = await compileWithBudget(tailoredResume, template, targetPages);
  const pdfPath = path.join(bundleDir, 'resume.pdf');
  await fs.writeFile(pdfPath, Buffer.from(pdfBytes));

  // 2. resume.json
  const jsonPath = path.join(bundleDir, 'resume.json');
  await fs.writeFile(jsonPath, JSON.stringify(tailoredResume, null, 2), 'utf-8');

  // 3. resume.md (side by side diff)
  const report = verificationReport || {
    status: 'PASS',
    errorCount: 0,
    warningCount: 0,
    issues: [],
    metricsVerified: 0,
    skillsMatched: [],
  };
  const mdPath = path.join(bundleDir, 'resume.md');
  const diffMarkdown = generateSideBySideDiffMarkdown(tailoredResume, report);
  await fs.writeFile(mdPath, diffMarkdown, 'utf-8');

  // 4. resume.yaml (RenderCV)
  const yamlPath = path.join(bundleDir, 'resume.yaml');
  await fs.writeFile(yamlPath, exportRenderCV(tailoredResume), 'utf-8');

  // 5. cover_letter.md (optional)
  let clPath: string | undefined;
  if (coverLetter && coverLetter.trim().length > 0) {
    clPath = path.join(bundleDir, 'cover_letter.md');
    await fs.writeFile(clPath, coverLetter, 'utf-8');
  }

  // 6. tailoring_plan.json
  const plan = tailoringPlan || synthesizePlanFromResume(tailoredResume);
  const planPath = path.join(bundleDir, 'tailoring_plan.json');
  await fs.writeFile(planPath, JSON.stringify(plan, null, 2), 'utf-8');

  // 7. verification.json
  const verifPath = path.join(bundleDir, 'verification.json');
  await fs.writeFile(verifPath, JSON.stringify(report, null, 2), 'utf-8');

  // 8. Auto-register in applications/registry.json
  try {
    await registerApplication(
      {
        id: slug,
        company: tailoredResume.targetCompany,
        role: tailoredResume.targetRole,
        createdAt: new Date().toISOString(),
        status: report.status,
        template,
        targetPages,
        bundleDir,
        pdfPath,
        jsonPath,
        mdPath,
      },
      path.join(baseDir, 'registry.json')
    );
  } catch {}

  if (spinner) spinner.succeed(`Application bundle written to: ${bundleDir}`);

  return {
    bundleDir,
    pdfPath,
    jsonPath,
    mdPath,
    yamlPath,
    clPath,
    planPath,
    verifPath,
  };
}
