---
name: imprintcv
description: Deterministic factual verification and reproducible ATS resume compilation for AI-tailored resumes. Use whenever the user asks to tailor, customize, verify, or compile a resume or cover letter for a job description.
---

# ImprintCV — Agent-Native Resume Tailoring & Verification Skill

ImprintCV provides deterministic claim/fact verification and WebAssembly Typst compilation for tailored resumes.

## The Division of Authority
- **LLM Agent (You)**: Proposes tailored phrasing, bullet reordering, keyword alignment, and cover letters.
- **Career Vault (`~/career/master_resume.json`)**: Immutable canonical source of truth for all career facts.
- **ImprintCV Verifier**: Deterministic authority on factual consistency (Layer 1-3 zero-token checks).
- **Typst WASM**: Deterministic authority on single-page ATS document compilation.

---

## Agent Workflow Instructions

When a user asks to tailor their resume for a job description:

### 1. Retrieve Canonical Career Facts
Call `imprintcv_get_facts` or read `~/career/master_resume.json`.
Inspect candidate employment dates, company names, verified metrics, and technologies.

### 2. Generate a Constrained Tailoring Draft
Construct a `TailoredResume` JSON where:
- Every tailored bullet references valid `sourceBulletIds` from the master resume.
- All numbers, percentages, and metrics from the original bullets are strictly preserved.
- Never alter dates, company names, job titles, or degree institutions.
- Reorder and rephrase bullets to highlight target job keywords.

### 3. Verify the Draft
Call `imprintcv_verify_draft({ tailoredResumeJson, masterResumeJson, coverLetter })`.
- If status is `PASS` or `PASS_WITH_WARNINGS`: Proceed to compilation.
- If status is `FAIL`: Inspect each issue's `repairAction`, update the contradicted bullets, and re-verify.

### 4. Save the Complete Application Bundle
Call `imprintcv_save_application({ tailoredResumeJson, coverLetter?, template: 'modern', targetPages: 1 })`.
- Automatically computes canonical directory slug (e.g. `applications/<company>-<role>/`).
- Compiles ATS PDF with multi-step page-budgeting.
- Generates side-by-side diff (`resume.md`), RenderCV YAML (`resume.yaml`), `resume.json`, and `verification.json`.
- Saves `cover_letter.md` if `coverLetter` is provided.

*(Alternatively, use `imprintcv_compile_pdf` if you only need an isolated PDF without saving the full bundle).*

---

## Available MCP Tools

1. `imprintcv_init({ sourcePath, vaultPath? })` — Convert legacy resume to Career Vault.
2. `imprintcv_get_facts({ vaultPath? })` — Retrieve structured facts with stable IDs.
3. `imprintcv_verify_draft({ tailoredResumeJson, masterResumeJson?, coverLetter? })` — Layer 1-3 consistency verification.
4. `imprintcv_save_application({ tailoredResumeJson, coverLetter?, template?, targetPages?, outputBaseDir? })` — Save complete verified bundle (PDF, JSON, RenderCV YAML, Diff MD, Verification Report, Cover Letter) with page budgeting.
5. `imprintcv_compile_pdf({ tailoredResumeJson, template?, outputPath?, targetPages? })` — Compile ATS-optimized PDF via Typst WASM with page budgeting.
