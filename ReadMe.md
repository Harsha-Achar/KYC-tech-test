# KYC-TechSpec (Affine TechSpec)

FinTech integration support workspace for API clients. Combines a React dashboard with a FastAPI backend that provides AI troubleshooting, document ingestion, compatibility analysis, and issue tracking.

**Service category for evaluation:** Service (LLM) — multi-agent orchestration with RAG retrieval.

---

## What this service does

KYC-TechSpec helps integration engineers troubleshoot API onboarding issues. Users ask natural-language questions; the backend classifies the query, retrieves relevant documentation from a vector index, and returns a formatted answer grounded in indexed sources when available.

Primary evaluation endpoint: **`POST /chatbot/chat`**

---

## Architecture

**Service type:** `multi_agent` + `rag_pipeline`

**Framework:** FastAPI (Python), Microsoft AutoGen, Azure OpenAI, Azure Cognitive Search, Azure Blob Storage

**Frontend:** React 19 + TypeScript + Vite (port 5174, proxies `/api` → backend port 8000)

### Multi-agent workflow (`POST /chatbot/chat`)

| Agent | Role |
|-------|------|
| `classification_agent` | Classifies query as `GENERAL`, `INTEGRATION`, or `ISSUE` |
| `retriever` | Runs vector search against Azure Cognitive Search |
| `fallback_checker_agent` | Decides whether retrieved docs are sufficient |
| `fallback_answer_agent` | Safe generic answer when RAG context is empty |
| `formatting_agent` | Produces final user-facing response (business or technical persona) |

**Execution order:** Input → Classification → Vector retrieval → Fallback check → (Fallback answer OR format from RAG) → JSON response

### RAG pipeline

1. Documents uploaded via `POST /upload/` (PDF, DOCX, TXT)
2. Text extracted, chunked (~1000 chars), embedded with Azure OpenAI
3. Chunks stored in Azure Search index (`tech-spec`)
4. Chat queries embed the question and retrieve top-K neighbors (default K=5)

---

## Target endpoint: POST /chatbot/chat

**Purpose:** AI troubleshooting chat with optional screenshot analysis for error diagnosis.

**Method:** `POST`

**URL (local):** `http://127.0.0.1:8000/chatbot/chat`

**Content-Type:** `multipart/form-data`

**Authentication:** None (local development)

### Request fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes* | User question. Alternatives accepted: `text`, `message`, `prompt` |
| `user_id` | string | No | Caller identifier. Default: `default_user` |
| `client_name` | string | No | Client name for issue tracking. Default: `Unknown Client` |
| `persona` | string | No | `business` or `technical`. Default: `technical` |
| `image` | file | No | Screenshot of error/logs; text extracted via vision model and appended to query |

### Response fields

| Field | Type | Description |
|-------|------|-------------|
| `answer` | string | Final formatted assistant response |
| `type` | string | Query classification: `GENERAL`, `INTEGRATION`, or `ISSUE` |
| `diagnosis` | string | Issue type label when applicable |
| `rootCause` | string | Root cause summary when applicable |
| `confidence` | string | `HIGH` or `LOW` |
| `persona_used` | string | Persona applied to the response |
| `rag_used` | boolean | Whether vector retrieval returned usable context |
| `fallback_used` | boolean | Whether the fallback agent was invoked |

### Example request (curl)

```bash
curl -X POST "http://127.0.0.1:8000/chatbot/chat" \
  -F "query=How do I authenticate to the Cortexa API?" \
  -F "client_name=Meridian Global Payments" \
  -F "persona=technical"
```

### Example response

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

### Error responses

| Status | Condition |
|--------|-----------|
| 400 | Missing `query` (and no usable alternate field or image text) |

---

## Additional HTTP endpoints

| Method | Path | Encoding | Purpose |
|--------|------|----------|---------|
| GET | `/` | — | Health check: `{"message": "Backend running"}` |
| POST | `/upload/` | multipart | Upload integration guide (PDF/DOCX); triggers background indexing |
| POST | `/chatbot/index` | multipart | Direct document indexing (`file` field: PDF/DOCX/TXT) |
| POST | `/compatibility/analyze` | JSON | Compare client stack text against Cortexa baseline |
| GET | `/compatibility/jpmc-config` | — | Returns JPMC/Cortexa reference configuration |
| GET | `/issues/list` | — | List tracked integration issues |
| GET | `/dashboard/` | — | Overview dashboard metrics |
| POST | `/client-config/create` | JSON | Create client configuration record |

### POST /upload/

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | Yes | PDF or DOCX integration guide |
| `tag` | string | No | e.g. `Integration Guide`, `Resolution Guide`, `FAQ` |
| `uploadedBy` | string | No | Uploader email |

**Response:** `{ "message", "filename", "indexingStarted" }`

### POST /compatibility/analyze

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `client_text` | string | Yes | Client architecture, stack, security, and integration requirements |

**Response:** `compatibility_score`, `status`, `key_matches`, `key_gaps`, `risks`, `recommended_next_steps`, `technical_recommendations`

---

## API contract summary (for evaluation harness)

```json
{
  "input_fields": ["query", "user_id", "client_name", "persona", "image"],
  "output_fields": ["answer", "type", "diagnosis", "rootCause", "confidence", "persona_used", "rag_used", "fallback_used"],
  "input_field_types": {
    "query": "string",
    "user_id": "string",
    "client_name": "string",
    "persona": "string",
    "image": "file"
  },
  "output_field_types": {
    "answer": "string",
    "type": "string",
    "diagnosis": "string",
    "rootCause": "string",
    "confidence": "string",
    "persona_used": "string",
    "rag_used": "boolean",
    "fallback_used": "boolean"
  },
  "input_encoding": "multipart",
  "auth_type": "none"
}
```

**Test harness hints:**

- **Endpoint:** `http://127.0.0.1:8000/chatbot/chat`
- **Content type:** `multipart`
- **File fields:** `image` (optional)
- **Response path:** `answer`

---

## Quality guarantees (kb_content)

**Relevancy:** Responses address the user's integration, product, or troubleshooting question. Classification routes GENERAL (product info), INTEGRATION (setup steps), and ISSUE (errors/failures) queries to appropriate formatting.

**Groundedness:** When RAG retrieval succeeds, answers use only content from indexed documentation chunks. The system does not invent product-specific endpoints, credentials, pricing, or policies beyond retrieved context.

**Completeness:** A complete response includes `answer`, classification `type`, confidence indicator, and flags for `rag_used` and `fallback_used`. ISSUE-type queries may also include `diagnosis` and `rootCause`.

**Faithfulness:** Retrieved source text is preserved through formatting; the formatter must not add facts not present in context. When context is insufficient, the service states that information was not found rather than guessing.

---

## Tech stack

**Backend:** FastAPI, Python, OpenAI SDK (Azure OpenAI), pyautogen, azure-search-documents, azure-storage-blob, PyPDF2, python-docx

**Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Recharts, React Router 7

**Infrastructure:** Azure OpenAI (chat + embeddings), Azure Cognitive Search, Azure Blob Storage

---

## Local development

### Backend

```bash
cd Backend
# activate venv and configure keys.env
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

---

## Expedia evaluation setup

1. **Category:** Service (LLM)
2. **Endpoint:** `http://127.0.0.1:8000/chatbot/chat`
3. **Base URL:** `http://127.0.0.1:8000`
4. **GitHub URL:** This repository (Expedia fetches this `README.md` for service analysis)
5. **Auth:** None (local)
6. **Content type (harness):** multipart

Suggested test prompts:

- "What are the steps to onboard a new API client?"
- "Why am I getting a 401 Unauthorized error during token exchange?"
- "What file types are supported for document upload and indexing?"
