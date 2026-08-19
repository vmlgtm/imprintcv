import { describe, it, expect } from 'vitest';
import { runDiagnostics } from '../../../src/doctor/doctor.js';

describe('Phase 6: Doctor Diagnostics', () => {
  it('runs diagnostic checks and returns structured report', async () => {
    const report = await runDiagnostics();

    expect(report.nodeVersion).toBeDefined();
    expect(report.platform).toBeDefined();
    expect(report.checks.length).toBeGreaterThanOrEqual(3);

    const nodeCheck = report.checks.find((c) => c.name === 'Node.js Runtime');
    expect(nodeCheck).toBeDefined();
    expect(nodeCheck?.passed).toBe(true);

    const typstCheck = report.checks.find((c) => c.name === 'Typst WASM Compiler');
    expect(typstCheck).toBeDefined();
    expect(typstCheck?.passed).toBe(true);
  });

  it('evaluates data quality checks when a vault directory is provided', async () => {
    // Tests with fixtures/senior-frontend vault directory
    const path = await import('node:path');
    const fixtureVault = path.resolve(__dirname, '../../fixtures/senior-frontend');
    const report = await runDiagnostics(fixtureVault);

    const vaultCheck = report.checks.find((c) => c.name === 'Career Vault');
    expect(vaultCheck?.passed).toBe(true);

    const activeCheck = report.checks.find((c) => c.name === 'Vault Quality: Active Roles');
    expect(activeCheck).toBeDefined();

    const techCheck = report.checks.find((c) => c.name === 'Vault Quality: Role Technologies');
    expect(techCheck).toBeDefined();

    const emailCheck = report.checks.find((c) => c.name === 'Vault Quality: Email Format');
    expect(emailCheck).toBeDefined();
    expect(emailCheck?.passed).toBe(true);

    const chronoCheck = report.checks.find((c) => c.name === 'Vault Quality: Chronological Order');
    expect(chronoCheck).toBeDefined();
  });
});
