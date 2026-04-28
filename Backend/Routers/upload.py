from fastapi import APIRouter, UploadFile, File, HTTPException, Form, BackgroundTasks
from fastapi.responses import StreamingResponse
from azure.storage.blob import BlobServiceClient
import os
import io
import mimetypes
from datetime import datetime, timezone
from Routers import chatbot

router = APIRouter()
DOCUMENTS_PREFIX = "documents/"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _get_blob_settings() -> tuple[str, str]:
    # Support both naming schemes (repo env file uses AZURE_BLOB_*)
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


def _get_container_client():
    connection_string, container_name = _get_blob_settings()
    blob_service_client = BlobServiceClient.from_connection_string(connection_string)
    return blob_service_client.get_container_client(container_name)


def _blob_name_from_file(file_name: str) -> str:
    safe_name = os.path.basename((file_name or "").strip())
    if not safe_name:
        raise HTTPException(status_code=400, detail="Invalid file_name")
    return f"{DOCUMENTS_PREFIX}{safe_name}"


def _to_list_item(blob) -> dict:
    meta = blob.metadata or {}
    uploaded_at = (meta.get("uploadedat") or "").strip()
    if not uploaded_at:
        uploaded_at = blob.last_modified.isoformat() if getattr(blob, "last_modified", None) else ""
    file_name = blob.name.removeprefix(DOCUMENTS_PREFIX)
    return {
        "file_name": file_name,
        "uploaded_by": (meta.get("uploadedby") or "").strip() or "team@affine.ai",
        "uploaded_at": uploaded_at,
        "blob_path": blob.name,
        "status": "Uploaded",
    }

@router.post("/")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    tag: str = Form(""),
    uploadedBy: str = Form(""),
):
    container_client = _get_container_client()
    content = await file.read()

    blob_name = _blob_name_from_file(file.filename)
    blob_client = container_client.get_blob_client(blob_name)
    guessed_content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"

    # Store a few fields as metadata for the UI "Upload history".
    # Azure metadata values must be strings and keys must be lowercase.
    blob_client.upload_blob(
        content,
        overwrite=True,
        metadata={
            "tag": (tag or ""),
            "uploadedby": (uploadedBy or ""),
            "uploadedat": _utc_now_iso(),
        },
        content_type=guessed_content_type,
    )

    def _index_job():
        try:
            chatbot.index_bytes(filename=file.filename, content=content)
        except Exception:
            # Don't fail the upload request if indexing fails.
            return

    background_tasks.add_task(_index_job)

    return {
        "message": "File uploaded successfully",
        "filename": blob_name,
        "indexingStarted": True,
    }


@router.get("/")
def list_uploads():
    """
    Returns blobs in the configured container in a UI-friendly shape.
    """
    container_client = _get_container_client()

    items = []
    for b in container_client.list_blobs(name_starts_with=DOCUMENTS_PREFIX, include=["metadata"]):
        item = _to_list_item(b)
        items.append(
            {
                "id": item["blob_path"],
                "fileName": item["file_name"],
                "tag": (b.metadata or {}).get("tag") or "—",
                "uploadedBy": item["uploaded_by"] or "—",
                "uploadDate": item["uploaded_at"],
                "status": item["status"],
            }
        )

    # newest first
    items.sort(key=lambda x: x.get("uploadDate") or "", reverse=True)
    return items


@router.get("/documents/list")
def list_documents():
    container_client = _get_container_client()
    rows = []
    for b in container_client.list_blobs(name_starts_with=DOCUMENTS_PREFIX, include=["metadata"]):
        rows.append(_to_list_item(b))
    rows.sort(key=lambda x: x.get("uploaded_at") or "", reverse=True)
    return rows


def _open_document_blob(file_name: str):
    container_client = _get_container_client()
    blob_name = _blob_name_from_file(file_name)
    blob_client = container_client.get_blob_client(blob_name)
    if not blob_client.exists():
        raise HTTPException(status_code=404, detail=f"Document '{file_name}' not found")
    stream = blob_client.download_blob()
    data = stream.readall()
    props = blob_client.get_blob_properties()
    content_type = (
        getattr(getattr(props, "content_settings", None), "content_type", None)
        or mimetypes.guess_type(file_name)[0]
        or "application/octet-stream"
    )
    return data, content_type


@router.get("/documents/view/{file_name:path}")
def view_document(file_name: str):
    data, content_type = _open_document_blob(file_name)
    safe_name = os.path.basename(file_name)
    headers = {"Content-Disposition": f'inline; filename="{safe_name}"'}
    return StreamingResponse(io.BytesIO(data), media_type=content_type, headers=headers)


@router.get("/documents/download/{file_name:path}")
def download_document(file_name: str):
    data, content_type = _open_document_blob(file_name)
    safe_name = os.path.basename(file_name)
    headers = {"Content-Disposition": f'attachment; filename="{safe_name}"'}
    return StreamingResponse(io.BytesIO(data), media_type=content_type, headers=headers)


@router.put("/documents/replace/{file_name:path}")
async def replace_document(
    file_name: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    uploadedBy: str = Form(""),
):
    container_client = _get_container_client()
    blob_name = _blob_name_from_file(file_name)
    blob_client = container_client.get_blob_client(blob_name)
    if not blob_client.exists():
        raise HTTPException(status_code=404, detail=f"Document '{file_name}' not found")

    current_meta = (blob_client.get_blob_properties().metadata or {})
    content = await file.read()
    guessed_content_type = file.content_type or mimetypes.guess_type(file_name)[0] or "application/octet-stream"

    blob_client.upload_blob(
        content,
        overwrite=True,
        metadata={
            "tag": current_meta.get("tag", ""),
            "uploadedby": (uploadedBy or current_meta.get("uploadedby") or ""),
            "uploadedat": _utc_now_iso(),
        },
        content_type=guessed_content_type,
    )

    def _index_job():
        try:
            chatbot.index_bytes(filename=os.path.basename(file_name), content=content)
        except Exception:
            return

    background_tasks.add_task(_index_job)
    return {
        "ok": True,
        "file_name": os.path.basename(file_name),
        "blob_path": blob_name,
        "status": "Uploaded",
        "message": "Document replaced successfully",
    }


@router.delete("/documents/delete/{file_name:path}")
def delete_document(file_name: str):
    container_client = _get_container_client()
    blob_name = _blob_name_from_file(file_name)
    blob_client = container_client.get_blob_client(blob_name)
    if not blob_client.exists():
        raise HTTPException(status_code=404, detail=f"Document '{file_name}' not found")
    blob_client.delete_blob()
    return {"ok": True, "file_name": os.path.basename(file_name), "blob_path": blob_name, "message": "Document deleted successfully"}