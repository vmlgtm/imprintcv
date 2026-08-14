# ImprintCV — Technical Specification & Implementation Blueprint

> **Version**: 2.1.0 (Production Blueprint + Addendum Contracts)  
> **Package**: `@imprintcv/engine` / `imprintcv`  
> **License**: MIT (Open Source)  
> **Tagline**: *"AI can rewrite your resume. ImprintCV verifies that it doesn't rewrite your career."*  
> **Target Ecosystem**: Developers, Job Seekers, and AI Agents (Claude Code, Pi, Cursor, Antigravity)

---

## 1. Executive Summary & Core Positioning

**ImprintCV** is a free, local-first, agent-native TypeScript engine and CLI tool providing **deterministic factual verification and reproducible ATS document compilation for AI-tailored resumes**.

Rather than being a generic AI resume generator, ImprintCV is a **claim/fact consistency engine** backed by an immutable local Career Vault and a WebAssembly-powered Typst document compiler.

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                           THE DIVISION OF AUTHORITY                            │
├────────────────────────────────────────────────────────────────────────────────┤
│  • LLM          = Proposes tailored language, ordering, and keyword framing    │
│  • Career Vault = Immutable canonical single source of truth for career facts  │
│  • Tailor Plan  = Constrained transformation instructions (No new facts)       │
│  • Verifier     = Deterministic authority on factual consistency (Zero-token)  │
│  • Typst WASM   = Deterministic authority on document layout & page budgeting  │
│  • Human/Agent  = Authority on final review, sync approval, and submission     │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Core Differentiators
1. **Fact & Claim Consistency Engine**: Protects candidates against AI hallucination drift by verifying tailored outputs against a derived facts database before rendering.
2. **Agent-Native Harness**: Zero-friction compatibility with **Claude Code**, **Pi (`pi.dev`)**, **Cursor**, and **Antigravity** via Model Context Protocol (MCP) and drop-in `SKILL.md`.
3. **Zero Double Cost ($0.00)**: In agent sessions (Claude Code/Pi), the host agent generates the text directly inside its session while ImprintCV handles local verification and PDF compilation at $0.00 additional API cost. In CLI mode, runs on Google Gemini's free tier (1,500 req/day) or local Ollama.
4. **5-Second Bootstrap (`imprintcv init`)**: Converts legacy PDFs, Word docs (`.docx`), or LinkedIn profile exports into structured, version-controlled career data.
5. **Deterministic Typst WASM Layout**: Compiles single-page (or balanced two-page) ATS-friendly PDFs in ~30ms in memory without native LaTeX/Python dependencies.

---

## 2. Core Behavioral & Architectural Contracts

### 2.1 Verification Status Contract
The verifier evaluates tailored output against the Career Vault and outputs one of three explicit statuses:

```typescript
export type VerificationStatus = 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL';
```

* **`PASS`**: `errorCount === 0 && warningCount === 0`. All claims are supported, valid paraphrases, or canonical aliases. Exit code `0`.
* **`PASS_WITH_WARNINGS`**: `errorCount === 0 && warningCount > 0`. No hard factual contradictions, but contains unmapped skills or plausible claim modifiers flagged for review. PDF is compiled. Exit code `0`.
* **`FAIL`**: `errorCount > 0`. Factual contradiction (inflated metrics, altered dates/companies/titles/degrees). The PDF **MUST NOT** be considered verified. Triggers self-repair loop. Exit code `1`.

### 2.2 Allowed Tailoring Transformations

| Transformation | Allowed? | Verification Level | Behavior |
| :--- | :--- | :--- | :--- |
| Reorder bullets | ✅ Yes | No factual change | Allowed |
| Omit bullets (Omission is valid) | ✅ Yes | No factual change | Allowed (Tailored resume does not need all master facts) |
| Rephrase / compress wording | ✅ Yes | Claim-level diff | Allowed if meaning preserved |
| Normalize skill aliases | ✅ Yes | Skill Taxonomy | Allowed via canonical dictionary (`k8s` ↔ `kubernetes`) |
| Combine existing bullets | ✅ Yes | Fact verification | Allowed if preserving source metrics & technologies |
| Add new metric or alter value | ❌ No | Hard check | **`ERROR`** |
| Alter company name, title, date | ❌ No | Hard check | **`ERROR`** |
| Alter degree or institution | ❌ No | Hard check | **`ERROR`** |
| Add unverified certification | ❌ No | Hard check | **`ERROR`** |
| Introduce unsupported skill | ❌ No | Taxonomy check | **`WARNING`** |
| Add unsupported scale / leadership claim | ❌ No | Modifier check | **`WARNING`** (e.g., *"Worked on"* → *"Led 20 teams"*) |

---

## 3. System Architecture & End-to-End Flow

```
                     ┌────────────────────────────────────────────────────────┐
                     │             1. Onboarding / Cold Start                 │
                     │  `imprintcv init --from my_old_resume.pdf`             │
                     └───────────────────────────┬────────────────────────────┘
                                                 │ (pdf-parse / mammoth)
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                           Evergreen Career Vault (`~/career/`)                                  │
│  ├── master_resume.json  (Canonical JSON Resume + Stable IDs + Facts DB + Version Metadata)     │
│  └── master_resume.md    (Human-readable / Git-versioned source of truth)                       │
└────────────────────────────────────────┬────────────────────────────────────────────────────────┘
                                         │
                                         │  + Target Job Description (File / URL / Stdin)
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               2. PII Privacy Sanitizer (`fast-redact`)                          │
│  Strips email, phone, location → Replaces with {{EMAIL}}, {{PHONE}} before LLM prompt           │
└────────────────────────────────────────┬────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                          3. Step 1: Structured Tailoring Plan (LLM)                             │
│  Constrained plan referencing stable bullet IDs: select, reorder, compress, rewrite (No text)   │
└────────────────────────────────────────┬────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                          4. Step 2: Tailored Drafting Execution (LLM)                           │
│  Generates tailored bullets with full provenance + drafts 3-paragraph Cover Letter              │
└────────────────────────────────────────┬────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                     5. Layered Deterministic Verifier Pass (`src/verifier/`)                    │
│  • Layer 1 (Hard Checks): Numbers, metrics, dates, companies, titles, degrees → ERROR           │
│  • Layer 2 (Skill Taxonomies): Check canonical aliases (`tanova` taxonomy)    → WARNING         │
│  • Layer 3 (Claim Modifiers): Detect unsupported leadership/scale claims      → WARNING         │
│  • Hard Contradiction Check on Cover Letter claims                                              │
└────────────────────────────────────────┬────────────────────────────────────────────────────────┘
                                         │
                                         ├─► If `FAIL`: Self-Repair Loop (Max 3 attempts with repairActions)
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                  6. In-Memory Typst WASM Compiler (`@myriad-dreamin/typst.ts`)                  │
│  • Dynamic Content-Volume Budgeting (Natural 1-page vs 2-page capacity)                         │
│  • 6-Step Gradual Fallback Ladder: Spacing → Margins → Type Scale → Compression → Drop         │
└────────────────────────────────────────┬────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                7. Complete Output Bundle Contract                               │
│  applications/<job-slug>/                                                                       │
│  ├── resume.pdf          (ATS-optimized PDF compiled via Typst WASM)                            │
│  ├── resume.json         (Tailored JSON Resume with provenance)                                 │
│  ├── resume.md           (Side-by-side bullet diffs for human review)                           │
│  ├── resume.yaml         (RenderCV compatible export)                                           │
│  ├── cover_letter.md     (Verified targeted cover letter)                                       │
│  ├── tailoring_plan.json (Exact plan used to construct output)                                  │
│  └── verification.json   (Full verification report with issues and metrics)                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Data Models & TypeScript Interfaces

### 4.1 Stable IDs & Career Vault Metadata (`src/types/resume.ts`)

All entities use stable, human-readable IDs (e.g. `exp_stripe`, `bullet_stripe_02`, `fact_8f2a1c`) rather than volatile array indices.

```typescript
import { z } from 'zod';

export const CareerVaultMetadataSchema = z.object({
  schemaVersion: z.string().default('2.1.0'),
  vaultVersion: z.number().default(1),
  vaultHash: z.string(), // SHA256 of master content
  lastUpdated: z.string(),
});

export const WorkExperienceSchema = z.object({
  id: z.string(), // e.g. "exp_stripe"
  company: z.string(),
  title: z.string(),
  location: z.string().optional(),
  startDate: z.string(), // "YYYY-MM"
  endDate: z.string().nullable(), // null = "Present"
  highlights: z.array(z.object({
    id: z.string(), // e.g. "bullet_stripe_01"
    text: z.string(),
    technologies: z.array(z.string()).default([]),
  })),
  technologies: z.array(z.string()).default([]),
});

export const MasterResumeSchema = z.object({
  metadata: CareerVaultMetadataSchema,
  basics: z.object({
    name: z.string(),
    email: z.string().email(),
    phone: z.string().optional(),
    location: z.string().optional(),
    website: z.string().url().optional(),
    linkedin: z.string().optional(),
    github: z.string().optional(),
    summary: z.string().optional(),
  }),
  experience: z.array(WorkExperienceSchema),
  skills: z.array(z.object({
    id: z.string(),
    name: z.string(),
    canonical: z.string(),
  })),
  education: z.array(z.object({
    id: z.string(),
    institution: z.string(),
    degree: z.string(),
    field: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })),
  projects: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    technologies: z.array(z.string()),
    url: z.string().url().optional(),
    highlights: z.array(z.string()).default([]),
  })).default([]),
});

export type MasterResume = z.infer<typeof MasterResumeSchema>;
```

### 4.2 Structured Facts Database (`src/types/facts.ts`)

```typescript
export interface CareerFact {
  id: string; // e.g. "fact_8f2a1c"
  companyId: string;
  sourceBulletId: string;
  sourceText: string;
  type: 'metric' | 'technology' | 'responsibility' | 'achievement' | 'date' | 'role';
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
```

### 4.3 Constrained Tailoring Plan (`src/types/plan.ts`)

```typescript
export interface TailoringPlan {
  targetRole: string;
  targetCompany: string;
  strategySummary: string;
  experiencePlan: Array<{
    companyId: string;
    reorder: string[];     // Bullet IDs in priority order
    rewrite: string[];     // Bullet IDs to rephrase for keywords
    compress: string[];    // Bullet IDs to shorten
    remove: string[];      // Bullet IDs omitted due to low relevance
    combine?: Array<{      // Pair of bullet IDs to merge
      sourceIds: [string, string];
      focus: string;
    }>;
  }>;
  emphasizedSkills: string[];
  omittedSkills: string[];
}
```

### 4.4 Tailored Bullet Provenance & Verification Report (`src/types/bundle.ts`)

```typescript
export type BulletStatus = 
  | 'UNCHANGED' 
  | 'REWORDED' 
  | 'REORDERED' 
  | 'COMPRESSED' 
  | 'COMBINED' 
  | 'UNSUPPORTED';

export interface TailoredBullet {
  id: string;
  sourceBulletIds: string[]; // Provenance IDs from master
  sourceFactIds: string[];   // Provenance fact IDs
  original: string;
  tailored: string;
  status: BulletStatus;
  matchedKeywords: string[];
}

export interface VerificationIssue {
  field: string;
  claim: string;
  reason: 
    | 'METRIC_CONTRADICTED' 
    | 'DATE_ALTERED' 
    | 'COMPANY_ALTERED' 
    | 'TITLE_ALTERED' 
    | 'DEGREE_ALTERED'
    | 'UNSUPPORTED_SKILL' 
    | 'UNSUPPORTED_CLAIM_MODIFIER';
  factsOriginal?: string;
  severity: 'ERROR' | 'WARNING';
  repairAction: string; // Machine-readable instruction for self-repair loop
}

export interface VerificationReport {
  status: 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL';
  errorCount: number;
  warningCount: number;
  issues: VerificationIssue[];
  metricsVerified: number;
  skillsMatched: string[];
}
```

---

## 5. Tailoring, Verification & Rendering Modules

### 5.1 Onboarding Bootstrapper (`src/bootstrap/init.ts`)
* **Input**: File path to `.pdf`, `.docx`, or `.txt`.
* **Action**:
  1. Detects file format.
  2. Runs `pdf-parse` (PDF) or `mammoth` (DOCX).
  3. Uses `generateObject()` with `MasterResumeSchema` to assign stable IDs and structure facts.
  4. Outputs `master_resume.json` and human-readable `master_resume.md`.

### 5.2 2-Step Tailoring Pipeline (`src/tailor/`)
* **Step 1 (`plan.ts`)**: LLM generates a constrained `TailoringPlan` using existing bullet IDs.
* **Step 2 (`draft.ts`)**: LLM executes the plan with bullet provenance and writes the cover letter.

### 5.3 Layered Deterministic Verifier (`src/verifier/diffChecker.ts`)
Executes deterministically in TypeScript (< 50ms, zero external API calls):
1. **Layer 1: Hard Contradiction Checks (`ERROR`)**:
   * Numeric / metric protection (values, percentages, currencies).
   * Dates, tenures, company names, job titles, and degree institutions.
   * New unverified contact info or URLs.
2. **Layer 2: Supported Skill Taxonomies (`WARNING`)**:
   * Cross-references against master skills and bundled `tanova/ai-skills-taxonomy` canonical aliases.
3. **Layer 3: Claim Modifier Analysis (`WARNING`)**:
   * Heuristic pattern matching for inflated leadership/scale modifiers (*"Worked on"* → *"Led 20 teams"*, *"Contributed"* → *"Owned company-wide"*).
4. **Cover Letter Fact Check**:
   * Verifies that any metric, technology, or title mentioned in the cover letter exists in the Career Vault.

### 5.4 Self-Repair Loop (Max 3 Attempts)
When verification returns `FAIL`:
1. The engine constructs a repair prompt containing each issue's `repairAction`.
2. The LLM regenerates the flagged bullets.
3. Re-runs verification.
4. Stops after **maximum 3 attempts** with `status = FAIL` if unresolvable, preventing infinite loops.

### 5.5 Typst WASM Renderer & 3 Built-In Templates (`src/render/typst/`)

ImprintCV ships with **3 battle-tested, 100% ATS-safe Typst templates**:
1. **`modern` (Default)**: "Jake's Resume" / Silicon Valley standard (Sans-Serif `Inter`, horizontal divider lines).
2. **`classic`**: "Harvard / Ivy League" executive (Serif `Linux Libertine`, centered header block).
3. **`contemporary`**: "Awesome-CV" modernist (Clean Sans-Serif, subtle slate accent headers `#1e293b`).

#### Gradual Page-Budgeting Fallback Ladder
If a rendered resume exceeds the target page budget (e.g. 1.1 pages when targeting 1.0 page):
1. Tighten vertical line & section spacing in Typst template.
2. Adjust page margins within safe bounds (`0.50in` → `0.42in`).
3. Scale typography slightly (`10pt` → `9.5pt`).
4. Re-prompt LLM to compress verbose bullet text.
5. Merge redundant short bullets.
6. **LAST RESORT ONLY**: Drop lowest-ranked bullet point.

---

## 6. AI Agent Integration Layer

### 6.1 Model Context Protocol (MCP) Server (`src/mcp/index.ts`)
Exposes 4 local stdio tools for Claude Code, Cursor, and Antigravity:

* `imprintcv_init({ sourcePath })`: Bootstrap Master Vault from legacy PDF/DOCX.
* `imprintcv_get_facts({ vaultPath })`: Retrieve structured facts with stable IDs.
* `imprintcv_verify_draft({ tailoredResume, masterFacts })`: Deterministic consistency check with structured repair actions.
* `imprintcv_compile_pdf({ tailoredData, outputPath, template, targetPages })`: In-memory Typst WASM compilation.

### 6.2 Pi (`pi.dev`) & Antigravity Drop-In Skill (`SKILL.md`)
Ships `skills/imprintcv/SKILL.md`. When loaded by Pi (`pi.dev`), Claude Code, or Antigravity, the agent autonomously executes the workflow without prompt drift.

---

## 7. CLI Specification & Diagnostic Tools

```bash
# 1. Bootstrap Master Profile
imprintcv init --from ./my_old_resume.pdf

# 2. Tailor for a Job Description (File, URL, or Stdin)
imprintcv tailor --jd ./job_description.txt
imprintcv tailor --jd "https://stripe.com/jobs/12345"
cat jd.txt | imprintcv tailor --jd -

# 3. Dry-Run Mode (Generates plan & validation without compiling PDF)
imprintcv tailor --jd ./jd.txt --dry-run

# 4. Machine-Readable Headless Mode (Stdout JSON, Stderr logs)
imprintcv tailor --jd ./jd.txt --json

# 5. Environment Diagnostics Check
imprintcv doctor
imprintcv doctor --json

# 6. Verify an existing tailored bundle
imprintcv verify --tailored ./applications/stripe/resume.json

# 7. Career Vault Reverse Sync (with Safety Approval Gate)
imprintcv sync --from ./applications/stripe/
```

### 7.1 CLI Output & Exit Code Contracts
* `--json` mode writes **pure valid JSON to `stdout`**; all logs, spinners, and progress output route to `stderr`.
* **Exit Code `0`**: `PASS` or `PASS_WITH_WARNINGS`.
* **Exit Code `1`**: `FAIL` (Verification error / unresolvable hallucination).
* **Exit Code `2`**: Execution error (Invalid input, network failure, Typst compile failure).

### 7.2 Safety Gate on `imprintcv sync`
1. Computes structural JSON diff against `master_resume.json`.
2. **Blocks contradictory metric updates**.
3. Displays side-by-side terminal diff and requires explicit human/agent confirmation before updating the Master Vault.

---

## 8. Automated Evaluation & Testing Harness

Located in `tests/`, executed automatically in GitHub Actions on every pull request:

### 8.1 15-Category Adversarial Fuzzer (`tests/evals/fuzzer.test.ts`)
Injects 50 synthetic adversarial mutations into real career vaults:
`METRIC_INFLATION`, `METRIC_CHANGE`, `DATE_CHANGE`, `TITLE_CHANGE`, `COMPANY_CHANGE`, `LOCATION_CHANGE`, `NEW_SKILL`, `NEW_TECHNOLOGY`, `NEW_RESPONSIBILITY`, `NEW_LEADERSHIP_CLAIM`, `NEW_SCALE_CLAIM`, `NEW_TEAM_SIZE`, `NEW_CUSTOMER_CLAIM`, `NEW_CERTIFICATION`, `NEW_DEGREE`.
* **Assertion**: Mutation Recall ≥ 98% (`ERROR` on hard contradictions), False Positive Rate ≤ 2% on valid paraphrases.

### 8.2 5 Golden Integration Fixtures (`tests/fixtures/`)
1. `senior-frontend`
2. `backend`
3. `engineering-manager`
4. `fresh-grad`
5. `career-switch`
* Tests validate end-to-end plan generation, fact preservation, and verifier status.

### 8.3 ATS Text Extraction & Layout Invariant Suite
* Uses `pdf-parse` to extract plain text from compiled PDFs.
* Asserts candidate name, company names, job titles, dates, and skills are present in logical reading order.
* Tests 50 synthetic profiles across length spectrums to guarantee `pdfDoc.getPageCount() === targetPages`.

---

## 9. Definition of Done (Weekend MVP Checklist)

The implementation is complete when all 30 criteria pass end-to-end:

- [ ] `imprintcv init` parses PDF/DOCX/TXT into Career Vault.
- [ ] Career Vault generates `master_resume.json` with stable IDs + `master_resume.md`.
- [ ] Structured facts extraction with `CareerFact` model.
- [ ] `--jd` accepts local file path.
- [ ] `--jd` accepts live web URL with HTML-to-text extraction.
- [ ] `--jd -` accepts input from stdin.
- [ ] 2-step tailoring pipeline generates `tailoring_plan.json`.
- [ ] Tailored resume generates with full bullet provenance (`sourceBulletIds`).
- [ ] Verified cover letter generates in `cover_letter.md`.
- [ ] Layer 1 deterministic verifier catches metric/date/title/company/degree contradictions (`ERROR`).
- [ ] Layer 2 skill taxonomy verifier checks canonical aliases (`WARNING`).
- [ ] Layer 3 modifier verifier catches unverified leadership/scale expansions (`WARNING`).
- [ ] Hard contradiction check runs on cover letter claims.
- [ ] Self-repair loop runs up to 3 attempts on `FAIL` with machine-readable `repairAction`.
- [ ] Status contract enforces `PASS`, `PASS_WITH_WARNINGS`, `FAIL`.
- [ ] Typst WASM compiles PDFs in-memory in < 50ms.
- [ ] 3 built-in templates implemented (`modern`, `classic`, `contemporary`).
- [ ] 6-step gradual fallback ladder enforces target page budget (1.0 or 2.0 pages).
- [ ] Complete output bundle written to `applications/<job-slug>/`.
- [ ] `resume.yaml` RenderCV export generated.
- [ ] `verification.json` and `tailoring_plan.json` written to output folder.
- [ ] `imprintcv verify` validates existing bundles.
- [ ] `imprintcv sync` safety gate diffs and blocks contradictory updates.
- [ ] Local stdio MCP server implemented for Claude Code and Cursor.
- [ ] `skills/imprintcv/SKILL.md` implemented for Pi (`pi.dev`) and Antigravity.
- [ ] `--json` mode routes clean JSON to stdout and logs to stderr.
- [ ] `--dry-run` mode plans without writing PDFs or altering vault.
- [ ] `imprintcv doctor` diagnoses environment and outputs JSON.
- [ ] 5 golden integration fixtures pass in Vitest.
- [ ] 15-category adversarial hallucination fuzzer passes in Vitest.
- [ ] ATS text extraction regression tests pass.
- [ ] GitHub Actions CI passes on push.
- [ ] README written with interactive terminal examples and badges.

---

## 10. Explicit Out of Scope

* ❌ **Hosting a Paid Web SaaS**: No user auth, no Stripe billing, no cloud databases.
* ❌ **Full Auto-Applier Bots**: No automated web form submission / job board spamming.
* ❌ **Interview Prep & Outreach DMs**: Preserved strictly for V2 to focus 100% on the Resume + Cover Letter + Verifier core.
* ❌ **Arbitrary Custom Theme Builders**: ImprintCV ships with 3 curated, ATS-perfect templates and delegates arbitrary custom styling to RenderCV or consumer templates.
