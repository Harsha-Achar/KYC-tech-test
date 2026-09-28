# KYC-TechSpec (Affine TechSpec)

## Overview

KYC-TechSpec is a FinTech integration support workspace for API client onboarding. Integration engineers submit natural-language troubleshooting questions; the FastAPI backend classifies the query, retrieves relevant documentation from an Azure Cognitive Search vector index, orchestrates five AutoGen agents, and returns a formatted answer grounded in indexed sources when available.

**Expedia evaluation type:** Service (LLM) — multi-agent orchestration with RAG retrieval.

**Target endpoint:** `POST /chatbot/chat`

## Base URL

```
http://127.0.0.1:8000
```

Production URL varies by deployment. Local backend starts via:

```bash
cd Backend && uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

## Authentication

**Type:** none (local development)

**Header/format:** No authentication headers required.

CORS is enabled for `http://localhost:5174` and `http://127.0.0.1:5174`.

## API Endpoints

### POST /chatbot/chat

**Purpose:** AI troubleshooting chat with optional screenshot analysis for error diagnosis. This is the **target endpoint** for Expedia service_llm evaluation.

#### Request

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes* | User question. Alternatives accepted: `text`, `message`, `prompt` |
| `user_id` | string | no | Caller identifier. Default: `default_user` |
| `client_name` | string | no | Client name for issue tracking. Default: `Unknown Client` |
| `persona` | string | no | Response style: `business` or `technical`. Default: `technical` |
| `image` | file (binary) | no | Error screenshot; text extracted via vision model and appended to query |

\*Required unless the optional `image` field yields extractable text.

**Content-Type:** `multipart/form-data`

#### Response

| Field | Type | Description |
|-------|------|-------------|
| `answer` | string | Final formatted assistant response |
| `type` | string | Query classification: `GENERAL`, `INTEGRATION`, or `ISSUE` |
| `diagnosis` | string | Issue type label when applicable (empty string otherwise) |
| `rootCause` | string | Root cause summary when applicable (empty string otherwise) |
| `confidence` | string | `HIGH` or `LOW` |
| `persona_used` | string | Persona applied to the response |
| `rag_used` | boolean | Whether vector retrieval returned usable context |
| `fallback_used` | boolean | Whether the fallback agent was invoked |

#### Error Response

| Status | Key | Example value |
|--------|-----|---------------|
| 400 | `detail` | `"Missing query"` |

FastAPI error shape:

```json
{ "detail": "Missing query" }
```

#### Example request

```bash
curl -X POST "http://127.0.0.1:8000/chatbot/chat" \
  -F "query=How do I authenticate to the Cortexa API?" \
  -F "client_name=Meridian Global Payments" \
  -F "persona=technical"
```

#### Example response

```json
{
  "answer": "Based on the available documentation...",
  "type": "INTEGRATION",
  "diagnosis": "",
  "rootCause": "",
  "confidence": "HIGH",
  "persona_used": "technical",
  "rag_used": true,
  "fallback_used": false
}
```

## Quality Guarantees

- **Relevancy:** Responses address the user's integration, product, or troubleshooting question. Classification routes `GENERAL` queries to product information, `INTEGRATION` queries to setup guidance, and `ISSUE` queries to error diagnosis and resolution steps.

- **Groundedness:** When RAG retrieval succeeds (`rag_used: true`), answers use only content from indexed documentation chunks in Azure Cognitive Search. The system does not invent product-specific endpoints, credentials, pricing, or policies beyond retrieved context.

- **Completeness:** A complete response includes `answer`, classification `type`, `confidence` indicator, and boolean flags `rag_used` and `fallback_used`. ISSUE-type queries may also include `diagnosis` and `rootCause`.

- **Faithfulness:** Retrieved source text is preserved through formatting; the formatter must not add facts not present in context. When context is insufficient, the service states that information was not found rather than guessing.

## Workflow / Architecture

**Service type:** `multi_agent` + `rag_pipeline`

**Framework:** FastAPI (Python), Microsoft AutoGen, Azure OpenAI, Azure Cognitive Search, Azure Blob Storage

### Multi-agent workflow

| Agent | Role | System prompt summary |
|-------|------|----------------------|
| `classification_agent` | Classifies query as GENERAL, INTEGRATION, or ISSUE | Returns strict JSON with type, issue_type, root_cause, confidence |
| `retriever` | Executes vector search via `extract_context()` | Retrieves top-K chunks from Azure Search (default K=5) |
| `fallback_checker_agent` | Decides whether retrieved docs are sufficient | Returns decision yes/no with next_agent routing |
| `fallback_answer_agent` | Safe generic answer when RAG context is empty | Never fabricates product facts; uses industry best practices only |
| `formatting_agent` | Produces final user-facing response | Applies business or technical persona to RAG or fallback content |

**Execution order:**

```
Input → Classification → Vector retrieval → Fallback check → (Fallback answer OR format from RAG) → JSON response
```

Guard loop limit: 10 iterations. ISSUE/RESOLUTION queries persist to `Backend/issues.json`.

### RAG pipeline

1. Documents uploaded via `POST /upload/` (PDF, DOCX) or `POST /chatbot/index` (PDF, DOCX, TXT)
2. Text extracted, chunked (~1000 chars), embedded with Azure OpenAI
3. Chunks stored in Azure Search index (`tech-spec`)
4. Chat queries embed the question and retrieve top-K neighbors (default K=5)
5. Retrieved docs trimmed to 3000 characters before formatting

## Models Used

| Usage | Model / deployment |
|-------|-------------------|
| Agent chat completions | `gpt-4o-08-06` (Azure deployment from `AZURE_OPENAI_DEPLOYMENT_NAME`) |
| Embeddings | Azure OpenAI deployment from `embedding_deployment` env var |
| Vision (screenshot OCR) | Azure OpenAI vision via `extract_issue_from_image()` |
| Compatibility analyze | Same Azure OpenAI deployment (single LLM call, not multi-agent) |

Temperature: 0.1. Max completion tokens: 8192.

## Latency Expectations

| Stage | Expected latency |
|-------|-----------------|
| Classification agent | 1–3s |
| Vector retrieval (Azure Search) | 200–800ms |
| Fallback check agent | 1–2s |
| Formatting (direct LLM call) | 2–5s |
| **Full pipeline p95** | **8–15s** (depends on Azure OpenAI load and RAG hit) |

Screenshot analysis adds 2–4s for vision extraction.

## OpenAPI

FastAPI auto-generates OpenAPI from running service:

| Resource | URL |
|----------|-----|
| OpenAPI JSON | `http://127.0.0.1:8000/openapi.json` |
| Swagger UI | `http://127.0.0.1:8000/docs` |
| ReDoc | `http://127.0.0.1:8000/redoc` |

Expedia fetches OpenAPI from the **running service**, not from GitHub.

The `/chatbot/chat` endpoint should declare in OpenAPI:

- `requestBody` with multipart fields: `query`, `user_id`, `client_name`, `persona`, `image` (type: string, format: binary)
- `responses.200` schema with all output fields listed above

## Additional Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Health check |
| POST | `/upload/` | Upload integration guide with background indexing |
| POST | `/chatbot/index` | Direct document indexing |
| POST | `/compatibility/analyze` | LLM compatibility assessment |
| GET | `/compatibility/jpmc-config` | Static Cortexa baseline config |
| GET | `/issues/list` | List tracked issues |
| GET | `/dashboard/` | Dashboard metrics |
| POST | `/client-config/create` | Create client configuration |

## Local Development

### Backend

```bash
cd Backend
# Configure Backend/keys.env with Azure credentials
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd Frontend
npm install
npm run dev
# http://localhost:5174
```

### Environment variables (`Backend/keys.env`)

- `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_VERSION`, `AZURE_OPENAI_DEPLOYMENT_NAME`
- `embedding_deployment`
- `AZURE_SEARCH_SERVICE_ENDPOINT`, `AZURE_SEARCH_INDEX_NAME`, `AZURE_SEARCH_ADMIN_KEY`
- `AZURE_BLOB_CONNECTION_STRING`, `AZURE_BLOB_CONTAINER`

## Suggested Test Prompts

- "What are the steps to onboard a new API client?"
- "Why am I getting a 401 Unauthorized error during token exchange?"
- "What file types are supported for document upload and indexing?"
- "What certifications does Cortexa hold for enterprise compliance?"
