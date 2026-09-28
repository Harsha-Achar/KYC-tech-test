# KYC-TechSpec Client Configuration Service

## Overview

KYC-TechSpec exposes deterministic, rule-based HTTP endpoints for FinTech client onboarding configuration and reference data retrieval. These endpoints perform CRUD validation, static config serving, and dashboard metrics without any LLM, agent, or RAG pipeline involvement.

**Expedia evaluation type:** Service (Non-LLM) — deterministic JSON request/response with strict schema conformance.

**Target endpoint:** `POST /client-config/create`

**Alternate target endpoint:** `GET /compatibility/jpmc-config` (read-only, zero request body)

## Base URL

```
http://127.0.0.1:8000
```

Local backend:

```bash
cd Backend && uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

## Authentication

**Type:** none (local development)

**Header/format:** No authentication headers required.

## API Endpoints

### POST /client-config/create

**Purpose:** Create a new client onboarding configuration record with field validation and Azure Blob persistence. This is the **target endpoint** for Expedia service_no_llm evaluation.

#### Request

**Content-Type:** `application/json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `client_name` | string | yes | Client display name (must be non-empty after trim) |
| `assigned_to` | string | no | Owner or assignee email |
| `services` | array | no | List of services the client uses |
| `environment` | string | no | Deployment environment (e.g. Sandbox, Production) |
| `system_type` | string | no | System classification |
| `legacy_present` | boolean | no | Whether legacy systems are present |
| `llm_fallback` | boolean | no | Whether LLM fallback is enabled for this client |
| `industry` | string | no | Industry vertical (e.g. Payments, Banking) |
| `priority` | string | no | Priority level |

#### Response

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `client_id` | string | yes | Auto-generated UUID |
| `client_name` | string | yes | Client display name |
| `assigned_to` | string | yes | Owner email (empty string if omitted) |
| `product` | string | yes | Always `"Unified"` |
| `services` | array | yes | Service list (empty array if omitted) |
| `environment` | string | yes | Environment value (empty string if omitted) |
| `system_type` | string | yes | System type (empty string if omitted) |
| `legacy_present` | boolean | yes | Legacy system flag |
| `llm_fallback` | boolean | yes | LLM fallback flag |
| `industry` | string | yes | Industry (empty string if omitted) |
| `priority` | string | yes | Priority (empty string if omitted) |
| `created_at` | string | yes | UTC ISO 8601 timestamp |
| `updated_at` | string | yes | UTC ISO 8601 timestamp |

#### Error Response

| Status | Key | Condition | Example |
|--------|-----|-----------|---------|
| 400 | `detail` | Missing required field | `"client_name is required"` |
| 500 | `detail` | Azure Blob not configured | `"Azure Blob connection string missing. Set AZURE_BLOB_CONNECTION_STRING in keys.env."` |
| 500 | `detail` | Container not configured | `"Azure Blob container name missing. Set AZURE_BLOB_CONTAINER in keys.env."` |

Error shape (FastAPI):

```json
{ "detail": "client_name is required" }
```

#### Example request

```bash
curl -X POST "http://127.0.0.1:8000/client-config/create" \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Meridian Global Payments",
    "assigned_to": "engineer@meridian.com",
    "environment": "Sandbox",
    "industry": "Payments",
    "priority": "High",
    "legacy_present": false,
    "llm_fallback": true,
    "services": ["API Integration", "Document Upload"]
  }'
```

#### Example response

```json
{
  "client_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "client_name": "Meridian Global Payments",
  "assigned_to": "engineer@meridian.com",
  "product": "Unified",
  "services": ["API Integration", "Document Upload"],
  "environment": "Sandbox",
  "system_type": "",
  "legacy_present": false,
  "llm_fallback": true,
  "industry": "Payments",
  "priority": "High",
  "created_at": "2026-09-28T06:30:00.000000+00:00",
  "updated_at": "2026-09-28T06:30:00.000000+00:00"
}
```

---

### GET /compatibility/jpmc-config

**Purpose:** Return static Cortexa/JPMC reference configuration. Deterministic read with no LLM, no external API calls.

**Alternate target endpoint** for read-only schema evaluation.

#### Request

No request body. No query parameters required.

#### Response

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `jpmc_config` | object | yes | Full Cortexa product configuration including features, security, onboarding, certifications |

The `jpmc_config` object contains nested keys: `product_name`, `executive_summary`, `features_and_capabilities`, `subscription_model`, `integration_methods`, `technical_requirements`, `infrastructure_and_hosting`, `onboarding`, `security_and_compliance`, `troubleshooting_and_error_codes`.

#### Error Response

No application-level errors for normal operation. Server startup failures return standard FastAPI 500.

#### Example request

```bash
curl -X GET "http://127.0.0.1:8000/compatibility/jpmc-config"
```

---

### GET /dashboard/

**Purpose:** Return static dashboard metrics. Fully deterministic, no database query.

#### Response

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `total_clients` | integer | yes | Total client count |
| `successful` | integer | yes | Successful integrations |
| `in_progress` | integer | yes | In-progress integrations |
| `issues` | integer | yes | Open issue count |

## Quality Guarantees

- **Relevancy:** Client configuration responses reflect exactly the input fields provided plus auto-generated metadata (`client_id`, timestamps, `product`). Dashboard metrics return the configured static values.

- **Groundedness:** All response fields are computed deterministically from request payload and server-side defaults. No generative content, no external LLM calls, no fabricated data beyond input normalization.

- **Completeness:** A successful `POST /client-config/create` response always includes all 13 fields: `client_id`, `client_name`, `assigned_to`, `product`, `services`, `environment`, `system_type`, `legacy_present`, `llm_fallback`, `industry`, `priority`, `created_at`, `updated_at`.

- **Faithfulness:** N/A — no source document preservation required. Field values match input with defined defaults (empty string for omitted strings, empty array for omitted `services`, `false` for omitted booleans).

## Workflow / Architecture

**Service type:** Deterministic CRUD + static config serving

**Framework:** FastAPI (Python), Azure Blob Storage (JSON file persistence)

### POST /client-config/create pipeline

```
JSON request body
  → Parse dict via FastAPI Body(...)
  → Validate client_name is non-empty (400 if missing)
  → Generate UUID client_id
  → Set product = "Unified"
  → Apply defaults for optional fields
  → Read existing records from Azure Blob (client_data/client_configs.json)
  → Append new record
  → Write back to Blob
  → Return full record JSON
```

No LLM, no agents, no vector search, no caching layer.

### GET /compatibility/jpmc-config pipeline

```
GET request
  → Return JPMC_CONFIG static dict wrapped in {"jpmc_config": ...}
  → Pydantic response_model validation (JpmcConfigResponse)
```

Latency: < 50ms (in-memory static object).

## Models Used

None. This service path uses zero LLM models.

## Latency Expectations

| Endpoint | Expected p95 |
|----------|-------------|
| `POST /client-config/create` | < 500ms (Azure Blob read/write) |
| `GET /compatibility/jpmc-config` | < 50ms |
| `GET /dashboard/` | < 10ms |

All endpoints meet the **< 1000ms** SLA required for service_no_llm full compliance score.

## OpenAPI

FastAPI auto-generates OpenAPI from the running service:

| Resource | URL |
|----------|-----|
| OpenAPI JSON | `http://127.0.0.1:8000/openapi.json` |
| Swagger UI | `http://127.0.0.1:8000/docs` |

Expedia fetches OpenAPI from the **running service**, not from GitHub.

### Required OpenAPI schema annotations

For `POST /client-config/create`, ensure OpenAPI includes:

```json
{
  "paths": {
    "/client-config/create": {
      "post": {
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["client_name"],
                "properties": {
                  "client_name": { "type": "string" },
                  "assigned_to": { "type": "string" },
                  "services": { "type": "array", "items": { "type": "string" } },
                  "environment": { "type": "string" },
                  "system_type": { "type": "string" },
                  "legacy_present": { "type": "boolean" },
                  "llm_fallback": { "type": "boolean" },
                  "industry": { "type": "string" },
                  "priority": { "type": "string" }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "schema": {
              "type": "object",
              "required": [
                "client_id", "client_name", "assigned_to", "product",
                "services", "environment", "system_type", "legacy_present",
                "llm_fallback", "industry", "priority", "created_at", "updated_at"
              ],
              "properties": {
                "client_id": { "type": "string" },
                "client_name": { "type": "string" },
                "assigned_to": { "type": "string" },
                "product": { "type": "string" },
                "services": { "type": "array", "items": { "type": "string" } },
                "environment": { "type": "string" },
                "system_type": { "type": "string" },
                "legacy_present": { "type": "boolean" },
                "llm_fallback": { "type": "boolean" },
                "industry": { "type": "string" },
                "priority": { "type": "string" },
                "created_at": { "type": "string", "format": "date-time" },
                "updated_at": { "type": "string", "format": "date-time" }
              }
            }
          }
        }
      }
    }
  }
}
```

**Gap:** Current `client_config.py` uses `dict = Body(...)` without Pydantic models. Recommend adding `ClientConfigRequest` and `ClientConfigResponse` Pydantic models so FastAPI auto-generates `required` arrays in OpenAPI.

## Error Handling Behavior

| HTTP Status | When | Response shape |
|-------------|------|----------------|
| 400 | Validation failure (missing `client_name`) | `{"detail": "client_name is required"}` |
| 500 | Azure Blob connection string missing | `{"detail": "Azure Blob connection string missing..."}` |
| 500 | Azure Blob container name missing | `{"detail": "Azure Blob container name missing..."}` |

No 401/403 in local development (no auth middleware).

## Local Development

```bash
cd Backend
# Configure Backend/keys.env:
#   AZURE_BLOB_CONNECTION_STRING=...
#   AZURE_BLOB_CONTAINER=...
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Test without Azure (expect 500):

```bash
curl -X POST "http://127.0.0.1:8000/client-config/create" \
  -H "Content-Type: application/json" \
  -d '{"client_name": "Test Client"}'
```

Test validation error (works without Azure):

```bash
curl -X POST "http://127.0.0.1:8000/client-config/create" \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: 400 {"detail": "client_name is required"}
```

Static endpoint (no Azure required):

```bash
curl -X GET "http://127.0.0.1:8000/compatibility/jpmc-config"
curl -X GET "http://127.0.0.1:8000/dashboard/"
```
