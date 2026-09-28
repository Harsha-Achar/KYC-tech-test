# KYC-TechSpec Architecture Reference

## System Overview

KYC-TechSpec (Affine TechSpec) is a FinTech integration support workspace. A React 19 + TypeScript frontend (`Frontend/`) talks to a FastAPI Python backend (`Backend/`) over HTTP. The frontend dev server runs on port **5174** and proxies `/api` requests to the backend on port **8000**.

The backend orchestrates:

- **Document ingestion** — PDF, DOCX, and TXT uploads to Azure Blob Storage with background vector indexing
- **RAG retrieval** — Azure Cognitive Search index `tech-spec` with Azure OpenAI embeddings
- **Multi-agent chat** — Microsoft AutoGen agents for classification, retrieval routing, fallback decisions, and answer formatting
- **Issue tracking** — JSON-backed issue store (`Backend/issues.json`) populated from ISSUE-type chat queries
- **Compatibility analysis** — LLM-driven comparison of client stack text against Cortexa baseline config
- **Client configuration** — Azure Blob-backed client onboarding records

## Backend Router Map

| Router module | Prefix | Primary responsibility |
|---------------|--------|------------------------|
| `Routers/chatbot.py` | `/chatbot` | Chat, indexing, conversations, ticket email |
| `Routers/upload.py` | `/upload` | Blob upload, document list/view/download |
| `Routers/compatibility.py` | `/compatibility` | Stack compatibility analysis, JPMC config |
| `Routers/issue.py` | `/issues` | Issue list, breakdowns, report generation |
| `Routers/issue_insights.py` | `/issue-insights` | Client insights and refresh |
| `Routers/client_config.py` | `/client-config` | Client config CRUD (Blob JSON) |
| `Routers/dashboard.py` | `/dashboard` | Static dashboard metrics |
| `Routers/start_mail.py` | `/start-mail` | Onboarding login email |

Entry point: `Backend/main.py` — loads `keys.env`, registers routers with graceful skip on import failure, enables CORS for localhost:5174.

## Multi-Agent Chat Pipeline

The primary LLM workflow lives in `Backend/Routers/chatbot.py` at `POST /chatbot/chat`.

### Agent roster

| Agent name | Framework class | Purpose |
|------------|-----------------|---------|
| `user_proxy` | `UserProxyAgent` | Passes user payload forward; no LLM |
| `classification_agent` | `AssistantAgent` | Classifies query as GENERAL, INTEGRATION, or ISSUE |
| `retriever` | `AssistantAgent` | Invokes vector search via `extract_context()` |
| `fallback_checker_agent` | `AssistantAgent` | Decides whether retrieved docs are sufficient |
| `fallback_answer_agent` | `AssistantAgent` | Safe generic answer when RAG context is empty |
| `formatting_agent` | Direct LLM call via `_format_answer_direct()` | Produces final user-facing response |

### Execution flow

```
POST /chatbot/chat
  → Parse multipart form (query, user_id, client_name, persona, optional image)
  → Optional vision extraction from screenshot (image field)
  → classification_agent → type + confidence + issue metadata
  → retriever → Azure Search vector query (TOP_K=5, default)
  → fallback_checker_agent → yes/no fallback decision
  → [fallback_answer_agent OR skip] → draft answer if no docs
  → formatting_agent → final formatted answer (business or technical persona)
  → [If ISSUE/RESOLUTION] → persist to issues.json
  → Return JSON response
```

Guard loop limit: 10 iterations. Temperature: 0.1. Max completion tokens: 8192.

## RAG Indexing Pipeline

1. **Upload paths:**
   - `POST /upload/` — stores file in Azure Blob under `documents/` prefix, triggers background `chatbot.index_bytes()`
   - `POST /chatbot/index` — direct indexing without Blob upload

2. **Text extraction:**
   - PDF → `PyPDF2.PdfReader`
   - DOCX → `python-docx`
   - TXT → UTF-8 decode

3. **Chunking:** Fixed-size chunks (~1000 characters) with strip validation

4. **Embedding:** Azure OpenAI deployment from `embedding_deployment` env var

5. **Storage:** Azure Cognitive Search documents with fields: `id`, `content`, `embedding`, `file_name`, `chunk_index`

## Azure Dependencies

| Service | Env vars | Usage |
|---------|----------|-------|
| Azure OpenAI | `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_VERSION`, `AZURE_OPENAI_DEPLOYMENT_NAME`, `embedding_deployment` | Chat completions, embeddings, vision |
| Azure Cognitive Search | `AZURE_SEARCH_SERVICE_ENDPOINT`, `AZURE_SEARCH_INDEX_NAME`, `AZURE_SEARCH_ADMIN_KEY`, `AZURE_SEARCH_VECTOR_FIELD`, `AZURE_SEARCH_TOP_K` | Vector retrieval |
| Azure Blob Storage | `AZURE_BLOB_CONNECTION_STRING`, `AZURE_BLOB_CONTAINER` | Document storage, client configs |

Model deployment referenced in code: `gpt-4o-08-06` (Azure deployment name from env).

## Frontend Structure

| Path | Purpose |
|------|---------|
| `Frontend/src/pages/AITroubleshooter.tsx` | Main chat UI |
| `Frontend/src/pages/ClientChatbotPage.tsx` | Client-scoped chatbot |
| `Frontend/src/pages/CompatibilityPage.tsx` | Compatibility analysis UI |
| `Frontend/src/pages/IssueMonitor.tsx` | Issue tracking dashboard |
| `Frontend/src/pages/UploadCenter.tsx` | Document upload management |
| `Frontend/src/pages/ClientConfiguration.tsx` | Client config forms |
| `Frontend/src/data/knowledgeBase.ts` | Static KB content for UI |
| `Frontend/vite.config.ts` | Dev proxy to backend port 8000 |

## Data Stores

| Store | Location | Format |
|-------|----------|--------|
| Issues | `Backend/issues.json` | Nested clients → users → issues |
| Conversations | `Backend/conversation.json` | Thread/message history |
| Insights | `Backend/insights.json` | Issue insight aggregates |
| Client configs | Azure Blob `client_data/client_configs.json` | Array of config records |
| Documents | Azure Blob `documents/*` | Binary files with metadata |

## OpenAPI

FastAPI auto-generates OpenAPI at:

- **Spec JSON:** `http://127.0.0.1:8000/openapi.json`
- **Swagger UI:** `http://127.0.0.1:8000/docs`
- **ReDoc:** `http://127.0.0.1:8000/redoc`

Expedia evaluation fetches OpenAPI from the **running service**, not from GitHub.
