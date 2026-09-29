# CLAUDE.md — KYC-TechSpec Project Conventions

## Project Summary

KYC-TechSpec (Affine TechSpec) is a FinTech integration support workspace. React frontend + FastAPI backend with multi-agent RAG chat, document ingestion, compatibility analysis, and issue tracking.

## Folder Structure

```
KYC-TechSpec/
├── Backend/
│   ├── main.py              # FastAPI entry, router registration
│   ├── keys.env             # Azure credentials (not committed)
│   ├── requirements.txt     # Python dependencies (pyautogen installed separately)
│   ├── Routers/             # API route modules
│   ├── Input/               # Reference DOCX documents
│   ├── issues.json          # Local issue store read by /issues/* (may differ from chat Blob store)
│   └── conversation.json    # Legacy/local copy; live chat uses Azure Blob
├── Frontend/
│   ├── src/pages/           # Route pages (ClientChatbotPage, AITroubleshooter, etc.)
│   ├── src/components/      # Reusable UI components
│   └── vite.config.ts       # Dev proxy → backend port (8001 when Expedia uses 8000)
├── .claude/skills/kyc-techspec/  # Expedia skill evaluation package
└── docs/expedia/            # Type-specific README copies
```

## Running Locally

### Backend

```bash
cd Backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install pyautogen==0.9.0
# Create keys.env with Azure OpenAI, Search, Blob credentials
uvicorn main:app --reload --host 127.0.0.1 --port 8001
```

Use port **8001** when Expedia eval backend runs on **8000**. Use **8000** for KYC-only and update `Frontend/vite.config.ts` proxy target to match.

### Frontend (port 5174)

```bash
cd Frontend
npm install
npm run dev
```

## Key Conventions

- Routers live in `Backend/Routers/` — one file per domain, registered in `main.py`
- Environment loaded from `Backend/keys.env` via `python-dotenv` in `main.py` and most routers
- `compatibility.py` and `issue_insights.py` still hardcode a Windows `keys.env` path — on macOS, export env vars in the shell or fix those paths
- Routers use graceful skip on import failure (`include_router_if_available`)
- FastAPI errors return `{"detail": "message"}` shape
- Chat endpoint uses `multipart/form-data`, not JSON
- Client config endpoint uses `application/json`
- Chat response types: `GENERAL`, `INTEGRATION`, `ISSUE` (classification); `RESOLUTION` may appear at runtime for issue persistence
- Chat model deployment comes from `AZURE_OPENAI_DEPLOYMENT_NAME`, not a hardcoded model name

## Data Stores

| Data | Primary location |
|------|------------------|
| Issues from chat | Azure Blob `Chatbot/issues.json` (written by `chatbot.py`) |
| Issues API (`GET /issues/list`) | Local `Backend/issues.json` (read by `issue.py`) |
| Conversations | Azure Blob `Chatbot/conversation.json` |
| Client configs | Azure Blob `client_data/client_configs.json` |
| Uploaded documents | Azure Blob `documents/*` |

## API Documentation

Full API spec is in root `README.md` and type-specific copies:

- **Service LLM:** `docs/expedia/README-SERVICE-LLM.md`
- **Service Non-LLM:** `docs/expedia/README-SERVICE-NO-LLM.md`
- **Skill workflow:** `.claude/skills/kyc-techspec/SKILL.md`

OpenAPI (live service only): `http://127.0.0.1:{PORT}/openapi.json` — use the port your backend runs on.

## Expedia Evaluation Paths

This repo supports three Expedia evaluation types:

| Type | Primary artifact | Target endpoint |
|------|-----------------|-----------------|
| Skill | `.claude/skills/kyc-techspec/SKILL.md` | N/A (workflow) |
| Service LLM | `docs/expedia/README-SERVICE-LLM.md` | `POST /chatbot/chat` |
| Service Non-LLM | `docs/expedia/README-SERVICE-NO-LLM.md` | `POST /client-config/create` |

When evaluating alongside Expedia, set KYC base URL to `http://127.0.0.1:8001`.

See `docs/expedia/ONBOARDING.md` for MetadataStep values.

## Do Not

- Commit `Backend/keys.env` or any secrets
- Assume auth is enabled — local dev has none
- Document endpoints not present in `Backend/Routers/` source
- Use `ReadMe.md` — GitHub sync requires exactly `README.md`
