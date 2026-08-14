import yaml from 'js-yaml';
import type { TailoredResume } from '../types/bundle.js';

export function exportRenderCV(resume: TailoredResume): string {
  const renderCvObj = {
    cv: {
      name: resume.basics.name,
      email: resume.basics.email,
      phone: resume.basics.phone || undefined,
      location: resume.basics.location || undefined,
      website: resume.basics.website || undefined,
      social_networks: [
        resume.basics.linkedin ? { network: 'LinkedIn', username: resume.basics.linkedin } : null,
        resume.basics.github ? { network: 'GitHub', username: resume.basics.github } : null,
      ].filter(Boolean),
      sections: {
        summary: resume.basics.summary ? [resume.basics.summary] : undefined,
        experience: resume.experience.map((exp) => ({
          company: exp.company,
          position: exp.title,
          location: exp.location || undefined,
          start_date: exp.startDate,
          end_date: exp.endDate || 'present',
          highlights: exp.bullets.map((b) => b.tailored),
        })),
        education: resume.education.map((edu) => ({
          institution: edu.institution,
          area: edu.degree,
          start_date: edu.startDate || undefined,
          end_date: edu.endDate || undefined,
        })),
        skills: [
          {
            label: 'Skills',
            details: resume.skills.map((s) => s.name).join(', '),
          },
        ],
        projects: (resume.projects || []).map((proj) => ({
          name: proj.name,
          summary: proj.description,
          highlights: proj.highlights,
          url: proj.url || undefined,
        })),
      },
    },
    design: {
      theme: 'classic',
    },
  };

  return yaml.dump(renderCvObj, { indent: 2, lineWidth: -1 });
}
