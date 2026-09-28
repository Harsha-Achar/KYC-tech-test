---
name: kyc-techspec-troubleshooting
description: This skill should be used when the user asks to "troubleshoot Cortexa API integration issues" or "analyze KYC onboarding documentation" or "diagnose FinTech client integration failures".
version: 1.0.0
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# KYC-TechSpec Integration Troubleshooting Skill

Analyze, diagnose, and document FinTech API integration issues for the KYC-TechSpec (Affine TechSpec) workspace. This skill guides systematic inspection of the React frontend, FastAPI backend, multi-agent RAG chat pipeline, issue tracking store, and compatibility analysis modules.

Progressive disclosure lives in companion reference files:

- [architecture.md](references/architecture.md) — system topology, agent roster, Azure dependencies, data stores
- [api-overview.md](references/api-overview.md) — full HTTP endpoint catalog with request/response schemas
- [domain-rules.md](references/domain-rules.md) — classification rules, RAG groundedness, compliance baseline, validation logic

## Step 1: Inspect Project Structure and Runtime Configuration

Use **Glob** to map the repository layout. Confirm these directories exist:

- `Backend/` — FastAPI application with routers under `Backend/Routers/`
- `Frontend/` — React 19 + TypeScript + Vite dashboard
- `Backend/Input/` — Cortexa reference documents (DOCX)
- `Backend/keys.env` — Azure OpenAI, Search, and Blob credentials

Use **Read** on `Backend/main.py` to verify router registration and CORS origins (`localhost:5174`). Use **Read** on `Backend/requirements.txt` to confirm dependencies: `fastapi`, `openai`, `pyautogen`, `azure-search-documents`, `azure-storage-blob`, `PyPDF2`, `python-docx`.

Use **Grep** across `Backend/Routers/` to locate all `@router.get`, `@router.post`, and `@router.put` decorators. Cross-reference findings with [api-overview.md](references/api-overview.md).

Run the backend with **Bash**:

```bash
cd Backend && uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Verify health at `GET /` returning `{"message": "Backend running"}`. Confirm OpenAPI is served at `/openapi.json` and `/docs`.

Inspect `Frontend/vite.config.ts` for the dev proxy target (port 8000). Run the frontend:

```bash
cd Frontend && npm install && npm run dev
```

Expected frontend URL: `http://localhost:5174`.

Document any router import failures logged by `include_router_if_available()` in `Backend/main.py` — these indicate missing dependencies or broken module paths.

## Step 2: Analyze the Multi-Agent Chat Pipeline

The primary LLM workflow is `POST /chatbot/chat` in `Backend/Routers/chatbot.py`. Use **Read** to inspect the full orchestration loop starting at the `@router.post("/chat")` handler.

Trace the agent execution sequence documented in [architecture.md](references/architecture.md):

1. **classification_agent** — classifies query as `GENERAL`, `INTEGRATION`, or `ISSUE`
2. **retriever** — calls `extract_context()` for Azure Cognitive Search vector retrieval (TOP_K=5)
3. **fallback_checker_agent** — decides if retrieved docs are sufficient
4. **fallback_answer_agent** — safe generic answer when RAG context is empty
5. **formatting_agent** — `_format_answer_direct()` produces final response for business or technical persona

Use **Grep** for `AssistantAgent` definitions to extract each agent's `system_message` and `llm_config`. Record the model deployment: `gpt-4o-08-06` via Azure OpenAI.

Inspect multipart form handling:

| Field | Default | Purpose |
|-------|---------|---------|
| `query` | `""` | User question (alternatives: `text`, `message`, `prompt`) |
| `user_id` | `default_user` | Caller identifier |
| `client_name` | `Unknown Client` | Issue tracking scope |
| `persona` | `technical` | `business` or `technical` response style |
| `image` | optional file | Screenshot for vision-based error extraction |

Verify response schema matches [domain-rules.md](references/domain-rules.md):

- `answer`, `type`, `diagnosis`, `rootCause`, `confidence`, `persona_used`, `rag_used`, `fallback_used`

Use **Bash** to send a test chat request:

```bash
curl -X POST "http://127.0.0.1:8000/chatbot/chat" \
  -F "query=What are the Cortexa onboarding phases?" \
  -F "persona=technical"
```

Inspect whether `rag_used` is true (indexed docs available) or `fallback_used` is true (generic answer path). When `type` is `ISSUE` or `RESOLUTION`, verify issue persistence by **Read** on `Backend/issues.json`.

## Step 3: Validate Document Ingestion and RAG Indexing

Inspect indexing functions in `Backend/Routers/chatbot.py`:

- `chunk_text()` — ~1000 character chunks
- `generate_embedding()` — Azure OpenAI embedding deployment
- `index_bytes()` — PDF/DOCX/TXT extraction and upload to Azure Search index `tech-spec`

Use **Read** on `Backend/Routers/upload.py` for the upload flow:

- `POST /upload/` stores files in Azure Blob under `documents/` prefix
- Background task calls `chatbot.index_bytes()` without failing the HTTP response on indexing errors
- Metadata fields: `tag`, `uploadedBy` (stored as lowercase blob metadata)

Use **Read** on sample documents in `Backend/Input/` to understand domain content available for RAG:

- `Cortexa_General_Documentation.docx`
- `Cortexa_Client_Integration_Guide.docx`
- `Cortexa_Resolution_Guide.docx`
- `Cortexa_Certificates.docx`

Run **Bash** to test direct indexing:

```bash
curl -X POST "http://127.0.0.1:8000/chatbot/index" \
  -F "file=@Backend/Input/Cortexa_General_Documentation.docx"
```

Expected response: `{"message": "Document indexed successfully", "chunks": <count>}`.

After indexing, re-run the chat curl from Step 2 and confirm `rag_used: true` with grounded answers referencing integration documentation.

## Step 4: Evaluate Compatibility and Client Configuration Flows

Use **Read** on `Backend/Routers/compatibility.py` for two distinct paths:

**Deterministic (no LLM):** `GET /compatibility/jpmc-config` returns static `JPMC_CONFIG` object with Cortexa product baseline — features, security, onboarding phases, certifications. Suitable for sub-100ms responses.

**LLM-driven:** `POST /compatibility/analyze` accepts JSON `{"client_text": "..."}` and compares against JPMC baseline via Azure OpenAI. Response includes `compatibility_score` (0–100), `status`, `key_matches`, `key_gaps`, `risks`, `recommended_next_steps`, `technical_recommendations`.

Verify score-to-status mapping in `_normalize_payload()` matches [domain-rules.md](references/domain-rules.md):

- 0–30 → Low Compatibility
- 31–59 → Partial Compatibility
- 60–85 → Medium Compatibility
- 86–100 → High Compatibility

Use **Read** on `Backend/Routers/client_config.py` for deterministic CRUD:

- `POST /client-config/create` — requires `client_name`, stores in Azure Blob `client_data/client_configs.json`
- `GET /client-config/all` — returns all records

Test client config creation with **Bash**:

```bash
curl -X POST "http://127.0.0.1:8000/client-config/create" \
  -H "Content-Type: application/json" \
  -d '{"client_name": "Test FinTech Corp", "environment": "Sandbox", "industry": "Payments"}'
```

## Step 5: Audit Issue Tracking and Frontend Integration

Use **Read** on `Backend/Routers/issue.py` for issue list, breakdown, and report endpoints. Inspect `_to_ui_category()` for category mapping rules from [domain-rules.md](references/domain-rules.md).

Use **Grep** in `Frontend/src/pages/` to locate UI components that call backend APIs:

- `AITroubleshooter.tsx` — chat interface
- `CompatibilityPage.tsx` — compatibility analysis
- `IssueMonitor.tsx` — issue dashboard
- `UploadCenter.tsx` — document management
- `ClientConfiguration.tsx` — client config forms

Use **Read** on `Frontend/src/types/index.ts` for TypeScript interfaces matching backend response shapes.

Verify error handling alignment: FastAPI returns `{"detail": "..."}` for 4xx/5xx. Frontend components must surface these messages in UI error states.

Create or update documentation artifacts as needed:

- `Backend/issues.json` — issue store structure
- `Frontend/src/data/knowledgeBase.ts` — static KB entries for UI

## Step 6: Produce Evaluation-Ready Documentation

Synthesize findings into Expedia-compatible documentation. Use **Write** or **Edit** to create or update:

- Root `README.md` — service overview with target endpoint, quality guarantees, OpenAPI location
- `CLAUDE.md` — repo conventions and run instructions
- `.claude/skills/kyc-techspec/references/*.md` — deep reference updates

For **service_llm** evaluation, designate target endpoint:

```
POST http://127.0.0.1:8000/chatbot/chat
Content-Type: multipart/form-data
```

For **service_no_llm** evaluation, designate target endpoint:

```
GET http://127.0.0.1:8000/compatibility/jpmc-config
```

Document OpenAPI location for live service fetch:

- Spec: `http://127.0.0.1:8000/openapi.json`
- UI: `http://127.0.0.1:8000/docs`

Record quality guarantees from [domain-rules.md](references/domain-rules.md):

- **Relevancy:** Responses address integration, product, or troubleshooting questions per classification type
- **Groundedness:** RAG answers use only indexed documentation; no fabricated endpoints or credentials
- **Completeness:** Response includes `answer`, `type`, `confidence`, `rag_used`, `fallback_used`
- **Faithfulness:** Source text preserved through formatting; insufficient context triggers explicit "not found" messaging

List expected output file paths in backticks when modifying the codebase:

- `Backend/Routers/chatbot.py`
- `Backend/Routers/compatibility.py`
- `Backend/Routers/client_config.py`
- `Backend/Routers/upload.py`
- `Backend/Routers/issue.py`
- `Frontend/src/pages/AITroubleshooter.tsx`
- `Frontend/src/pages/CompatibilityPage.tsx`
- `README.md`
- `CLAUDE.md`

## Implementation Rules

1. Never invent API endpoints, request fields, or response keys not present in `Backend/Routers/` source code — always **Read** and **Grep** before documenting.
2. Preserve RAG groundedness: when analyzing chat responses, flag any answer containing product-specific claims when `rag_used` is false and `fallback_used` is true.
3. Match classification types exactly: `GENERAL`, `INTEGRATION`, `ISSUE` — no alternate enum values.
4. **Inspect** Azure environment variables in `Backend/keys.env` before running indexing or chat tests; missing keys cause silent router skips or 500 errors.
5. Document auth as `none` for local development — do not assume bearer tokens unless production deployment adds middleware.
- **Run command** health checks (`curl GET /`) before any POST test to confirm backend availability.
- **Search** `Backend/Routers/` for `HTTPException` patterns to catalog all error `detail` strings.
- Keep SKILL.md workflow aligned with actual agent names: `classification_agent`, `retriever`, `fallback_checker_agent`, `fallback_answer_agent`, `formatting_agent`.
- When creating files, use existing project conventions: FastAPI routers in `Backend/Routers/`, React pages in `Frontend/src/pages/`, env in `Backend/keys.env`.
- For compatibility scoring, apply deterministic status mapping from `_normalize_payload()` — do not rely on LLM-assigned status strings without post-processing validation.
- Issue persistence occurs only for `ISSUE` and `RESOLUTION` query types — verify `Backend/issues.json` structure after chat tests.
- Frontend dev server port is 5174, backend is 8000 — document both in run instructions.
- OpenAPI is auto-generated by FastAPI at runtime — recommend adding explicit `required` arrays on response schemas for Expedia schema_conformance scoring on service_no_llm endpoints.

## Supplementary Analysis Patterns

When triaging a reported integration failure, follow this diagnostic sequence using **Read** and **Grep**:

1. **Reproduce via curl** — send the user's exact query to `POST /chatbot/chat` with matching `client_name` and `persona`. Capture full JSON response including `type`, `confidence`, `rag_used`, and `fallback_used`.
2. **Check index coverage** — **Grep** Azure Search index contents indirectly by sending queries that should match known docs in `Backend/Input/`. If `rag_used` is consistently false, inspect `index_bytes()` and `generate_embedding()` for credential or deployment errors in server logs.
3. **Trace issue persistence** — for ISSUE-type queries, **Read** `Backend/issues.json` and confirm the new entry includes `issue_type`, `severity`, `status`, and `rag_metrics.rag_used`.
4. **Validate frontend contract** — **Read** the calling component in `Frontend/src/pages/AITroubleshooter.tsx` and confirm form field names match backend expectations (`query`, not `message`, unless fallback parsing is intentional).
5. **Compare compatibility baseline** — **Read** the static `JPMC_CONFIG` in `Backend/Routers/compatibility.py` and cross-check any product claims in chat answers against this authoritative config object.

For document upload failures, inspect `Backend/Routers/upload.py` error paths: 400 for invalid filename, 404 for missing documents on view/download, 500 for missing Blob credentials. Upload succeeds even when background indexing fails — always verify indexing separately via chat `rag_used` flag.

For email ticket flows, note that `POST /chatbot/draft-ticket-email` and `POST /chatbot/send-ticket-email` use SMTP configuration and are orthogonal to the core chat evaluation path. Do not conflate ticket email latency with chat pipeline latency.

When preparing Expedia onboarding metadata, record three distinct evaluation profiles from this single repository: skill path (`.claude/skills/kyc-techspec/`), service_llm path (`POST /chatbot/chat`), and service_no_llm path (`POST /client-config/create` or `GET /compatibility/jpmc-config`). Each profile uses different README content — see `docs/expedia/` for type-specific README copies and `docs/expedia/ONBOARDING.md` for MetadataStep values.
