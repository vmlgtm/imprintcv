import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { $typst } from '@myriaddreamin/typst.ts';
import type { TailoredResume } from '../types/bundle.js';

export type TemplateName = 'modern' | 'classic' | 'contemporary';

export interface RenderOptions {
  template?: TemplateName;
  marginInches?: number;
  fontSizePt?: number;
  spacingEm?: number;
}

export function escapeTypst(str: string): string {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/@/g, '\\@')
    .replace(/</g, '\\<')
    .replace(/>/g, '\\>')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*');
}

export function generateTypstDocument(
  resume: TailoredResume,
  templateName: TemplateName = 'modern',
  options: RenderOptions = {}
): string {
  const margin = options.marginInches ?? 0.5;
  const fontSize = options.fontSizePt ?? 10;
  const spacing = options.spacingEm ?? 0.65;

  const fontList =
    templateName === 'classic'
      ? '("Linux Libertine", "Times New Roman", "DejaVu Serif", "Serif")'
      : '("Inter", "Helvetica", "Arial", "DejaVu Sans", "Sans-Serif")';

  const primaryColor =
    templateName === 'contemporary'
      ? 'rgb("#1e293b")'
      : templateName === 'classic'
      ? 'rgb("#000000")'
      : 'rgb("#111827")';

  const accentColor = templateName === 'contemporary' ? 'rgb("#3b82f6")' : 'rgb("#d1d5db")';

  const contacts: string[] = [];
  if (resume.basics.location) contacts.push(escapeTypst(resume.basics.location));
  if (resume.basics.phone) contacts.push(escapeTypst(resume.basics.phone));
  if (resume.basics.email) contacts.push(escapeTypst(resume.basics.email));
  if (resume.basics.linkedin) contacts.push(escapeTypst(resume.basics.linkedin));
  if (resume.basics.github) contacts.push(escapeTypst(resume.basics.github));
  if (resume.basics.website) contacts.push(escapeTypst(resume.basics.website));

  const contactLine = contacts.join(' | ');

  let doc = `
#set document(title: "${escapeTypst(resume.basics.name)} - Resume", author: "${escapeTypst(resume.basics.name)}")
#set page(
  paper: "us-letter",
  margin: (x: ${margin}in, y: ${margin}in),
)

#set text(
  font: ${fontList},
  size: ${fontSize}pt,
  fill: ${primaryColor},
  lang: "en",
)
#set par(justify: false, leading: 0.55em)

`;

  // Header
  if (templateName === 'contemporary') {
    doc += `
#grid(
  columns: (1fr, auto),
  [
    #text(size: 1.8em, weight: "bold", fill: ${primaryColor})[${escapeTypst(resume.basics.name)}] \\
    ${resume.basics.summary ? `#v(1pt)\n#text(size: 0.85em, fill: rgb("#64748b"))[${escapeTypst(resume.basics.summary)}]` : ''}
  ],
  align(right)[
    #set text(size: 0.8em, fill: rgb("#475569"))
    ${contacts.map((c) => `${c} \\`).join('\n    ')}
  ]
)
#v(${spacing}em)
`;
  } else if (templateName === 'classic') {
    doc += `
#align(center)[
  #text(size: 1.8em, weight: "bold")[${escapeTypst(resume.basics.name)}] \\
  #v(2pt)
  #text(size: 0.85em, fill: rgb("#374151"))[${contactLine}]
]
#v(${spacing}em)
`;
  } else {
    // Modern
    doc += `
#align(center)[
  #text(size: 1.75em, weight: "bold")[${escapeTypst(resume.basics.name)}] \\
  #v(2pt)
  #text(size: 0.85em, fill: rgb("#4b5563"))[${contactLine}]
]
#v(${spacing}em)
`;
  }

  // Section helper
  const renderSectionHeader = (title: string) => {
    const titleText = title.toUpperCase();
    const strokeWidth = templateName === 'contemporary' ? '1pt' : '0.75pt';
    return `
#v(${spacing}em)
#text(size: 1.05em, weight: "bold", fill: ${primaryColor})[${titleText}]
#v(-4pt)
#line(length: 100%, stroke: ${strokeWidth} + ${accentColor})
#v(2pt)
`;
  };

  // Summary
  if (templateName !== 'contemporary' && resume.basics.summary) {
    doc += renderSectionHeader('Summary');
    doc += `\n#text(size: 0.95em)[${escapeTypst(resume.basics.summary)}]\n`;
  }

  // Experience
  if (resume.experience.length > 0) {
    doc += renderSectionHeader('Experience');
    for (const exp of resume.experience) {
      const dateRange = `${escapeTypst(exp.startDate)} -- ${escapeTypst(exp.endDate || 'Present')}`;
      doc += `
#grid(
  columns: (1fr, auto),
  text(weight: "bold")[${escapeTypst(exp.title)}],
  text(fill: rgb("#4b5563"), size: 0.9em)[${dateRange}]
)
#grid(
  columns: (1fr, auto),
  text(style: "italic", fill: rgb("#374151"))[${escapeTypst(exp.company)}],
  text(fill: rgb("#6b7280"), size: 0.85em)[${exp.location ? escapeTypst(exp.location) : ''}]
)
#v(2pt)
`;
      for (const b of exp.bullets) {
        doc += `#list(marker: [•], text(size: 0.95em)[${escapeTypst(b.tailored)}])\n`;
      }
      doc += `#v(2pt)\n`;
    }
  }

  // Skills
  if (resume.skills.length > 0) {
    doc += renderSectionHeader('Skills');
    const skillList = resume.skills.map((s) => escapeTypst(s.name)).join(', ');
    doc += `\n#text(size: 0.95em)[#strong("Technical Skills: ") ${skillList}]\n`;
  }

  // Education
  if (resume.education.length > 0) {
    doc += renderSectionHeader('Education');
    for (const edu of resume.education) {
      const dates =
        edu.startDate || edu.endDate
          ? `${edu.startDate ? `${escapeTypst(edu.startDate)} -- ` : ''}${escapeTypst(edu.endDate || '')}`
          : '';
      doc += `
#grid(
  columns: (1fr, auto),
  text(weight: "bold")[${escapeTypst(edu.institution)}],
  text(fill: rgb("#4b5563"), size: 0.9em)[${dates}]
)
#text(style: "italic", fill: rgb("#374151"))[${escapeTypst(edu.degree)}${edu.field ? ` in ${escapeTypst(edu.field)}` : ''}]
#v(2pt)
`;
    }
  }

  // Projects
  if (resume.projects && resume.projects.length > 0) {
    doc += renderSectionHeader('Projects');
    for (const proj of resume.projects) {
      doc += `
#text(weight: "bold")[${escapeTypst(proj.name)}] ${proj.url ? `([${escapeTypst(proj.url)}])` : ''}
#v(1pt)
#text(size: 0.95em)[${escapeTypst(proj.description)}]
`;
      for (const h of proj.highlights) {
        doc += `#list(marker: [•], text(size: 0.95em)[${escapeTypst(h)}])\n`;
      }
      doc += `#v(2pt)\n`;
    }
  }

  return doc;
}

export async function compileTypstToPdf(
  resume: TailoredResume,
  options: RenderOptions = {}
): Promise<Uint8Array> {
  const typstSource = generateTypstDocument(resume, options.template || 'modern', options);
  const pdfBytes = await $typst.pdf({
    mainContent: typstSource,
  });
  if (!pdfBytes) {
    throw new Error('Typst WASM compilation failed to produce binary output');
  }
  return pdfBytes;
}
