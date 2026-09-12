import { describe, it, expect } from 'vitest';
import { compileWithBudget } from '../../../src/render/page-budget.js';
import { compileTypstToPdf } from '../../../src/render/typst-compiler.js';
import type { TailoredResume } from '../../../src/types/bundle.js';

const mockTailoredResume: TailoredResume = {
  basics: {
    name: 'Sarah Connor',
    email: 'sarah@example.com',
    phone: '+1 (555) 019-2834',
    location: 'Los Angeles, CA',
    summary: 'Senior Infrastructure Architect with 12+ years designing distributed high-availability platforms and Kubernetes clusters.',
    linkedin: 'https://linkedin.com/in/sarahconnor',
    github: 'https://github.com/sarahconnor',
  },
  experience: [
    {
      company: 'Cyberdyne Systems',
      title: 'Principal Systems Engineer',
      startDate: '2021-01',
      endDate: null,
      bullets: [
        {
          id: 'b1',
          original: 'Architected distributed resilience mesh for core neural network pipelines across 8 AWS regions.',
          tailored: 'Architected distributed resilience mesh for core neural network pipelines across 8 AWS regions with 99.999% SLA.',
          technologies: ['Kubernetes', 'Go', 'AWS'],
          provenance: 'VERIFIED_VAULT',
        },
        {
          id: 'b2',
          original: 'Cut monthly infrastructure spending by 42% through automated spot instance orchestrator.',
          tailored: 'Cut monthly infrastructure spending by 42% ($1.2M annual savings) via automated spot instance orchestrator in Go.',
          technologies: ['Go', 'Kubernetes'],
          provenance: 'VERIFIED_VAULT',
        },
        {
          id: 'b3',
          original: 'Led zero-downtime database migration for 40TB transactional datastore.',
          tailored: 'Led zero-downtime database migration for 40TB transactional datastore with automated canary verification.',
          technologies: ['PostgreSQL', 'Redis'],
          provenance: 'VERIFIED_VAULT',
        },
        {
          id: 'b4',
          original: 'Mentored 14 senior engineers across platform and SRE organizations.',
          tailored: 'Mentored 14 senior engineers across platform and SRE organizations establishing architecture RFC review standard.',
          technologies: ['Leadership'],
          provenance: 'VERIFIED_VAULT',
        },
      ],
    },
    {
      company: 'Resistance Ops',
      title: 'Senior DevOps Architect',
      startDate: '2017-06',
      endDate: '2020-12',
      bullets: [
        {
          id: 'b5',
          original: 'Designed and deployed unified GitOps deployment pipeline using ArgoCD and Terraform.',
          tailored: 'Designed and deployed unified GitOps deployment pipeline using ArgoCD and Terraform for 120+ microservices.',
          technologies: ['ArgoCD', 'Terraform', 'Kubernetes'],
          provenance: 'VERIFIED_VAULT',
        },
        {
          id: 'b6',
          original: 'Reduced MTTR by 65% by implementing eBPF-based distributed tracing and Prometheus alerting.',
          tailored: 'Reduced MTTR by 65% by implementing eBPF-based distributed tracing and Prometheus anomaly alerting.',
          technologies: ['Prometheus', 'eBPF'],
          provenance: 'VERIFIED_VAULT',
        },
      ],
    },
  ],
  skills: [
    { name: 'Kubernetes' },
    { name: 'Go' },
    { name: 'Rust' },
    { name: 'Terraform' },
    { name: 'AWS' },
    { name: 'PostgreSQL' },
    { name: 'ArgoCD' },
    { name: 'eBPF' },
  ],
  education: [
    {
      institution: 'Caltech',
      degree: 'B.S. in Computer Science',
      startDate: '2013-09',
      endDate: '2017-05',
    },
  ],
  projects: [
    {
      name: 'SkyNet Sentinel',
      description: 'Open-source distributed telemetry proxy for autonomous workloads.',
      url: 'https://github.com/sarahconnor/sentinel',
      technologies: ['Rust', 'eBPF'],
      highlights: ['Achieved 2M req/sec throughput with sub-millisecond p99 latency.'],
    },
  ],
};

describe('Phase 1: Typst Micro-Budgeting Solver & Templates', () => {
  it('compiles within 1 page budget for standard resume', async () => {
    const result = await compileWithBudget(mockTailoredResume, 'modern', 1);
    expect(result.pageCount).toBe(1);
    expect(result.pdfBytes.length).toBeGreaterThan(1000);
  });

  it('compiles with executive and compact-tech templates', async () => {
    const execResult = await compileWithBudget(mockTailoredResume, 'executive', 1);
    expect(execResult.pageCount).toBe(1);

    const compactResult = await compileWithBudget(mockTailoredResume, 'compact-tech', 1);
    expect(compactResult.pageCount).toBe(1);
  });

  it('solves 1-page fit dynamically when dense content overflows baseline', async () => {
    // Create an artificially dense resume with extra experience to trigger micro-budget solver
    const denseResume: TailoredResume = JSON.parse(JSON.stringify(mockTailoredResume));
    for (let i = 1; i <= 3; i++) {
      denseResume.experience.push({
        company: `Cloud Systems Enterprise ${i}`,
        title: `Staff Reliability Architect ${i}`,
        startDate: `201${i}-01`,
        endDate: `201${i + 1}-01`,
        bullets: [
          {
            id: `b_extra_${i}_1`,
            original: 'Implemented automated disaster recovery failover across multi-cloud regions with zero data loss.',
            tailored: 'Implemented automated disaster recovery failover across multi-cloud regions with 15-second RTO guarantee.',
            technologies: ['AWS', 'GCP'],
            provenance: 'VERIFIED_VAULT',
          },
          {
            id: `b_extra_${i}_2`,
            original: 'Architected high-throughput message bus processing 5 billion messages daily with high availability.',
            tailored: 'Architected high-throughput message bus processing 5 billion messages daily with Kafka and gRPC.',
            technologies: ['Kafka', 'gRPC'],
            provenance: 'VERIFIED_VAULT',
          },
        ],
      });
    }

    const result = await compileWithBudget(denseResume, 'modern', 1);
    expect(result.pageCount).toBe(1);
    expect(result.adjustmentsApplied.length).toBeGreaterThan(0);
    expect(denseResume.experience[0].bullets.length).toBe(4);
    expect(result.adjustmentsApplied[0]).toContain('scale_font');
  });
});
