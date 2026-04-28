from fastapi import APIRouter, Body, HTTPException
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any
import uuid
from dotenv import load_dotenv
from openai import AzureOpenAI

router = APIRouter()

DATA_PATH = Path(__file__).resolve().parent.parent / "issues.json"
BASE_DIR = Path(__file__).resolve().parent
env_path = BASE_DIR / "keys.env"

load_dotenv(env_path)

openai_client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
)


def _load_data() -> dict:
    if not DATA_PATH.exists():
        return {"clients": []}
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _normalize_status(status: str) -> str:
    s = (status or "OPEN").strip().upper()
    if s in {"RESOLVED", "CLOSED"}:
        return "RESOLVED"
    if s in {"FAILED", "FAILED_RESOLUTION"}:
        return "FAILED"
    if s in {"IN_PROGRESS", "INPROGRESS"}:
        return "IN_PROGRESS"
    if s in {"ESCALATED"}:
        return "ESCALATED"
    return "OPEN"

def _display_status_from_json(status: str) -> str:
    # Keep status exactly in JSON-style enum format for frontend table.
    return (status or "OPEN").strip().upper()


def _to_ui_category(issue_type: str) -> str:
    t = (issue_type or "").lower()

    # Security / Auth
    if any(k in t for k in ["auth", "jwt", "token", "permission", "access", "signature"]):
        return "Security & Access Issues"

    # Database
    if any(k in t for k in ["database", "db", "connection", "query"]):
        return "Database Issues"

    # Retrieval / AI / Search
    if any(k in t for k in ["retrieval", "search", "embedding", "rag", "index", "chunk"]):
        return "AI / Retrieval Issues"

    # Performance / Scalability
    if any(k in t for k in ["scalability", "latency", "performance", "timeout", "delay"]):
        return "Performance & Scalability Issues"

    # Architecture / Integration
    if any(k in t for k in ["architecture", "integration", "mapping", "design"]):
        return "Integration & Architecture Issues"

    # Compliance
    if "compliance" in t:
        return "Compliance Issues"

    # File / Upload / Docs
    if any(k in t for k in ["upload", "file", "document"]):
        return "Document & File Handling Issues"

    # Default
    return "General Technical Issues"


def _flatten_issues() -> list[dict]:
    data = _load_data()
    out: list[dict] = []

    for client in data.get("clients", []):
        client_name = client.get("client_name", "Unknown Client")
        for user in client.get("users", []):
            for issue in user.get("issues", []):
                issue_type = issue.get("issue_type", "")
                out.append(
                    {
                        "id": issue.get("issue_id") or f"ISSUE_{len(out) + 1}",
                        "clientId": client_name,
                        "title": issue.get("issue_summary") or issue_type or "Issue",
                        "category": _to_ui_category(issue_type),
                        "severity": issue.get("severity", "Medium"),
                        "status": _display_status_from_json(issue.get("status", "OPEN")),
                        "rootCause": issue.get("sub_issue_type") or issue.get("issue_type") or "Unknown",
                        "rootCauseStatus": "Identified"
                        if issue.get("sub_issue_type")
                        else "Unknown",
                        "createdAt": issue.get("created_at") or datetime.utcnow().isoformat() + "Z",
                        "updatedAt": issue.get("last_updated")
                        or issue.get("created_at")
                        or datetime.utcnow().isoformat() + "Z",
                        "assignedTeam": issue.get("product_area") or "API",
                        "affectedComponent": issue.get("product_area") or "API",
                        "slaRisk": "On Track",
                        "detectedSource": "Chatbot",
                        "affectedApi": issue.get("product_area") or "API",
                        "environment": "Sandbox",
                        "confidence": 75,
                        "estimatedFixTime": "TBD",
                        "businessImpact": "TBD",
                        "technicalSummary": issue.get("issue_summary") or "",
                    }
                )
    return out


def _issue_history_to_messages(issue: dict[str, Any]) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = []
    history = issue.get("history", [])
    if not isinstance(history, list):
        return messages
    for idx, entry in enumerate(history):
        if not isinstance(entry, dict):
            continue
        ts = entry.get("timestamp") or issue.get("created_at") or datetime.utcnow().isoformat() + "Z"
        user_input = str(entry.get("user_input") or "").strip()
        bot_response = str(entry.get("bot_response") or "").strip()
        if user_input:
            messages.append(
                {
                    "id": f"{issue.get('issue_id', 'issue')}_u_{idx}",
                    "role": "user",
                    "content": user_input,
                    "timestamp": ts,
                }
            )
        if bot_response:
            messages.append(
                {
                    "id": f"{issue.get('issue_id', 'issue')}_a_{idx}",
                    "role": "assistant",
                    "content": bot_response,
                    "timestamp": ts,
                }
            )
    return messages


def _issue_to_thread(issue: dict[str, Any], client_name: str, user_id: str) -> dict[str, Any]:
    created_at = issue.get("created_at") or datetime.utcnow().isoformat() + "Z"
    updated_at = issue.get("last_updated") or created_at
    issue_id = str(issue.get("issue_id") or f"ISSUE_{uuid.uuid4().hex[:8]}")
    return {
        "id": f"issue_{issue_id}",
        "owner_role": "client",
        "owner_email": f"{user_id}@history.local",
        "client_id": client_name,
        "client_name": client_name,
        "api_product": "Unified",
        "environment": "Sandbox",
        "status": "in-progress",
        "title": issue.get("issue_summary") or issue.get("issue_type") or issue_id,
        "diagnosis": issue.get("issue_type") or "General",
        "root_cause": issue.get("sub_issue_type") or "--",
        "created_at": created_at,
        "updated_at": updated_at,
        "messages": _issue_history_to_messages(issue),
    }


def _client_issue_threads(client_name: str | None = None) -> list[dict[str, Any]]:
    data = _load_data()
    out: list[dict[str, Any]] = []
    normalized = (client_name or "").strip().lower()
    for client in data.get("clients", []):
        name = str(client.get("client_name") or "Unknown Client")
        if normalized and name.lower() != normalized:
            continue
        for user in client.get("users", []):
            user_id = str(user.get("user_id") or "default_user")
            for issue in user.get("issues", []):
                if not isinstance(issue, dict):
                    continue
                out.append(_issue_to_thread(issue, name, user_id))
    out.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
    return out


def _find_issue_by_id(issue_id: str) -> dict[str, Any] | None:
    data = _load_data()
    for client in data.get("clients", []):
        for user in client.get("users", []):
            for issue in user.get("issues", []):
                if str(issue.get("issue_id", "")).strip() == issue_id:
                    return issue
    return None


def _history_to_text(issue: dict[str, Any]) -> str:
    history = issue.get("history", [])
    if not isinstance(history, list):
        return ""
    return "\n".join(
        [
            f"User: {h.get('user_input', '')} \nBot: {h.get('bot_response', '')}"
            for h in history
            if isinstance(h, dict)
        ]
    )


def _generate_issue_report(issue_data: dict[str, Any]) -> str:
    prompt = f"""
    You are an AI system generating a formal administrative issue report.

    This report will be downloaded as a PDF and must be written in a professional documentation style.

    Write the report in clear paragraphs with proper section headings.

    Output format requirements (strict):
    - Do NOT include a report title line.
    - Do NOT include metadata lines such as Issue ID, Client Name, or Status.
    - Do NOT use markdown symbols (no #, ##, **, or bullets).
    - Use only plain text.
    - Use exactly these numbered section headings in this order:
      1. Issue Overview
      2. Root Cause Analysis
      3. Issue Progression
      4. Business Impact
      5. Suggested Resolution
      6. Current Status
    - Keep each section as paragraph text (no bullet lists).

    1. Issue Overview
    Provide a concise description of the issue and current status.

    2. Root Cause Analysis
    Explain the likely root causes based strictly on the provided data.

    3. Issue Progression
    Describe how the issue evolved over time based on the interaction history.

    4. Business Impact
    Explain the impact of this issue on the client’s operations.

    5. Suggested Resolution
    Summarize the fixes already suggested by the system (do not create new ones).

    6. Current Status
    Clearly state whether the issue is resolved or still in progress.

    Important Instructions:
    - Write in paragraph format (not bullet points)
    - Maintain a formal and professional tone
    - Do NOT invent information
    - Use only the provided data

    Issue Data:
    {issue_data}
    """
    response = openai_client.chat.completions.create(
        model=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
        messages=[
            {"role": "system", "content": "You create factual internal issue analysis reports."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
    )
    return (response.choices[0].message.content or "").strip()


@router.get("/list")
def get_issue_list():
    return _flatten_issues()


@router.get("/client-history")
def get_client_history(client_name: str | None = None):
    return _client_issue_threads(client_name)


@router.get("/category-breakdown")
def get_issue_category_breakdown():
    counts: dict[str, int] = {}
    for issue in _flatten_issues():
        category = issue.get("category") or "Other"
        counts[category] = counts.get(category, 0) + 1
    return [{"category": k, "count": v} for k, v in counts.items()]


@router.get("/status-breakdown")
def get_issue_status_breakdown():
    counts = {"OPEN": 0, "IN_PROGRESS": 0, "RESOLVED": 0, "FAILED": 0, "ESCALATED": 0}
    data = _load_data()
    for client in data.get("clients", []):
        for user in client.get("users", []):
            for issue in user.get("issues", []):
                counts[_normalize_status(issue.get("status", "OPEN"))] += 1
    return [{"status": k, "count": v} for k, v in counts.items()]


@router.get("/")
def get_issue_kpis():
    data = _load_data()

    total_open = 0
    critical = 0
    db_issues = 0
    security_issues = 0
    resolution_times = []
    reopened = 0

    for client in data.get("clients", []):
        for user in client.get("users", []):
            for issue in user.get("issues", []):
                status = _normalize_status(issue.get("status", "OPEN"))
                severity = (issue.get("severity", "") or "").lower()
                issue_type = (issue.get("issue_type", "") or "").lower()

                if status in {"OPEN", "IN_PROGRESS", "ESCALATED"}:
                    total_open += 1
                if severity == "critical":
                    critical += 1
                if "database" in issue_type:
                    db_issues += 1
                if "auth" in issue_type or "jwt" in issue_type or "security" in issue_type:
                    security_issues += 1

                if issue.get("resolved") and issue.get("resolved_at") and issue.get("created_at"):
                    try:
                        created = datetime.fromisoformat(issue["created_at"].replace("Z", ""))
                        resolved = datetime.fromisoformat(issue["resolved_at"].replace("Z", ""))
                        resolution_times.append((resolved - created).total_seconds())
                    except Exception:
                        pass

                history = issue.get("history", [])
                reopen_events = [h for h in history if h.get("event_type") == "REOPENED"]
                if reopen_events:
                    reopened += 1

    avg_resolution = (
        sum(resolution_times) / len(resolution_times) / 3600 if resolution_times else 0
    )
    return {
        "total_open_issues": total_open,
        "critical_issues": critical,
        "database_issues": db_issues,
        "security_issues": security_issues,
        "avg_resolution_time_hours": round(avg_resolution, 2),
        "reopened_issues": reopened,
    }


@router.post("/generate-issue-report")
def generate_issue_report(payload: dict = Body(...)):
    issue_id = str(payload.get("issue_id", "")).strip()
    if not issue_id:
        raise HTTPException(status_code=400, detail="Missing 'issue_id'")

    issue = _find_issue_by_id(issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail=f"Issue '{issue_id}' not found")

    history_text = _history_to_text(issue)
    resolution = issue.get("resolution") if isinstance(issue.get("resolution"), dict) else {}
    issue_data = {
        "issue_id": issue_id,
        "client_name": issue.get("client_name", "Unknown Client"),
        "issue_summary": issue.get("issue_summary", ""),
        "status": issue.get("status", "OPEN"),
        "history": history_text,
        "resolution": resolution,
    }

    try:
        report = _generate_issue_report(issue_data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {exc}") from exc

    return {
        "issue_id": issue_id,
        "client_name": issue.get("client_name", "Unknown Client"),
        "issue_summary": issue.get("issue_summary", ""),
        "status": issue.get("status", "OPEN"),
        "history": issue.get("history", []),
        "resolution": resolution,
        "report": report,
    }