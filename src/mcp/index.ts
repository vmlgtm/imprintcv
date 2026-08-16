#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { bootstrapCareerVault, getDefaultVaultDir } from '../bootstrap/init.js';
import { extractFacts } from '../bootstrap/facts-extractor.js';
import { verify } from '../verifier/index.js';
import { compileTypstToPdf, type TemplateName } from '../render/typst-compiler.js';
import { MasterResumeSchema, type MasterResume } from '../types/resume.js';
import type { TailoredResume } from '../types/bundle.js';

export function createImprintCVMcpServer(): McpServer {
  const server = new McpServer({
    name: 'imprintcv',
    version: '0.1.0',
  });

  // Tool 1: imprintcv_init
  server.tool(
    'imprintcv_init',
    'Bootstrap Master Profile / Career Vault from legacy resume PDF, DOCX, or TXT file.',
    {
      sourcePath: z.string().describe('Path to source resume file (.pdf, .docx, .txt)'),
      vaultPath: z.string().optional().describe('Custom destination path for Career Vault directory'),
    },
    async ({ sourcePath, vaultPath }) => {
      try {
        const result = await bootstrapCareerVault({
          fromPath: sourcePath,
          vaultPath,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'SUCCESS',
                  vaultDir: result.vaultDir,
                  jsonPath: result.jsonPath,
                  mdPath: result.mdPath,
                  vaultHash: result.masterResume.metadata.vaultHash,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Init Error: ${(err as Error).message}` }],
        };
      }
    }
  );

  // Tool 2: imprintcv_get_facts
  server.tool(
    'imprintcv_get_facts',
    'Retrieve immutable structured facts with stable IDs and metrics from the Career Vault.',
    {
      vaultPath: z.string().optional().describe('Custom path to Career Vault directory (defaults to ~/career/)'),
    },
    async ({ vaultPath }) => {
      try {
        const vaultDir = vaultPath ? path.resolve(vaultPath) : getDefaultVaultDir();
        const jsonPath = path.join(vaultDir, 'master_resume.json');
        const rawJson = await fs.readFile(jsonPath, 'utf-8');
        const masterResume = MasterResumeSchema.parse(JSON.parse(rawJson));
        const facts = extractFacts(masterResume);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ masterResume, facts }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Get Facts Error: ${(err as Error).message}` }],
        };
      }
    }
  );

  // Tool 3: imprintcv_verify_draft
  server.tool(
    'imprintcv_verify_draft',
    'Deterministically verify a tailored resume draft against the Career Vault (Layer 1-3 checks). Returns PASS, PASS_WITH_WARNINGS, or FAIL with machine-readable repair actions.',
    {
      tailoredResumeJson: z.string().describe('JSON string of TailoredResume object'),
      masterResumeJson: z.string().optional().describe('Optional JSON string of MasterResume (defaults to loading from Career Vault)'),
      coverLetter: z.string().optional().describe('Optional cover letter text to verify'),
      vaultPath: z.string().optional().describe('Custom path to Career Vault directory'),
    },
    async ({ tailoredResumeJson, masterResumeJson, coverLetter, vaultPath }) => {
      try {
        let masterResume: MasterResume;
        if (masterResumeJson) {
          masterResume = MasterResumeSchema.parse(JSON.parse(masterResumeJson));
        } else {
          const vaultDir = vaultPath ? path.resolve(vaultPath) : getDefaultVaultDir();
          const jsonPath = path.join(vaultDir, 'master_resume.json');
          const raw = await fs.readFile(jsonPath, 'utf-8');
          masterResume = MasterResumeSchema.parse(JSON.parse(raw));
        }

        const tailoredResume: TailoredResume = JSON.parse(tailoredResumeJson);
        const report = verify(masterResume, tailoredResume, coverLetter);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(report, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Verification Error: ${(err as Error).message}` }],
        };
      }
    }
  );

  // Tool 4: imprintcv_compile_pdf
  server.tool(
    'imprintcv_compile_pdf',
    'Compile a verified tailored resume into an ATS-optimized PDF using in-memory Typst WASM.',
    {
      tailoredResumeJson: z.string().describe('JSON string of TailoredResume object'),
      template: z.enum(['modern', 'classic', 'contemporary']).default('modern').describe('Typst template'),
      outputPath: z.string().optional().describe('Optional output file path to write PDF to'),
    },
    async ({ tailoredResumeJson, template, outputPath }) => {
      try {
        const tailoredResume: TailoredResume = JSON.parse(tailoredResumeJson);
        const pdfBytes = await compileTypstToPdf(tailoredResume, {
          template: template as TemplateName,
        });

        if (outputPath) {
          const resolvedOut = path.resolve(outputPath);
          await fs.mkdir(path.dirname(resolvedOut), { recursive: true });
          await fs.writeFile(resolvedOut, Buffer.from(pdfBytes));
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ status: 'SUCCESS', outputPath: resolvedOut, sizeBytes: pdfBytes.length }, null, 2),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'SUCCESS',
                pdfBase64: Buffer.from(pdfBytes).toString('base64'),
                sizeBytes: pdfBytes.length,
              }),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Compile Error: ${(err as Error).message}` }],
        };
      }
    }
  );

  return server;
}

export async function runMcpServer() {
  const server = createImprintCVMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMcpServer().catch((err) => {
    process.stderr.write(`MCP server fatal error: ${err.message}\n`);
    process.exit(1);
  });
}
