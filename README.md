# ImprintCV

[![CI](https://github.com/vmlgtm/imprintcv/actions/workflows/ci.yml/badge.svg)](https://github.com/vmlgtm/imprintcv/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/imprintcv.svg)](https://www.npmjs.com/package/imprintcv)

> *"AI can rewrite your resume. ImprintCV verifies that it doesn't rewrite your career."*

**ImprintCV** is a free, local-first, agent-native TypeScript engine and CLI tool providing **deterministic factual consistency verification and reproducible ATS document compilation for AI-tailored resumes**.

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

---

## Key Features

1. **Deterministic Fact & Metric Consistency**: Layer 1-3 verifiers detect metric inflation, altered employment dates, fake job titles, altered degrees, and leadership hallucinations before PDF compilation.
2. **Local-First & In-Memory Typst WASM**: Compiles ATS-optimized PDFs in ~30ms without native LaTeX/Python dependencies.
3. **Agent-Native MCP Server**: Drop-in Model Context Protocol (MCP) server for Claude Code, Cursor, and Antigravity, plus `SKILL.md` for Pi (`pi.dev`).
4. **5-Second Bootstrap (`imprintcv init`)**: Ingest legacy PDFs, DOCX, or TXT into a structured, version-controlled Career Vault (`~/career/`).
5. **Multi-Provider LLM Support**: Works seamlessly with Google Gemini (free tier), OpenAI, Anthropic, OpenRouter, and local Ollama (`llama3.2`, `mistral`, etc.) via Vercel AI SDK.

---

## Installation & Quick Start

```bash
# Install globally or run with npx
npm install -g imprintcv

# 1. Bootstrap your Career Vault
imprintcv init --from ./my_old_resume.pdf

# 2. Tailor for a target job description (file, URL, or stdin)
imprintcv tailor --jd ./job_description.txt
imprintcv tailor --jd "https://stripe.com/jobs/12345"
cat jd.txt | imprintcv tailor --jd -

# 3. Dry-run mode (generates plan and verification report without writing PDF)
imprintcv tailor --jd ./jd.txt --dry-run

# 4. Machine-readable headless mode (pure JSON to stdout, logs to stderr)
imprintcv tailor --jd ./jd.txt --json

# 5. Reverse sync verified improvements back to Career Vault
imprintcv sync --from ./applications/stripe-senior-engineer/

# 6. Run environment diagnostics
imprintcv doctor
```

---

## Output Application Bundle

Each tailoring run generates a complete application bundle in `applications/<job-slug>/`:

```
applications/stripe-senior-software-engineer/
├── resume.pdf          # ATS-optimized PDF compiled via Typst WASM
├── resume.json         # Tailored JSON resume with bullet provenance IDs
├── resume.md           # Side-by-side bullet transformation diffs
├── resume.yaml         # RenderCV-compatible YAML export
├── cover_letter.md     # Verified 3-paragraph targeted cover letter
├── tailoring_plan.json # Structured plan referencing stable bullet IDs
└── verification.json   # Full verification report with zero-token check results
```

---

## MCP Server Integration

To connect ImprintCV to Claude Code, Cursor, or Antigravity, add the stdio server to your configuration:

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

Exposed MCP Tools:
- `imprintcv_init`: Bootstrap Career Vault from resume file.
- `imprintcv_get_facts`: Retrieve structured facts with stable IDs.
- `imprintcv_verify_draft`: Run Layer 1-3 deterministic consistency checks.
- `imprintcv_compile_pdf`: Compile ATS PDF via in-memory Typst WASM.

---

## Testing & Evaluation

ImprintCV includes a 15-category adversarial hallucination fuzzer and 5 golden integration fixtures:

```bash
npm test
```

- **Mutation Recall**: $\ge 98\%$ on adversarial synthetic mutations.
- **False Positive Rate**: $\le 2\%$ on valid factual paraphrases.

---

## License

MIT © [ImprintCV Contributors](LICENSE)
