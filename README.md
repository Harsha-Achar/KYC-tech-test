# KYC-TechSpec (Affine TechSpec)

FinTech integration support workspace for **Cortexa API client onboarding**. A React dashboard and a FastAPI backend work together for AI-assisted troubleshooting, document ingestion, compatibility analysis, issue tracking, and client configuration.

---

## What it does

- **AI chat** — Natural-language questions about integration and product docs; optional error screenshots.
- **RAG over tech specs** — Upload PDF/DOCX/TXT, chunk, embed, and search Azure Cognitive Search.
- **Issue tracking** — Classify and persist integration issues and resolutions.
- **Client onboarding config** — Create and validate client configuration records.
- **Compatibility** — Analyze configs against Cortexa baselines (LLM-assisted where applicable).
- **Dashboard** — Summary views for the integration workspace.

---

## Architecture

```
┌─────────────────┐     HTTP (/api → backend)     ┌──────────────────────────────┐
│  React (Vite)   │ ────────────────────────────► │  FastAPI (Backend/main.py)   │
│  Frontend/      │                               │  Routers: chatbot, upload,   │
└─────────────────┘                               │  issues, client-config, …    │
                                                  └──────────────┬───────────────┘
                                                                 │
                    ┌────────────────────────────────────────────┼────────────────────────┐
                    ▼                    ▼                       ▼                        ▼
            Azure OpenAI          Azure Cognitive Search   Azure Blob Storage      Local JSON (some APIs)
            (chat, embed,         (index: tech-spec)       (issues, conversations,  (e.g. issues list)
             vision)                                      client configs)
```

### Chat pipeline (LLM path)

| Step | Component | Role |
|------|-----------|------|
| 1 | `classification_agent` | Classifies query: `GENERAL`, `INTEGRATION`, or `ISSUE` |
| 2 | Retriever | Vector search via `extract_context()` on Azure Search |
| 3 | `fallback_checker_agent` | Checks if retrieved context is sufficient |
| 4 | `fallback_answer_agent` | Safe answer when RAG context is empty |
| 5 | `_format_answer_direct()` | Final response (business or technical persona) |

**Flow:** Input → classification → retrieval → fallback check → formatted JSON response.

**Ingestion:** Upload → chunk (~1000 chars) → Azure OpenAI embeddings → index → top-K retrieval (default 5).

### Stack

| Layer | Technology |
|-------|------------|
| Backend | FastAPI, Python, Microsoft AutoGen (`pyautogen`) |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| AI / search | Azure OpenAI, Azure Cognitive Search |
| Storage | Azure Blob Storage |

### Backend routers (prefixes)

| Router | Prefix | Purpose |
|--------|--------|---------|
| `chatbot` | `/chatbot` | AI chat (`POST /chatbot/chat`) |
| `upload` | `/upload` | Document upload and indexing |
| `client_config` | `/client-config` | Client onboarding CRUD |
| `compatibility` | `/compatibility` | Compatibility analysis |
| `issue` | `/issues` | Issue APIs |
| `issue_insights` | `/issue-insights` | Issue analytics |
| `dashboard` | `/dashboard` | Dashboard data |
| `start_mail` | `/start-mail` | Mail-related flows |

---

## Repository layout

```
KYC-TechSpec/
├── Backend/
│   ├── main.py              # FastAPI app entry
│   ├── keys.env             # Secrets (not committed)
│   ├── requirements.txt
│   └── Routers/             # API modules
├── Frontend/                # React app
└── .claude/skills/kyc-techspec/   # Optional Claude skill + references for this domain
```

---

## Local development

### Prerequisites

- Python 3.11+ (or version matching your venv)
- Node.js 18+
- Azure resources configured in `Backend/keys.env` (see below)

### Backend

```bash
cd Backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
pip install pyautogen==0.9.0   # required by chatbot; not listed in requirements.txt
# Fill in Backend/keys.env, then:
uvicorn main:app --reload --host 127.0.0.1 --port 8001
```

Default API base URL: **`http://127.0.0.1:8001`**

Health check: `GET /` → `{"message":"Backend running"}`

### Frontend

```bash
cd Frontend
npm install
npm run dev
```

Dev UI: **`http://localhost:5174`**

The Vite dev server proxies `/api` to the backend URL in `Frontend/vite.config.ts` (default target `http://localhost:8001`). Change the proxy `target` if you run the API on another port.

---

## Configuration (`Backend/keys.env`)

- **Azure OpenAI:** `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_VERSION`, `AZURE_OPENAI_DEPLOYMENT_NAME`
- **Embeddings:** `embedding_deployment`
- **Azure Search:** `AZURE_SEARCH_SERVICE_ENDPOINT`, `AZURE_SEARCH_INDEX_NAME`, `AZURE_SEARCH_ADMIN_KEY`
- **Blob storage:** `AZURE_BLOB_CONNECTION_STRING`, `AZURE_BLOB_CONTAINER`

---

## Main APIs (summary)

### `POST /chatbot/chat`

Multipart form: `query` (required; aliases `text`, `message`, `prompt`), optional `user_id`, `client_name`, `persona` (`business` | `technical`), optional `image` (screenshot).

Response includes: `answer`, `type`, `confidence`, `rag_used`, `fallback_used`, and related fields.

### `POST /client-config/create`

JSON body: `client_name` (required), plus optional onboarding fields (`assigned_to`, `services`, `environment`, etc.).

### Other useful routes

- `GET /compatibility/jpmc-config` — static baseline config
- `GET /dashboard/` — dashboard payload
- Upload and issue routes under `/upload` and `/issues`

Interactive docs (with backend running): **`http://127.0.0.1:8001/docs`** and **`http://127.0.0.1:8001/openapi.json`**

---

## Data persistence

| Data | Typical location |
|------|------------------|
| Chat issues / conversations | Azure Blob (`Chatbot/issues.json`, `Chatbot/conversation.json`) |
| Client configs | Azure Blob (`client_data/client_configs.json`) |
| Some issue list data | Local `Backend/issues.json` (issue router) |

---

## Quality characteristics

- **Relevancy** — Answers aligned with query type (general, integration, issue).
- **Groundedness** — When RAG succeeds, answers lean on indexed documentation.
- **Completeness** — Chat and config responses expose the fields the API contract defines.
- **Faithfulness** — Missing context surfaced explicitly instead of inventing endpoints or policies.

---

## Latency (typical, local/cloud dependent)

| Route | Order of magnitude |
|-------|--------------------|
| `POST /chatbot/chat` (full agent + RAG) | ~8–15s p95 |
| `POST /client-config/create` | sub-second |
| `GET /compatibility/jpmc-config` | tens of ms |
| `GET /dashboard/` | tens of ms |

---

## Authentication

Local development: **no auth** on the API. Do not expose `keys.env` or production keys in the repo.
