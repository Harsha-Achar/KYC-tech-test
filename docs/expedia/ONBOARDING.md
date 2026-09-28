# Expedia Evaluation — Detection Summary & Onboarding

## Detection Summary

| Type | Recommended? | Reasoning |
|------|-------------|-----------|
| **service_llm** | **Primary (best fit)** | FastAPI HTTP API with multi-agent AutoGen orchestration, Azure OpenAI, and RAG vector retrieval. Primary endpoint `POST /chatbot/chat` uses 5 agents + embedding search. |
| **skill** | **Secondary (valid)** | Project is a workflow-driven KYC/integration troubleshooting workspace. Skill format captures the diagnostic workflow engineers follow when analyzing chat failures, indexing gaps, and compatibility issues. |
| **service_no_llm** | **Tertiary (valid subset)** | Deterministic endpoints exist without LLM: `POST /client-config/create`, `GET /compatibility/jpmc-config`, `GET /dashboard/`. Best target: `POST /client-config/create` (request/response validation) or `GET /compatibility/jpmc-config` (Pydantic response model, <50ms). |

**Natural project type:** `service_llm` — the core value proposition is AI troubleshooting chat with RAG.

**Skill applicability:** Engineers and Claude agents follow repeatable inspection workflows across Backend routers, issue store, and frontend integration — suitable for skill evaluation.

**Non-LLM applicability:** Only a subset of endpoints qualify. Do not evaluate `POST /chatbot/chat` or `POST /compatibility/analyze` as service_no_llm — both use Azure OpenAI.

---

## File Tree — All Generated Files

```
KYC-TechSpec/
├── README.md                                          # Hub README (GitHub sync)
├── CLAUDE.md                                          # Repo conventions
├── .claude/skills/kyc-techspec/
│   ├── SKILL.md                                       # Skill primary input
│   └── references/
│       ├── architecture.md                            # System topology
│       ├── api-overview.md                            # Full endpoint catalog
│       └── domain-rules.md                            # KYC/compliance rules
└── docs/expedia/
    ├── ONBOARDING.md                                  # This file
    ├── README-SERVICE-LLM.md                          # Service LLM full spec
    └── README-SERVICE-NO-LLM.md                       # Service non-LLM full spec
```

---

## Expedia MetadataStep Values

### Option A — Service (LLM) [Recommended]

| Field | Value |
|-------|-------|
| Application name | KYC-TechSpec AI Troubleshooter |
| Category | Service (LLM) |
| Owner | Affine / Integration Engineering |
| Endpoint | `POST /chatbot/chat` |
| Base URL | `http://127.0.0.1:8000` |
| Full endpoint URL | `http://127.0.0.1:8000/chatbot/chat` |
| GitHub URL | `<your-repo-url>` (fetches root `README.md`) |
| Skill path | N/A |
| Content type | multipart/form-data |
| Auth type | none |
| OpenAPI URL | `http://127.0.0.1:8000/openapi.json` |
| README for analysis | `docs/expedia/README-SERVICE-LLM.md` (copy to root or use local path) |

### Option B — Skill

| Field | Value |
|-------|-------|
| Application name | KYC-TechSpec Troubleshooting Skill |
| Category | Skill |
| Owner | Affine / Integration Engineering |
| Endpoint | N/A |
| Base URL | N/A |
| GitHub URL | `<your-repo-url>` (fetches root `SKILL.md` if placed at root, or use local path) |
| Skill path | `.claude/skills/kyc-techspec/` |
| README for analysis | Root `README.md` (optional GitHub URL) |

### Option C — Service (Non-LLM)

| Field | Value |
|-------|-------|
| Application name | KYC-TechSpec Client Config API |
| Category | Service (Non-LLM) |
| Owner | Affine / Integration Engineering |
| Endpoint | `POST /client-config/create` |
| Base URL | `http://127.0.0.1:8000` |
| Full endpoint URL | `http://127.0.0.1:8000/client-config/create` |
| GitHub URL | `<your-repo-url>` |
| Skill path | N/A |
| Content type | application/json |
| Auth type | none |
| OpenAPI URL | `http://127.0.0.1:8000/openapi.json` |
| README for analysis | `docs/expedia/README-SERVICE-NO-LLM.md` (copy to root for GitHub sync) |

**Alternate non-LLM endpoint:**

| Field | Value |
|-------|-------|
| Endpoint | `GET /compatibility/jpmc-config` |
| Full endpoint URL | `http://127.0.0.1:8000/compatibility/jpmc-config` |

---

## GitHub Sync Notes

Expedia's GitHub fetcher (`github_client.py`) **only reads repo root**:

- `README.md` (exact name — NOT `ReadMe.md`)
- `SKILL.md` (if skill — currently in `.claude/skills/`, not root)
- `CLAUDE.md` (optional)

**Subfolders and source code are NOT fetched from GitHub.**

For skill evaluation via GitHub URL, either:
- Copy `.claude/skills/kyc-techspec/SKILL.md` to repo root, OR
- Use **local folder path** in Expedia onboarding (recommended — includes `references/`)

For service evaluation, copy the type-specific README to root before GitHub sync, or paste content into root `README.md`.

---

## Validation Checklist

### Skill (SKILL.md)

- [x] Frontmatter: name, description (third-person), allowed-tools, version
- [x] ≥2 quoted trigger phrases in description
- [x] ≥3 steps using `## Step N:` format (6 steps)
- [x] `## Implementation Rules` section with numbered/bulleted rules
- [x] No "you should/must/can" in body (imperative voice)
- [x] ~1500+ words in SKILL.md body
- [x] Every references/*.md filename mentioned in SKILL.md body
- [x] Expected output file paths in backticks

### Service LLM (README)

- [x] Target endpoint: `POST /chatbot/chat`
- [x] Request/response field tables match `Backend/Routers/chatbot.py`
- [x] Quality Guarantees: Relevancy, Groundedness, Completeness, Faithfulness
- [x] Auth documented (none)
- [x] Error response format documented (`detail` key)
- [x] OpenAPI location documented
- [x] Models listed (gpt-4o-08-06, embedding deployment)
- [x] Multi-agent orchestration documented
- [x] RAG pipeline documented

### Service Non-LLM (README)

- [x] Target endpoint: `POST /client-config/create`
- [x] Strict request/response JSON schema
- [x] All required response fields listed
- [x] Error handling (400/500 with `detail`)
- [x] Latency SLA (<1000ms)
- [x] No LLM/agent language in architecture
- [x] OpenAPI `required` arrays documented (with gap note)

---

## Gaps & Recommendations

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| No root `SKILL.md` | GitHub skill sync won't find skill file | Use local skill path `.claude/skills/kyc-techspec/` in Expedia UI, or copy SKILL.md to root |
| `client_config.py` uses `dict = Body(...)` | OpenAPI missing `required` arrays for schema_conformance | Add Pydantic `ClientConfigRequest` / `ClientConfigResponse` models |
| `/chatbot/chat` returns untyped dict | OpenAPI may not mark response fields as required | Add Pydantic response model `ChatResponse` with Field annotations |
| Hardcoded Windows env path in some routers | Import may fail on non-Windows dev machines | Fix `env_path` in `chatbot.py` and `compatibility.py` to use relative `keys.env` |
| `pyautogen` not in `requirements.txt` | Router import may skip chatbot on fresh install | Add `pyautogen` to `Backend/requirements.txt` |
| No bearer auth | Production deployment undocumented | Document auth as `none` for eval; add middleware note for production |
| OpenAPI not served from GitHub | Expedia needs running service | Start backend before evaluation; verify `/openapi.json` is reachable |
| `ReadMe.md` was previous name | GitHub sync fails on wrong casing | Fixed: root file is `README.md` |

### OpenAPI Enhancement (Recommended for Running Service)

Add to `Backend/Routers/client_config.py`:

```python
class ClientConfigRequest(BaseModel):
    client_name: str
    assigned_to: str = ""
    services: list[str] = []
    environment: str = ""
    system_type: str = ""
    legacy_present: bool = False
    llm_fallback: bool = False
    industry: str = ""
    priority: str = ""

class ClientConfigResponse(BaseModel):
    client_id: str
    client_name: str
    assigned_to: str
    product: str
    services: list[str]
    environment: str
    system_type: str
    legacy_present: bool
    llm_fallback: bool
    industry: str
    priority: str
    created_at: str
    updated_at: str
```

Add to `Backend/Routers/chatbot.py`:

```python
class ChatResponse(BaseModel):
    answer: str
    type: str
    diagnosis: str
    rootCause: str
    confidence: str
    persona_used: str
    rag_used: bool
    fallback_used: bool
```

Then set `response_model=ChatResponse` on the `@router.post("/chat")` decorator.

---

## Suggested Test Prompts by Type

### Service LLM

- "What are the steps to onboard a new API client?"
- "Why am I getting a 401 Unauthorized error during token exchange?"
- "What certifications does Cortexa hold?"

### Service Non-LLM

- Request: `{"client_name": "Test Corp", "environment": "Sandbox"}`
- Request: `{}` (expect 400)
- GET `/compatibility/jpmc-config` (expect `jpmc_config.product_name: "Cortexa"`)

### Skill

- "Troubleshoot Cortexa API integration issues for client Meridian Global Payments"
- "Analyze KYC onboarding documentation and verify RAG indexing coverage"
