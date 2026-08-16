# ImprintCV

[![CI](https://github.com/vmlgtm/imprintcv/actions/workflows/ci.yml/badge.svg)](https://github.com/vmlgtm/imprintcv/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/imprintcv.svg)](https://www.npmjs.com/package/imprintcv)

> **AI can rewrite your resume. ImprintCV ensures it doesn't invent your career.**

When you ask ChatGPT or Claude to tailor your resume for a job, it often inflates numbers, exaggerates job titles, invents skills you don't have, or messes up LaTeX formatting.

**ImprintCV** is a local-first CLI and MCP server that:
1. Stores your actual career history in an immutable local **Career Vault** (`~/career/`).
2. Uses LLMs *only* to rephrase and select relevant experience for a target job description.
3. **Deterministically verifies** all metrics, dates, companies, and claims before outputting anything (zero hallucinations).
4. Compiles a pixel-perfect, ATS-compliant PDF in **~30ms** via in-memory Typst WebAssembly (no LaTeX or Python required).

---

## Quick Start

### 1. Installation

```bash
npm install -g imprintcv
```

### 2. Configure Your LLM Provider

Set an API key for your preferred provider, or run 100% locally and offline with Ollama:

```bash
# Google Gemini (Recommended — free tier works out of the box)
export GEMINI_API_KEY="your-api-key"

# Or OpenAI / Anthropic / OpenRouter
export OPENAI_API_KEY="your-api-key"
export ANTHROPIC_API_KEY="your-api-key"
export OPENROUTER_API_KEY="your-api-key"

# Or Local Ollama (zero API cost, fully offline)
export IMPRINTCV_PROVIDER="ollama"
export OLLAMA_MODEL="llama3.2"
```

### 3. Bootstrap Your Career Vault

Import your existing resume (`.pdf`, `.docx`, or `.txt`) to create your canonical profile:

```bash
imprintcv init --from ./my_resume.pdf
```
*This creates `~/career/master_resume.json` with stable bullet IDs and verified metrics.*

### 4. Tailor for a Job Description

```bash
# From a URL
imprintcv tailor --jd "https://stripe.com/jobs/12345"

# From a local text file
imprintcv tailor --jd ./job_description.txt

# Target a strict 1-page budget with a specific template
imprintcv tailor --jd ./job.txt --template modern --pages 1
```

---

## How It Works

```
Target Job Description ──┐
                         ▼
┌──────────────────┐   ┌───────────────────────┐   ┌────────────────────────┐   ┌─────────────────────┐
│  Career Vault    │──▶│  LLM Tailoring Plan   │──▶│ Deterministic Verifier │──▶│ Typst WASM Compiler │
│  (Immutable DB)  │   │  (Rephrase & Select)  │   │ (Zero Hallucinations)  │   │ (~30ms ATS PDF)     │
└──────────────────┘   └───────────────────────┘   └────────────────────────┘   └─────────────────────┘
```

1. **Vault Authority**: Your experience history, dates, titles, and metrics are stored locally in `~/career/master_resume.json`.
2. **Constrained Phrasing**: The LLM suggests bullet reordering and keyword emphasis matching the job description, strictly mapped to source bullet IDs.
3. **Deterministic Verification**: Static analysis checks that:
   - **Metrics & Numbers**: Every metric in the output matches the original source (e.g., `20%` is never inflated to `80%`).
   - **Hard Facts**: Employment dates, company names, job titles, and degrees cannot be altered.
   - **Claim Escalation**: Role scope cannot be escalated (e.g., "contributed to" cannot become "architected and led").
4. **Instant Typst Rendering**: Compiles directly into a single or multi-page ATS PDF using built-in Typst WebAssembly without external TeX dependencies.

---

## 🤖 Agentic Workflows & Tool Use

ImprintCV is designed from the ground up to integrate seamlessly into **AI agent workflows** (Claude Code, Cursor, Windsurf, Antigravity, Pi, or custom autonomous scripts).

### Why Agents Need ImprintCV
When autonomous agents tailor resumes, prompt drift and hallucinations are major risks. ImprintCV gives agents a **deterministic verify-and-repair loop**: an agent can draft a tailored resume, submit it to ImprintCV for static verification, receive actionable error reports, fix the claims, and compile the final PDF.

```
┌──────────────┐     1. imprintcv_get_facts      ┌──────────────────┐
│              │ ──────────────────────────────▶ │  Career Vault    │
│              │ ◀────────────────────────────── │  (Immutable)     │
│   AI Agent   │
│ (Claude Code │     2. imprintcv_verify_draft   ┌──────────────────┐
│   Cursor,    │ ──────────────────────────────▶ │ ImprintCV Engine │
│ Antigravity) │ ◀────────────────────────────── │ (Pass / Repairs) │
│              │       [Loop until verified]     └──────────────────┘
│              │
│              │     3. imprintcv_compile_pdf    ┌──────────────────┐
│              │ ──────────────────────────────▶ │ ATS PDF (~30ms)  │
└──────────────┘                                 └──────────────────┘
```

---

### Integration Option A: Model Context Protocol (MCP)

Add ImprintCV to your MCP configuration (`claude_desktop_config.json`, Cursor Settings, `antigravity.json`, etc.):

```json
{
  "mcpServers": {
    "imprintcv": {
      "command": "npx",
      "args": ["-y", "imprintcv-mcp"]
    }
  }
}
```

#### Exposed MCP Tools for Agents

| MCP Tool | Description |
| :--- | :--- |
| `imprintcv_init` | Bootstrap Career Vault from a source resume file (`.pdf`, `.docx`, `.txt`). |
| `imprintcv_get_facts` | Fetch canonical career facts, metrics, and stable bullet IDs from the vault. |
| `imprintcv_verify_draft` | Deterministically verify a draft JSON. Returns `PASS`, `PASS_WITH_WARNINGS`, or `FAIL` with structured `repairAction` items. |
| `imprintcv_compile_pdf` | Compile a verified draft into an ATS-optimized PDF using in-memory Typst WASM. |

#### Example Agent Prompt
Once configured, you can prompt your AI agent directly:
> *"Tailor my resume for this Staff Engineer opening: https://stripe.com/jobs/12345. Fetch my facts from ImprintCV, verify the draft to ensure zero hallucinations, and compile a single-page PDF."*

---

### Integration Option B: Agent Skills (`SKILL.md`)

ImprintCV ships with an agent skill definition at `skills/imprintcv/SKILL.md` compatible with agent frameworks like **Pi** (`pi.dev`), **Claude Code**, and **Antigravity**.

To use the skill, point your agent to the `skills/imprintcv/` directory or include `SKILL.md` in your agent prompt context.

---

### Integration Option C: Headless Scripting & Autonomous Pipelines

For CI/CD pipelines, subagents, or batch processing scripts, use the headless `--json` mode:

```bash
# Run tailoring in headless mode (pure JSON to stdout, diagnostic logs to stderr)
imprintcv tailor --jd ./job.txt --json > result.json

# Exit codes:
# 0 = Verification PASSED & PDF compiled
# 1 = Verification FAILED (hallucination or constraint violation detected)
# 2 = Execution or network error
```

---

## Application Bundle Output

Every tailoring run creates an isolated bundle inside `applications/<job-slug>/`:

```
applications/stripe-senior-software-engineer/
├── resume.pdf          # Clean ATS-optimized PDF compiled via Typst
├── resume.json         # Tailored JSON with source bullet provenance IDs
├── resume.md           # Side-by-side diff showing what was rephrased
├── resume.yaml         # RenderCV-compatible YAML export
├── cover_letter.md     # Factual, 3-paragraph tailored cover letter
├── tailoring_plan.json # Structured mapping of selected bullets
└── verification.json   # Static verification report
```

---

## CLI Reference

| Command | Description | Example |
| :--- | :--- | :--- |
| `imprintcv init` | Import a PDF/DOCX/TXT resume into `~/career/` | `imprintcv init --from ./resume.pdf` |
| `imprintcv tailor` | Generate tailored resume bundle for a job | `imprintcv tailor --jd ./job.txt --template modern` |
| `imprintcv verify` | Run deterministic verification on an existing bundle | `imprintcv verify --tailored ./applications/stripe/` |
| `imprintcv sync` | Merge verified improvements back into your Career Vault | `imprintcv sync --from ./applications/stripe/ --yes` |
| `imprintcv doctor` | Check environment, API keys, and vault integrity | `imprintcv doctor` |

### Key Flags

- `--template <modern|classic|contemporary>`: Choose the PDF styling layout (default: `modern`).
- `--pages <1|2>`: Target page budget constraint (default: `1`).
- `--dry-run`: Run LLM tailoring and verification checks without writing files.
- `--json`: Output machine-readable JSON to `stdout` (logs to `stderr`) for CI/CD or agent scripts.
- `--provider <gemini|openai|anthropic|openrouter|ollama>`: Select LLM provider per run.
- `--vault <path>`: Custom path to Career Vault directory (defaults to `~/career/`).

---

## Templates

ImprintCV includes 3 clean, ATS-tested templates:
- **`modern`**: Clean sans-serif layout with compact line budgeting.
- **`classic`**: Traditional serif layout ideal for academic or corporate roles.
- **`contemporary`**: Distinct header hierarchy and refined typography.

---

## Verification & Reliability Guarantees

ImprintCV includes an automated adversarial fuzzer and golden integration test suite:

```bash
npm test
```

- **Mutation Recall**: $\ge$ 98% detection rate on adversarial synthetic mutations (metric tampering, title fabrication, timeline shifting).
- **False Positive Rate**: $\le$ 2% on valid factual paraphrases and reorderings.

---

## License

MIT © [Vaibhav Misra](https://github.com/vmlgtm)
