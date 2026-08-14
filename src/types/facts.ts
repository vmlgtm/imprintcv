export type CareerFactType =
  | 'metric'
  | 'technology'
  | 'responsibility'
  | 'achievement'
  | 'date'
  | 'role';

export interface CareerFact {
  id: string; // e.g. "fact_8f2a1c"
  companyId: string;
  sourceBulletId: string;
  sourceText: string;
  type: CareerFactType;
  subject: string;
  predicate: string;
  object: string;
  qualifiers: string[]; // e.g. ["25%", "Kubernetes migration"]
  confidence: 'explicit' | 'derived';
}

export interface StructuredFacts {
  vaultHash: string;
  facts: CareerFact[];
  companies: Array<{
    id: string;
    name: string;
    normalizedName: string;
    titles: string[];
    startDate: string;
    endDate: string | null;
  }>;
  skills: string[];
  metrics: Array<{
    value: string;
    context: string;
    factId: string;
  }>;
  totalYearsExperience: number;
  totalBulletCount: number;
}
