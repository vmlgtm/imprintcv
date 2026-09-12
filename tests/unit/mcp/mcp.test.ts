import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createImprintCVMcpServer } from '../../../src/mcp/server.js';
import type { MasterResume } from '../../../src/types/resume.js';
import type { TailoredResume } from '../../../src/types/bundle.js';

describe('Phase 7: MCP Server & Tools', () => {
  let tempDir: string;

  const sampleMaster: MasterResume = {
    metadata: {
      schemaVersion: '2.1.0',
      vaultVersion: 1,
      vaultHash: 'hash_mcp_test',
      lastUpdated: '2026-08-20T00:00:00Z',
    },
    basics: {
      name: 'Alex Developer',
      email: 'alex@example.com',
      phone: '+1-555-0100',
      location: 'San Francisco, CA',
      summary: 'Senior Backend Engineer specializing in TypeScript, Node.js, and Postgres.',
    },
    experience: [
      {
        id: 'exp_stripe',
        company: 'Stripe',
        title: 'Senior Software Engineer',
        startDate: '2021-01',
        endDate: null,
        highlights: [
          {
            id: 'bullet_stripe_01',
            text: 'Architected payment webhook processor handling 25,000 req/sec with 99.99% uptime.',
            technologies: ['TypeScript', 'Node.js', 'PostgreSQL', 'Redis'],
          },
        ],
        technologies: ['TypeScript', 'Node.js', 'PostgreSQL', 'Redis'],
      },
    ],
    skills: [
      { id: 'skill_ts', name: 'TypeScript', canonical: 'typescript' },
      { id: 'skill_node', name: 'Node.js', canonical: 'node.js' },
      { id: 'skill_pg', name: 'PostgreSQL', canonical: 'postgresql' },
    ],
    education: [
      {
        id: 'edu_ucb',
        institution: 'UC Berkeley',
        degree: 'B.S. in Electrical Engineering and Computer Science',
        startDate: '2016-08',
        endDate: '2020-05',
      },
    ],
    projects: [],
  };

  const sampleTailored: TailoredResume = {
    targetRole: 'Staff Infrastructure Engineer',
    targetCompany: 'Stripe',
    basics: sampleMaster.basics,
    experience: [
      {
        id: 'exp_stripe',
        company: 'Stripe',
        title: 'Senior Software Engineer',
        startDate: '2021-01',
        endDate: null,
        technologies: ['TypeScript', 'Node.js', 'PostgreSQL', 'Redis'],
        bullets: [
          {
            id: 'bullet_stripe_01',
            sourceBulletIds: ['bullet_stripe_01'],
            sourceFactIds: [],
            original: sampleMaster.experience[0].highlights[0].text,
            tailored: 'Scaled real-time payment ingestion pipelines in TypeScript to 25,000 req/sec with 99.99% uptime.',
            status: 'REPHRASED',
            matchedKeywords: ['TypeScript', 'pipelines'],
          },
        ],
      },
    ],
    skills: sampleMaster.skills,
    education: sampleMaster.education,
  };

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'imprintcv-mcp-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('instantiates MCP server with all 8 tools registered', () => {
    const server = createImprintCVMcpServer();
    expect(server).toBeDefined();

    // Access registered tools map on server instance
    const registeredTools = (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools;
    expect(registeredTools).toBeDefined();
    expect(registeredTools['imprintcv_init']).toBeDefined();
    expect(registeredTools['imprintcv_get_facts']).toBeDefined();
    expect(registeredTools['imprintcv_verify_draft']).toBeDefined();
    expect(registeredTools['imprintcv_save_application']).toBeDefined();
    expect(registeredTools['imprintcv_compile_pdf']).toBeDefined();
    expect(registeredTools['imprintcv_analyze_jd']).toBeDefined();
    expect(registeredTools['imprintcv_list_applications']).toBeDefined();
    expect(registeredTools['imprintcv_get_schema']).toBeDefined();
  });

  it('imprintcv_save_application generates complete application bundle with all 7 artifacts', async () => {
    const server = createImprintCVMcpServer();
    const registeredTools = (server as unknown as { _registeredTools: Record<string, { handler: (args: unknown) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> }> })._registeredTools;

    const saveTool = registeredTools['imprintcv_save_application'];
    expect(saveTool).toBeDefined();

    const coverLetter = `Dear Stripe Hiring Team,\n\nI am writing to express my strong interest in the Staff Infrastructure Engineer position.\n\nAt Stripe, I scaled payment pipelines to 25,000 req/sec with 99.99% uptime.\n\nSincerely,\nAlex Developer`;

    const response = await saveTool.handler({
      tailoredResumeJson: JSON.stringify(sampleTailored),
      masterResumeJson: JSON.stringify(sampleMaster),
      coverLetter,
      template: 'modern',
      targetPages: 1,
      outputBaseDir: tempDir,
    });

    expect(response.isError).toBeFalsy();
    const result = JSON.parse(response.content[0].text);
    expect(result.status).toBe('SUCCESS');
    expect(result.verificationStatus).toBe('PASS');
    expect(result.bundleDir).toBeDefined();

    // Verify all 7 files were written to disk
    const bundleDir = result.bundleDir;
    const pdfStat = await fs.stat(path.join(bundleDir, 'resume.pdf'));
    expect(pdfStat.size).toBeGreaterThan(0);

    const jsonContent = JSON.parse(await fs.readFile(path.join(bundleDir, 'resume.json'), 'utf-8'));
    expect(jsonContent.targetRole).toBe('Staff Infrastructure Engineer');

    const mdContent = await fs.readFile(path.join(bundleDir, 'resume.md'), 'utf-8');
    expect(mdContent).toContain('Tailored Resume: Staff Infrastructure Engineer at Stripe');
    expect(mdContent).toContain('25,000 req/sec');

    const yamlContent = await fs.readFile(path.join(bundleDir, 'resume.yaml'), 'utf-8');
    expect(yamlContent).toContain('name: Alex Developer');

    const clContent = await fs.readFile(path.join(bundleDir, 'cover_letter.md'), 'utf-8');
    expect(clContent).toContain('Dear Stripe Hiring Team');

    const planContent = JSON.parse(await fs.readFile(path.join(bundleDir, 'tailoring_plan.json'), 'utf-8'));
    expect(planContent.targetCompany).toBe('Stripe');

    const verifContent = JSON.parse(await fs.readFile(path.join(bundleDir, 'verification.json'), 'utf-8'));
    expect(verifContent.status).toBe('PASS');
  });

  it('imprintcv_save_application rejects drafts with hallucinated metrics', async () => {
    const server = createImprintCVMcpServer();
    const registeredTools = (server as unknown as { _registeredTools: Record<string, { handler: (args: unknown) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> }> })._registeredTools;

    const saveTool = registeredTools['imprintcv_save_application'];

    const hallucinatedTailored: TailoredResume = JSON.parse(JSON.stringify(sampleTailored));
    hallucinatedTailored.experience[0].bullets[0].tailored = 'Scaled pipelines to 500,000 req/sec.'; // 20x inflation

    const response = await saveTool.handler({
      tailoredResumeJson: JSON.stringify(hallucinatedTailored),
      masterResumeJson: JSON.stringify(sampleMaster),
      template: 'modern',
      targetPages: 1,
      outputBaseDir: tempDir,
    });

    expect(response.isError).toBe(true);
    const result = JSON.parse(response.content[0].text);
    expect(result.status).toBe('VERIFICATION_FAILED');
    expect(result.verification.status).toBe('FAIL');
    expect(result.verification.errorCount).toBeGreaterThan(0);
  });

  it('imprintcv_compile_pdf compiles PDF with page-budgeting metadata', async () => {
    const server = createImprintCVMcpServer();
    const registeredTools = (server as unknown as { _registeredTools: Record<string, { handler: (args: unknown) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> }> })._registeredTools;

    const compileTool = registeredTools['imprintcv_compile_pdf'];
    const outputPath = path.join(tempDir, 'standalone_resume.pdf');

    const response = await compileTool.handler({
      tailoredResumeJson: JSON.stringify(sampleTailored),
      template: 'modern',
      outputPath,
      targetPages: 1,
    });

    expect(response.isError).toBeFalsy();
    const result = JSON.parse(response.content[0].text);
    expect(result.status).toBe('SUCCESS');
    expect(result.outputPath).toBe(outputPath);
    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(result.pageCount).toBe(1);
    expect(Array.isArray(result.adjustmentsApplied)).toBe(true);

    const pdfStat = await fs.stat(outputPath);
    expect(pdfStat.size).toBe(result.sizeBytes);
  });

  it('imprintcv_analyze_jd analyzes JD compatibility and returns 3-tier gap report', async () => {
    const server = createImprintCVMcpServer();
    const registeredTools = (server as unknown as { _registeredTools: Record<string, { handler: (args: unknown) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> }> })._registeredTools;

    const analyzeTool = registeredTools['imprintcv_analyze_jd'];
    expect(analyzeTool).toBeDefined();

    // Write master resume to temp dir
    await fs.writeFile(path.join(tempDir, 'master_resume.json'), JSON.stringify(sampleMaster, null, 2), 'utf-8');

    const jdText = `We are looking for a Senior Engineer with deep TypeScript, Node.js, and Swift experience.`;
    const response = await analyzeTool.handler({
      jd: jdText,
      vaultPath: tempDir,
    });

    expect(response.isError).toBeFalsy();
    const result = JSON.parse(response.content[0].text);
    expect(result.score).toBeGreaterThan(0);
    expect(result.coveredSkills).toContain('typescript');
    expect(result.trueSkillGaps).toContain('swift');
  });

  it('imprintcv_list_applications lists registered applications from directory', async () => {
    const server = createImprintCVMcpServer();
    const registeredTools = (server as unknown as { _registeredTools: Record<string, { handler: (args: unknown) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> }> })._registeredTools;

    const listTool = registeredTools['imprintcv_list_applications'];
    expect(listTool).toBeDefined();

    const response = await listTool.handler({
      applicationsDir: tempDir,
    });

    expect(response.isError).toBeFalsy();
    const result = JSON.parse(response.content[0].text);
    expect(Array.isArray(result.applications)).toBe(true);
  });

  it('imprintcv_get_schema returns full JSON schema, valid example, and guidelines', async () => {
    const server = createImprintCVMcpServer();
    const registeredTools = (server as unknown as { _registeredTools: Record<string, { handler: (args: unknown) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> }> })._registeredTools;

    const schemaTool = registeredTools['imprintcv_get_schema'];
    expect(schemaTool).toBeDefined();

    const response = await schemaTool.handler({});
    expect(response.isError).toBeFalsy();
    const result = JSON.parse(response.content[0].text);
    expect(result.status).toBe('SUCCESS');
    expect(result.schema).toBeDefined();
    expect(result.schema.type).toBe('object');
    expect(result.schema.properties.targetRole).toBeDefined();
    expect(result.schema.properties.experience).toBeDefined();
    expect(result.example).toBeDefined();
    expect(result.example.targetRole).toBe('Staff Infrastructure Engineer');
    expect(Array.isArray(result.guidance)).toBe(true);
  });

  it('imprintcv_verify_draft returns INVALID_JSON on malformed JSON string', async () => {
    const server = createImprintCVMcpServer();
    const registeredTools = (server as unknown as { _registeredTools: Record<string, { handler: (args: unknown) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> }> })._registeredTools;

    const verifyTool = registeredTools['imprintcv_verify_draft'];

    const response = await verifyTool.handler({
      tailoredResumeJson: '{ "targetRole": "Engineer", unclosed_json...',
      masterResumeJson: JSON.stringify(sampleMaster),
    });

    expect(response.isError).toBe(true);
    const result = JSON.parse(response.content[0].text);
    expect(result.status).toBe('INVALID_JSON');
    expect(result.message).toContain('Malformed JSON string');
  });

  it('imprintcv_verify_draft returns INVALID_SCHEMA with structured errors on missing required fields', async () => {
    const server = createImprintCVMcpServer();
    const registeredTools = (server as unknown as { _registeredTools: Record<string, { handler: (args: unknown) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> }> })._registeredTools;

    const verifyTool = registeredTools['imprintcv_verify_draft'];

    const response = await verifyTool.handler({
      tailoredResumeJson: JSON.stringify({
        // missing targetRole, targetCompany, basics
        experience: [],
      }),
      masterResumeJson: JSON.stringify(sampleMaster),
    });

    expect(response.isError).toBe(true);
    const result = JSON.parse(response.content[0].text);
    expect(result.status).toBe('INVALID_SCHEMA');
    expect(result.errors).toBeDefined();
    expect(result.errors.targetRole).toBeDefined();
    expect(result.errors.targetCompany).toBeDefined();
  });

  it('imprintcv_verify_draft accepts structured tailoredResume object directly', async () => {
    const server = createImprintCVMcpServer();
    const registeredTools = (server as unknown as { _registeredTools: Record<string, { handler: (args: unknown) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> }> })._registeredTools;

    const verifyTool = registeredTools['imprintcv_verify_draft'];

    const response = await verifyTool.handler({
      tailoredResume: sampleTailored, // structured object, NOT stringified!
      masterResume: sampleMaster,
    });

    expect(response.isError).toBeFalsy();
    const result = JSON.parse(response.content[0].text);
    expect(result.status).toBe('PASS');
    expect(result.errorCount).toBe(0);
  });

  it('imprintcv_verify_draft normalizes highlights format gracefully without crashing', async () => {
    const server = createImprintCVMcpServer();
    const registeredTools = (server as unknown as { _registeredTools: Record<string, { handler: (args: unknown) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> }> })._registeredTools;

    const verifyTool = registeredTools['imprintcv_verify_draft'];

    const legacyDraft = {
      targetRole: 'Senior Software Engineer',
      targetCompany: 'Stripe',
      basics: sampleMaster.basics,
      experience: [
        {
          id: 'exp_stripe',
          company: 'Stripe',
          title: 'Senior Software Engineer',
          startDate: '2021-01',
          endDate: null,
          technologies: ['TypeScript', 'Node.js'],
          highlights: [
            {
              id: 'bullet_stripe_01',
              text: 'Architected payment webhook processor handling 25,000 req/sec with 99.99% uptime.',
            },
          ],
        },
      ],
      skills: sampleMaster.skills,
      education: sampleMaster.education,
    };

    const response = await verifyTool.handler({
      tailoredResume: legacyDraft,
      masterResume: sampleMaster,
    });

    expect(response.isError).toBeFalsy();
    const result = JSON.parse(response.content[0].text);
    expect(result.status).toBe('PASS');
    expect(result.errorCount).toBe(0);
  });
});
