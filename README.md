# KYC-TechSpec (Affine TechSpec)

FinTech integration support workspace for API client onboarding. Combines a React dashboard with a FastAPI backend providing AI troubleshooting, document ingestion, compatibility analysis, and issue tracking.

This repository supports **three Expedia High Level Evaluation paths**. Choose the type that matches your onboarding configuration.

| Expedia Type | Best For | Primary Artifact | Target Endpoint |
|--------------|----------|------------------|-----------------|
| **Service (LLM)** | Multi-agent RAG chat | [`docs/expedia/README-SERVICE-LLM.md`](docs/expedia/README-SERVICE-LLM.md) | `POST /chatbot/chat` |
| **Service (Non-LLM)** | Deterministic CRUD/config | [`docs/expedia/README-SERVICE-NO-LLM.md`](docs/expedia/README-SERVICE-NO-LLM.md) | `POST /client-config/create` |
| **Skill** | Claude workflow for KYC analysis | [`.claude/skills/kyc-techspec/SKILL.md`](.claude/skills/kyc-techspec/SKILL.md) | N/A (workflow) |

Full onboarding metadata: [`docs/expedia/ONBOARDING.md`](docs/expedia/ONBOARDING.md)

---

## Overview

KYC-TechSpec helps integration engineers troubleshoot Cortexa API onboarding issues. Users ask natural-language questions; the backend classifies the query, retrieves relevant documentation from a vector index, orchestrates AutoGen agents, and returns a formatted answer grounded in indexed sources when available.

**Recommended evaluation type:** Service (LLM) — the core product is the multi-agent RAG chat pipeline.

---

## Base URL

```
http://127.0.0.1:8000
```

Frontend dev server: `http://localhost:5174` (proxies to backend)

## Authentication

**Type:** none (local development)

**Header/format:** No authentication headers required.

---

## Primary Endpoint — Service (LLM)

### POST /chatbot/chat

**Purpose:** AI troubleshooting chat with optional screenshot analysis. **Target endpoint for service_llm evaluation.**

**Content-Type:** `multipart/form-data`

#### Request

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes* | User question. Alternatives: `text`, `message`, `prompt` |
| `user_id` | string | no | Caller identifier. Default: `default_user` |
| `client_name` | string | no | Client name for issue tracking. Default: `Unknown Client` |
| `persona` | string | no | `business` or `technical`. Default: `technical` |
| `image` | file | no | Error screenshot for vision-based text extraction |

#### Response

| Field | Type | Description |
|-------|------|-------------|
| `answer` | string | Final formatted assistant response |
| `type` | string | `GENERAL`, `INTEGRATION`, or `ISSUE` |
| `diagnosis` | string | Issue type label (may be empty) |
| `rootCause` | string | Root cause summary (may be empty) |
| `confidence` | string | `HIGH` or `LOW` |
| `persona_used` | string | Persona applied |
| `rag_used` | boolean | Vector retrieval returned context |
| `fallback_used` | boolean | Fallback agent was invoked |

#### Error Response

| Status | Key | Example |
|--------|-----|---------|
| 400 | `detail` | `"Missing query"` |

See [`docs/expedia/README-SERVICE-LLM.md`](docs/expedia/README-SERVICE-LLM.md) for full service_llm documentation including agents, models, and latency.

---

## Primary Endpoint — Service (Non-LLM)

### POST /client-config/create

**Purpose:** Create client onboarding configuration with validation. **Target endpoint for service_no_llm evaluation.**

**Content-Type:** `application/json`

#### Request

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `client_name` | string | yes | Client display name |
| `assigned_to` | string | no | Owner email |
| `services` | array | no | Service list |
| `environment` | string | no | Sandbox, Production, etc. |
| `system_type` | string | no | System classification |
| `legacy_present` | boolean | no | Legacy system flag |
| `llm_fallback` | boolean | no | LLM fallback enabled |
| `industry` | string | no | Industry vertical |
| `priority` | string | no | Priority level |

#### Response (all fields required)

`client_id`, `client_name`, `assigned_to`, `product`, `services`, `environment`, `system_type`, `legacy_present`, `llm_fallback`, `industry`, `priority`, `created_at`, `updated_at`

#### Error Response

| Status | Key | Example |
|--------|-----|---------|
| 400 | `detail` | `"client_name is required"` |
| 500 | `detail` | Azure Blob configuration missing |

**Alternate non-LLM endpoint:** `GET /compatibility/jpmc-config` — returns static Cortexa baseline config (<50ms, no LLM).

See [`docs/expedia/README-SERVICE-NO-LLM.md`](docs/expedia/README-SERVICE-NO-LLM.md) for full service_no_llm documentation.

---

## Skill Evaluation

For skill-based evaluation, use local path:

```
.claude/skills/kyc-techspec/
├── SKILL.md
└── references/
    ├── architecture.md
    ├── api-overview.md
    └── domain-rules.md
```

Skill trigger phrases: "troubleshoot Cortexa API integration issues", "analyze KYC onboarding documentation", "diagnose FinTech client integration failures".

---

## Quality Guarantees

- **Relevancy:** Responses address integration, product, or troubleshooting questions per classification type (GENERAL, INTEGRATION, ISSUE).

- **Groundedness:** When RAG retrieval succeeds, answers use only indexed documentation. No fabricated endpoints, credentials, or policies.

- **Completeness:** Chat responses include `answer`, `type`, `confidence`, `rag_used`, `fallback_used`. Client config responses include all 13 schema fields.

- **Faithfulness:** Retrieved source text preserved through formatting. Insufficient context triggers explicit "not found" messaging rather than guessing.

---

## Workflow / Architecture

**Service type (LLM path):** Multi-agent + RAG pipeline

| Agent | Role |
|-------|------|
| `classification_agent` | Classifies query as GENERAL, INTEGRATION, or ISSUE |
| `retriever` | Vector search against Azure Cognitive Search |
| `fallback_checker_agent` | Decides if retrieved docs are sufficient |
| `fallback_answer_agent` | Safe generic answer when RAG context is empty |
| `formatting_agent` | Final user-facing response (business or technical persona) |

**Execution order:** Input → Classification → Vector retrieval → Fallback check → (Fallback answer OR format from RAG) → JSON response

**RAG pipeline:** Upload (PDF/DOCX/TXT) → chunk (~1000 chars) → embed (Azure OpenAI) → index (Azure Search `tech-spec`) → retrieve top-K (default 5) on query

**Framework:** FastAPI, Microsoft AutoGen, Azure OpenAI, Azure Cognitive Search, Azure Blob Storage

**Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4

---

## Models Used

| Usage | Model |
|-------|-------|
| Agent chat | `gpt-4o-08-06` (Azure deployment) |
| Embeddings | Azure OpenAI `embedding_deployment` |
| Vision (screenshots) | Azure OpenAI vision |
| Compatibility analyze | Same Azure deployment (single LLM call) |

Non-LLM endpoints (`/client-config/create`, `/compatibility/jpmc-config`, `/dashboard/`) use zero models.

---

## Latency Expectations

| Path | Expected p95 |
|------|-------------|
| `POST /chatbot/chat` (full pipeline) | 8–15s |
| `POST /client-config/create` | < 500ms |
| `GET /compatibility/jpmc-config` | < 50ms |
| `GET /dashboard/` | < 10ms |

---

## OpenAPI

FastAPI auto-generates from the **running service** (not GitHub):

| Resource | URL |
|----------|-----|
| OpenAPI JSON | `http://127.0.0.1:8000/openapi.json` |
| Swagger UI | `http://127.0.0.1:8000/docs` |
| ReDoc | `http://127.0.0.1:8000/redoc` |

Expedia evaluation requires the backend to be running and `/openapi.json` reachable.

---

## Local Development

### Backend

```bash
cd Backend
# Configure Backend/keys.env
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd Frontend
npm install
npm run dev
```

### Environment variables (`Backend/keys.env`)

- `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_VERSION`, `AZURE_OPENAI_DEPLOYMENT_NAME`
- `embedding_deployment`
- `AZURE_SEARCH_SERVICE_ENDPOINT`, `AZURE_SEARCH_INDEX_NAME`, `AZURE_SEARCH_ADMIN_KEY`
- `AZURE_BLOB_CONNECTION_STRING`, `AZURE_BLOB_CONTAINER`

---

## Expedia Onboarding Quick Reference

| Field | Service LLM | Service Non-LLM | Skill |
|-------|-------------|-----------------|-------|
| Category | Service (LLM) | Service (Non-LLM) | Skill |
| Endpoint | `POST /chatbot/chat` | `POST /client-config/create` | N/A |
| Base URL | `http://127.0.0.1:8000` | `http://127.0.0.1:8000` | N/A |
| Skill path | N/A | N/A | `.claude/skills/kyc-techspec/` |
| GitHub sync file | This `README.md` | Copy `docs/expedia/README-SERVICE-NO-LLM.md` to root | Local path recommended |

See [`docs/expedia/ONBOARDING.md`](docs/expedia/ONBOARDING.md) for complete MetadataStep values, validation checklist, and known gaps.
