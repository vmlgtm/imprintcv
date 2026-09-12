import { zodToJsonSchema } from 'zod-to-json-schema';
import { TailoredResumeSchema, type TailoredResume } from '../types/bundle.js';

export function getTailoredResumeJsonSchema(): Record<string, unknown> {
  return zodToJsonSchema(TailoredResumeSchema, {
    target: 'jsonSchema7',
    $refStrategy: 'none',
  }) as Record<string, unknown>;
}

export function getExampleTailoredResume(): TailoredResume {
  return {
    targetRole: 'Staff Infrastructure Engineer',
    targetCompany: 'Stripe',
    basics: {
      name: 'Alex Developer',
      email: 'alex@example.com',
      phone: '+1-555-0100',
      location: 'San Francisco, CA',
      summary: 'Senior Backend Engineer specializing in TypeScript, Node.js, and distributed systems.',
    },
    experience: [
      {
        id: 'exp_stripe',
        company: 'Stripe',
        title: 'Senior Software Engineer',
        startDate: '2021-01',
        endDate: null,
        technologies: ['TypeScript', 'Node.js', 'PostgreSQL', 'Redis'],
        bullets: [
          {
            id: 'bullet_stripe_01',
            sourceBulletIds: ['bullet_stripe_01'],
            sourceFactIds: [],
            original: 'Architected payment webhook processor handling 25,000 req/sec with 99.99% uptime.',
            tailored: 'Scaled real-time payment ingestion pipelines in TypeScript to 25,000 req/sec with 99.99% uptime.',
            status: 'REWORDED',
            matchedKeywords: ['TypeScript', 'pipelines'],
          },
        ],
      },
    ],
    skills: [
      { id: 'skill_typescript', name: 'TypeScript', canonical: 'typescript' },
      { id: 'skill_node_js', name: 'Node.js', canonical: 'node.js' },
      { id: 'skill_postgresql', name: 'PostgreSQL', canonical: 'postgresql' },
    ],
    education: [
      {
        id: 'edu_ucb',
        institution: 'UC Berkeley',
        degree: 'B.S. in Electrical Engineering and Computer Science',
        startDate: '2016-08',
        endDate: '2020-05',
      },
    ],
    projects: [
      {
        id: 'proj_distcache',
        name: 'DistCache',
        description: 'Distributed in-memory cache with Raft consensus in Go',
        technologies: ['Go', 'Raft', 'gRPC'],
        url: 'https://github.com/alexdeveloper/distcache',
        highlights: ['Supports 100k QPS with <2ms P99 latency'],
      },
    ],
  };
}
