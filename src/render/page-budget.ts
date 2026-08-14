import type { TailoredResume } from '../types/bundle.js';
import { compileTypstToPdf, type TemplateName, type RenderOptions } from './typst-compiler.js';
import { info, warn } from '../utils/logger.js';

async function getPdfPageCount(pdfBytes: Uint8Array): Promise<number> {
  try {
    const pdfModule = await import('pdf-parse');
    const pdfParser = (pdfModule.default || pdfModule) as (dataBuffer: Buffer) => Promise<{ numpages: number }>;
    const data = await pdfParser(Buffer.from(pdfBytes));
    return data.numpages || 1;
  } catch {
    // If pdf-parse has trouble with pure wasm buffer in unit tests, count /Type /Page occurrences
    const pdfString = Buffer.from(pdfBytes).toString('latin1');
    const matches = pdfString.match(/\/Type\s*\/Page\b/g);
    return matches ? matches.length : 1;
  }
}

export interface BudgetResult {
  pdfBytes: Uint8Array;
  pageCount: number;
  adjustmentsApplied: string[];
}

export async function compileWithBudget(
  resume: TailoredResume,
  templateName: TemplateName = 'modern',
  targetPages: number = 1
): Promise<BudgetResult> {
  const adjustmentsApplied: string[] = [];
  const resumeClone: TailoredResume = JSON.parse(JSON.stringify(resume));

  // Step 1: Default compile
  let options: RenderOptions = {
    template: templateName,
    marginInches: 0.5,
    fontSizePt: 10,
    spacingEm: 0.65,
  };
  let pdfBytes = await compileTypstToPdf(resumeClone, options);
  let pageCount = await getPdfPageCount(pdfBytes);

  if (pageCount <= targetPages) {
    return { pdfBytes, pageCount, adjustmentsApplied };
  }

  // Step 2: Tighten vertical spacing
  info(`Resume is ${pageCount} pages (target: ${targetPages}). Step 2: Tightening vertical spacing...`);
  options.spacingEm = 0.45;
  adjustmentsApplied.push('tightened_vertical_spacing');
  pdfBytes = await compileTypstToPdf(resumeClone, options);
  pageCount = await getPdfPageCount(pdfBytes);

  if (pageCount <= targetPages) {
    return { pdfBytes, pageCount, adjustmentsApplied };
  }

  // Step 3: Adjust page margins (0.50in -> 0.42in)
  info(`Resume is ${pageCount} pages. Step 3: Adjusting page margins to 0.42in...`);
  options.marginInches = 0.42;
  adjustmentsApplied.push('reduced_margins_to_0.42in');
  pdfBytes = await compileTypstToPdf(resumeClone, options);
  pageCount = await getPdfPageCount(pdfBytes);

  if (pageCount <= targetPages) {
    return { pdfBytes, pageCount, adjustmentsApplied };
  }

  // Step 4: Scale typography (10pt -> 9.5pt)
  info(`Resume is ${pageCount} pages. Step 4: Scaling typography to 9.5pt...`);
  options.fontSizePt = 9.5;
  options.spacingEm = 0.35;
  adjustmentsApplied.push('scaled_typography_to_9.5pt');
  pdfBytes = await compileTypstToPdf(resumeClone, options);
  pageCount = await getPdfPageCount(pdfBytes);

  if (pageCount <= targetPages) {
    return { pdfBytes, pageCount, adjustmentsApplied };
  }

  // Step 5: Trim overly long bullets (compress)
  info(`Resume is ${pageCount} pages. Step 5: Compressing long bullets...`);
  for (const exp of resumeClone.experience) {
    for (const b of exp.bullets) {
      if (b.tailored.length > 120) {
        b.tailored = b.tailored.slice(0, 110) + '...';
      }
    }
  }
  adjustmentsApplied.push('compressed_bullet_text');
  pdfBytes = await compileTypstToPdf(resumeClone, options);
  pageCount = await getPdfPageCount(pdfBytes);

  if (pageCount <= targetPages) {
    return { pdfBytes, pageCount, adjustmentsApplied };
  }

  // Step 6: Drop lowest-ranked bullet (Last resort)
  info(`Resume is ${pageCount} pages. Step 6: Dropping lowest-ranked bullet point as last resort...`);
  for (let i = resumeClone.experience.length - 1; i >= 0; i--) {
    const exp = resumeClone.experience[i];
    if (exp && exp.bullets.length > 1) {
      const dropped = exp.bullets.pop();
      adjustmentsApplied.push(`dropped_bullet_${dropped?.id || 'last'}`);
      pdfBytes = await compileTypstToPdf(resumeClone, options);
      pageCount = await getPdfPageCount(pdfBytes);
      if (pageCount <= targetPages) break;
    }
  }

  return { pdfBytes, pageCount, adjustmentsApplied };
}
