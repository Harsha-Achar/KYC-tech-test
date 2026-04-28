from fastapi import APIRouter, HTTPException, Body
from azure.storage.blob import BlobServiceClient
import os
import json
import uuid
from datetime import datetime, timezone

router = APIRouter()

CONFIG_BLOB_PATH = "client_data/client_configs.json"


def _get_blob_settings() -> tuple[str, str]:
    connection_string = os.getenv("AZURE_BLOB_CONNECTION_STRING") or os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    container_name = os.getenv("AZURE_BLOB_CONTAINER") or os.getenv("AZURE_CONTAINER_NAME")

    if not connection_string:
        raise HTTPException(
            status_code=500,
            detail="Azure Blob connection string missing. Set AZURE_BLOB_CONNECTION_STRING in keys.env.",
        )
    if not container_name:
        raise HTTPException(
            status_code=500,
            detail="Azure Blob container name missing. Set AZURE_BLOB_CONTAINER in keys.env.",
        )
    return connection_string, container_name


def _get_blob_client():
    connection_string, container_name = _get_blob_settings()
    svc = BlobServiceClient.from_connection_string(connection_string)
    return svc.get_blob_client(container=container_name, blob=CONFIG_BLOB_PATH)


def _read_all() -> list[dict]:
    blob = _get_blob_client()
    if not blob.exists():
        return []

    raw = blob.download_blob().readall()
    if not raw:
        return []

    try:
        data = json.loads(raw.decode("utf-8"))
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _write_all(rows: list[dict]):
    blob = _get_blob_client()
    payload = json.dumps(rows, ensure_ascii=True, indent=2)
    blob.upload_blob(payload.encode("utf-8"), overwrite=True, content_type="application/json")


@router.post("/create")
def create_client_config(payload: dict = Body(...)):
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "client_id": str(uuid.uuid4()),
        "client_name": (payload.get("client_name") or "").strip(),
        "assigned_to": (payload.get("assigned_to") or "").strip(),
        "product": "Unified",
        "services": payload.get("services") or [],
        "environment": (payload.get("environment") or "").strip(),
        "system_type": (payload.get("system_type") or "").strip(),
        "legacy_present": bool(payload.get("legacy_present")),
        "llm_fallback": bool(payload.get("llm_fallback")),
        "industry": (payload.get("industry") or "").strip(),
        "priority": (payload.get("priority") or "").strip(),
        "created_at": now,
        "updated_at": now,
    }

    if not record["client_name"]:
        raise HTTPException(status_code=400, detail="client_name is required")

    rows = _read_all()
    rows.append(record)
    _write_all(rows)
    return record


@router.get("/all")
def get_all_client_configs():
    return _read_all()

