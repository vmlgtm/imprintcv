import fs from 'node:fs/promises';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { bootstrapCareerVault, getDefaultVaultDir } from '../bootstrap/init.js';
import { extractFacts } from '../bootstrap/facts-extractor.js';
import { verify } from '../verifier/index.js';
import { compileWithBudget } from '../render/page-budget.js';
import { compileTypstToPdf, type TemplateName } from '../render/typst-compiler.js';
import { writeApplicationBundle } from '../bundle/writer.js';
import { listApplications } from '../bundle/registry.js';
import { analyzeJdCompatibility } from '../tailor/jd-matcher.js';
import { loadJD } from '../tailor/jd-loader.js';
import { MasterResumeSchema, type MasterResume } from '../types/resume.js';
import { TailoredResumeSchema, normalizeTailoredResume, type TailoredResume } from '../types/bundle.js';
import { getTailoredResumeJsonSchema, getExampleTailoredResume } from './schema-helpers.js';
import { APP_VERSION } from '../utils/version.js';

interface ParseTailoredSuccess {
  success: true;
  data: TailoredResume;
}

interface ParseTailoredError {
  success: false;
  isJsonSyntaxError?: boolean;
  message: string;
  errors?: unknown;
}

type ParseTailoredResult = ParseTailoredSuccess | ParseTailoredError;

export function parseAndValidateTailoredResume(
  tailoredResume?: unknown,
  tailoredResumeJson?: unknown,
  masterResume?: MasterResume
): ParseTailoredResult {
  let raw: unknown = tailoredResume;

  if (raw === undefined && tailoredResumeJson !== undefined) {
    if (typeof tailoredResumeJson === 'string') {
      try {
        raw = JSON.parse(tailoredResumeJson);
      } catch (err) {
        return {
          success: false,
          isJsonSyntaxError: true,
          message: `Malformed JSON string provided in tailoredResumeJson: ${(err as Error).message}`,
        };
      }
    } else {
      raw = tailoredResumeJson;
    }
  } else if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch (err) {
      return {
        success: false,
        isJsonSyntaxError: true,
        message: `Malformed JSON string provided in tailoredResume: ${(err as Error).message}`,
      };
    }
  }

  if (raw === undefined || raw === null || typeof raw !== 'object') {
    return {
      success: false,
      message: "Missing required tailored resume: provide 'tailoredResume' (structured object) or 'tailoredResumeJson' (JSON string).",
    };
  }

  const parseResult = TailoredResumeSchema.safeParse(raw);
  if (!parseResult.success) {
    return {
      success: false,
      message: 'The provided tailored resume does not conform to the TailoredResume schema.',
      errors: parseResult.error.format(),
    };
  }

  let data = parseResult.data;
  if (masterResume) {
    data = normalizeTailoredResume(data, masterResume);
  }

  return {
    success: true,
    data,
  };
}

export async function resolveMasterResume(
  masterResumeArg?: unknown,
  masterResumeJson?: string,
  vaultPath?: string
): Promise<MasterResume> {
  if (masterResumeArg) {
    if (typeof masterResumeArg === 'string') {
      return MasterResumeSchema.parse(JSON.parse(masterResumeArg));
    }
    return MasterResumeSchema.parse(masterResumeArg);
  }
  if (masterResumeJson) {
    return MasterResumeSchema.parse(JSON.parse(masterResumeJson));
  }
  const vaultDir = vaultPath ? path.resolve(vaultPath) : getDefaultVaultDir();
  const jsonPath = path.join(vaultDir, 'master_resume.json');
  const raw = await fs.readFile(jsonPath, 'utf-8');
  return MasterResumeSchema.parse(JSON.parse(raw));
}

export function createImprintCVMcpServer(): McpServer {
  const server = new McpServer({
    name: 'imprintcv',
    version: APP_VERSION,
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
      tailoredResume: TailoredResumeSchema.optional().describe('Structured TailoredResume object to verify'),
      tailoredResumeJson: z.string().optional().describe('JSON string of TailoredResume object (alternative to tailoredResume)'),
      masterResume: MasterResumeSchema.optional().describe('Optional structured MasterResume (defaults to loading from Career Vault)'),
      masterResumeJson: z.string().optional().describe('Optional JSON string of MasterResume (defaults to loading from Career Vault)'),
      coverLetter: z.string().optional().describe('Optional cover letter text to verify'),
      vaultPath: z.string().optional().describe('Custom path to Career Vault directory'),
    },
    async ({ tailoredResume, tailoredResumeJson, masterResume: masterResumeArg, masterResumeJson, coverLetter, vaultPath }) => {
      try {
        let masterResume: MasterResume;
        try {
          masterResume = await resolveMasterResume(masterResumeArg, masterResumeJson, vaultPath);
        } catch (err) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Vault/MasterResume Error: ${(err as Error).message}` }],
          };
        }

        const parsedTailored = parseAndValidateTailoredResume(tailoredResume, tailoredResumeJson, masterResume);
        if (!parsedTailored.success) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: parsedTailored.isJsonSyntaxError ? 'INVALID_JSON' : 'INVALID_SCHEMA',
                    message: parsedTailored.message,
                    errors: parsedTailored.errors,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const report = verify(masterResume, parsedTailored.data, coverLetter);

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

  // Tool 4: imprintcv_save_application
  server.tool(
    'imprintcv_save_application',
    'Save complete verified application bundle (PDF, JSON, RenderCV YAML, Diff MD, Verification Report, and optional Cover Letter) into applications/<job-slug>/ with page budgeting.',
    {
      tailoredResume: TailoredResumeSchema.optional().describe('Structured TailoredResume object'),
      tailoredResumeJson: z.string().optional().describe('JSON string of TailoredResume object (alternative to tailoredResume)'),
      masterResume: MasterResumeSchema.optional().describe('Optional structured MasterResume (defaults to loading from Career Vault)'),
      masterResumeJson: z.string().optional().describe('Optional JSON string of MasterResume (defaults to loading from Career Vault)'),
      coverLetter: z.string().optional().describe('Optional cover letter markdown text to verify and save'),
      template: z.enum(['modern', 'classic', 'contemporary', 'executive', 'compact-tech']).default('modern').describe('Typst template'),
      targetPages: z.number().default(1).describe('Target page budget constraint (1 or 2)'),
      outputBaseDir: z.string().optional().describe('Custom base directory for applications (defaults to ./applications)'),
      vaultPath: z.string().optional().describe('Custom path to Career Vault directory'),
    },
    async ({ tailoredResume, tailoredResumeJson, masterResume: masterResumeArg, masterResumeJson, coverLetter, template, targetPages, outputBaseDir, vaultPath }) => {
      try {
        let masterResume: MasterResume;
        try {
          masterResume = await resolveMasterResume(masterResumeArg, masterResumeJson, vaultPath);
        } catch (err) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Vault/MasterResume Error: ${(err as Error).message}` }],
          };
        }

        const parsedTailored = parseAndValidateTailoredResume(tailoredResume, tailoredResumeJson, masterResume);
        if (!parsedTailored.success) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: parsedTailored.isJsonSyntaxError ? 'INVALID_JSON' : 'INVALID_SCHEMA',
                    message: parsedTailored.message,
                    errors: parsedTailored.errors,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const verificationReport = verify(masterResume, parsedTailored.data, coverLetter);

        if (verificationReport.status === 'FAIL') {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: 'VERIFICATION_FAILED',
                    message: 'Cannot save application bundle: Deterministic verification failed. Please repair the contradicted claims first.',
                    verification: verificationReport,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const bundle = await writeApplicationBundle(
          parsedTailored.data,
          undefined,
          verificationReport,
          coverLetter,
          {
            outputBaseDir,
            template: template as TemplateName,
            targetPages,
          }
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'SUCCESS',
                  verificationStatus: verificationReport.status,
                  bundleDir: bundle.bundleDir,
                  targetPages,
                  artifacts: {
                    pdf: bundle.pdfPath,
                    json: bundle.jsonPath,
                    diffMarkdown: bundle.mdPath,
                    rendercvYaml: bundle.yamlPath,
                    verificationReport: bundle.verifPath,
                    tailoringPlan: bundle.planPath,
                    coverLetter: bundle.clPath,
                  },
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
          content: [{ type: 'text', text: `Save Application Error: ${(err as Error).message}` }],
        };
      }
    }
  );

  // Tool 5: imprintcv_compile_pdf
  server.tool(
    'imprintcv_compile_pdf',
    'Compile a verified tailored resume into an ATS-optimized PDF using in-memory Typst WASM with page budgeting.',
    {
      tailoredResume: TailoredResumeSchema.optional().describe('Structured TailoredResume object'),
      tailoredResumeJson: z.string().optional().describe('JSON string of TailoredResume object (alternative to tailoredResume)'),
      template: z.enum(['modern', 'classic', 'contemporary', 'executive', 'compact-tech']).default('modern').describe('Typst template'),
      outputPath: z.string().optional().describe('Optional output file path to write PDF to'),
      targetPages: z.number().optional().default(1).describe('Target page budget constraint (1 or 2)'),
    },
    async ({ tailoredResume, tailoredResumeJson, template, outputPath, targetPages }) => {
      try {
        const parsedTailored = parseAndValidateTailoredResume(tailoredResume, tailoredResumeJson);
        if (!parsedTailored.success) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: parsedTailored.isJsonSyntaxError ? 'INVALID_JSON' : 'INVALID_SCHEMA',
                    message: parsedTailored.message,
                    errors: parsedTailored.errors,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const { pdfBytes, pageCount, adjustmentsApplied } = await compileWithBudget(
          parsedTailored.data,
          template as TemplateName,
          targetPages || 1
        );

        if (outputPath) {
          const resolvedOut = path.resolve(outputPath);
          await fs.mkdir(path.dirname(resolvedOut), { recursive: true });
          await fs.writeFile(resolvedOut, Buffer.from(pdfBytes));
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: 'SUCCESS',
                    outputPath: resolvedOut,
                    sizeBytes: pdfBytes.length,
                    pageCount,
                    adjustmentsApplied,
                  },
                  null,
                  2
                ),
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
                pageCount,
                adjustmentsApplied,
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

  // Tool 6: imprintcv_analyze_jd
  server.tool(
    'imprintcv_analyze_jd',
    'Analyze job description compatibility against Career Vault, returning 3-tier gap analysis (covered skills, untapped vault skills, and true skill gaps).',
    {
      jd: z.string().describe('Job description text or file path'),
      vaultPath: z.string().optional().describe('Custom path to Career Vault directory'),
      tailoredResume: TailoredResumeSchema.optional().describe('Optional structured TailoredResume object'),
      tailoredResumeJson: z.string().optional().describe('Optional JSON string of TailoredResume object'),
    },
    async ({ jd, vaultPath, tailoredResume: tailoredResumeArg, tailoredResumeJson }) => {
      try {
        const vaultDir = vaultPath ? path.resolve(vaultPath) : getDefaultVaultDir();
        const jsonPath = path.join(vaultDir, 'master_resume.json');
        const rawJson = await fs.readFile(jsonPath, 'utf-8');
        const masterResume = MasterResumeSchema.parse(JSON.parse(rawJson));

        const jdText = await loadJD(jd);
        let tailoredResume: TailoredResume | undefined;
        if (tailoredResumeArg !== undefined || tailoredResumeJson !== undefined) {
          const parsed = parseAndValidateTailoredResume(tailoredResumeArg, tailoredResumeJson, masterResume);
          if (!parsed.success) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      status: parsed.isJsonSyntaxError ? 'INVALID_JSON' : 'INVALID_SCHEMA',
                      message: parsed.message,
                      errors: parsed.errors,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }
          tailoredResume = parsed.data;
        }

        const result = analyzeJdCompatibility(masterResume, jdText, tailoredResume);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `JD Match Error: ${(err as Error).message}` }],
        };
      }
    }
  );

  // Tool 7: imprintcv_list_applications
  server.tool(
    'imprintcv_list_applications',
    'List all tracked job applications and verification reports from applications/registry.json.',
    {
      applicationsDir: z.string().optional().describe('Custom applications directory (defaults to ./applications)'),
    },
    async ({ applicationsDir }) => {
      try {
        const apps = await listApplications(applicationsDir);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ applications: apps }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `List Applications Error: ${(err as Error).message}` }],
        };
      }
    }
  );

  // Tool 8: imprintcv_get_schema
  server.tool(
    'imprintcv_get_schema',
    'Retrieve the exact JSON Schema, example template, and authoring guidelines for TailoredResume to ensure flawless verification in standalone MCP mode.',
    {},
    async () => {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                status: 'SUCCESS',
                schema: getTailoredResumeJsonSchema(),
                example: getExampleTailoredResume(),
                guidance: [
                  'Match experience[].id with master_resume.json experience IDs (e.g. "exp_stripe").',
                  'In each bullet, set sourceBulletIds to the source highlight ID(s) from the Career Vault (e.g. ["bullet_stripe_01"]).',
                  'Retain exact historical employment dates, company names, and educational degrees.',
                  'Set bullet status to UNCHANGED, REWORDED, REPHRASED, REORDERED, COMPRESSED, or COMBINED.',
                  'Do not inflate numbers/metrics or claim unverified technologies (e.g. Azure, C#) not in Career Vault.',
                  'If highlights is provided instead of bullets, ImprintCV will automatically normalize them into bullets.',
                ],
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // MCP Resource: schema template
  server.resource(
    'tailored-resume-schema',
    'imprintcv://schema/tailored-resume',
    { mimeType: 'application/json', description: 'JSON Schema and example template for TailoredResume' },
    async () => ({
      contents: [
        {
          uri: 'imprintcv://schema/tailored-resume',
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              schema: getTailoredResumeJsonSchema(),
              example: getExampleTailoredResume(),
            },
            null,
            2
          ),
        },
      ],
    })
  );

  return server;
}

export async function runMcpServer() {
  const server = createImprintCVMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
