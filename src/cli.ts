#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';
import { setJsonMode, log, info, success, warn, error, outputJson } from './utils/logger.js';
import { bootstrapCareerVault, getDefaultVaultDir } from './bootstrap/init.js';
import { loadJD } from './tailor/jd-loader.js';
import { generatePlan } from './tailor/plan.js';
import { tailorWithRepair } from './tailor/repair.js';
import { extractFacts } from './bootstrap/facts-extractor.js';
import { writeApplicationBundle } from './bundle/writer.js';
import { verify } from './verifier/index.js';
import { runDiagnostics } from './doctor/doctor.js';
import { performReverseSync } from './sync/reverse-sync.js';
import { MasterResumeSchema, type MasterResume } from './types/resume.js';
import type { TailoredResume } from './types/bundle.js';
import type { ProviderType } from './utils/llm.js';
import type { TemplateName } from './render/typst-compiler.js';

const program = new Command();

program
  .name('imprintcv')
  .description('AI resume verification engine & ATS document compiler')
  .version('0.1.0');

// Global options
program
  .option('--provider <provider>', 'LLM provider (gemini, openai, anthropic, openrouter)', 'gemini')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.json) {
      setJsonMode(true);
    }
  });

program
  .command('init')
  .description('Bootstrap Master Profile / Career Vault from PDF, DOCX, or TXT')
  .requiredOption('--from <path>', 'Source resume file (.pdf, .docx, .txt)')
  .option('--vault <path>', 'Custom path for career vault')
  .action(async (options, cmd) => {
    const globalOpts = cmd.optsWithGlobals();
    try {
      const result = await bootstrapCareerVault({
        fromPath: options.from,
        vaultPath: options.vault,
        provider: globalOpts.provider as ProviderType,
      });
      if (globalOpts.json) {
        outputJson({
          status: 'SUCCESS',
          vaultDir: result.vaultDir,
          jsonPath: result.jsonPath,
          mdPath: result.mdPath,
          vaultHash: result.masterResume.metadata.vaultHash,
        });
      } else {
        success(`Vault created at: ${result.vaultDir}`);
        success(`- JSON: ${result.jsonPath}`);
        success(`- Markdown: ${result.mdPath}`);
      }
    } catch (err) {
      error(`Init failed: ${(err as Error).message}`);
      process.exit(2);
    }
  });

program
  .command('tailor')
  .description('Tailor resume for a target job description (file, URL, or stdin)')
  .requiredOption('--jd <source>', 'Job description file path, URL, or "-" for stdin')
  .option('--vault <path>', 'Custom path to career vault directory')
  .option('--dry-run', 'Generate plan & validation report without writing PDF', false)
  .option('--json', 'Output machine-readable JSON to stdout and logs to stderr', false)
  .option('--template <name>', 'Typst template (modern, classic, contemporary)', 'modern')
  .option('--pages <n>', 'Target page budget (1 or 2)', '1')
  .option('--output <dir>', 'Output directory for application bundle')
  .action(async (options, cmd) => {
    const globalOpts = cmd.optsWithGlobals();
    if (options.json) setJsonMode(true);

    try {
      const vaultDir = options.vault ? path.resolve(options.vault) : getDefaultVaultDir();
      const masterPath = path.join(vaultDir, 'master_resume.json');

      let masterResume: MasterResume;
      try {
        const rawJson = await fs.readFile(masterPath, 'utf-8');
        masterResume = MasterResumeSchema.parse(JSON.parse(rawJson));
      } catch {
        error(`Could not read Career Vault at ${masterPath}. Run "imprintcv init --from <resume>" first.`);
        process.exit(2);
      }

      info(`Reading Target Job Description...`);
      const jdText = await loadJD(options.jd);
      const masterFacts = extractFacts(masterResume);

      info(`Generating structured Tailoring Plan...`);
      const plan = await generatePlan(masterResume, jdText, {
        provider: globalOpts.provider as ProviderType,
      });

      info(`Executing tailoring with deterministic consistency verification...`);
      const { tailoredResume, coverLetter, verificationReport, attempts } = await tailorWithRepair(
        masterResume,
        masterFacts,
        plan,
        jdText,
        { provider: globalOpts.provider as ProviderType }
      );

      // Handle dry-run
      if (options.dryRun) {
        if (options.json) {
          outputJson({
            status: verificationReport.status,
            errorCount: verificationReport.errorCount,
            warningCount: verificationReport.warningCount,
            tailoringPlan: plan,
            verificationReport,
            tailoredResume,
          });
        } else {
          info(`[DRY-RUN] Verification status: ${verificationReport.status}`);
          info(`Errors: ${verificationReport.errorCount}, Warnings: ${verificationReport.warningCount}`);
        }
        process.exit(verificationReport.status === 'FAIL' ? 1 : 0);
      }

      // Write full bundle
      const bundle = await writeApplicationBundle(
        tailoredResume,
        plan,
        verificationReport,
        coverLetter,
        {
          outputBaseDir: options.output,
          template: options.template as TemplateName,
          targetPages: parseInt(options.pages, 10) || 1,
        }
      );

      if (options.json) {
        outputJson({
          status: verificationReport.status,
          bundleDir: bundle.bundleDir,
          pdfPath: bundle.pdfPath,
          jsonPath: bundle.jsonPath,
          mdPath: bundle.mdPath,
          yamlPath: bundle.yamlPath,
          coverLetterPath: bundle.clPath,
          verification: verificationReport,
          attempts,
        });
      } else {
        success(`Verification Status: ${verificationReport.status}`);
        success(`Application Bundle generated at: ${bundle.bundleDir}`);
        success(`- PDF: ${bundle.pdfPath}`);
        success(`- JSON: ${bundle.jsonPath}`);
        success(`- Diff MD: ${bundle.mdPath}`);
        success(`- RenderCV YAML: ${bundle.yamlPath}`);
        success(`- Cover Letter: ${bundle.clPath}`);
      }

      process.exit(verificationReport.status === 'FAIL' ? 1 : 0);
    } catch (err) {
      error(`Tailoring failed: ${(err as Error).message}`);
      process.exit(2);
    }
  });

program
  .command('verify')
  .description('Verify an existing tailored bundle against Career Vault')
  .requiredOption('--tailored <path>', 'Path to tailored resume.json or application bundle directory')
  .option('--vault <path>', 'Custom path for career vault')
  .option('--json', 'Output machine-readable JSON to stdout', false)
  .action(async (options) => {
    if (options.json) setJsonMode(true);

    try {
      const vaultDir = options.vault ? path.resolve(options.vault) : getDefaultVaultDir();
      const masterPath = path.join(vaultDir, 'master_resume.json');

      const rawMaster = await fs.readFile(masterPath, 'utf-8');
      const masterResume = MasterResumeSchema.parse(JSON.parse(rawMaster));

      let tailoredPath = path.resolve(options.tailored);
      const stat = await fs.stat(tailoredPath);
      let coverLetter: string | undefined;

      if (stat.isDirectory()) {
        const clPath = path.join(tailoredPath, 'cover_letter.md');
        try {
          coverLetter = await fs.readFile(clPath, 'utf-8');
        } catch {}
        tailoredPath = path.join(tailoredPath, 'resume.json');
      }

      const rawTailored = await fs.readFile(tailoredPath, 'utf-8');
      const tailoredResume: TailoredResume = JSON.parse(rawTailored);

      const report = verify(masterResume, tailoredResume, coverLetter);

      if (options.json) {
        outputJson(report);
      } else {
        info(`Verification Report for: ${tailoredPath}`);
        if (report.status === 'PASS') {
          success(`Status: PASS (0 errors, 0 warnings)`);
        } else if (report.status === 'PASS_WITH_WARNINGS') {
          warn(`Status: PASS_WITH_WARNINGS (${report.warningCount} warnings)`);
          for (const issue of report.issues) {
            warn(`- [${issue.field}] ${issue.reason}: ${issue.claim}`);
          }
        } else {
          error(`Status: FAIL (${report.errorCount} errors, ${report.warningCount} warnings)`);
          for (const issue of report.issues) {
            error(`- [${issue.field}] ${issue.reason}: ${issue.claim}`);
            error(`  Action: ${issue.repairAction}`);
          }
        }
      }

      process.exit(report.status === 'FAIL' ? 1 : 0);
    } catch (err) {
      error(`Verification failed: ${(err as Error).message}`);
      process.exit(2);
    }
  });

program
  .command('sync')
  .description('Reverse sync verified improvements from an application back to Career Vault')
  .requiredOption('--from <path>', 'Path to application bundle folder')
  .option('--vault <path>', 'Custom path for career vault')
  .option('--yes', 'Skip interactive confirmation gate', false)
  .action(async (options) => {
    try {
      const result = await performReverseSync({
        fromPath: options.from,
        vaultPath: options.vault,
        autoApprove: options.yes,
      });

      if (!result.allowed) {
        error(result.blockReason || 'Sync blocked by Safety Gate.');
        process.exit(1);
      }

      if (result.diffs.length === 0) {
        info('No changes to sync. Career Vault is already up to date.');
        process.exit(0);
      }

      info(`Found ${result.diffs.length} improvements ready to sync:`);
      for (const d of result.diffs) {
        info(`- [${d.type}] ${d.description}`);
        if (d.original && d.updated) {
          info(`  Original: "${d.original}"`);
          info(`  Updated:  "${d.updated}"`);
        }
      }

      if (options.yes) {
        success(`Successfully synced improvements back to Career Vault at ${result.vaultDir}`);
      } else {
        warn('Dry-run mode: pass "--yes" to commit these changes to your master Career Vault.');
      }
    } catch (err) {
      error(`Sync failed: ${(err as Error).message}`);
      process.exit(2);
    }
  });

program
  .command('doctor')
  .description('Run environment and system diagnostics')
  .option('--json', 'Output diagnostic report in JSON format', false)
  .option('--vault <path>', 'Custom path for career vault')
  .action(async (options) => {
    if (options.json) setJsonMode(true);
    try {
      const report = await runDiagnostics(options.vault);
      if (options.json) {
        outputJson(report);
      } else {
        info('Running ImprintCV Doctor diagnostics...\n');
        for (const check of report.checks) {
          if (check.passed) {
            success(`${check.name}: ${check.message}`);
          } else {
            warn(`${check.name}: ${check.message}`);
          }
        }
        info(`\nOverall System Status: ${report.status}`);
      }
    } catch (err) {
      error(`Doctor check failed: ${(err as Error).message}`);
      process.exit(2);
    }
  });

program.parse(process.argv);
