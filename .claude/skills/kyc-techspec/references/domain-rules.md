# KYC-TechSpec Domain Rules

## Product Context

KYC-TechSpec supports **Cortexa** — an enterprise AI-powered search and inference platform for FinTech API client onboarding. Integration engineers use the workspace to troubleshoot authentication failures, document ingestion issues, compatibility gaps, and go-live blockers.

The domain spans:

- **KYC / compliance onboarding** — credential provisioning, certificate requirements, audit logging
- **API integration** — REST auth flows, document upload, query endpoints, token refresh
- **Document RAG** — integration guides, resolution guides, certificates, client integration docs stored in `Backend/Input/`
- **Issue lifecycle** — OPEN → IN_PROGRESS → RESOLVED / FAILED / ESCALATED

## Query Classification Rules

The `classification_agent` assigns exactly one type per query:

| Type | When to assign | Examples |
|------|----------------|----------|
| `GENERAL` | Product info, capabilities, pricing, subscription, requirements | "What is Cortexa?", "What certifications does Cortexa hold?" |
| `INTEGRATION` | Setup steps, onboarding, API integration guidance | "How do I get an API token?", "What are the onboarding phases?" |
| `ISSUE` | Something broken, errors, failures, retries | "Why am I getting 401 Unauthorized?", "Upload keeps failing" |

Classification output fields:

- `type` — GENERAL | INTEGRATION | ISSUE
- `issue_type` — short label (empty for GENERAL/INTEGRATION)
- `root_cause` — short explanation (empty for GENERAL/INTEGRATION)
- `confidence` — HIGH | LOW

## RAG Groundedness Rules

When `rag_used` is true:

1. Answers must derive from indexed documentation chunks retrieved via Azure Cognitive Search
2. Do not invent product-specific endpoints, credentials, pricing, or policies beyond retrieved context
3. Retrieved source text passes through formatting without adding unsupported facts
4. Trim retrieved docs to 3000 characters before formatting to control token budget

When `rag_used` is false and `fallback_used` is true:

1. The `fallback_answer_agent` provides generic industry guidance only
2. Never fabricate product names, endpoints, credentials, certificates, pricing, or timelines
3. Explicitly state when exact product details are unavailable
4. Recommend checking official documentation or support team for product-specific values

## Persona Rules

| Persona | Response style |
|---------|----------------|
| `business` | Simple professional language, business impact, short paragraphs, minimal jargon |
| `technical` | Engineering language, structured troubleshooting, bullets/steps, generic examples only when safe |

Default persona: `technical`.

## Issue Tracking Rules

Issues are stored when query type is `ISSUE` or `RESOLUTION`:

- Persisted to `Backend/issues.json` via `store_or_update_issue()`
- Includes `rag_metrics.rag_used` flag
- UI category mapping via `_to_ui_category()`:
  - Security & Access Issues (auth, jwt, token, permission)
  - Database Issues
  - AI / Retrieval Issues (retrieval, search, embedding, rag, index)
  - Performance & Scalability Issues
  - Integration & Architecture Issues
  - Compliance Issues
  - Document & File Handling Issues
  - General Technical Issues (default)

Status normalization:

- RESOLVED, CLOSED → `RESOLVED`
- FAILED, FAILED_RESOLUTION → `FAILED`
- IN_PROGRESS, INPROGRESS → `IN_PROGRESS`
- ESCALATED → `ESCALATED`
- Default → `OPEN`

## Document Upload Rules

Supported file types for indexing:

- `.pdf` — PyPDF2 text extraction
- `.docx` — python-docx paragraph extraction
- `.txt` — UTF-8 decode

Upload validation:

- Reject empty extracted text with error
- Blob metadata keys must be lowercase (`tag`, `uploadedby`, `uploadedat`)
- Indexing failures do not fail the upload HTTP response (background task catches exceptions)

Document tags used in UI:

- Integration Guide
- Resolution Guide
- FAQ
- Certificates

## Compatibility Analysis Rules

`POST /compatibility/analyze` compares client-provided stack text against static `JPMC_CONFIG` baseline.

Score-to-status mapping (deterministic post-processing):

| Score range | Status |
|-------------|--------|
| 0–30 | Low Compatibility |
| 31–59 | Partial Compatibility |
| 60–85 | Medium Compatibility |
| 86–100 | High Compatibility |

Result shaping limits by score:

- Score ≥ 75: max 4 matches, 2 gaps, 2 risks, 3 next steps
- Score ≥ 45: max 4 matches, 4 gaps, 4 risks, 4 next steps
- Score < 45: max 4 matches, 5 gaps, 5 risks, 5 next steps

Dedup rules:

- Do not list same capability as both `key_match` and `key_gap`
- Concept keys deduplicated via `_concept_key()` (database, network, security, file_ingestion, governance, observability, api)

## Cortexa Security & Compliance Baseline

From `JPMC_CONFIG` in `Backend/Routers/compatibility.py`:

- **Authentication:** Bearer JWT (3600s expiry, refresh before expiry)
- **Credentials:** Client ID + Client Secret, rotate every 90 days
- **Transport:** HTTPS TLS 1.2+
- **Encryption at rest:** AES-256 (Azure Blob)
- **Certifications:** ISO 27001, SOC 2 Type II, GDPR, HIPAA (Enterprise with BAA)
- **Audit logging:** UTC timestamp, caller identity, endpoint, HTTP code, request_id, source IP
- **Token storage:** Azure Key Vault / AWS Secrets Manager

## Client Configuration Validation

`POST /client-config/create` requirements:

- `client_name` is mandatory (400 if missing or blank after strip)
- Auto-generated: `client_id` (UUID), `created_at`, `updated_at` (UTC ISO), `product: "Unified"`
- Stored in Azure Blob at `client_data/client_configs.json`

## Error Handling Conventions

FastAPI `HTTPException` format:

```json
{ "detail": "Human-readable error message" }
```

Common status codes:

| Code | Scenario |
|------|----------|
| 400 | Missing required field, invalid input |
| 404 | Document not found in Blob |
| 500 | Azure config missing, internal failure |
| 502 | LLM returned invalid JSON (compatibility analyze) |

## Environment Configuration

All secrets live in `Backend/keys.env` (loaded by `main.py` via `python-dotenv`):

```
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_VERSION=
AZURE_OPENAI_DEPLOYMENT_NAME=
embedding_deployment=
AZURE_SEARCH_SERVICE_ENDPOINT=
AZURE_SEARCH_INDEX_NAME=
AZURE_SEARCH_ADMIN_KEY=
AZURE_BLOB_CONNECTION_STRING=
AZURE_BLOB_CONTAINER=
```

Optional tuning:

- `AZURE_SEARCH_VECTOR_FIELD` (default: `embedding`)
- `AZURE_SEARCH_TOP_K` (default: `5`)

## Sample Integration Documents

Pre-loaded reference documents in `Backend/Input/`:

- `Cortexa_General_Documentation.docx`
- `Cortexa_Client_Integration_Guide.docx`
- `Cortexa_Resolution_Guide.docx`
- `Cortexa_Advance_Resolution.docx`
- `Cortexa_Certificates.docx`

These documents inform RAG answers when indexed into Azure Search.
