import json
import logging
import mimetypes
import os
import smtplib
import ssl
from email.message import EmailMessage
from pathlib import Path
from typing import Any

from azure.storage.blob import BlobServiceClient
from dotenv import load_dotenv
from fastapi import APIRouter, Body, HTTPException
from openai import AzureOpenAI

router = APIRouter()
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent.parent
ENV_PATH = BASE_DIR.parent / "keys.env"
load_dotenv(ENV_PATH, override=False)

openai_client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
)

DEFAULT_SENDER = "sowmya.sri@affine.ai"
DEFAULT_RECIPIENT = "sowmya.sri0112@gmail.com"
DEFAULT_CLIENT_NAME = "Annex Analytics"
DEFAULT_PRODUCT_NAME = "Cortexa"
DOCUMENTS_PREFIX = "documents/"
ALLOWED_ATTACHMENT_EXTENSIONS = {".pdf", ".docx"}


def _normalize_signature(body: str) -> str:
    normalized = body or ""
    normalized = normalized.replace("Best regards, JPMC Support Team", "Best regards,\nJPMC Support Team")
    normalized = normalized.replace("Best regards , JPMC Support Team", "Best regards,\nJPMC Support Team")
    return normalized


def _generate_onboarding_email_content(client_name: str, product_name: str) -> dict[str, str]:
    prompt = f"""
You are drafting a professional onboarding email for enterprise API integration.

Return STRICT JSON only:
{{
  "subject": "email subject",
  "body": "email body"
}}

Requirements:
- Greet the client by name.
- Mention we see they are trying to integrate {product_name}.
- Say "we are here to ensure a smooth integration".
- Mention that attached documents will help with setup and integration.
- Say: "In case you get any errors or get stuck anywhere, please refer to the attached documents or connect with our chatbot to guide you."
- Close with: "Best regards, JPMC Support Team"
- Keep tone professional and concise.
- 5 to 8 lines in body.
- Do NOT include placeholders like [Your Name], [Title], [Company], [Email], [Phone].
- Do NOT ask about target environment or go-live timeline.

Client Name: {client_name}
Product Name: {product_name}
""".strip()

    fallback = {
        "subject": f"Welcome to {product_name} Integration ",
        "body": (
            f"Hi {client_name} Team,\n\n"
            f"Welcome, and thank you for beginning your {product_name} integration journey.\n"
            f"We are here to ensure a smooth integration.\n"
            "Please find the attached documents which will help guide your setup and integration.\n"
            "In case you get any errors or get stuck anywhere, please refer to the attached documents "
            "or connect with our chatbot to guide you.\n\n"
            "Best regards,\nJPMC Support Team"
        ),
    }

    try:
        response = openai_client.chat.completions.create(
            model=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
            messages=[
                {"role": "system", "content": "Return strict JSON only."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
        )
        raw = (response.choices[0].message.content or "").strip()
        parsed = json.loads(raw)
        subject = str(parsed.get("subject") or "").strip()
        body = str(parsed.get("body") or "").strip()
        if not subject or not body:
            return fallback
        return {"subject": subject, "body": _normalize_signature(body)}
    except Exception as exc:
        logger.exception("Failed to generate onboarding email content via LLM: %s", exc)
        return fallback


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


def _get_container_client():
    connection_string, container_name = _get_blob_settings()
    blob_service_client = BlobServiceClient.from_connection_string(connection_string)
    return blob_service_client.get_container_client(container_name)


def _get_blob_attachments() -> list[tuple[str, bytes]]:
    container_client = _get_container_client()
    attachments: list[tuple[str, bytes]] = []
    seen_names: set[str] = set()

    blobs = container_client.list_blobs(name_starts_with=DOCUMENTS_PREFIX, include=["metadata"])
    for blob in blobs:
        blob_name = blob.name or ""
        file_name = blob_name.removeprefix(DOCUMENTS_PREFIX)
        if not file_name:
            continue

        ext = Path(file_name).suffix.lower()
        if ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
            continue
        if file_name in seen_names:
            continue

        try:
            content = container_client.get_blob_client(blob_name).download_blob().readall()
            attachments.append((file_name, content))
            seen_names.add(file_name)
        except Exception as exc:
            logger.exception("Failed downloading blob attachment '%s': %s", blob_name, exc)

    if not attachments:
        logger.warning("No onboarding attachments found under '%s' for extensions %s", DOCUMENTS_PREFIX, sorted(ALLOWED_ATTACHMENT_EXTENSIONS))
    return attachments


def _attach_files(msg: EmailMessage, attachments: list[tuple[str, bytes]]) -> None:
    for filename, file_bytes in attachments:
        try:
            mime, _ = mimetypes.guess_type(filename)
            if mime:
                maintype, subtype = mime.split("/", 1)
            else:
                maintype, subtype = "application", "octet-stream"
            msg.add_attachment(file_bytes, maintype=maintype, subtype=subtype, filename=filename)
        except Exception as exc:
            logger.exception("Failed attaching file '%s': %s", filename, exc)


def _send_email(sender: str, recipient: str, subject: str, body: str, attachments: list[tuple[str, bytes]]) -> None:
    smtp_host = (os.getenv("SMTP_HOST") or "").strip()
    smtp_port = int(os.getenv("SMTP_PORT") or "587")
    smtp_username = (os.getenv("SMTP_USERNAME") or "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD") or ""
    smtp_use_tls = (os.getenv("SMTP_USE_TLS") or "true").strip().lower() in {"1", "true", "yes", "y"}
    smtp_use_ssl = (os.getenv("SMTP_USE_SSL") or "false").strip().lower() in {"1", "true", "yes", "y"}

    if not smtp_host:
        raise HTTPException(status_code=500, detail="SMTP is not configured. Set SMTP_HOST and related SMTP_* settings.")

    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = recipient
    msg["Subject"] = subject
    msg.set_content(body)
    _attach_files(msg, attachments)

    if smtp_use_ssl:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context, timeout=30) as server:
            if smtp_username and smtp_password:
                server.login(smtp_username, smtp_password)
            server.send_message(msg)
    else:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
            if smtp_use_tls:
                server.starttls(context=ssl.create_default_context())
            if smtp_username and smtp_password:
                server.login(smtp_username, smtp_password)
            server.send_message(msg)


@router.post("/onboarding-login")
async def send_onboarding_email_after_login(payload: dict[str, Any] = Body(default={})):
    role = str(payload.get("role") or "client").strip().lower()
    if role != "client":
        return {"ok": True, "skipped": True, "reason": "Role is not client."}

    sender = str(payload.get("sender") or DEFAULT_SENDER).strip() or DEFAULT_SENDER
    recipient = str(payload.get("recipient") or DEFAULT_RECIPIENT).strip() or DEFAULT_RECIPIENT
    client_name = str(payload.get("client_name") or DEFAULT_CLIENT_NAME).strip() or DEFAULT_CLIENT_NAME
    product_name = str(payload.get("product_name") or DEFAULT_PRODUCT_NAME).strip() or DEFAULT_PRODUCT_NAME

    email_content = _generate_onboarding_email_content(client_name, product_name)
    attachments = _get_blob_attachments()

    try:
        _send_email(
            sender=sender,
            recipient=recipient,
            subject=email_content["subject"],
            body=email_content["body"],
            attachments=attachments,
        )
        logger.info(
            "Onboarding email sent for client login. client=%s product=%s recipient=%s attachments=%d",
            client_name,
            product_name,
            recipient,
            len(attachments),
        )
        return {
            "ok": True,
            "sender": sender,
            "recipient": recipient,
            "client_name": client_name,
            "product_name": product_name,
            "attachments_count": len(attachments),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed sending onboarding email post-login: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to send onboarding email: {exc}") from exc
