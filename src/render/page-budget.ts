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

interface TuningCandidate {
  fontSizePt: number;
  marginInches: number;
  spacingEm: number;
  leadingEm: number;
  description: string;
}

// Ordered ladder of fine-grained continuous parameter configurations
const TUNING_LADDER: TuningCandidate[] = [
  // Stage 1: Minor vertical margin & pitch compaction (Font: 10.0pt)
  { fontSizePt: 10.0, marginInches: 0.48, spacingEm: 0.58, leadingEm: 0.53, description: 'tighten_spacing_0.58em' },
  { fontSizePt: 10.0, marginInches: 0.45, spacingEm: 0.50, leadingEm: 0.50, description: 'tighten_margins_0.45in_spacing_0.50em' },

  // Stage 2: Sub-point font scaling (9.8pt - 9.6pt)
  { fontSizePt: 9.8, marginInches: 0.45, spacingEm: 0.48, leadingEm: 0.50, description: 'scale_font_9.8pt_spacing_0.48em' },
  { fontSizePt: 9.7, marginInches: 0.44, spacingEm: 0.45, leadingEm: 0.48, description: 'scale_font_9.7pt_spacing_0.45em' },
  { fontSizePt: 9.6, marginInches: 0.42, spacingEm: 0.42, leadingEm: 0.48, description: 'scale_font_9.6pt_margins_0.42in' },

  // Stage 3: Maximum density layout (9.5pt - 9.4pt)
  { fontSizePt: 9.5, marginInches: 0.40, spacingEm: 0.38, leadingEm: 0.46, description: 'scale_font_9.5pt_margins_0.40in_spacing_0.38em' },
  { fontSizePt: 9.4, marginInches: 0.38, spacingEm: 0.35, leadingEm: 0.44, description: 'scale_font_9.4pt_margins_0.38in_spacing_0.35em' },
];

export async function compileWithBudget(
  resume: TailoredResume,
  templateName: TemplateName = 'modern',
  targetPages: number = 1
): Promise<BudgetResult> {
  const adjustmentsApplied: string[] = [];
  const resumeClone: TailoredResume = JSON.parse(JSON.stringify(resume));

  // Step 1: Baseline compile (Standard 10pt / 0.50in margin / 0.65em spacing)
  let options: RenderOptions = {
    template: templateName,
    marginInches: 0.5,
    fontSizePt: 10,
    spacingEm: 0.65,
    leadingEm: 0.55,
  };
  let pdfBytes = await compileTypstToPdf(resumeClone, options);
  let pageCount = await getPdfPageCount(pdfBytes);

  if (pageCount <= targetPages) {
    return { pdfBytes, pageCount, adjustmentsApplied };
  }

  info(`Resume is ${pageCount} pages (target: ${targetPages}). Activating Typst Micro-Budgeting Solver...`);

  // Step 2: Continuous parameter tuning ladder (Preserves 100% of candidate content)
  for (const candidate of TUNING_LADDER) {
    options = {
      template: templateName,
      fontSizePt: candidate.fontSizePt,
      marginInches: candidate.marginInches,
      spacingEm: candidate.spacingEm,
      leadingEm: candidate.leadingEm,
    };

    pdfBytes = await compileTypstToPdf(resumeClone, options);
    pageCount = await getPdfPageCount(pdfBytes);

    if (pageCount <= targetPages) {
      adjustmentsApplied.push(candidate.description);
      info(`Micro-budget solver converged to ${pageCount} page(s) using [${candidate.description}] without dropping content.`);
      return { pdfBytes, pageCount, adjustmentsApplied };
    }
  }

  // Step 3: Text compression (compress long bullets >130 chars)
  info(`Resume still exceeds ${targetPages} page(s). Compressing lengthy bullets...`);
  for (const exp of resumeClone.experience || []) {
    for (const b of exp.bullets || []) {
      if (b.tailored.length > 130) {
        b.tailored = b.tailored.slice(0, 115) + '...';
      }
    }
  }
  adjustmentsApplied.push('compressed_bullet_text');
  pdfBytes = await compileTypstToPdf(resumeClone, options);
  pageCount = await getPdfPageCount(pdfBytes);

  if (pageCount <= targetPages) {
    return { pdfBytes, pageCount, adjustmentsApplied };
  }

  // Step 4: Drop lowest-ranked bullet (Absolute Last Resort)
  info(`Resume is ${pageCount} pages. Dropping lowest-ranked bullet point as last resort...`);
  for (let i = (resumeClone.experience || []).length - 1; i >= 0; i--) {
    const exp = resumeClone.experience[i];
    if (exp && exp.bullets && exp.bullets.length > 1) {
      const dropped = exp.bullets.pop();
      adjustmentsApplied.push(`dropped_bullet_${dropped?.id || 'last'}`);
      pdfBytes = await compileTypstToPdf(resumeClone, options);
      pageCount = await getPdfPageCount(pdfBytes);
      if (pageCount <= targetPages) break;
    }
  }

  return { pdfBytes, pageCount, adjustmentsApplied };
}
