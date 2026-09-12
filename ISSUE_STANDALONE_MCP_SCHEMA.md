# [Bug/DX] MCP server fails in standalone mode without repo context due to untyped `tailoredResumeJson` and unhandled schema crashes

## Problem Description
When ImprintCV is used strictly as a standalone MCP server (e.g., via `npx imprintcv-mcp` in Claude Desktop, Cursor, or other MCP clients without the local repository or `SKILL.md` present), AI agents cannot reliably draft or verify tailored resumes.

This happens because the MCP tool parameters define `tailoredResumeJson` as an unconstrained `z.string()`, hiding the expected schema contract from the LLM. Furthermore, when an LLM guesses the schema based on `MasterResume`, the MCP server crashes with unhandled JavaScript runtime exceptions rather than returning actionable validation errors.

---

## Root Cause Analysis

### 1. Schema Blindness in MCP Tool Declarations
In `src/mcp/server.ts`, tools like `imprintcv_verify_draft`, `imprintcv_save_application`, and `imprintcv_compile_pdf` declare:
```typescript
tailoredResumeJson: z.string().describe('JSON string of TailoredResume object')
```
Because it is typed as a string instead of a structured Zod schema, the MCP client never receives the JSON schema for `TailoredResume`. The agent is left blind to required fields like `sourceBulletIds`, `bullets`, `status`, and `matchedKeywords`.

### 2. Structural Drift Between `MasterResume` and `TailoredResume`
- When an agent calls `imprintcv_get_facts`, the returned `masterResume` uses:
  ```json
  experience[].highlights: [{ "id": "...", "text": "...", "technologies": [...] }]
  ```
- However, `TailoredResume` expects:
  ```json
  experience[].bullets: [{ "id": "...", "sourceBulletIds": [...], "original": "...", "tailored": "...", "status": "...", "matchedKeywords": [...] }]
  ```
Any LLM will naturally mirror the `masterResume` structure and supply `highlights` rather than `bullets`.

### 3. Unhandled Runtime Exceptions (`TypeError`)
In `src/mcp/server.ts`:
```typescript
const tailoredResume: TailoredResume = JSON.parse(tailoredResumeJson);
const report = verify(masterResume, tailoredResume, coverLetter);
```
In `src/verifier/layer1-hard.ts` (and other verifier layers):
```typescript
for (const bullet of tExp.bullets) // TypeError: tExp.bullets is not iterable
```
If `bullets` is undefined, Node throws a runtime exception that bubbles up as:
```json
{
  "isError": true,
  "content": [{ "type": "text", "text": "Verification Error: tExp.bullets is not iterable" }]
}
```
The agent receives a runtime stack crash rather than a schema validation message, causing it to hallucinate or get trapped in failed retry loops.

### 4. Missing Zod Schema for `TailoredResume`
`MasterResume` has `MasterResumeSchema` defined in `src/types/resume.ts`, but `TailoredResume` in `src/types/bundle.ts` is only defined as a TypeScript `interface`, meaning there is currently no runtime validation schema for tailored resumes.

---

## Expected Behavior
1. **Discoverable Contract**: Agents connecting to the MCP server can inspect or receive the exact `TailoredResume` JSON schema.
2. **Graceful Schema Validation**: If an agent submits malformed JSON or misses required fields, the server returns clear, formatted Zod validation errors explaining exactly what keys are missing or invalid (never an unhandled `TypeError`).
3. **Shape Normalization/Tolerance**: The verifier gracefully accepts or normalizes `highlights` into `bullets` with sensible defaults (e.g., auto-populating `sourceBulletIds` from the ID, default `status: 'UNCHANGED'`), avoiding unnecessary failure modes.

---

## Proposed Fix / Action Items

### 1. Define `TailoredResumeSchema` in `src/types/bundle.ts`
Create and export complete Zod schemas:
- `TailoredBulletSchema`
- `TailoredExperienceSchema`
- `TailoredResumeSchema`
Derive the TypeScript types from these schemas using `z.infer`.

### 2. Add Schema Validation in `src/mcp/server.ts`
Before passing `tailoredResume` to `verify()`, validate with `TailoredResumeSchema.safeParse()`:
- If validation fails, return a structured error response detailing the exact missing or misconfigured fields:
  ```json
  {
    "status": "INVALID_SCHEMA",
    "errors": result.error.format()
  }
  ```

### 3. Normalize Experience Bullets (`bullets` vs `highlights`)
In the verifier or a pre-processing normalizer:
- If `tExp.bullets` is absent but `tExp.highlights` is present, automatically map each highlight to a bullet:
  - `id: h.id`
  - `sourceBulletIds: [h.id]`
  - `original: h.text`
  - `tailored: h.text`
  - `status: 'UNCHANGED'`
  - `matchedKeywords: []`

### 4. Expose Schema Helper / MCP Tool or Prompt
Add a lightweight tool `imprintcv_get_schema` (or register an MCP resource / prompt `tailor-instructions`) returning an empty/example `TailoredResume` template so standalone agents can query the expected structure on demand.

---

## Files to Modify
- `src/types/bundle.ts` (Add `TailoredResumeSchema`)
- `src/mcp/server.ts` (Add Zod validation, error handling, and optional schema tool/prompt)
- `src/verifier/index.ts` & `src/verifier/layer1-hard.ts` (Defensive access or normalization for `bullets`/`highlights`)
