from fastapi import APIRouter, UploadFile, File, HTTPException, Body, Form, Request
import os
import uuid
import json
import base64
import ssl
import smtplib
import re
import io
from pathlib import Path
from typing import Any, Dict, List
from datetime import datetime
from email.message import EmailMessage

from dotenv import load_dotenv
from openai import AzureOpenAI
from autogen import AssistantAgent, UserProxyAgent

from azure.search.documents import SearchClient
from azure.core.credentials import AzureKeyCredential
from azure.storage.blob import BlobServiceClient

try:
    from azure.search.documents.models import VectorizedQuery
except Exception:  # pragma: no cover
    VectorizedQuery = None

from PyPDF2 import PdfReader
from docx import Document

router = APIRouter()
TICKET_FROM_EMAIL = "sowmya.sri@affine.ai"
TICKET_TO_EMAIL = "sowmya.sri0112@gmail.com"

# =========================================================
# ENV / CLIENT SETUP
# =========================================================

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

search_client = SearchClient(
    endpoint=os.getenv("AZURE_SEARCH_SERVICE_ENDPOINT"),
    index_name=(os.getenv("AZURE_SEARCH_INDEX_NAME") or "tech-spec"),
    credential=AzureKeyCredential(os.getenv("AZURE_SEARCH_ADMIN_KEY")),
)

VECTOR_FIELD = os.getenv("AZURE_SEARCH_VECTOR_FIELD", "embedding")
TOP_K = int(os.getenv("AZURE_SEARCH_TOP_K", "5"))

AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION")
AZURE_OPENAI_DEPLOYMENT_NAME = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")

# LLM configuration
llm_config = {
    "config_list": [
        {
            "model": "gpt-4o-08-06",  # your deployment name
            "api_key": AZURE_OPENAI_API_KEY,
            "base_url": AZURE_OPENAI_ENDPOINT.rstrip("/"),  # ← changed
            "api_type": "azure",
            "api_version": AZURE_OPENAI_API_VERSION,
        }
    ],
    "temperature": 0.1,
    "max_completion_tokens": 8192, 
}

print("DEPLOYMENT =", AZURE_OPENAI_DEPLOYMENT_NAME)
print("ENDPOINT =", AZURE_OPENAI_ENDPOINT)
print("VERSION =", AZURE_OPENAI_API_VERSION)


# =========================================================
# EMBEDDING / INDEXING
# =========================================================


def generate_embedding(text: str):
    response = openai_client.embeddings.create(
        input=text,
        model=os.getenv("embedding_deployment"),
    )
    return response.data[0].embedding


def chunk_text(text: str, chunk_size: int = 1000) -> List[str]:
    chunks: List[str] = []
    for i in range(0, len(text), chunk_size):
        chunk = text[i : i + chunk_size].strip()
        if chunk:
            chunks.append(chunk)
    return chunks


def extract_text_from_pdf(file_bytes: bytes) -> str:
    text = ""
    reader = PdfReader(io.BytesIO(file_bytes))
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"
    return text.strip()


def extract_text_from_docx(file_bytes: bytes) -> str:
    doc = Document(io.BytesIO(file_bytes))
    return "\n".join([para.text for para in doc.paragraphs if para.text.strip()])


def index_text(*, filename: str, text: str) -> int:
    chunks = chunk_text(text)
    documents = []

    for i, chunk in enumerate(chunks):
        embedding = generate_embedding(chunk)
        documents.append(
            {
                "id": str(uuid.uuid4()),
                "content": chunk,
                "embedding": embedding,
                "file_name": filename,
                "chunk_index": i,
            }
        )

    result = search_client.upload_documents(documents)
    failed = [r for r in result if not r.succeeded]

    if failed:
        print("❌ Failed docs:", failed)
        raise Exception("Indexing failed")

    print(f"✅ Indexed {len(result)} documents")
    return len(documents)


def index_bytes(filename: str, content: bytes) -> int:
    filename_lower = filename.lower()

    if filename_lower.endswith(".pdf"):
        text = extract_text_from_pdf(content)
    elif filename_lower.endswith(".docx"):
        text = extract_text_from_docx(content)
    elif filename_lower.endswith(".txt"):
        text = content.decode("utf-8", errors="ignore")
    else:
        raise ValueError("Unsupported file type")

    if not text.strip():
        raise ValueError("No text could be extracted from file")

    return index_text(filename=filename, text=text)


@router.post("/index")
async def index_document(file: UploadFile = File(...)):
    content = await file.read()
    chunk_count = index_bytes(filename=file.filename, content=content)
    return {"message": "Document indexed successfully", "chunks": chunk_count}


# =========================================================
# AUTOGEN HELPERS
# =========================================================


def _safe_json_loads(raw: Any, default: Dict[str, Any]) -> Dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    text = str(raw or "").strip()

    if not text:
        return default

    # direct parse
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    # try extracting json object from text
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group(0))
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass

    return default


def _agent_reply_json(agent: AssistantAgent, payload: Dict[str, Any], default: Dict[str, Any]) -> Dict[str, Any]:
    try:
        raw = agent.generate_reply(
            messages=[
                {
                    "role": "user",
                    "content": json.dumps(payload, ensure_ascii=False),
                }
            ]
        )
        return _safe_json_loads(raw, default)
    except Exception as e:
        print(f"AGENT ERROR [{getattr(agent, 'name', 'unknown')}]:", str(e))
        return default


# =========================================================
# AUTOGEN AGENTS
# =========================================================

user_proxy = UserProxyAgent(
    name="user_proxy",
    system_message=(
        "You pass the user request forward without changing meaning. "
        "Always reply in strict JSON only with fields: query, persona, client_name, user_id, next_agent."
    ),
    code_execution_config={"work_dir": "chatbot_agent_workdir", "use_docker": False},
    max_consecutive_auto_reply=1,
    llm_config=None,
    human_input_mode="NEVER",
)

classification_agent = AssistantAgent(
    name="classification_agent",
    system_message="""
You classify user questions for an API integration assistant.

Return STRICT JSON only:
{
  "type": "GENERAL | INTEGRATION | ISSUE ",
  "issue_type": "short label",
  "root_cause": "short explanation",
  "confidence": "HIGH | LOW",
  "next_agent": "retriever"
}

Rules:
- GENERAL = product info, capabilities, pricing, subscription, requirements
- INTEGRATION = setup steps, onboarding, API integration guidance
- ISSUE = something broken, errors, failures and fixing a known issue or retrying steps
- For GENERAL / INTEGRATION, issue_type and root_cause may be empty strings
- Never return markdown
- Return only valid JSON
""",
    llm_config=llm_config,
    human_input_mode="NEVER",
    max_consecutive_auto_reply=1,
)

retriever = AssistantAgent(
    name="retriever",
    system_message="""
Your role is to execute the extract_context function and return only vector-search context.
Always work in strict JSON-friendly structure.
Do not use graph retrieval.
Pass the retrieved context to the next agent.
""",
    max_consecutive_auto_reply=3,
    llm_config=llm_config,
    human_input_mode="NEVER",
)


fallback_checker_agent = AssistantAgent(
    name="fallback_checker_agent",
    system_message="""
You decide whether fallback is required after retrieval.
Decision rules:
- decision = "yes" when retrieved docs are empty or not useful for the query -> next_agent fallback_answer_agent
- decision = "no" when retrieved docs are useful and should be used directly -> next_agent formatting_agent

Return STRICT JSON only:
{
    "decision": "yes | no",
    "reason": "short explanation",
    "next_agent": "fallback_answer_agent | formatting_agent"
}
""",
    llm_config=llm_config,
    human_input_mode="NEVER",
    max_consecutive_auto_reply=1,
)

fallback_answer_agent = AssistantAgent(
    name="fallback_answer_agent",
    system_message="""
You provide a safe fallback response ONLY when meaningful retrieved documentation context is unavailable.

Your role is NOT to fabricate product facts, internal policies, configurations, APIs, timelines, commitments, or unsupported claims.

You must give a useful GENERAL answer based only on:
1. the user's question
2. common best practices
3. clearly generic industry knowledge

-----------------------------------
CORE RULES
-----------------------------------

1. Never hallucinate.
2. Never pretend specific documentation exists when it does not.
3. Never mention fake product names, endpoints, credentials, certificates, pricing, timelines, or features.
4. Never state assumptions as facts.
5. If exact details are unavailable, explicitly say so.
6. Provide practical guidance that would help the user move forward.
7. If question requires product-specific information not available, recommend checking official documentation / support team.
8. Keep answer relevant to the exact user question.
9. Do not over-answer unrelated topics.
10. Stay professional and concise.

-----------------------------------
RESPONSE STYLE BY PERSONA
-----------------------------------

Business Persona:
- Use simple professional language.
- Focus on business meaning, impact, next steps.
- Use short paragraphs.
- Avoid heavy technical jargon.

Technical Persona:
- Use clear engineering language.
- Give structured troubleshooting or implementation guidance.
- Use bullets / steps where helpful.
- Include generic examples only when safe.

-----------------------------------
QUESTION TYPE RULES
-----------------------------------

If question is GENERAL:
- Provide conceptual explanation.
- Mention common scenarios.
- Mention where exact details usually come from.

If question is INTEGRATION:
- Provide standard integration checklist:
  authentication, certificates, dependencies, sandbox, testing, monitoring, go-live.
- Clearly mark that exact requirements depend on provider documentation.

If question is ISSUE:
- Provide common causes, checks, and fixes.
- Do not claim root cause unless stated.

If question is RESOLUTION:
- Provide general resolution path and validation steps.

If question requests unavailable exact values:
Examples:
- supported endpoints
- exact limits
- exact certificates for specific product
- pricing
- internal architecture

Then respond with:
"The requested exact information is not available in the retrieved context. Based on common practice..."

-----------------------------------
IMPORTANT TONE RULE
-----------------------------------

Be helpful without pretending certainty.

Bad:
"This API requires mTLS and OAuth2."

Good:
"Many enterprise APIs commonly require mTLS or OAuth2, but the exact requirement depends on the provider documentation."

-----------------------------------
OUTPUT FORMAT
-----------------------------------

Return STRICT JSON only:

{
  "answer": "safe fallback answer",
  "next_agent": "formatting_agent"
}

Return nothing else.
""",
    llm_config=llm_config,
    human_input_mode="NEVER",
    max_consecutive_auto_reply=1,
)


def _format_answer_direct(query: str, query_type: str, persona: str, retrieved_docs: str, fallback_answer: str) -> str:
    source = fallback_answer.strip() if fallback_answer.strip() else retrieved_docs.strip()
    if not source:
        return "Information not found in documentation."

    prompt = f"""You are a final response formatter for an API integration assistant.

QUERY: {query}
CLASSIFICATION TYPE: {query_type}
PERSONA: {persona}
CONTEXT:
{source[:3000]}

You will receive one of the following:
1. retrieved_docs context (primary source)
2. fallback_answer (fallback source)

Your job is to generate a polished, user-ready response using ONLY the provided input/context.

STRICT RULES:
1. Use ONLY the given context.
2. Do NOT invent, assume, infer, or hallucinate information.
3. If context is incomplete, answer only with what is available.
4. Do not generate or assume any information outside of the provided context.
5. Your role is to generate the detailed answer for the given question using only the retriever context.
6. Never create answers independently without context.
7. Avoid guessing.
8. Remove duplicate content, noisy formatting, markdown clutter, random symbols.
9. Keep all important factual content from input.
10. Response should feel natural, polished, professional, and complete.
- Convert long text blocks into clean sections
- Every major topic gets heading
- Lists must be on separate lines
- No inline bullets inside paragraphs
- Max paragraph = 4 lines
- Use spacing between sections
- Rewrite robotic closing lines naturally

-----------------------------------
PERSONA RULES
-----------------------------------

You may receive persona metadata:

1. Business Persona
- Usually GENERAL type questions.
- Audience: business users, managers, non-technical stakeholders.
- Explain in clear professional paragraphs.
- Use natural flow.
- If multiple sections, leave blank lines between paragraphs.
- Avoid excessive bullets unless truly needed.
- Focus on meaning, value, impact, summary.

2. Technical Persona
- Usually INTEGRATION / ISSUE / RESOLUTION type questions.
- Audience: developers, engineers, architects.
- Use structured response.
- Explain first with a short starter paragraph.
- Then provide steps / bullets / code snippets where relevant.
- Keep code blocks clean and separate.
- Troubleshooting should be practical and direct.

-----------------------------------
FORMATTING RULES
-----------------------------------

IMPORTANT:
Do NOT start answers immediately with:
1.
2.
3.

Always begin with a short natural opening sentence based on the user's question.

Examples:
- To integrate this API, you need to complete the following setup steps.
- Based on the available documentation, the issue is usually caused by the following factors.
- This product supports multiple authentication methods depending on your environment.

Then continue with steps / explanation.

GENERAL TYPE:
- Use paragraph style.
- If needed, small bullets allowed.
- Keep readable spacing.

INTEGRATION TYPE:
- Start with intro line.
- Then numbered implementation steps.
- Include dependencies, certificates, setup sequence, sample payloads if present in context.

ISSUE TYPE:
- Start with summary line.
- Then likely causes.
- Then fixes.
- Then validation steps.

RESOLUTION TYPE:
- Start with outcome statement.
- Then exact resolution steps.

CODE RULES:
- If context contains code/config/API payloads, format cleanly.
- Never merge code inside paragraphs.
- Put code in separate fenced blocks.

MISSING CONTEXT RULE:
If insufficient information exists in context, say:
"The provided context does not contain enough information to fully answer this request."

-----------------------------------
OUTPUT FORMAT
-----------------------------------

Return STRICT JSON only:

{{
  "formatted_answer": "final polished response",
  "next_agent": "end"
}}"""

    try:
        response = openai_client.chat.completions.create(
            model=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
            messages=[
                {"role": "system", "content": "You are a response formatter. Return only valid JSON."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_completion_tokens=4096,
        )
        raw = response.choices[0].message.content or ""
        raw = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        parsed = json.loads(raw)
        return str(parsed.get("formatted_answer") or source).strip()
    except Exception as e:
        print("FORMAT DIRECT ERROR:", str(e))
        return source



@retriever.register_for_execution()
@retriever.register_for_llm(
    description="Retrieve relevant context from the vector database only by executing the extract_context function."
)
async def extract_context(question: str = None) -> dict:
    if not question:
        return {
            "vector_context": {"chunks": [], "sources": []},
            "next_agent": "fallback_checker_agent",
        }

    try:
        if VectorizedQuery is None:
            return {
                "vector_context": {"chunks": [], "sources": []},
                "error": "VectorizedQuery unavailable",
                "next_agent": "fallback_checker_agent",
            }

        vector_query = VectorizedQuery(
            vector=generate_embedding(question),
            k_nearest_neighbors=TOP_K,
            fields=VECTOR_FIELD,
        )

        # Pull a larger candidate window, then enforce source diversity so
        # one document cannot dominate all returned chunks.
        candidate_window = max(TOP_K * 8, 30)
        results = search_client.search(
            search_text=None,
            vector_queries=[vector_query],
            top=candidate_window,
        )

        candidates: List[Dict[str, Any]] = []
        for result in results:
            payload = result if isinstance(result, dict) else dict(result)
            content = str(payload.get("content", "")).strip()
            source = str(payload.get("sourcepage") or payload.get("file_name") or "").strip()
            if not content:
                continue
            score = float(payload.get("@search.score") or 0.0)
            candidates.append({"source": source, "content": content, "score": score})

        if not candidates:
            return {
                "vector_context": {"chunks": [], "sources": []},
                "next_agent": "fallback_checker_agent",
            }

        # Lightweight keyword boost helps route certification questions toward
        # certification-related docs when available in indexed sources/content.
        q = question.lower()
        cert_query = any(k in q for k in ["certification", "certificate", "certificates", "compliance", "iso", "soc"])
        if cert_query:
            for item in candidates:
                source_lower = item["source"].lower()
                content_head = item["content"][:400].lower()
                if any(k in source_lower for k in ["cert", "certificate", "compliance", "iso", "soc"]):
                    item["score"] += 2.0
                if any(k in content_head for k in ["certification", "certificate", "compliance", "iso", "soc"]):
                    item["score"] += 0.5

        candidates.sort(key=lambda x: x["score"], reverse=True)

        # De-duplicate identical chunks from the same source.
        deduped: List[Dict[str, Any]] = []
        seen_pairs = set()
        for item in candidates:
            key = (item["source"], item["content"])
            if key in seen_pairs:
                continue
            seen_pairs.add(key)
            deduped.append(item)

        # Enforce diversity: limit how many chunks can come from one source.
        max_per_source = 2
        selected: List[Dict[str, Any]] = []
        source_counts: Dict[str, int] = {}
        for item in deduped:
            source_key = item["source"] or "__unknown__"
            if source_counts.get(source_key, 0) >= max_per_source:
                continue
            selected.append(item)
            source_counts[source_key] = source_counts.get(source_key, 0) + 1
            if len(selected) >= TOP_K:
                break

        # If strict diversity under-fills results, backfill from best remaining.
        if len(selected) < TOP_K:
            selected_keys = {(x["source"], x["content"]) for x in selected}
            for item in deduped:
                key = (item["source"], item["content"])
                if key in selected_keys:
                    continue
                selected.append(item)
                if len(selected) >= TOP_K:
                    break

        result_list = {"chunks": [], "sources": []}
        for item in selected:
            source = item["source"]
            content = item["content"]
            result_list["chunks"].append(f"{source}: {content}" if source else content)
            if source and source not in result_list["sources"]:
                result_list["sources"].append(source)

        return {
            "vector_context": result_list,
            "next_agent": "fallback_checker_agent",
        }

    except Exception as e:
        print("VECTOR RETRIEVAL ERROR:", str(e))
        return {
            "vector_context": {"chunks": [], "sources": []},
            "error": str(e),
            "next_agent": "fallback_checker_agent",
        }


# =========================================================
# RESPONSE / FORMAT HELPERS
# =========================================================


def _normalize_formatted_text(answer: str, query_type: str) -> str:
    text = (answer or "").replace("\r", "").strip()

    # Remove only noisy/broken symbols but keep structure
    text = re.sub(r"[~^|\\]", "", text)               # remove random symbols
    text = re.sub(r"\n{3,}", "\n\n", text)             # max 2 consecutive newlines

    return text.strip()


# =========================================================
# IMAGE EXTRACTION
# =========================================================


def extract_issue_from_image(image_bytes: bytes, mime_type: str = "image/png") -> str:
    try:
        encoded_image = base64.b64encode(image_bytes).decode("utf-8")
        response = openai_client.chat.completions.create(
            model=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert at analyzing screenshots of API errors, logs, and UI issues. Extract meaningful technical details.",
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Analyze this image and extract error messages, logs, or any issue visible."},
                        {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{encoded_image}"}},
                    ],
                },
            ],
            temperature=0.2,
        )
        return response.choices[0].message.content or ""
    except Exception:
        return ""


# =========================================================
# EMAIL DRAFTING / SENDING
# =========================================================


def draft_ticket_email_llm(user_query: str, bot_response: str):
    prompt = f"""
You are helping draft a short professional support email for an API integration issue.

Use the user's latest question and the bot's latest response to create:
1. a concise email subject
2. a short email body

Rules:
- Keep it brief and professional
- Focus on the user's issue
- Do not invent technical details beyond the provided content
- Body should be 3-6 lines max
- Return STRICT JSON only

JSON format:
{{
  "subject": "short email subject",
  "body": "short email body"
}}

User question:
{user_query}

Bot response:
{bot_response}
"""
    response = openai_client.chat.completions.create(
        model=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
        messages=[
            {"role": "system", "content": "You generate short support email drafts in strict JSON."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
    )

    output = response.choices[0].message.content or ""
    output = output.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
    try:
        parsed = json.loads(output)
        subject = str(parsed.get("subject") or "").strip()
        body = str(parsed.get("body") or "").strip()
        return {
            "subject": subject or "Support ticket request",
            "body": body or "Hi Team,\n\nPlease help me with my current issue.\n\nThanks,",
        }
    except Exception:
        return {
            "subject": "Support ticket request",
            "body": "Hi Team,\n\nPlease help me with my current issue.\n\nThanks,",
        }


@router.post("/send-ticket-email")
async def send_ticket_email(payload: dict = Body(...)):
    from_email = TICKET_FROM_EMAIL
    to_email = TICKET_TO_EMAIL
    subject = (payload.get("subject") or "").strip()
    body = (payload.get("body") or "").strip()

    if not subject:
        raise HTTPException(status_code=400, detail="Missing email subject")
    if not body:
        raise HTTPException(status_code=400, detail="Missing email body")

    smtp_host = (os.getenv("SMTP_HOST") or "").strip()
    smtp_port = int(os.getenv("SMTP_PORT") or "587")
    smtp_username = (os.getenv("SMTP_USERNAME") or "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD") or ""
    smtp_from_email = (os.getenv("SMTP_FROM_EMAIL") or "").strip()
    smtp_use_tls = (os.getenv("SMTP_USE_TLS") or "true").strip().lower() in {"1", "true", "yes", "y"}
    smtp_use_ssl = (os.getenv("SMTP_USE_SSL") or "false").strip().lower() in {"1", "true", "yes", "y"}

    if not smtp_host:
        raise HTTPException(
            status_code=500,
            detail="SMTP is not configured. Set SMTP_HOST (and related SMTP_* settings).",
        )

    msg = EmailMessage()
    sender = smtp_from_email or from_email
    msg["From"] = sender
    msg["To"] = to_email
    msg["Subject"] = subject
    if sender != from_email:
        msg["Reply-To"] = from_email
    msg.set_content(body)

    try:
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
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {exc}") from exc

    return {"ok": True}


@router.post("/draft-ticket-email")
async def draft_ticket_email(payload: dict = Body(...)):
    user_query = (payload.get("userQuery") or "").strip()
    bot_response = (payload.get("botResponse") or "").strip()

    if not user_query and not bot_response:
        return {
            "subject": "Support ticket request",
            "body": "Hi Team,\n\nPlease help me with my current issue.\n\nThanks,",
        }

    try:
        return draft_ticket_email_llm(user_query, bot_response)
    except Exception:
        return {
            "subject": "Support ticket request",
            "body": "Hi Team,\n\nPlease help me with my current issue.\n\nThanks,",
        }


# =========================================================
# ISSUE STORAGE HELPERS
# =========================================================

ISSUE_BLOB_PATH = "Chatbot/issues.json"
CONVERSATION_BLOB_PATH = "Chatbot/conversation.json"
INSIGHT_BLOB_PATH = "Chatbot/insights.json"


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


def _get_blob_client(blob_path: str):
    connection_string, container_name = _get_blob_settings()
    service = BlobServiceClient.from_connection_string(connection_string)
    return service.get_blob_client(container=container_name, blob=blob_path)


def _read_json_blob(blob_path: str, default: dict) -> dict:
    blob = _get_blob_client(blob_path)
    if not blob.exists():
        return default
    raw = blob.download_blob().readall()
    if not raw:
        return default
    try:
        data = json.loads(raw.decode("utf-8"))
        return data if isinstance(data, dict) else default
    except Exception:
        return default


def _write_json_blob(blob_path: str, data: dict) -> None:
    blob = _get_blob_client(blob_path)
    payload = json.dumps(data, indent=2, ensure_ascii=False)
    blob.upload_blob(payload.encode("utf-8"), overwrite=True, content_type="application/json")


def load_issues():
    data = _read_json_blob(ISSUE_BLOB_PATH, {"clients": []})
    if not isinstance(data, dict):
        return {"clients": []}
    if not isinstance(data.get("clients"), list):
        data["clients"] = []
    return data


def save_issues(data):
    _write_json_blob(ISSUE_BLOB_PATH, data)


def _iter_all_issues(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for client in data.get("clients", []):
        if not isinstance(client, dict):
            continue
        for user in client.get("users", []):
            if not isinstance(user, dict):
                continue
            issues = user.get("issues", [])
            if not isinstance(issues, list):
                continue
            for issue in issues:
                if isinstance(issue, dict):
                    out.append(issue)
    return out


def _ensure_client_user_bucket(data: Dict[str, Any], client_name: str, user_id: str) -> List[Dict[str, Any]]:
    clients = data.get("clients")
    if not isinstance(clients, list):
        clients = []
        data["clients"] = clients

    client_obj = None
    for client in clients:
        if isinstance(client, dict) and str(client.get("client_name", "")).strip() == client_name:
            client_obj = client
            break
    if client_obj is None:
        client_obj = {"client_name": client_name, "users": []}
        clients.append(client_obj)

    users = client_obj.get("users")
    if not isinstance(users, list):
        users = []
        client_obj["users"] = users

    user_obj = None
    for user in users:
        if isinstance(user, dict) and str(user.get("user_id", "")).strip() == user_id:
            user_obj = user
            break
    if user_obj is None:
        user_obj = {"user_id": user_id, "issues": []}
        users.append(user_obj)

    issues = user_obj.get("issues")
    if not isinstance(issues, list):
        issues = []
        user_obj["issues"] = issues

    return issues


def create_issue_from_classification(query, classification, user_id, client_name):
    query_type = str(classification.get("type") or "").strip().upper()
    if query_type not in {"ISSUE", "RESOLUTION"}:
        return None

    now = datetime.utcnow().isoformat() + "Z"

    return {
        "issue_id": f"ISSUE_{uuid.uuid4().hex[:8]}",
        "user_id": user_id,
        "client_name": client_name,
        "created_at": now,
        "last_updated": now,
        "resolved_at": None,
        "status": "OPEN",
        "ticket_raised": False,
        "ticket_status": "null",
        "ticket_id": "null",
        "resolved": False,
        "category": query_type,
        "issue_type": classification.get("issue_type", ""),
        "sub_issue_type": classification.get("root_cause", ""),
        "product_area": "API",
        "issue_summary": query[:120],
        "tags": [],
        "message_count": 1,
        "rag_metrics": {"rag_used": True},
        "resolution": {
            "resolution_summary": None,
            "resolution_type": None,
            "resolved_by": None,
        },
        "history": [
            {
                "event_id": f"EVT_{uuid.uuid4().hex[:8]}",
                "timestamp": now,
                "event_type": "CREATED",
                "input_type": "text",
                "query_category": query_type,  # ← add this
                "user_input": query,
                "bot_response": None,
            }
        ],
    }


def store_or_update_issue(issue_obj, query, answer, user_id, client_name, query_type="ISSUE"):
    data = load_issues()
    issues = _iter_all_issues(data)
    matched_issue = None

    for issue in issues:
        if (
            issue.get("user_id") == user_id
            and issue.get("client_name") == client_name
            and issue.get("status") == "OPEN"
        ):
            matched_issue = issue
            break

    now = datetime.utcnow().isoformat() + "Z"

    if matched_issue:
        matched_issue["last_updated"] = now
        matched_issue["message_count"] = int(matched_issue.get("message_count", 0)) + 1
        history = matched_issue.get("history")
        if not isinstance(history, list):
            history = []
            matched_issue["history"] = history
        history.append(
            {
                "event_id": f"EVT_{uuid.uuid4().hex[:8]}",
                "timestamp": now,
                "event_type": "UPDATED",
                "input_type": "text",
                "user_input": query,
                "bot_response": answer,
            }
        )
    elif issue_obj:
        issue_obj["history"][0]["bot_response"] = answer
        client_issues = _ensure_client_user_bucket(data, client_name, user_id)
        client_issues.append(issue_obj)

    save_issues(data)


# =========================================================
# CONVERSATION STORAGE
# =========================================================


def load_conversations():
    data = _read_json_blob(CONVERSATION_BLOB_PATH, {"conversations": []})
    if not isinstance(data, dict):
        return {"conversations": []}
    rows = data.get("conversations")
    if not isinstance(rows, list):
        return {"conversations": []}
    return {"conversations": rows}


def save_conversations(data):
    _write_json_blob(CONVERSATION_BLOB_PATH, data)


def _find_conversation(data: dict, thread_id: str):
    rows = data.get("conversations", [])
    for idx, row in enumerate(rows):
        if isinstance(row, dict) and row.get("id") == thread_id:
            return idx, row
    return -1, None


@router.get("/conversations")
async def list_conversations(
    ownerRole: str | None = None,
    ownerEmail: str | None = None,
    clientId: str | None = None,
):
    data = load_conversations()
    rows = data.get("conversations", [])
    out = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        if ownerRole and row.get("owner_role") != ownerRole:
            continue
        if ownerEmail and row.get("owner_email") != ownerEmail:
            continue
        if clientId and row.get("client_id") != clientId:
            continue
        out.append(row)
    out.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
    return out


@router.post("/conversations/upsert")
async def upsert_conversation(payload: dict = Body(...)):
    thread_id = payload.get("id")
    if not thread_id:
        raise HTTPException(status_code=400, detail="Missing conversation id")
    data = load_conversations()
    idx, _existing = _find_conversation(data, thread_id)
    rows = data.get("conversations", [])
    if idx >= 0:
        rows[idx] = payload
    else:
        rows.insert(0, payload)
    save_conversations(data)
    return {"ok": True}


@router.post("/conversations/{thread_id}/messages")
async def append_conversation_message(thread_id: str, payload: dict = Body(...)):
    message = payload.get("message")
    if not isinstance(message, dict):
        raise HTTPException(status_code=400, detail="Missing message payload")
    stored_message = {
        "id": message.get("id"),
        "role": message.get("role"),
        "content": message.get("content"),
        "timestamp": message.get("timestamp"),
        "diagnosis": str(message.get("diagnosis") or "General"),
        "root_cause": str(message.get("root_cause") or message.get("rootCause") or ""),
    }
    if "attachments" in message and message.get("attachments") is not None:
        stored_message["attachments"] = message.get("attachments")
    data = load_conversations()
    idx, existing = _find_conversation(data, thread_id)
    if idx < 0 or not existing:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msgs = existing.get("messages")
    if not isinstance(msgs, list):
        msgs = []
    msgs.append(stored_message)
    existing["messages"] = msgs
    existing["updated_at"] = stored_message.get("timestamp") or datetime.utcnow().isoformat() + "Z"
    data["conversations"][idx] = existing
    save_conversations(data)
    return {"ok": True}


@router.patch("/conversations/{thread_id}/meta")
async def update_conversation_meta(thread_id: str, payload: dict = Body(...)):
    data = load_conversations()
    idx, existing = _find_conversation(data, thread_id)
    if idx < 0 or not existing:
        raise HTTPException(status_code=404, detail="Conversation not found")
    for key in ["diagnosis", "root_cause", "status", "title", "updated_at"]:
        if key in payload:
            existing[key] = payload[key]
    data["conversations"][idx] = existing
    save_conversations(data)
    return {"ok": True}


# =========================================================
# CHAT ORCHESTRATION
# =========================================================


@router.post("/chat")
async def chat(
    request: Request,
    query: str = Form(""),
    user_id: str = Form("default_user"),
    client_name: str = Form("Unknown Client"),
    persona: str = Form("technical"),
    image: UploadFile = File(None),
):
    # Defensive fallback: accept alternate field names if client sends
    # text/message/prompt instead of query.
    if not query.strip():
        try:
            form = await request.form()
            for key in ("query", "text", "message", "prompt"):
                candidate = str(form.get(key) or "").strip()
                if candidate:
                    query = candidate
                    break
        except Exception:
            pass

    if image:
        image_bytes = await image.read()
        image_text = extract_issue_from_image(image_bytes).strip()
        if query:
            query += f"\n\n[Image]\n{image_text}"
        else:
            query = image_text

    if not query.strip():
        raise HTTPException(status_code=400, detail="Missing query")

    # 1) user_proxy
    proxy_payload = {
        "query": query,
        "persona": persona,
        "client_name": client_name,
        "user_id": user_id,
        "next_agent": "classification_agent",
    }

    classification = {
        "type": "GENERAL",
        "issue_type": "",
        "root_cause": "",
        "confidence": "LOW",
    }
    query_type = "GENERAL"
    retrieved_docs = ""
    answer = ""
    formatted_answer = ""
    fallback_used = False

    next_agent = str(proxy_payload.get("next_agent") or "classification_agent")
    guard = 0

    while next_agent != "end" and guard < 10:
        guard += 1

        if next_agent == "classification_agent":
            classification = _agent_reply_json(
                classification_agent,
                proxy_payload,
                {
                    "type": "GENERAL",
                    "issue_type": "",
                    "root_cause": "",
                    "confidence": "LOW",
                    "next_agent": "retriever",
                },
            )
            query_type = str(classification.get("type") or "GENERAL").strip().upper()
            next_agent = str(classification.get("next_agent") or "retriever")
            continue

        if next_agent == "retriever":
            retrieval_result = await extract_context(question=query)
            vector_context = retrieval_result.get("vector_context", {})
            retrieved_chunks = vector_context.get("chunks", []) if isinstance(vector_context, dict) else []
            retrieved_docs = "\n\n---\n\n".join([str(c).strip() for c in retrieved_chunks if str(c).strip()])

            print("\n====================")
            print("QUERY:", query)
            print("RETRIEVED DOCS:\n", retrieved_docs[:2000])
            print("====================\n")

            next_agent = str(retrieval_result.get("next_agent") or "fallback_checker_agent")
            continue

        if next_agent == "fallback_checker_agent":
            docs_available = bool(retrieved_docs.strip())
            checker = _agent_reply_json(
                fallback_checker_agent,
                {
                    "query": query,
                    "classification": classification,
                    "retrieved_docs": retrieved_docs,
                    "docs_available": docs_available,
                },
                {
                    "decision": "yes" if not docs_available else "no",
                    "reason": "Default agent-only fallback based on document availability.",
                    "next_agent": "fallback_answer_agent" if not docs_available else "formatting_agent",
                },
            )
            decision = str(checker.get("decision") or "").strip().lower()
            if decision not in {"yes", "no"}:
                decision = "yes" if not docs_available else "no"
            next_agent = "fallback_answer_agent" if decision == "yes" else "formatting_agent"
            continue

        if next_agent == "fallback_answer_agent":
            fallback_result = _agent_reply_json(
                fallback_answer_agent,
                {
                    "query": query,
                    "classification": classification,
                    "persona": persona,
                },
                {
                    "answer": "I could not find this in the provided documentation, but here is a best-effort general answer.",
                    "next_agent": "formatting_agent",
                },
            )
            answer = str(fallback_result.get("answer") or "").strip()
            fallback_used = True
            next_agent = str(fallback_result.get("next_agent") or "formatting_agent")
            continue

        if next_agent == "formatting_agent":
            trimmed_docs = retrieved_docs[:3000] if retrieved_docs else ""
            formatted_answer = _normalize_formatted_text(
                _format_answer_direct(query, query_type, persona, trimmed_docs, answer),
                query_type,
            )
            next_agent = "end"
            continue

        next_agent = "end"
    if not formatted_answer:
        fallback_text = answer.strip() or retrieved_docs.strip() or "Information not found in documentation."
        formatted_answer = _normalize_formatted_text(fallback_text, query_type)

    store_issue = query_type in {"ISSUE", "RESOLUTION"}
    if store_issue:
        issue_obj = create_issue_from_classification(query, classification, user_id, client_name)
        if issue_obj:
            issue_obj["rag_metrics"]["rag_used"] = bool(retrieved_docs.strip())
        store_or_update_issue(issue_obj, query, formatted_answer, user_id, client_name,query_type)

    return {
        "answer": formatted_answer,
        "type": classification.get("type"),
        "diagnosis": classification.get("issue_type"),
        "rootCause": classification.get("root_cause"),
        "confidence": classification.get("confidence"),
        "persona_used": persona,
        "rag_used": bool(retrieved_docs.strip()),
        "fallback_used": fallback_used,
    }
