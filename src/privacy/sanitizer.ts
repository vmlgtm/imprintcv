export interface SanitizationResult {
  sanitized: string;
  replacements: Map<string, string>;
}

export function sanitizeText(text: string): SanitizationResult {
  const replacements = new Map<string, string>();
  let count = 1;

  // 1. Email addresses
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,10}\b/g;
  let sanitized = text.replace(emailRegex, (match) => {
    const token = `{{EMAIL_${count++}}}`;
    replacements.set(token, match);
    return token;
  });

  // 2. Phone numbers (e.g. +1-555-0199, (555) 123-4567, 555-123-4567, +44 20 7123 4567)
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]*)?(?:\(\d{3}\)|\d{3})[-.\s]*\d{3}[-.\s]*\d{4}(?:\s*(?:ext|x|#)\s*\d+)?/gi;
  sanitized = sanitized.replace(phoneRegex, (match) => {
    const digits = match.replace(/\D/g, '');
    if (digits.length >= 7) {
      const token = `{{PHONE_${count++}}}`;
      replacements.set(token, match);
      return token;
    }
    return match;
  });

  // 3. Street addresses (e.g., 123 Main St, 742 Evergreen Terrace)
  const addressRegex = /\b\d{1,5}\s+[A-Za-z0-9\s.,#-]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Way|Terrace)\b/gi;
  sanitized = sanitized.replace(addressRegex, (match) => {
    const token = `{{ADDRESS_${count++}}}`;
    replacements.set(token, match);
    return token;
  });

  return { sanitized, replacements };
}

export function restoreText(sanitized: string, replacements: Map<string, string>): string {
  let restored = sanitized;
  for (const [token, original] of replacements.entries()) {
    restored = restored.replaceAll(token, original);
  }
  return restored;
}
