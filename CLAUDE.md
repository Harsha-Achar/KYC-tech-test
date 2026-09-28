# CLAUDE.md — KYC-TechSpec Project Conventions

## Project Summary

KYC-TechSpec (Affine TechSpec) is a FinTech integration support workspace. React frontend + FastAPI backend with multi-agent RAG chat, document ingestion, compatibility analysis, and issue tracking.

## Folder Structure

```
KYC-TechSpec/
├── Backend/
│   ├── main.py              # FastAPI entry, router registration
│   ├── keys.env             # Azure credentials (not committed)
│   ├── requirements.txt     # Python dependencies
│   ├── Routers/             # API route modules
│   ├── Input/               # Reference DOCX documents
│   ├── issues.json          # Issue store
│   └── conversation.json    # Chat thread history
├── Frontend/
│   ├── src/pages/           # Route pages (AITroubleshooter, etc.)
│   ├── src/components/      # Reusable UI components
│   └── vite.config.ts       # Dev proxy → port 8000
├── .claude/skills/kyc-techspec/  # Expedia skill evaluation package
└── docs/expedia/            # Type-specific README copies
```

## Running Locally

### Backend (port 8000)

```bash
cd Backend
# Create keys.env with Azure OpenAI, Search, Blob credentials
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend (port 5174)

```bash
cd Frontend
npm install
npm run dev
```

## Key Conventions

- Routers live in `Backend/Routers/` — one file per domain, registered in `main.py`
- Environment loaded from `Backend/keys.env` via `python-dotenv`
- Routers use graceful skip on import failure (`include_router_if_available`)
- FastAPI errors return `{"detail": "message"}` shape
- Chat endpoint uses `multipart/form-data`, not JSON
- Client config endpoint uses `application/json`
- Issue types: `GENERAL`, `INTEGRATION`, `ISSUE` (uppercase in responses)

## API Documentation

Full API spec is in root `README.md` and type-specific copies:

- **Service LLM:** `docs/expedia/README-SERVICE-LLM.md`
- **Service Non-LLM:** `docs/expedia/README-SERVICE-NO-LLM.md`
- **Skill workflow:** `.claude/skills/kyc-techspec/SKILL.md`

OpenAPI (live service only): `http://127.0.0.1:8000/openapi.json`

## Expedia Evaluation Paths

This repo supports three Expedia evaluation types:

| Type | Primary artifact | Target endpoint |
|------|-----------------|-----------------|
| Skill | `.claude/skills/kyc-techspec/SKILL.md` | N/A (workflow) |
| Service LLM | `docs/expedia/README-SERVICE-LLM.md` | `POST /chatbot/chat` |
| Service Non-LLM | `docs/expedia/README-SERVICE-NO-LLM.md` | `POST /client-config/create` |

See `docs/expedia/ONBOARDING.md` for MetadataStep values.

## Do Not

- Commit `Backend/keys.env` or any secrets
- Assume auth is enabled — local dev has none
- Document endpoints not present in `Backend/Routers/` source
- Use `ReadMe.md` — GitHub sync requires exactly `README.md`
