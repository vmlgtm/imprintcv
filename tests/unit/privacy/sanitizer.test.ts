import { describe, it, expect } from 'vitest';
import { sanitizeText, restoreText } from '../../../src/privacy/sanitizer.js';

describe('Phase 2: Privacy Sanitizer', () => {
  it('redacts email addresses with deterministic replacement tokens', () => {
    const raw = 'Contact me at john.doe@company.org or support@domain.io for inquiries.';
    const { sanitized, replacements } = sanitizeText(raw);

    expect(sanitized).not.toContain('john.doe@company.org');
    expect(sanitized).not.toContain('support@domain.io');
    expect(sanitized).toMatch(/\{\{EMAIL_\d+\}\}/);

    const restored = restoreText(sanitized, replacements);
    expect(restored).toBe(raw);
  });

  it('redacts phone numbers while preserving text context', () => {
    const raw = 'Call me at (555) 123-4567 or +1-800-555-0199.';
    const { sanitized, replacements } = sanitizeText(raw);

    expect(sanitized).not.toContain('(555) 123-4567');
    expect(sanitized).not.toContain('+1-800-555-0199');
    expect(sanitized).toMatch(/\{\{PHONE_\d+\}\}/);

    const restored = restoreText(sanitized, replacements);
    expect(restored).toBe(raw);
  });

  it('redacts street addresses', () => {
    const raw = 'Located at 123 Market Street, Suite 400 and previously at 742 Evergreen Terrace.';
    const { sanitized, replacements } = sanitizeText(raw);

    expect(sanitized).not.toContain('123 Market Street');
    expect(sanitized).toMatch(/\{\{ADDRESS_\d+\}\}/);

    const restored = restoreText(sanitized, replacements);
    expect(restored).toBe(raw);
  });

  it('does not alter non-PII technical text and metrics', () => {
    const raw = 'Reduced latency by 45% across 20 microservices processing 10,000 req/sec in Kubernetes.';
    const { sanitized, replacements } = sanitizeText(raw);

    expect(sanitized).toBe(raw);
    expect(replacements.size).toBe(0);
  });

  it('rejects malformed email strings with concatenated labels exceeding TLD cap', () => {
    const raw = 'Contact vaibhav.misra92@outlook.comLinkedIn: linkedin.com/in/vaibhav-misra';
    const { sanitized, replacements } = sanitizeText(raw);

    // .comLinkedIn is 11 chars (> 10 max TLD length) so it should not match emailRegex
    expect(sanitized).not.toContain('{{EMAIL_');
    expect(replacements.size).toBe(0);
  });
});
