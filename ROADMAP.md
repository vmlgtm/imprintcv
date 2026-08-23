# ImprintCV Roadmap

> **The Deterministic Career OS for AI Agents & Developers**  
> *Zero Hallucinations • Sub-30ms Typst WASM Compilation • Single-Column ATS Guarantees • 1-Click Publishing*

---

## 🏛️ Core Architectural Foundation: "One Engine, All Interfaces"

Every capability in ImprintCV is built into the **Deterministic Core Engine** first, then exposed symmetrically across all interface adapters:

```
                    ┌────────────────────────────────────────────────────────────────────────┐
                    │                           INTERFACE ADAPTERS                           │
                    │                                                                        │
   CLI / TUI        │      MCP Server        │    Browser Extension    │    GitHub Action    │
(Terminal Humans)   │ (Claude / Cursor / AGY)│  (Clip & 1-Click AutoFill)  │ (CI/CD & Releases)  │
  `imprintcv ...`   │  `imprintcv_...` tools │    (Web / Local Bridge)     │ `actions/imprintcv` │
           │        └────────────┬───────────┴─────────────┬───────────────┴───────────┬────────┘
           │                     │                         │                           │
           └─────────────────────┼─────────────────────────┼───────────────────────────┘
                                 ▼                         ▼
  ┌────────────────────────────────────────────────────────────────────────────────────────────┐
  │                                   IMPRINTCV CORE ENGINE                                    │
  ├───────────────────────────────────┬────────────────────────────────────────────────────────┤
  │ 1. Immutable Vault Management     │ • `master_resume.json` Schema & Hashing                │
  │                                   │ • Day-0 Clean Ingestion (PDF, LinkedIn ZIP)            │
  │                                   │ • Privacy & Redaction Profiles (Public / Internal)     │
  ├───────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ 2. Deterministic Verifier & Match │ • Layer 1: Invariant & Metric AST matching             │
  │                                   │ • Layer 2: Skill taxonomy & graph consistency          │
  │                                   │ • Layer 3: Claim escalation & scope drift detection    │
  │                                   │ • Layer 4: Cover letter & portal Q&A fact checking     │
  │                                   │ • JD Compatibility & 3-tier gap analysis               │
  ├───────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ 3. WASM Typst Compiler & Web      │ • In-memory WebAssembly Typst engine (~30ms)           │
  │                                   │ • Dynamic micro-budgeting solver (exact 1-2 pages)     │
  │                                   │ • Semantic responsive HTML resume generator (Schema.org)│
  │                                   │ • Single-column ATS linear layout guarantees           │
  ├───────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ 4. Distribution & Storage         │ • Bundle generator (PDF, JSON, RenderCV YAML, MD, HTML)│
  │                                   │ • 1-Click Publisher (GitHub Pages, Cloudflare, Vercel) │
  │                                   │ • Zero-effort automatic cataloging                     │
  │                                   │ • Grounding engine for tailored interview prep         │
  └───────────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

## 🗺️ Phased Delivery Milestones

```
┌──────────────────────────────────────┐
│  Phase 1: Polish & Ingestion (v0.2)  │ ──▶ LinkedIn ZIP Seed • Micro-Budget • JD Match • Catalog
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│  Phase 2: Deep Truth & Privacy (v0.3)│ ──▶ Scope Drift Guard • Q&A Verifier • Redaction Profiles
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│  Phase 3: Publishing & Scale (v0.4+) │ ──▶ 1-Click Web Publish • Browser Auto-Fill • CI/CD Releases
└──────────────────────────────────────┘
```

---

## 🟢 Phase 1: Core Polish, Day-0 Ingestion, JD Match & Exact Page Budgeting (v0.2.0)
*Focus: Eliminate Day-0 onboarding friction, provide honest JD match scores, solve the 1.05-page overflow problem, and streamline local cataloging.*

### 1. LinkedIn Archive Ingestion (`imprintcv init --from linkedin.zip`)
- **Direct Archive Parser**: Ingest official LinkedIn data export (`.zip` or folder containing `Positions.csv`, `Education.csv`, `Skills.csv`, `Projects.csv`, `Profile.csv`).
- **Zero-Loss Cold Start**: Bypasses messy PDF OCR and column layout ambiguity; parses full, untruncated bullet points and exact dates directly into `~/career/master_resume.json`.
- **Automatic Provenance**: Automatically tags extracted bullets with stable IDs (`#exp-1-b1`) and parses quantitative metrics.
- **Symmetric Availability**: Available via CLI (`imprintcv init --from ./linkedin.zip`) and MCP (`imprintcv_init(sourcePath: "...")`).

### 2. Typst Micro-Budgeting Solver (`compileWithBudget`)
- **Dynamic Parameter Tuning**: Implement a binary-search solver in `page-budget.ts` that tunes Typst variables when content overflows by 1–4 lines:
  - Font size scaling ($\pm 0.2\text{pt}$ to $\pm 0.4\text{pt}$).
  - Line pitch / leading ($1.15 \rightarrow 1.08$).
  - Section vertical margins ($1.5\text{em} \rightarrow 1.1\text{em}$).
- **Content Preservation**: Guarantees an exact 1-page fit without dropping or truncating any candidate bullets.
- **Sub-30ms Execution**: Runs entirely in-memory via Typst WebAssembly.

### 3. Deterministic JD Compatibility & Gap Analysis
- **Honest 3-Tier Matcher**:
  1. *Direct Matches (Covered)*: Skills & achievements present in vault and highlighted on the tailored resume.
  2. *Untapped Vault Skills*: Relevant qualifications in the vault omitted from the 1-page draft due to space.
  3. *True Skill Gaps*: Hard requirements in the JD missing from the vault (never hallucinated or stuffed).
- **CLI & MCP Tool**: `imprintcv match --jd <url|file>` and `imprintcv_analyze_jd` to assess fit and highlight real gaps before drafting.

### 4. Expanded ATS Typst Templates
- **`executive`**: Tailored for leadership/staff roles with an emphasis on career summary and high-impact metrics.
- **`compact-tech`**: Maximized bullet and skills density for senior engineers and specialists.

### 5. Zero-Effort Application Cataloging & CLI Ergonomics
- **Automatic Catalog**: Every run of `imprintcv tailor` or `imprintcv_save_application` automatically registers the bundle in an isolated, lightweight index (`applications/registry.json`).
- **CLI Commands**:
  - `imprintcv list`: Quick overview of generated applications, targets, dates, and verification status.
  - `imprintcv open <job-slug>`: Instantly opens the compiled ATS PDF in the system's default viewer.
- **MCP Parity**: `imprintcv_list_applications` enables AI agents to query application history.

---

## 🟡 Phase 2: Deep Truth Engine & Privacy Profiles (v0.3.0)
*Focus: Deepen the verification moat and support multi-context resume sharing.*

### 1. Supplemental Application Q&A Fact Verifier
- **Form & Essay Checking**: Verify candidate responses to custom Greenhouse/Lever application questions (e.g. *"Describe a time you scaled a system under load"*) against Career Vault facts.
- **MCP & CLI Interface**: `imprintcv verify-qa` / `imprintcv_verify_qa` ensures answers to portal questions never hallucinate metrics or claim unverified skills.

### 2. Semantic Scope & Role Escalation Detector (Layer 3 Verifier Enhancement)
- **Syntactic & AST Role Verification**: Detect unearned authority escalation (e.g., turning *"assisted in database migration"* into *"led global database overhaul"*).
- **Actionable Repair Suggestions**: Returns structured repair hints to the AI agent to automatically re-ground phrases to verified scope.

### 3. Redaction & Privacy Profiles
- **Multi-Profile Export**: Support generating public/sanitized resumes from the master vault:
  - Redact sensitive company internal codenames.
  - Mask confidential revenue/dollar figures or customer names.
  - Omit personal contact PII for public web portfolios.
- **CLI / MCP Flag**: `imprintcv tailor --profile public` / `profile: "public"`.

### 4. Plaintext ATS Text Export
- **Copy-Paste Optimized Export**: Generate a clean, unformatted `.txt` file formatted with standard section dividers for direct pasting into legacy application forms.

---

## 🟣 Phase 3: 1-Click Publishing, Distribution & Ecosystem (v0.4.0+)
*Focus: Frictionless web publishing, 1-click job portal auto-fill, and automated CI/CD releases.*

### 1. 1-Click Live Web Resume Publishing (`imprintcv publish`)
- **Semantic Responsive HTML**: Generate a blazing-fast, mobile-friendly web resume with light/dark theme toggle and Schema.org JSON-LD microdata for Google SEO.
- **1-Click Hosting Adapters**:
  - `imprintcv publish --target github-pages`: Automatically builds and pushes static web resume + downloadable PDF to `gh-pages` in 2 seconds.
  - Custom domain support (`resume.yourname.dev`) with zero ongoing hosting costs.
  - Cloudflare Pages / Vercel / Netlify static output export.

### 2. 1-Click Job Portal Ingestion & Auto-Fill (Browser Extension)
- **1-Click Capture**: Detect job descriptions on Greenhouse, Lever, Ashby, LinkedIn, and Workday $\rightarrow$ sends JD payload to local MCP engine.
- **1-Click Auto-Fill**: Injects verified personal details, tailored bullet points, and fact-checked essay answers directly into job application forms.

### 3. GitHub Action CI/CD (`actions/imprintcv`)
- **Versioned Resume Releases**: Run ImprintCV in GitHub Actions on a private career repository:
  - Lint and verify `master_resume.md` on pull request.
  - Automatically compile all 3 Typst templates (`modern.pdf`, `classic.pdf`, `executive.pdf`) and publish to GitHub Releases on git tag (`git tag v2026.08`).

### 4. Agent Interview Prep Grounding
- **Tailored Interview Prep Skill**: AI agent reads the exact tailored bundle in `applications/<job-slug>/` to conduct targeted mock interviews grounded in the exact metrics and projects highlighted on that specific resume.

### 5. Interactive Terminal TUI (`imprintcv review`)
- **Tactile Diff Review**: Side-by-side terminal inspector (using `ink`) allowing candidates to interactively toggle bullets on/off and approve rephrased wording before final PDF compilation.

---

## 📊 Summary Roadmap Matrix

| Milestone | Feature Area | User Value | Interface Parity |
| :--- | :--- | :--- | :--- |
| **v0.2.0** | **LinkedIn ZIP Ingestion** | Zero-loss Day-0 onboarding from official LinkedIn CSVs | CLI (`init`) + MCP (`imprintcv_init`) |
| **v0.2.0** | **Typst Micro-Budgeting** | Exact 1-page fit via font/margin solver without dropping bullets | CLI (`tailor`) + MCP (`compile_pdf`, `save_app`) |
| **v0.2.0** | **JD Compatibility Engine** | Honest 3-tier match score & skill gap analysis | CLI (`match`) + MCP (`analyze_jd`) |
| **v0.2.0** | **New ATS Templates** | `executive` and `compact-tech` Typst layouts | CLI (`--template`) + MCP (`template: "..."`) |
| **v0.2.0** | **Application Catalog & Open** | Instant zero-effort tracking and PDF opening | CLI (`list`, `open`) + MCP (`list_applications`) |
| **v0.3.0** | **Q&A Essay Verifier** | Fact-checked answers for job portal essay questions | CLI (`verify-qa`) + MCP (`verify_qa`) |
| **v0.3.0** | **Scope Escalation Guard** | Catch subtle role/authority inflation deterministically | Core Verifier (CLI & MCP) |
| **v0.3.0** | **Privacy & Redaction Profiles** | Public portfolio resumes with PII/metrics masked | CLI (`--profile`) + MCP (`profile: "..."`) |
| **v0.4.0** | **1-Click Web Publishing** | Instant hosted web resume + PDF on GitHub Pages / Vercel | CLI (`publish`) + MCP (`publish`) |
| **v0.4.0** | **Browser Job Clipper & Auto-Fill**| 1-click capture and form filling on Greenhouse/Lever/Ashby | Chrome Extension $\leftrightarrow$ Local Bridge |
| **v0.4.0** | **GitHub Action CI/CD** | Automated PDF builds and git-versioned career releases | GitHub Actions Workflow |
| **v0.4.0** | **Interview Prep Grounding** | Grounded mock interviews from exact submitted diffs | Agent Skill / MCP Workflow |
| **v0.4.0** | **Interactive TUI Review** | Terminal side-by-side diff inspector (`ink`) | CLI (`imprintcv review`) |

---

## 🎯 Guiding Principles

1. **Deterministic Truth First**: No LLM hallucination can ever reach an output document.
2. **Anti-Magic Data Model**: The Career Vault is a clean, immutable ledger. No destructive auto-merging; changes are explicit and transparent.
3. **Engine-First Parity**: Every feature exists in `@imprintcv/core` so CLI users and AI Agents share identical capabilities.
4. **Sub-Second Performance**: Document compilation and verification must always complete in milliseconds.
