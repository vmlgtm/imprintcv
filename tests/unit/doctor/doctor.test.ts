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
});
