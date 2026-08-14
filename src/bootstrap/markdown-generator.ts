import type { MasterResume } from '../types/resume.js';

export function generateMasterMarkdown(resume: MasterResume): string {
  const lines: string[] = [];

  lines.push(`# ${resume.basics.name}`);
  lines.push('');
  
  const contacts: string[] = [];
  if (resume.basics.email) contacts.push(`Email: ${resume.basics.email}`);
  if (resume.basics.phone) contacts.push(`Phone: ${resume.basics.phone}`);
  if (resume.basics.location) contacts.push(`Location: ${resume.basics.location}`);
  if (resume.basics.website) contacts.push(`Website: [${resume.basics.website}](${resume.basics.website})`);
  if (resume.basics.linkedin) contacts.push(`LinkedIn: [${resume.basics.linkedin}](${resume.basics.linkedin})`);
  if (resume.basics.github) contacts.push(`GitHub: [${resume.basics.github}](${resume.basics.github})`);
  
  if (contacts.length > 0) {
    lines.push(contacts.join(' | '));
    lines.push('');
  }

  if (resume.basics.summary) {
    lines.push('## Summary');
    lines.push(resume.basics.summary);
    lines.push('');
  }

  if (resume.experience && resume.experience.length > 0) {
    lines.push('## Experience');
    lines.push('');
    for (const exp of resume.experience) {
      lines.push(`### ${exp.title} — ${exp.company} \`[${exp.id}]\``);
      lines.push(`*${exp.startDate} – ${exp.endDate || 'Present'}${exp.location ? ` | ${exp.location}` : ''}*`);
      lines.push('');
      for (const h of exp.highlights) {
        const techStr = h.technologies && h.technologies.length > 0 ? ` *(Tech: ${h.technologies.join(', ')})*` : '';
        lines.push(`- \`[${h.id}]\` ${h.text}${techStr}`);
      }
      lines.push('');
    }
  }

  if (resume.skills && resume.skills.length > 0) {
    lines.push('## Skills');
    lines.push(resume.skills.map((s) => `${s.name} (\`${s.canonical}\`)`).join(', '));
    lines.push('');
  }

  if (resume.education && resume.education.length > 0) {
    lines.push('## Education');
    lines.push('');
    for (const edu of resume.education) {
      lines.push(`### ${edu.degree} — ${edu.institution} \`[${edu.id}]\``);
      if (edu.startDate || edu.endDate) {
        lines.push(`*${edu.startDate || ''} – ${edu.endDate || ''}*`);
      }
      lines.push('');
    }
  }

  if (resume.projects && resume.projects.length > 0) {
    lines.push('## Projects');
    lines.push('');
    for (const proj of resume.projects) {
      lines.push(`### ${proj.name} \`[${proj.id}]\``);
      if (proj.url) lines.push(`[${proj.url}](${proj.url})`);
      lines.push(proj.description);
      for (const h of proj.highlights) {
        lines.push(`- ${h}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
