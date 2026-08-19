import type { MasterResume } from '../types/resume.js';
import type { TailoredResume, VerificationIssue } from '../types/bundle.js';

function extractKeywords(text: string): Set<string> {
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'as', 'is', 'was',
    'are', 'were', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'but', 'if', 'then', 'else',
    'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
    'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just',
    'should', 'now', 'into', 'across', 'using', 'used', 'built', 'delivering', 'delivered', 'led', 'served',
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^\w\s\d\-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !stopWords.has(w));

  return new Set(words);
}

export function checkProvenance(
  masterResume: MasterResume,
  tailoredResume: TailoredResume
): VerificationIssue[] {
  const issues: VerificationIssue[] = [];

  // Build lookup of all master bullets
  const masterBulletMap = new Map<string, { companyId: string; text: string; technologies: string[] }>();
  for (const exp of masterResume.experience) {
    for (const h of exp.highlights) {
      masterBulletMap.set(h.id, { companyId: exp.id, text: h.text, technologies: h.technologies || [] });
    }
  }

  for (const tExp of tailoredResume.experience) {
    for (const bullet of tExp.bullets) {
      const field = `experience[${tExp.id}].bullets[${bullet.id}]`;

      // 1. Must cite at least one sourceBulletId
      if (!bullet.sourceBulletIds || bullet.sourceBulletIds.length === 0) {
        issues.push({
          field,
          claim: bullet.tailored,
          reason: 'PROVENANCE_MISMATCH',
          factsOriginal: 'No sourceBulletIds declared',
          severity: 'ERROR',
          repairAction: `Assign valid sourceBulletIds from career vault experience highlights for this claim`,
        });
        continue;
      }

      // 2. Validate every sourceBulletId exists
      const sourceTexts: string[] = [];
      const sourceTechs: string[] = [];
      let hasInvalidId = false;

      for (const sId of bullet.sourceBulletIds) {
        const found = masterBulletMap.get(sId);
        if (!found) {
          hasInvalidId = true;
          issues.push({
            field,
            claim: sId,
            reason: 'PROVENANCE_MISMATCH',
            factsOriginal: `Source bullet ID "${sId}" does not exist in Career Vault`,
            severity: 'ERROR',
            repairAction: `Use existing canonical bullet ID from Career Vault`,
          });
        } else {
          if (found.companyId !== tExp.id) {
            issues.push({
              field,
              claim: bullet.tailored,
              reason: 'PROVENANCE_MISMATCH',
              factsOriginal: `Source bullet "${sId}" belongs to "${found.companyId}", not "${tExp.id}"`,
              severity: 'WARNING',
              repairAction: `Move bullet to correct experience section "${found.companyId}" or use a source bullet from "${tExp.id}"`,
            });
          }
          sourceTexts.push(found.text);
          sourceTechs.push(...found.technologies);
        }
      }

      if (hasInvalidId || sourceTexts.length === 0) continue;

      // 3. Verify semantic grounding (topic / token overlap)
      const combinedSource = sourceTexts.join(' ') + ' ' + sourceTechs.join(' ');
      const sourceKeywords = extractKeywords(combinedSource);
      const tailoredKeywords = extractKeywords(bullet.tailored);

      let sharedCount = 0;
      for (const kw of tailoredKeywords) {
        if (sourceKeywords.has(kw)) {
          sharedCount++;
        }
      }

      // If tailored text contains substantial content (> 4 keywords) but shares ZERO keywords with declared source
      if (tailoredKeywords.size >= 4 && sharedCount === 0) {
        issues.push({
          field,
          claim: bullet.tailored,
          reason: 'PROVENANCE_MISMATCH',
          factsOriginal: sourceTexts.join(' | '),
          severity: 'ERROR',
          repairAction: `Generated text does not derive from declared source bullet "${bullet.sourceBulletIds.join(', ')}". Match source facts: ${sourceTexts.join(' | ')}`,
        });
      }
    }
  }

  return issues;
}
