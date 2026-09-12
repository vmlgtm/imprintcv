import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import AdmZip from 'adm-zip';
import { parseCsv, parseLinkedInToMasterResume, loadLinkedInFiles, type LinkedInExportFiles } from '../../../src/bootstrap/linkedin-parser.js';
import { MasterResumeSchema } from '../../../src/types/resume.js';

describe('Phase 1: LinkedIn Archive & Directory Ingestion', () => {
  it('parses complex RFC-4180 CSV with quotes, commas, and newlines', () => {
    const csv = `Company Name,Title,Description,Location,Started On,Finished On
"Acme, Inc.","Staff Engineer","Led migration of core payment pipeline.
- Reduced latency by 45% across 10M req/day.
- Mentored 8 engineers.","San Francisco, CA","Jan 2022","Present"
"Beta Corp","Senior Developer","Built real-time websocket microservices.","New York, NY","Jun 2019","Dec 2021"`;

    const parsed = parseCsv(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].companyname).toBe('Acme, Inc.');
    expect(parsed[0].title).toBe('Staff Engineer');
    expect(parsed[0].description).toContain('Reduced latency by 45%');
    expect(parsed[0].startedon).toBe('Jan 2022');
    expect(parsed[0].finishedon).toBe('Present');
    expect(parsed[1].companyname).toBe('Beta Corp');
  });

  it('transforms LinkedIn export files into a validated MasterResume with stable IDs', () => {
    const files: LinkedInExportFiles = {
      profileCsv: `First Name,Last Name,Headline,Summary,Location,Zip Code,Websites
"Jane","Doe","Staff Infrastructure Architect","Passionate systems engineer with 10+ years experience.","San Francisco Bay Area","94105","https://github.com/janedoe,https://linkedin.com/in/janedoe"`,
      skillsCsv: `Name
"Kubernetes"
"Go"
"TypeScript"
"Distributed Systems"`,
      positionsCsv: `Company Name,Title,Description,Location,Started On,Finished On
"CloudScale","Principal Systems Architect","Architected multi-region Kubernetes control plane.
• Scaled cluster capacity to 50,000 nodes with 99.999% availability.
• Cut AWS infrastructure cost by $2.4M annually through spot-instance scheduler.","San Francisco, CA","Feb 2022",""
"DataCore","Senior Infrastructure Engineer","Built Go streaming ingestion engine handling 500k events/sec.
• Maintained TypeScript internal developer portal.","Palo Alto, CA","Aug 2018","Jan 2022"`,
      educationCsv: `School Name,Degree Name,Notes,Start Date,End Date
"UC Berkeley","B.S. Computer Science","High Honors","2014","2018"`,
      projectsCsv: `Title,Description,Url
"OpenMesh","Distributed service mesh written in Go for edge computing.","https://github.com/janedoe/openmesh"`,
    };

    const resume = parseLinkedInToMasterResume(files);

    // Validate schema compliance
    const validated = MasterResumeSchema.safeParse(resume);
    expect(validated.success).toBe(true);

    expect(resume.basics.name).toBe('Jane Doe');
    expect(resume.basics.summary).toContain('Passionate systems engineer');
    expect(resume.basics.github).toBe('https://github.com/janedoe');
    expect(resume.basics.linkedin).toBe('https://linkedin.com/in/janedoe');

    // Check Skills
    expect(resume.skills.length).toBe(4);
    expect(resume.skills.map((s) => s.name)).toEqual(['Kubernetes', 'Go', 'TypeScript', 'Distributed Systems']);

    // Check Experience & Bullets & Tech matching
    expect(resume.experience.length).toBe(2);
    const exp1 = resume.experience[0];
    expect(exp1.company).toBe('CloudScale');
    expect(exp1.title).toBe('Principal Systems Architect');
    expect(exp1.startDate).toBe('2022-02');
    expect(exp1.endDate).toBeNull(); // Active role
    expect(exp1.highlights.length).toBe(3);
    expect(exp1.highlights[0].id).toContain('cloudscale');
    expect(exp1.highlights[0].text).toContain('Architected multi-region Kubernetes control plane');
    expect(exp1.highlights[0].technologies).toContain('Kubernetes');
    expect(exp1.highlights[1].text).toContain('Scaled cluster capacity to 50,000 nodes');

    // Check Education
    expect(resume.education.length).toBe(1);
    expect(resume.education[0].institution).toBe('UC Berkeley');

    // Check Projects
    expect(resume.projects.length).toBe(1);
    expect(resume.projects[0].name).toBe('OpenMesh');
    expect(resume.projects[0].technologies).toContain('Go');

    // Check Metadata & Hash
    expect(resume.metadata.schemaVersion).toBe('2.1.0');
    expect(resume.metadata.vaultHash).toBeDefined();
  });

  it('loads files from a real zip archive and directory export', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'imprintcv-linkedin-test-'));
    try {
      const positionsContent = `Company Name,Title,Description,Started On,Finished On\n"Stripe","Staff SRE","Built multi-region failover.","2021","Present"`;
      const skillsContent = `Name\n"Go"\n"Rust"`;

      // 1. Directory export test
      const exportDir = path.join(tempDir, 'export_folder');
      await fs.mkdir(exportDir);
      await fs.writeFile(path.join(exportDir, 'Positions.csv'), positionsContent);
      await fs.writeFile(path.join(exportDir, 'Skills.csv'), skillsContent);

      const dirFiles = await loadLinkedInFiles(exportDir);
      expect(dirFiles.positionsCsv).toBe(positionsContent);
      expect(dirFiles.skillsCsv).toBe(skillsContent);

      // 2. Zip archive test
      const zip = new AdmZip();
      zip.addFile('Positions.csv', Buffer.from(positionsContent, 'utf8'));
      zip.addFile('Skills.csv', Buffer.from(skillsContent, 'utf8'));
      const zipPath = path.join(tempDir, 'linkedin.zip');
      zip.writeZip(zipPath);

      const zipFiles = await loadLinkedInFiles(zipPath);
      expect(zipFiles.positionsCsv).toBe(positionsContent);
      expect(zipFiles.skillsCsv).toBe(skillsContent);

      const masterResume = parseLinkedInToMasterResume(zipFiles);
      expect(masterResume.experience[0].company).toBe('Stripe');
      expect(masterResume.skills.map((s) => s.name)).toEqual(['Go', 'Rust']);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
