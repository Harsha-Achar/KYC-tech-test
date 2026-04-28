from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from openai import AzureOpenAI
from pydantic import BaseModel, Field

router = APIRouter()

from pathlib import Path

env_path = Path(
    r"C:\Users\sowmya\Downloads\Projects\JPMC-TechSpec\Backend\keys.env"
)

load_dotenv(env_path)

openai_client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
)

JPMC_CONFIG: dict[str, Any] = {
    "product_name": "Cortexa",
    "document_type": "Client-facing General and Integration Guide",
    "executive_summary": [
        "Enterprise AI-powered search and inference platform for structured and unstructured data.",
        "Provides one governed question-answering interface across documents, databases, and operational knowledge sources.",
        "Supports natural language interaction, source-grounded answers, and enterprise integration workflows.",
    ],
    "features_and_capabilities": [
        "AI chat-based troubleshooting with context-aware diagnosis and step-by-step resolution.",
        "RAG-based semantic search across PDFs, Word docs, CSV, logs, and structured data.",
        "API-first integration for authentication, upload, query, configuration, and user management.",
        "Multi-agent diagnosis pipeline for high-confidence responses.",
        "Automated ingestion: extraction, chunking, embeddings, indexing.",
        "Category-based governance and source traceability for responses.",
    ],
    "subscription_model": {
        "monthly": {
            "target": "Pilots and short-term projects",
            "support": "Email support, 48h SLA",
            "limits": "Standard API rate limits",
        },
        "quarterly": {
            "target": "Ongoing integration workloads",
            "support": "Priority support (email + chat), 24h SLA",
            "limits": "Elevated rate limits",
        },
        "annual": {
            "target": "Production enterprise environments",
            "support": "Dedicated CSM, 8h SLA",
            "limits": "High-volume limits",
        },
        "enterprise_custom": {
            "target": "Large-scale or regulated deployments",
            "support": "Custom SLA with optional 24/7 support",
            "limits": "Negotiated usage limits",
            "extras": [
                "Negotiated data residency",
                "Dedicated infrastructure options",
                "Custom legal agreements",
            ],
        },
    },
    "integration_methods": [
        "REST APIs for auth, upload, query, configuration.",
        "Database connectors (SQL/NoSQL) with schema registration and access controls.",
        "File-based ingestion for PDF, DOCX, CSV, logs with async indexing.",
        "Real-time API calls for chat, dashboards, and in-app assistants.",
    ],
    "technical_requirements": {
        "credentials": "Client ID + Client Secret, rotate every 90 days",
        "transport_security": "HTTPS with TLS 1.2+",
        "authentication": "Bearer JWT (expires in 3600s, refresh before expiry)",
        "request_formats": ["JSON (primary)", "XML", "CSV"],
        "network_access": "Outbound HTTPS on port 443 with firewall allow rules",
    },
    "infrastructure_and_hosting": {
        "cloud_provider": "Microsoft Azure (multi-region)",
        "storage": "Azure Blob Storage with AES-256 encryption at rest",
        "network": "Stable outbound HTTPS; static IP allowlisting for Enterprise",
        "token_storage": "Secure secrets vault (Azure Key Vault / AWS Secrets Manager)",
        "availability": {
            "quarterly_and_annual": "99.9%",
            "enterprise": "99.95%",
        },
    },
    "onboarding": {
        "overview": [
            "Phase 1: Account provisioning and credential issuance",
            "Phase 2: Environment setup (network + secrets)",
            "Phase 3: First integration flow (auth/upload-or-connector/query)",
            "Phase 4: Go-live validation (quality, latency, attribution)",
        ],
        "first_api_call_sequence": [
            "POST /v1/auth/token",
            "POST /v1/documents/upload",
            "GET /v1/documents/{document_id}/status (poll until indexed)",
            "POST /v1/query",
        ],
        "go_live_checklist": [
            "Portal login and credential storage confirmed",
            "Outbound HTTPS/443 and base URL configured",
            "Token refresh logic at ~50 min implemented",
            "At least one integration path tested end-to-end",
            "Error handling for 401/429/503 implemented",
            "request_id logging enabled",
        ],
    },
    "security_and_compliance": {
        "authentication_and_authorization": [
            "Short-lived RS256 JWT tokens, no long-lived API keys",
            "RBAC roles: Admin, Developer, Viewer",
            "Enterprise supports custom granular roles",
        ],
        "service_account_best_practices": [
            "Dedicated service account per integration",
            "Rotate client secrets every 90 days",
            "Immediate credential revocation on compromise",
        ],
        "encryption": {
            "in_transit": "TLS 1.2+ only",
            "at_rest": "AES-256 with managed keys (BYOK option for Enterprise)",
            "in_processing": "Isolated processing containers; raw intermediates deleted after successful indexing",
        },
        "data_residency_and_retention": {
            "residency": "Primary assigned Azure region; Enterprise can request region",
            "documents": "Retained during subscription + 30-day grace period",
            "query_logs": "Retained for 90 days by default",
            "deletion": "Permanent deletion within 30 days of termination",
            "isolation": "Logical tenant isolation; dedicated partitions for Enterprise",
        },
        "certifications": ["ISO 27001", "SOC 2 Type II", "GDPR", "HIPAA (Enterprise with BAA)"],
        "audit_logging": [
            "UTC timestamp",
            "caller identity",
            "endpoint and method",
            "HTTP response code",
            "request_id",
            "source IP address",
        ],
    },
    "troubleshooting_and_error_codes": {
        "common_issues": [
            "401 auth failures from header/expiry/credential mismatch",
            "document processing delays or failed ingestion",
            "low-confidence retrieval and inconsistent answer behavior",
            "429 rate limiting requiring exponential back-off",
        ],
        "quick_reference_codes": {
            "200": "OK",
            "201": "Created",
            "400": "Bad Request",
            "401": "Unauthorized",
            "403": "Forbidden",
            "404": "Not Found",
            "409": "Conflict",
            "413": "Payload Too Large",
            "415": "Unsupported Media Type",
            "429": "Too Many Requests",
            "500": "Internal Server Error",
            "503": "Service Unavailable",
        },
        "advanced_resolution_topics": [
            "mTLS certificate chain and key-cert pairing validation",
            "OAuth/JWT expiry/audience/issuer/scope validation",
            "network/DNS/firewall/proxy/IP-whitelist diagnosis",
        ],
    },
    "integration_playbooks": {
        "payment_gateway": {
            "required_apis": [
                "POST /v1/auth/token",
                "POST /v1/documents/upload",
                "GET /v1/documents/{document_id}/status",
                "POST /v1/config/categories",
                "POST /v1/query",
            ],
            "focus": "Natural-language querying of transactions, reconciliation reports, payment status logs",
        },
        "database_integration": {
            "workflow": [
                "Register connector",
                "Test connectivity",
                "Define accessible schemas/tables/views",
                "Map connector to category",
                "Validate query and source attribution",
            ],
            "security_note": "Use dedicated read-only DB account and rotate credentials every 90 days",
        },
        "file_ingestion": {
            "workflow": [
                "Authenticate",
                "Upload file",
                "Capture document_id",
                "Poll status",
                "Assign metadata/category",
                "Test retrieval",
            ],
            "pipeline": ["blob storage", "extraction", "chunking", "embedding", "indexing"],
        },
        "real_time_api": {
            "workflow": [
                "Authenticate and cache JWT",
                "Send query with category/source/session context",
                "Handle answer + sources + session continuity",
                "Render response with citations",
            ],
            "latency_guidance": "Scope queries by category or source_ids for lower latency",
        },
    },
    "technical_stack": {
        "backend": ["FastAPI", "Python", "PM2 process orchestration"],
        "frontend": ["React", "Vite", "TypeScript", "Tailwind CSS"],
        "infrastructure": ["Azure OpenAI", "Azure Cognitive Search", "Cosmos DB", "Azure Blob Storage", "NGINX"],
    },
    "prerequisites_data": {
        "programming_environment": ["Python", "venv", "Node.js", "npm"],
        "backend_dependencies": [
            "fastapi",
            "uvicorn[standard]",
            "python-dotenv",
            "openai",
            "azure-search-documents",
            "azure-storage-blob",
            "PyPDF2",
            "python-docx",
            "python-multipart",
        ],
        "database_requirement": "No mandatory DB connector unless external DB integration is enabled",
    },
}


class CompatibilityRequest(BaseModel):
    client_text: str = Field(..., min_length=1, description="Client technical stack and integration details")


class CompatibilityResponse(BaseModel):
    compatibility_score: int = Field(..., ge=0, le=100)
    status: str
    reasoning: str
    key_matches: list[str]
    key_gaps: list[str]
    risks: list[str]
    recommended_next_steps: list[str]
    technical_recommendations: list[dict[str, Any]] = Field(default_factory=list)


class JpmcConfigResponse(BaseModel):
    jpmc_config: dict[str, Any]


def _extract_json(content: str) -> dict[str, Any]:
    text = (content or "").strip()
    if text.startswith("```"):
        lines = [line for line in text.splitlines() if not line.strip().startswith("```")]
        text = "\n".join(lines).strip()

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]

    return json.loads(text)


def _normalize_payload(payload: dict[str, Any]) -> CompatibilityResponse:
    raw_score = payload.get("compatibility_score", 0)
    try:
        compatibility_score = int(raw_score)
    except Exception:
        compatibility_score = 0
    compatibility_score = max(0, min(100, compatibility_score))

    if compatibility_score <= 30:
        status = "Low Compatibility"
    elif compatibility_score < 60:
        status = "Partial Compatibility"
    elif compatibility_score <= 85:
        status = "Medium Compatibility"
    else:
        status = "High Compatibility"

    def as_list(key: str) -> list[str]:
        value = payload.get(key, [])
        if not isinstance(value, list):
            return []
        return [str(item).strip() for item in value if str(item).strip()]

    return CompatibilityResponse(
        compatibility_score=compatibility_score,
        status=status,
        reasoning=str(payload.get("reasoning", "")).strip(),
        key_matches=as_list("key_matches"),
        key_gaps=as_list("key_gaps"),
        risks=as_list("risks"),
        recommended_next_steps=as_list("recommended_next_steps"),
    )


TECHNICAL_RECOMMENDATION_LIBRARY: dict[str, dict[str, Any]] = {
    "database integration": {
        "title": "Database Integration",
        "type": "clickable",
        "details": {
            "technical_requirements": [
                "Provision a dedicated read-only database service account",
                "Enable network connectivity from integration layer to DB and Cortexa endpoints",
                "Register connector metadata (host, port, schema scope, SSL mode=require)",
                "Define table/view allowlist with least-privilege access",
            ],
            "implementation_steps": [
                "Create connector via /v1/connectors/database",
                "Run connectivity test via /v1/connectors/{connector_id}/test",
                "Map connector to category_id",
                "Validate queries and source attribution from /v1/query",
            ],
            "security": [
                "Store DB credentials in a secrets vault",
                "Enforce TLS for database connectivity",
                "Rotate DB credentials every 90 days",
            ],
        },
    },
    "network readiness": {
        "title": "Network Readiness",
        "type": "clickable",
        "details": {
            "technical_requirements": [
                "Allow outbound HTTPS traffic on port 443 to Cortexa API endpoints",
                "Validate DNS resolution and proxy forwarding for the integration runtime",
                "Confirm whether static egress IP allowlisting is required for the selected plan",
            ],
            "implementation_steps": [
                "Run connectivity checks from the target server or middleware host",
                "Document proxy, firewall, and TLS inspection behavior",
                "Create allowlist and routing changes before API integration testing",
            ],
            "security": [
                "Restrict outbound access to approved Cortexa hosts",
                "Log network failures and request correlation identifiers",
                "Review TLS inspection policies to avoid certificate validation failures",
            ],
        },
    },
    "governance": {
        "title": "Governance and Access Mapping",
        "type": "clickable",
        "details": {
            "technical_requirements": [
                "Define Cortexa categories for each business domain",
                "Map users or service accounts to RBAC roles",
                "Prepare metadata standards for documents and structured sources",
            ],
            "implementation_steps": [
                "Create categories through configuration APIs",
                "Assign document uploads and database connectors to category_id values",
                "Test access boundaries with Admin, Developer, and Viewer roles",
            ],
            "security": [
                "Use least-privilege roles for service accounts",
                "Maintain audit logs for category and permission changes",
                "Avoid broad connector permissions across unrelated datasets",
            ],
        },
    },
    "observability": {
        "title": "Observability and Operations",
        "type": "clickable",
        "details": {
            "technical_requirements": [
                "Centralize request_id, response status, latency, and retry logs",
                "Track upload/indexing status transitions and failures",
                "Define alert thresholds for 401, 429, 500, and 503 responses",
            ],
            "implementation_steps": [
                "Add middleware logging around every Cortexa API call",
                "Create dashboards for auth failures, query latency, and indexing delays",
                "Document runbooks for auth, upload, query, and connector failures",
            ],
            "security": [
                "Mask tokens, secrets, and sensitive payload fields in logs",
                "Restrict log access to support and platform operations teams",
                "Retain audit logs according to client compliance policy",
            ],
        },
    },
    "api integration": {
        "title": "API Integration Layer",
        "type": "clickable",
        "details": {
            "technical_requirements": [
                "Introduce middleware/API gateway for auth, retries, and observability",
                "Implement JWT token lifecycle (acquire, cache, refresh)",
                "Enable outbound HTTPS 443 with DNS/proxy validation",
            ],
            "implementation_steps": [
                "Integrate POST /v1/auth/token and token refresh scheduler",
                "Implement exponential backoff for 429 and retry guard for 503",
                "Log request_id from all API responses for support tracing",
            ],
            "security": [
                "Keep Client ID/Secret in vault only",
                "Restrict egress via allowlist rules",
                "Audit authentication and failed request patterns",
            ],
        },
    },
    "security": {
        "title": "Security Hardening (JWT/TLS/mTLS)",
        "type": "clickable",
        "details": {
            "technical_requirements": [
                "TLS 1.2+ support across client integration stack",
                "JWT bearer token handling with expiry checks",
                "Optional certificate and mTLS readiness for enterprise policies",
            ],
            "implementation_steps": [
                "Validate token exp/aud/iss claims in middleware",
                "Add proactive token refresh at 50-minute mark",
                "Run certificate-chain checks for mTLS endpoints where required",
            ],
            "security": [
                "Do not persist tokens in plain text",
                "Rotate client secrets every 90 days",
                "Enable centralized audit logging for auth events",
            ],
        },
    },
    "file ingestion": {
        "title": "File Ingestion Pipeline",
        "type": "clickable",
        "details": {
            "technical_requirements": [
                "Support accepted file types (PDF, DOCX, TXT, CSV, logs)",
                "Respect file size limits and UTF-8 encoding where required",
                "Handle asynchronous indexing status polling",
            ],
            "implementation_steps": [
                "Upload with POST /v1/documents/upload",
                "Poll GET /v1/documents/{document_id}/status until indexed",
                "Assign category metadata before query enablement",
            ],
            "security": [
                "Validate uploaded content types",
                "Block unsupported/unsafe files",
                "Track document_id and request_id for incident handling",
            ],
        },
    },
}


def _technical_key_for_text(text: str) -> str:
    lowered = text.lower()
    keyword_map = [
        ("database integration", ["database", "db", "connector", "schema", "table", "view"]),
        ("network readiness", ["network", "https", "443", "dns", "proxy", "firewall", "allowlist", "egress"]),
        ("observability", ["monitoring", "logging", "observability", "request_id", "retry", "429", "503", "latency"]),
        ("governance", ["governance", "rbac", "category", "metadata", "access control", "role"]),
        ("api integration", ["api", "gateway", "endpoint", "integration layer", "service layer", "middleware", "rest"]),
        ("file ingestion", ["upload", "document", "ingestion", "index", "csv", "pdf", "docx", "file"]),
        ("security", ["jwt", "oauth", "tls", "mtls", "certificate", "secret", "token", "credential"]),
    ]
    for key, keywords in keyword_map:
        if any(keyword in lowered for keyword in keywords):
            return key
    return "api integration"


def _recommendation_for_text(text: str) -> dict[str, Any]:
    key = _technical_key_for_text(text)
    template = TECHNICAL_RECOMMENDATION_LIBRARY[key]
    details = template["details"]
    finding = text.rstrip(".")
    return {
        "related_text": text,
        "title": f"{template['title']} Requirements",
        "type": template["type"],
        "details": {
            "technical_requirements": [
                f"Address this specific finding: {finding}.",
                *_contextual_requirements(key, finding),
                *details["technical_requirements"][:2],
            ],
            "implementation_steps": [
                f"Create an implementation task for: {finding}.",
                *_contextual_steps(key, finding),
                *details["implementation_steps"][:2],
            ],
            "security": [
                f"Validate security impact for: {finding}.",
                *_contextual_security(key, finding),
                *details["security"][:2],
            ],
        },
    }


def _contextual_requirements(key: str, finding: str) -> list[str]:
    if key == "database integration":
        return [
            "Identify the exact source database engine, host, port, schema, and read-only object scope affected by this finding.",
            "Confirm whether Cortexa should use a direct database connector or a middleware-mediated query path.",
        ]
    if key == "network readiness":
        return [
            "Document the runtime host that must reach Cortexa and list its proxy, DNS, firewall, and egress IP constraints.",
            "Confirm outbound HTTPS/443 and TLS certificate validation from the same environment mentioned in the finding.",
        ]
    if key == "security":
        return [
            "Define the exact token, secret, certificate, or TLS control missing in this finding.",
            "Confirm ownership for vault setup, credential rotation, and certificate lifecycle management.",
        ]
    if key == "file ingestion":
        return [
            "List the exact file types, size limits, encoding rules, and metadata required for the affected ingestion path.",
            "Confirm whether indexing will be manual, scheduled, or event-driven for this finding.",
        ]
    if key == "governance":
        return [
            "Map the affected users, roles, categories, and metadata fields before enabling production access.",
            "Define category ownership and approval workflow for the specific governance gap.",
        ]
    if key == "observability":
        return [
            "Identify the events, request IDs, latency metrics, and failures that must be logged for this finding.",
            "Define alert thresholds and support ownership for the affected operational path.",
        ]
    return [
        "Define the middleware/API component responsible for this integration gap.",
        "Confirm required Cortexa endpoints, payloads, retries, and response handling for this finding.",
    ]


def _contextual_steps(key: str, finding: str) -> list[str]:
    if key == "database integration":
        return [
            "Create a read-only service account and validate connectivity from the integration runtime.",
            "Register the connector, test it, then map allowed schemas/tables to Cortexa categories.",
        ]
    if key == "network readiness":
        return [
            "Run curl/nslookup/proxy tests from the target runtime and record failures.",
            "Apply firewall/proxy/allowlist changes, then retest Cortexa auth and query endpoints.",
        ]
    if key == "security":
        return [
            "Implement token acquisition, refresh, and secure storage before enabling downstream API calls.",
            "Test TLS/mTLS certificate validation and secret rotation in a non-production environment.",
        ]
    if key == "file ingestion":
        return [
            "Upload a representative sample file and poll status until indexed.",
            "Attach category_id, metadata, and tags, then validate retrieval with a targeted query.",
        ]
    if key == "governance":
        return [
            "Create categories and assign role permissions for a limited pilot user group.",
            "Run access tests to confirm users can only query approved categories and sources.",
        ]
    if key == "observability":
        return [
            "Add structured logs around auth, upload, connector, and query calls.",
            "Create dashboard panels for failures, retries, latency, and indexing delay.",
        ]
    return [
        "Build a thin integration service or API gateway route for the affected workflow.",
        "Add retries, timeout handling, request_id logging, and contract validation.",
    ]


def _contextual_security(key: str, finding: str) -> list[str]:
    if key == "database integration":
        return [
            "Use least-privilege database permissions and block write access unless explicitly required.",
            "Store DB credentials in a managed vault and rotate them every 90 days.",
        ]
    if key == "network readiness":
        return [
            "Avoid broad outbound rules; restrict access to approved Cortexa hosts and ports.",
            "Check TLS inspection behavior to prevent broken certificate validation.",
        ]
    if key == "security":
        return [
            "Never hard-code Client ID, Client Secret, tokens, or certificate private keys.",
            "Log authentication events without exposing token or secret values.",
        ]
    if key == "file ingestion":
        return [
            "Reject unsupported, oversized, encrypted, or malformed files before upload.",
            "Mask sensitive document metadata in logs and support tickets.",
        ]
    if key == "governance":
        return [
            "Apply least-privilege RBAC and review role assignments before go-live.",
            "Audit category and permission changes with timestamp and actor identity.",
        ]
    if key == "observability":
        return [
            "Mask secrets, tokens, credentials, and sensitive payload data in every log sink.",
            "Restrict operational dashboard access to authorized support teams.",
        ]
    return [
        "Store integration credentials in vault-backed configuration.",
        "Require TLS 1.2+ and validate authorization failures before retrying.",
    ]


def _build_technical_recommendations(key_gaps: list[str], next_steps: list[str]) -> list[dict[str, Any]]:
    return [_recommendation_for_text(item) for item in key_gaps + next_steps]


def _concept_key(text: str) -> str:
    lowered = text.lower()
    concept_map = {
        "database": ["database", "db", "connector", "schema", "table"],
        "network": ["network", "https", "443", "dns", "proxy", "firewall", "allowlist"],
        "security": ["jwt", "oauth", "tls", "mtls", "certificate", "secret", "token", "credential"],
        "file_ingestion": ["upload", "document", "ingestion", "index", "csv", "pdf", "docx", "file"],
        "governance": ["governance", "rbac", "category", "metadata", "access control", "role"],
        "observability": ["monitoring", "logging", "observability", "request_id", "retry", "429", "503", "latency"],
        "api": ["api", "gateway", "endpoint", "integration layer", "service layer", "middleware"],
    }
    for concept, keywords in concept_map.items():
        if any(keyword in lowered for keyword in keywords):
            return concept
    return lowered[:60]


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        normalized = " ".join(item.lower().split())
        if normalized in seen:
            continue
        seen.add(normalized)
        result.append(item)
    return result


def _result_limits(score: int) -> dict[str, int]:
    if score >= 75:
        return {"matches": 4, "gaps": 2, "risks": 2, "next_steps": 3}
    if score >= 45:
        return {"matches": 4, "gaps": 4, "risks": 4, "next_steps": 4}
    return {"matches": 4, "gaps": 5, "risks": 5, "next_steps": 5}


def _shape_result(result: CompatibilityResponse) -> CompatibilityResponse:
    matches = _dedupe(result.key_matches)
    match_concepts = {_concept_key(item) for item in matches}
    gaps = [item for item in _dedupe(result.key_gaps) if _concept_key(item) not in match_concepts]
    risks = _dedupe(result.risks)
    next_steps = _dedupe(result.recommended_next_steps)

    limits = _result_limits(result.compatibility_score)
    result.key_matches = matches[: limits["matches"]]
    result.key_gaps = gaps[: limits["gaps"]]
    result.risks = risks[: limits["risks"]]
    result.recommended_next_steps = next_steps[: limits["next_steps"]]
    result.technical_recommendations = _build_technical_recommendations(
        result.key_gaps,
        result.recommended_next_steps,
    )
    return result


def _analyze_compatibility_with_llm(client_text: str) -> CompatibilityResponse:
    jpmc_text = json.dumps(JPMC_CONFIG, indent=2)
    prompt = f"""
You are an enterprise integration compatibility analyst.

Compare the two inputs and produce an AI-driven compatibility assessment.
Your scoring must be based on the content quality and alignment (not fixed thresholds hardcoded by the caller).

Evaluate alignment across:
1) product requirements
2) technical stack
3) integration expectations
4) security / certificates
5) data formats
6) infrastructure readiness

Return STRICT JSON only, with no markdown and no extra text.

Required JSON shape:
{{
  "compatibility_score": <integer 0-100>,
  "status": "High Compatibility" | "Medium Compatibility" | "Partial Compatibility" | "Low Compatibility",
  "reasoning": "<clear summary of why this score was assigned>",
  "key_matches": ["...", "..."],
  "key_gaps": ["...", "..."],
  "risks": ["...", "..."],
  "recommended_next_steps": ["...", "..."]
}}

Guidelines:
- Assign status strictly from compatibility_score: 0-30 Low Compatibility, 31-59 Partial Compatibility, 60-85 Medium Compatibility, 86-100 High Compatibility.
- Keep reasoning concise but specific and enterprise-ready.
- Return only the highest priority items. Avoid long lists.
- For high scores (75+), include fewer gaps and risks. For low scores, include more gaps, but no more than 5.
- Do not describe the same capability as both a key_match and a key_gap.
- Make key_gaps and recommended_next_steps technical and implementation-oriented.
- Do not return null values.

JPMC Side:
{jpmc_text}

Client Side:
{client_text}
""".strip()

    response = openai_client.chat.completions.create(
        model=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
        messages=[
            {"role": "system", "content": "You output valid JSON only."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.1,
    )

    content = response.choices[0].message.content or "{}"
    parsed = _extract_json(content)
    return _normalize_payload(parsed)


@router.post("/analyze", response_model=CompatibilityResponse)
def analyze_compatibility(payload: CompatibilityRequest):
    try:
        result = _analyze_compatibility_with_llm(payload.client_text)
        result = _shape_result(result)
        return result.model_dump()
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail=f"Invalid JSON from LLM: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Compatibility analysis failed: {exc}") from exc


@router.get("/jpmc-config", response_model=JpmcConfigResponse)
def get_jpmc_config():
    return JpmcConfigResponse(jpmc_config=JPMC_CONFIG).model_dump()