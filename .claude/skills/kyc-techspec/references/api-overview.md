# KYC-TechSpec API Overview

Base URL (local): `http://127.0.0.1:8000`

Authentication: **None** in local development.

OpenAPI: `http://127.0.0.1:8000/openapi.json` (live service only)

---

## Primary LLM Endpoint

### POST /chatbot/chat

**Purpose:** AI troubleshooting chat with optional screenshot analysis. Target endpoint for **service_llm** Expedia evaluation.

**Content-Type:** `multipart/form-data`

#### Request fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes* | User question. Alternatives: `text`, `message`, `prompt` |
| `user_id` | string | No | Caller identifier. Default: `default_user` |
| `client_name` | string | No | Client name for issue tracking. Default: `Unknown Client` |
| `persona` | string | No | `business` or `technical`. Default: `technical` |
| `image` | file (binary) | No | Error screenshot; text extracted via vision model |

\*Required unless image yields extractable text.

#### Response fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `answer` | string | yes | Final formatted assistant response |
| `type` | string | yes | `GENERAL`, `INTEGRATION`, or `ISSUE` |
| `diagnosis` | string | yes | Issue type label (may be empty) |
| `rootCause` | string | yes | Root cause summary (may be empty) |
| `confidence` | string | yes | `HIGH` or `LOW` |
| `persona_used` | string | yes | Persona applied |
| `rag_used` | boolean | yes | Whether vector retrieval returned context |
| `fallback_used` | boolean | yes | Whether fallback agent was invoked |

#### Error responses

| Status | Key | Example |
|--------|-----|---------|
| 400 | `detail` | `"Missing query"` |

#### Example curl

```bash
curl -X POST "http://127.0.0.1:8000/chatbot/chat" \
  -F "query=How do I authenticate to the Cortexa API?" \
  -F "client_name=Meridian Global Payments" \
  -F "persona=technical"
```

---

## Document & Index Endpoints

### POST /upload/

Upload integration guide to Azure Blob; triggers background indexing.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | Yes | PDF or DOCX |
| `tag` | string | No | e.g. `Integration Guide`, `Resolution Guide` |
| `uploadedBy` | string | No | Uploader email |

**Response:** `{ "message", "filename", "indexingStarted" }`

### POST /chatbot/index

Direct document indexing without Blob upload.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | Yes | PDF, DOCX, or TXT |

**Response:** `{ "message", "chunks" }`

### GET /upload/

List uploaded documents (UI-friendly shape).

### GET /upload/documents/list

List documents with blob metadata.

### GET /upload/documents/view/{file_name}

Stream document inline.

### GET /upload/documents/download/{file_name}

Download document attachment.

---

## Compatibility Endpoints

### POST /compatibility/analyze

LLM-driven compatibility assessment (uses Azure OpenAI, not multi-agent).

**Content-Type:** `application/json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `client_text` | string | Yes | Client architecture, stack, security requirements |

**Response fields:** `compatibility_score`, `status`, `reasoning`, `key_matches`, `key_gaps`, `risks`, `recommended_next_steps`, `technical_recommendations`

**Errors:** 502 (`detail`: invalid LLM JSON), 500 (analysis failure)

### GET /compatibility/jpmc-config

**Purpose:** Returns static Cortexa/JPMC reference configuration. Target endpoint for **service_no_llm** Expedia evaluation.

**Method:** GET

**Request body:** None

**Response:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `jpmc_config` | object | yes | Full Cortexa product config (features, security, onboarding, etc.) |

**Latency:** < 100ms (deterministic, no external calls)

---

## Client Configuration Endpoints

### POST /client-config/create

Deterministic CRUD — no LLM.

**Content-Type:** `application/json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `client_name` | string | Yes | Client display name |
| `assigned_to` | string | No | Owner email |
| `services` | array | No | Service list |
| `environment` | string | No | e.g. Sandbox, Production |
| `system_type` | string | No | System classification |
| `legacy_present` | boolean | No | Legacy system flag |
| `llm_fallback` | boolean | No | LLM fallback enabled |
| `industry` | string | No | Industry vertical |
| `priority` | string | No | Priority level |

**Response:** Full record with `client_id`, `created_at`, `updated_at`, `product: "Unified"`

**Errors:** 400 (`detail`: `"client_name is required"`), 500 (Azure Blob config missing)

### GET /client-config/all

Returns array of all client config records from Blob storage.

---

## Issue Endpoints

### GET /issues/list

Flattened issue list from `issues.json`.

### GET /issues/

Filtered issue query with optional client/category/status params.

### GET /issues/client-history

Client-specific issue history.

### GET /issues/category-breakdown

Issue counts by category.

### GET /issues/status-breakdown

Issue counts by status.

### POST /issues/generate-issue-report

Generate issue report (uses LLM for summarization).

---

## Dashboard & Health

### GET /

Health check: `{ "message": "Backend running" }`

### GET /dashboard/

Static metrics: `{ "total_clients", "successful", "in_progress", "issues" }`

---

## Conversation Endpoints

### GET /chatbot/conversations

List conversation threads.

### POST /chatbot/conversations/upsert

Create or update conversation thread.

### POST /chatbot/conversations/{thread_id}/messages

Append message to thread.

---

## Email Endpoints

### POST /chatbot/draft-ticket-email

Draft support ticket email from chat context.

### POST /chatbot/send-ticket-email

Send support ticket email via SMTP.

### POST /start-mail/onboarding-login

Send onboarding login email.

---

## Frontend API Proxy

During local development, the Vite dev server proxies API calls:

- Frontend: `http://localhost:5174`
- Proxy target: `http://127.0.0.1:8000`

Frontend components call relative paths that resolve through the proxy configuration in `Frontend/vite.config.ts`.
