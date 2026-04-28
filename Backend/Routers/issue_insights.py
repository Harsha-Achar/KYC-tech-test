from __future__ import annotations

from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import APIRouter, Body, HTTPException, Query
from openai import AzureOpenAI

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
ISSUES_PATH = PROJECT_ROOT / "issues.json"
INSIGHTS_PATH = PROJECT_ROOT / "insights.json"
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


def _utc_now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _parse_iso(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    raw = value.strip()
    try:
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        return datetime.fromisoformat(raw)
    except Exception:
        return None


def _normalize_status(status: Any) -> str:
    value = str(status or "OPEN").strip().upper().replace(" ", "_")
    if value in {"RESOLVED", "CLOSED", "SUCCESS"}:
        return "CLOSED"
    if value in {"FAILED", "FAILED_RESOLUTION", "ESCALATED"}:
        return "FAILED"
    return "OPEN"


def _load_issues_data() -> dict[str, Any]:
    if not ISSUES_PATH.exists():
        return {"clients": []}
    with open(ISSUES_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict) and isinstance(data.get("clients"), list):
        return data
    return {"clients": []}


def _load_insights_data() -> dict[str, Any]:
    if not INSIGHTS_PATH.exists():
        return {"clients": []}
    with open(INSIGHTS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict) and isinstance(data.get("clients"), list):
        return data
    return {"clients": []}


def _save_insights_data(data: dict[str, Any]) -> None:
    with open(INSIGHTS_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _issue_history_to_text(issue: dict[str, Any]) -> str:
    history = issue.get("history", [])
    if not isinstance(history, list):
        return ""
    rows: list[str] = []
    for entry in history:
        if not isinstance(entry, dict):
            continue
        user_text = str(entry.get("user_input") or "").strip()
        bot_text = str(entry.get("bot_response") or "").strip()
        if user_text:
            rows.append(f"User: {user_text}")
        if bot_text:
            rows.append(f"Bot: {bot_text}")
    return "\n".join(rows)


def _extract_client_issues(client_obj: dict[str, Any]) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    for user in client_obj.get("users", []):
        if not isinstance(user, dict):
            continue
        for issue in user.get("issues", []):
            if isinstance(issue, dict):
                issues.append(issue)
    return issues


def _collect_issue_timestamps(issue: dict[str, Any]) -> list[datetime]:
    values: list[datetime] = []
    for key in ("created_at", "last_updated", "resolved_at"):
        parsed = _parse_iso(issue.get(key))
        if parsed:
            values.append(parsed)
    history = issue.get("history", [])
    if isinstance(history, list):
        for item in history:
            if not isinstance(item, dict):
                continue
            parsed = _parse_iso(item.get("timestamp"))
            if parsed:
                values.append(parsed)
    return values


def _aggregate_client_summary(client_name: str, issues: list[dict[str, Any]]) -> dict[str, Any]:
    start_dt: datetime | None = None
    last_dt: datetime | None = None
    status_counts = {"open": 0, "closed": 0, "failed": 0}

    for issue in issues:
        status = _normalize_status(issue.get("status"))
        if status == "CLOSED":
            status_counts["closed"] += 1
        elif status == "FAILED":
            status_counts["failed"] += 1
        else:
            status_counts["open"] += 1

        for dt in _collect_issue_timestamps(issue):
            if start_dt is None or dt < start_dt:
                start_dt = dt
            if last_dt is None or dt > last_dt:
                last_dt = dt

    if status_counts["failed"] > 0:
        overall_status = "FAILED"
    elif status_counts["open"] > 0:
        overall_status = "IN_PROGRESS"
    elif issues:
        overall_status = "CLOSED"
    else:
        overall_status = "NO_ISSUES"

    return {
        "client_name": client_name,
        "start_date": start_dt.isoformat().replace("+00:00", "Z") if start_dt else None,
        "last_updated": last_dt.isoformat().replace("+00:00", "Z") if last_dt else None,
        "overall_status": overall_status,
        "total_issues": len(issues),
        "status_breakdown": status_counts,
    }


def _build_hash_payload(client_name: str, issues: list[dict[str, Any]]) -> str:
    compact: list[dict[str, Any]] = []
    for issue in issues:
        compact.append(
            {
                "issue_id": issue.get("issue_id"),
                "status": issue.get("status"),
                "issue_summary": issue.get("issue_summary"),
                "issue_type": issue.get("issue_type"),
                "sub_issue_type": issue.get("sub_issue_type"),
                "resolution": issue.get("resolution"),
                "created_at": issue.get("created_at"),
                "last_updated": issue.get("last_updated"),
                "history": issue.get("history"),
            }
        )
    material = {"client_name": client_name, "issues": compact}
    encoded = json.dumps(material, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def _prepare_llm_input(client_name: str, summary: dict[str, Any], issues: list[dict[str, Any]]) -> dict[str, Any]:
    issue_rows: list[dict[str, Any]] = []
    for issue in issues:
        issue_rows.append(
            {
                "issue_id": issue.get("issue_id"),
                "status": issue.get("status", "OPEN"),
                "issue_type": issue.get("issue_type"),
                "root_cause": issue.get("sub_issue_type"),
                "issue_summary": issue.get("issue_summary"),
                "created_at": issue.get("created_at"),
                "last_updated": issue.get("last_updated"),
                "resolution": issue.get("resolution"),
                "history_text": _issue_history_to_text(issue),
            }
        )
    return {
        "client_name": client_name,
        "client_summary": summary,
        "issues": issue_rows,
    }


def _generate_sections_with_llm(prompt_data: dict[str, Any]) -> dict[str, str]:
    prompt = f"""
You are an AI assistant generating a client-level issue insights report for internal operations teams.

Use only the provided data. Do not invent facts, causes, or solutions.

Return STRICT JSON with this exact shape:
{{
  "issue_overview": "paragraph text",
  "root_cause_analysis": "paragraph text",
  "business_impact": "paragraph text",
  "suggested_resolution": "paragraph text"
}}

Instructions:
- Write concise professional paragraphs.
- No markdown.
- No bullet points.
- Suggested Resolution must summarize only fixes/actions that already appear in the issue data/history.

Client Dataset:
{json.dumps(prompt_data, ensure_ascii=False)}
"""

    response = openai_client.chat.completions.create(
        model=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
        messages=[
            {"role": "system", "content": "You generate factual client-level issue insights in strict JSON."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
    )
    raw = (response.choices[0].message.content or "").strip()
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise ValueError("LLM response is not a JSON object.")

    def _to_text(key: str) -> str:
        value = parsed.get(key, "")
        return str(value).strip()

    return {
        "issue_overview": _to_text("issue_overview"),
        "root_cause_analysis": _to_text("root_cause_analysis"),
        "business_impact": _to_text("business_impact"),
        "suggested_resolution": _to_text("suggested_resolution"),
    }


def _build_full_report_text(sections: dict[str, str]) -> str:
    return (
        "1. Issue Overview\n"
        f"{sections.get('issue_overview', '').strip()}\n\n"
        "2. Root Cause Analysis\n"
        f"{sections.get('root_cause_analysis', '').strip()}\n\n"
        "3. Business Impact\n"
        f"{sections.get('business_impact', '').strip()}\n\n"
        "4. Suggested Resolution\n"
        f"{sections.get('suggested_resolution', '').strip()}"
    ).strip()


def _create_fallback_sections(summary: dict[str, Any]) -> dict[str, str]:
    total = summary.get("total_issues", 0)
    breakdown = summary.get("status_breakdown", {})
    return {
        "issue_overview": (
            f"The client currently has {total} tracked issues. "
            f"Open: {breakdown.get('open', 0)}, Closed: {breakdown.get('closed', 0)}, Failed: {breakdown.get('failed', 0)}."
        ),
        "root_cause_analysis": "Root causes should be reviewed from issue-level records where LLM classification captured issue type and likely cause.",
        "business_impact": "Business impact varies by issue severity and status; unresolved and failed issues likely affect client operations and support load.",
        "suggested_resolution": "Use the suggested fixes already present in issue histories, prioritize failed issues first, then close open items with validated remediation.",
    }


def _sync_insights(force: bool = False, target_client: str | None = None) -> tuple[dict[str, Any], int]:
    issues_data = _load_issues_data()
    existing_data = _load_insights_data()
    existing_by_client: dict[str, dict[str, Any]] = {}
    for row in existing_data.get("clients", []):
        if isinstance(row, dict):
            key = str(row.get("client_name") or "").strip()
            if key:
                existing_by_client[key] = row

    target_norm = (target_client or "").strip().lower()
    next_rows: list[dict[str, Any]] = []
    changed_count = 0

    for client_obj in issues_data.get("clients", []):
        if not isinstance(client_obj, dict):
            continue
        client_name = str(client_obj.get("client_name") or "Unknown Client").strip()
        if target_norm and client_name.lower() != target_norm:
            existing = existing_by_client.get(client_name)
            if existing:
                next_rows.append(existing)
            continue

        issues = _extract_client_issues(client_obj)
        summary = _aggregate_client_summary(client_name, issues)
        source_hash = _build_hash_payload(client_name, issues)
        existing = existing_by_client.get(client_name)

        should_regenerate = force or not existing or existing.get("source_hash") != source_hash
        if should_regenerate:
            llm_input = _prepare_llm_input(client_name, summary, issues)
            try:
                sections = _generate_sections_with_llm(llm_input)
                generation_error = None
            except Exception as exc:
                sections = _create_fallback_sections(summary)
                generation_error = str(exc)

            report_text = _build_full_report_text(sections)
            issue_ids = [str(i.get("issue_id") or "") for i in issues if isinstance(i, dict)]
            updated_row = {
                **summary,
                "issue_ids": issue_ids,
                "report_sections": sections,
                "report_text": report_text,
                "source_hash": source_hash,
                "last_generated_at": _utc_now_iso(),
                "generation_error": generation_error,
            }
            next_rows.append(updated_row)
            changed_count += 1
        else:
            next_rows.append(existing)

    next_rows.sort(key=lambda x: str(x.get("client_name") or "").lower())
    final_data = {"clients": next_rows}
    _save_insights_data(final_data)
    return final_data, changed_count


def _find_client_row(data: dict[str, Any], client_name: str) -> dict[str, Any] | None:
    target = client_name.strip().lower()
    for row in data.get("clients", []):
        if not isinstance(row, dict):
            continue
        if str(row.get("client_name") or "").strip().lower() == target:
            return row
    return None


@router.get("/clients")
def get_client_summary_metadata(refresh: bool = Query(True)):
    data, changed = _sync_insights(force=False) if refresh else (_load_insights_data(), 0)
    rows = []
    for row in data.get("clients", []):
        if not isinstance(row, dict):
            continue
        rows.append(
            {
                "client_name": row.get("client_name"),
                "start_date": row.get("start_date"),
                "last_updated": row.get("last_updated"),
                "overall_status": row.get("overall_status"),
                "total_issues": row.get("total_issues"),
                "status_breakdown": row.get("status_breakdown"),
                "last_generated_at": row.get("last_generated_at"),
            }
        )
    return {"changed_clients": changed, "clients": rows}


@router.get("/insights")
def get_client_insights_data(refresh: bool = Query(True)):
    data, changed = _sync_insights(force=False) if refresh else (_load_insights_data(), 0)
    return {"changed_clients": changed, "clients": data.get("clients", [])}


@router.get("/report/{client_name}")
def get_client_report(client_name: str, refresh: bool = Query(True)):
    if refresh:
        data, _changed = _sync_insights(force=False, target_client=client_name)
    else:
        data = _load_insights_data()
    row = _find_client_row(data, client_name)
    if not row:
        raise HTTPException(status_code=404, detail=f"Client '{client_name}' not found in insights.")
    return {
        "client_name": row.get("client_name"),
        "start_date": row.get("start_date"),
        "last_updated": row.get("last_updated"),
        "overall_status": row.get("overall_status"),
        "total_issues": row.get("total_issues"),
        "status_breakdown": row.get("status_breakdown"),
        "report_sections": row.get("report_sections", {}),
        "report_text": row.get("report_text", ""),
        "last_generated_at": row.get("last_generated_at"),
        "generation_error": row.get("generation_error"),
    }


@router.post("/refresh")
def refresh_insights(payload: dict[str, Any] = Body(default={})):
    target_client = str(payload.get("client_name") or "").strip() or None
    force = bool(payload.get("force", False))
    data, changed = _sync_insights(force=force, target_client=target_client)
    if target_client and not _find_client_row(data, target_client):
        raise HTTPException(status_code=404, detail=f"Client '{target_client}' not found in issues data.")
    return {"ok": True, "changed_clients": changed, "clients": data.get("clients", [])}
