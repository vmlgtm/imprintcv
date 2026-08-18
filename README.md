# ImprintCV

[![CI](https://github.com/vmlgtm/imprintcv/actions/workflows/ci.yml/badge.svg)](https://github.com/vmlgtm/imprintcv/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/imprintcv.svg)](https://www.npmjs.com/package/imprintcv)

> **Tailor resumes with LLMs without hallucinated metrics, altered dates, or broken formatting.**

When you ask ChatGPT or Claude to tailor your resume for a job, it often inflates numbers, exaggerates job titles, invents skills you don't have, or messes up LaTeX formatting.

**ImprintCV** is a local-first engine and tool that:
1. Stores your actual career history in an immutable local **Career Vault** (`~/career/`).
2. Uses LLMs *only* to rephrase and select relevant experience for a target job description.
3. **Deterministically verifies** all metrics, dates, companies, and claims before outputting anything (zero hallucinations).
4. Compiles a clean, ATS-parseable PDF in **~30ms** via in-memory Typst WebAssembly (no LaTeX or Python required).

---

## Choose Your Workflow

You can use ImprintCV either **interactively through your AI editor/agent** or **directly from your terminal**.

### 🅰️ Option 1: Use with AI Agents (Cursor, Claude Code, Windsurf, Antigravity)

Connect ImprintCV as an MCP (Model Context Protocol) server so your AI agent can manage your resume with deterministic guardrails.

Add to your MCP configuration (`claude_desktop_config.json`, Cursor Settings, `antigravity.json`, etc.):

```json
{
  "mcpServers": {
    "imprintcv": {
      "command": "npx",
      "args": ["-y", "imprintcv", "mcp"]
    }
  }
}
```

#### How the Agentic Workflow Works
When you ask your agent to tailor a resume, it executes an autonomous **verify-and-repair loop**:

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

1. **Fetches Canonical Facts**: The agent reads your verified career facts via `imprintcv_get_facts`.
2. **Drafts Tailored Content**: The agent reorders and highlights relevant experience while preserving stable source bullet IDs.
3. **Deterministic Verification**: The agent calls `imprintcv_verify_draft`. If any metric inflation or title changes are detected, ImprintCV returns structured repair instructions so the agent can fix them.
4. **Instant PDF Compilation**: Once verified, the agent compiles the PDF via `imprintcv_compile_pdf`.

**Example Agent Prompt:**
> *"Tailor my resume for this Staff Engineer opening: https://stripe.com/jobs/12345. Fetch my facts from ImprintCV, verify the draft to ensure zero hallucinations, and compile a single-page PDF."*

*(Also ships with a drop-in skill at `skills/imprintcv/SKILL.md` compatible with Pi, Claude Code, and Antigravity).*

---

### 🅱️ Option 2: Use via Terminal CLI

Run ImprintCV directly from your command line using `npx` (no install needed) or install globally.

#### 1. Setup Your LLM Provider
Set an API key for your preferred provider, or run 100% offline with Ollama:

```bash
# Google Gemini (Free tier works out of the box)
export GEMINI_API_KEY="your-api-key"

# Or OpenAI / Anthropic / OpenRouter
export OPENAI_API_KEY="your-api-key"
export ANTHROPIC_API_KEY="your-api-key"
export OPENROUTER_API_KEY="your-api-key"

# Or Local Ollama (zero API cost, fully offline)
export IMPRINTCV_PROVIDER="ollama"
export OLLAMA_MODEL="llama3.2"
```

#### 2. Bootstrap Your Career Vault
Import an existing resume (`.pdf`, `.docx`, or `.txt`) to create your canonical profile:

```bash
npx imprintcv init --from ./my_resume.pdf
```
*This creates `~/career/master_resume.json` with stable bullet IDs and verified metrics.*

#### 3. Tailor for a Target Job

```bash
# From a job posting URL
npx imprintcv tailor --jd "https://stripe.com/jobs/12345"

# From a local text file with a 1-page budget constraint
npx imprintcv tailor --jd ./job_description.txt --template modern --pages 1

# Headless mode for CI/CD or scripts (pure JSON to stdout, logs to stderr)
npx imprintcv tailor --jd ./job.txt --json > result.json
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

## ATS Compatibility & Text Parsing

Rather than making vague marketing claims, ImprintCV enforces ATS compatibility through concrete architectural guarantees:

1. **Single-Column Linear Hierarchy**: All templates use clean, single-column reading orders without floating text boxes, sidebars, or unparseable multi-column grids that confuse ATS parsers.
2. **Standard Selectable Text Streams**: PDFs are compiled via Typst with clean Unicode text layers (no rasterized text or non-standard font encodings).
3. **Automated Parser Invariant Tests**: Every build runs integration tests with `pdf-parse` to verify that applicant contact info, job titles, companies, dates, and skills extract in exact logical sequence.
4. **RenderCV-Compatible YAML Export**: Every run generates a `resume.yaml` file conforming to standard resume interchange formats.

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
| `imprintcv mcp` | Start Model Context Protocol (MCP) stdio server | `imprintcv mcp` |

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

## Verification & Reliability

ImprintCV uses deterministic (zero-token) rule engines rather than LLM judges to enforce factual integrity:

- **Deterministic Invariants**: Strict schema checks ensure dates, job titles, companies, and degrees can never be altered by the LLM.
- **Metric Provenance**: Quantities, percentages, and currencies are extracted via AST/regex and verified against the candidate's source bullets.
- **Adversarial Fuzzer & Golden Fixtures**: Evaluated continuously in CI (`npm test` via [`tests/evals/fuzzer.test.ts`](tests/evals/fuzzer.test.ts)) with a 15-category synthetic mutation suite achieving $\ge$ 98% detection rate on adversarial mutations and $\le$ 2% false positive rate on valid paraphrases.

---

## License

MIT © [Vaibhav Misra](https://github.com/vmlgtm)
