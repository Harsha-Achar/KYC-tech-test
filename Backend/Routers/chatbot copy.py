
from fastapi import APIRouter, UploadFile, File, HTTPException, Body, Form
import os
import uuid
import json
import base64
from typing import Any
from pathlib import Path
import smtplib
import ssl
import re
from email.message import EmailMessage
from azure.search.documents import SearchClient
from azure.core.credentials import AzureKeyCredential
try:
    from azure.search.documents.models import VectorizedQuery
except Exception:  # pragma: no cover
    VectorizedQuery = None
from openai import AzureOpenAI

router = APIRouter()

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
env_path = BASE_DIR / "keys.env"

load_dotenv(env_path)

# Load once
openai_client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
)

search_client = SearchClient(
    endpoint=os.getenv("AZURE_SEARCH_SERVICE_ENDPOINT"),
    index_name=(os.getenv("AZURE_SEARCH_INDEX_NAME") or "tech-spec"),
    credential=AzureKeyCredential(os.getenv("AZURE_SEARCH_ADMIN_KEY"))
)

VECTOR_FIELD = os.getenv("AZURE_SEARCH_VECTOR_FIELD", "embedding")
TOP_K = int(os.getenv("AZURE_SEARCH_TOP_K", "5"))
# Document Indexing Functions
def generate_embedding(text: str):
    response = openai_client.embeddings.create(
        input=text,
        model=os.getenv("embedding_deployment")
    )
    return response.data[0].embedding


def chunk_text(text, chunk_size=500):
    chunks = []
    for i in range(0, len(text), chunk_size):
        chunks.append(text[i:i + chunk_size])
    return chunks

from PyPDF2 import PdfReader
from docx import Document
import io

def extract_text_from_pdf(file_bytes: bytes) -> str:
    text = ""
    reader = PdfReader(io.BytesIO(file_bytes))
    
    for page in reader.pages:
        if page.extract_text():
            text += page.extract_text() + "\n"
    
    return text


def extract_text_from_docx(file_bytes: bytes) -> str:
    doc = Document(io.BytesIO(file_bytes))
    return "\n".join([para.text for para in doc.paragraphs])


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
    else:
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

    return index_text(filename=filename, text=text)

@router.post("/index")
async def index_document(file: UploadFile = File(...)):
    content = await file.read()
    chunk_count = index_bytes(filename=file.filename, content=content)

    return {
        "message": "Document indexed successfully",
        "chunks": chunk_count
    }

# CHATBOT
def classifier_llm(user_query: str):
    prompt = f"""
You are an AI assistant for API integration troubleshooting.

Classify the query into:

1. GENERAL → product info, features, pricing
2. INTEGRATION → setup steps, API integration guidance
3. ISSUE → something broken, errors, failures
4. RESOLUTION → fixing a known issue or retrying steps

If ISSUE:
- give issue_type
- give root_cause

Return STRICT JSON:

{{
  "type": "GENERAL | INTEGRATION | ISSUE | RESOLUTION",
  "issue_type": "short label",
  "root_cause": "short explanation",
  "confidence": "HIGH or LOW"
}}

User Query:
{user_query}
"""

    response = openai_client.chat.completions.create(
        model=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
        messages=[
            {"role": "system", "content": "Strict JSON generator"},
            {"role": "user", "content": prompt}
        ],
        temperature=0.1
    )

    try:
        return json.loads(response.choices[0].message.content)
    except:
        return {
            "type": "GENERAL",
            "issue_type": "",
            "root_cause": "",
            "confidence": "LOW"
        }

product_context = """
IMPORTANT CONTEXT:
"Unified" is a product/platform referenced in the provided documents.

Do NOT treat it as a generic term.
Always assume it refers to the product unless explicitly stated otherwise.
"""
def answer_llm_grounded(user_query: str, retrieved_docs: str, classification: dict, persona: str = "technical"):
    query_type = classification.get("type", "GENERAL")
    issue_type = classification.get("issue_type", "")
    root_cause = classification.get("root_cause", "")

    # 🔹 STYLE BASED ON QUERY TYPE
    if query_type == "GENERAL":
        style = """
Explain clearly in simple text.

STRICT RULES:
- No troubleshooting format
- No "Root Cause", "Detected Issues", or "Steps"
- Just give a clean explanation in 4-6 lines
"""

    elif query_type == "INTEGRATION":
        style = """
Provide step-by-step integration guidance.

STRICT FORMAT:
Steps:
1. Step one
2. Step two
3. Step three

- No Root Cause or Detected Issues
- Keep it clear and actionable
- If a specific external system (for example, CRM) is asked but not explicitly named in context,
  provide the best available integration guidance from context and clearly mention what system-specific details are missing.
"""

    elif query_type in ["ISSUE", "RESOLUTION"]:
        style = """
You are a technical troubleshooting assistant.

STRICT FORMAT:

Root Cause:
<short explanation>

Detected Issues:
1. Issue 1
2. Issue 2

Steps to Fix:
1. Step 1
2. Step 2
3. Step 3

Notes:
<optional>

IMPORTANT:
- No markdown symbols
- Keep it structured
"""

    else:
        style = "Answer clearly."

    if not retrieved_docs.strip():
        return "Information not found in documentation."

    context_block = f"""
You are answering questions only from the provided documentation context about the product "Unified".

Rules:
- Use ONLY the provided context
- Do NOT hallucinate
- If the answer is not present in the context, say exactly:
Information not found in documentation.
- If the answer is present semantically, answer it even if the wording is different
- Do not require exact quote matching
- For integration questions, if partial relevant guidance exists in context, provide that guidance instead of returning not found.
- Explicitly mention what exact details are missing when context is partial.

Context:
{retrieved_docs}
"""

    prompt = f"""
IMPORTANT:
"Unified" is a product. Do NOT treat it as a generic word.

You are an API integration assistant.

{style}

Query Type: {query_type}

{context_block}

User Query:
{user_query}

Issue Type: {issue_type}
Root Cause Hint: {root_cause}

Return STRICT JSON only:
{{
  "answer": "final answer"
}}
"""

    response = openai_client.chat.completions.create(
        model=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
        messages=[
            {"role": "system", "content": "Strict structured assistant"},
            {"role": "user", "content": prompt}
        ],
        temperature=0.1
    )

    raw = (response.choices[0].message.content or "").strip()

    try:
        parsed = json.loads(raw)
        answer = str(parsed.get("answer") or "").strip()
        return answer or "Information not found in documentation."
    except Exception:
        return raw or "Information not found in documentation."


def answer_llm_doc_best_effort(user_query: str, retrieved_docs: str, classification: dict) -> str:
    if not retrieved_docs.strip():
        return "Information not found in documentation."
    query_type = str(classification.get("type") or "GENERAL").upper()
    prompt = f"""
You are answering from documentation context only.

Task:
- The user asked a {query_type} question.
- Use only the provided context.
- If partial relevant information exists, provide the best possible answer from context.
- Clearly mention what specific details are missing from documentation.
- Do NOT use outside knowledge.
- Return plain text only.

Context:
{retrieved_docs}

User Query:
{user_query}
"""
    response = openai_client.chat.completions.create(
        model=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
        messages=[
            {"role": "system", "content": "Documentation-grounded assistant."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.1,
    )
    text = (response.choices[0].message.content or "").strip()
    return text or "Information not found in documentation."


def _has_useful_doc_context(user_query: str, retrieved_docs: str) -> bool:
    docs = (retrieved_docs or "").strip()
    if not docs:
        return False

    stopwords = {
        "what", "when", "where", "which", "with", "from", "your", "this", "that", "about",
        "does", "have", "into", "also", "there", "their", "them", "they", "than", "then",
        "how", "why", "who", "whom", "would", "could", "should", "will", "can", "the",
        "and", "for", "are", "was", "were", "you", "our", "any",
    }
    q_tokens = {
        t for t in re.findall(r"[a-z0-9]+", (user_query or "").lower())
        if len(t) > 2 and t not in stopwords
    }
    d_tokens = {
        t for t in re.findall(r"[a-z0-9]+", docs.lower())
        if len(t) > 2 and t not in stopwords
    }

    if not q_tokens:
        return False

    overlap_count = len(q_tokens & d_tokens)
    overlap_ratio = overlap_count / max(len(q_tokens), 1)

    # Require meaningful semantic overlap before trusting retrieved docs.
    if len(q_tokens) <= 4:
        return overlap_count >= 1 and overlap_ratio >= 0.5
    return overlap_count >= 2 and overlap_ratio >= 0.35


def answer_llm_fallback(user_query: str, classification: dict, persona: str = "technical") -> str:
    query_type = classification.get("type", "GENERAL")
    issue_type = classification.get("issue_type", "")
    root_cause = classification.get("root_cause", "")

    if persona == "business":
        style = "Explain in simple, non-technical terms. Focus on business impact."
    else:
        style = "Give detailed technical explanation with steps."

    prompt = f"""
You are an API integration assistant.

No meaningful documentation context was found for this question.
Provide a best-effort general answer.

{style}

Query Type: {query_type}
User Query: {user_query}
Issue Type: {issue_type}
Root Cause Hint: {root_cause}
"""
    response = openai_client.chat.completions.create(
        model=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
        messages=[
            {"role": "system", "content": "Helpful assistant"},
            {"role": "user", "content": prompt}
        ],
        temperature=0.2
    )
    text = (response.choices[0].message.content or "").strip()
    return text or "Information not found in documentation."


def is_not_found_response(answer: str) -> bool:
    normalized = (answer or "").strip().lower().rstrip(".!")
    return normalized == "information not found in documentation"


def formatter_llm(answer: str, classification: dict) -> str:
    query_type = str(classification.get("type", "GENERAL")).upper()

    prompt = f"""
You are a response formatter for a chatbot UI.

Reformat the answer based on query classification.

Classification Type: {query_type}

STRICT RULES:

GENERAL:
- Convert into a clean 2-3 line paragraph.
- No bullets or numbered steps.

INTEGRATION:
- Convert into clean numbered steps.
- Each step must be exactly one line.
- Keep it actionable.

ISSUE/RESOLUTION:
- Give a practical solution approach.
- Do not use these phrases:
  "Information not found in documentation"
  "No data available"
  "Cannot determine"
- Keep it realistic and helpful.

FOR ALL:
- Remove markdown symbols (#, *, etc.).
- No JSON.
- Remove heading labels like "Answer:", "Steps:", "Root Cause:", "Detected Issues:", "Notes:".
- Output plain text only.
- Keep all important details from the original answer.
- Do not cut off sentences midway.

EDGE CASE:
- If original answer includes "Information not found in documentation", replace it with a practical possible troubleshooting approach.

Original Answer:
{answer}

Return only the formatted response.
"""

    def _truncate_words(text: str, max_words: int) -> str:
        words = (text or "").split()
        if len(words) <= max_words:
            return " ".join(words)
        return " ".join(words[:max_words]).rstrip(",;:") + "."

    def _strip_format_noise(text: str) -> str:
        cleaned = (text or "").replace("\r", "")
        cleaned = re.sub(r"[#*`_]+", "", cleaned)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        cleaned = re.sub(
            r"(?im)^\s*(answer|steps|root cause|detected issues|notes)\s*:\s*",
            "",
            cleaned,
        )
        return cleaned.strip()

    def _replace_disallowed_phrases(text: str) -> str:
        return re.sub(
            r"information not found in documentation|no data available|cannot determine",
            "Check request payload validity, required headers, endpoint configuration, and recent error logs; then retry with a minimal valid request and compare the response.",
            text or "",
            flags=re.IGNORECASE,
        )

    def _extract_integration_steps(text: str) -> list[str]:
        raw = (text or "").strip()
        if not raw:
            return []

        # Handles inline forms like: "1) ... 2) ... 3) ..." or "(1) ... (2) ..."
        inline = " " + " ".join(raw.split()) + " "
        numbered_chunks = re.findall(
            r"(?:^|\s)(?:\(?\d+\)?[\)\.\-:]?)\s*(.+?)(?=\s(?:\(?\d+\)?[\)\.\-:]?)\s*|$)",
            inline,
            flags=re.IGNORECASE,
        )
        if numbered_chunks and len(numbered_chunks) >= 2:
            return [c.strip(" -:;,.") for c in numbered_chunks if c.strip()]

        # Handles multiline bullets/steps.
        lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
        steps: list[str] = []
        for line in lines:
            step = re.sub(r"^(?:step\s*\d+[:\-\s]*|\(?\d+\)?[\)\.\-:]?\s*)", "", line, flags=re.IGNORECASE).strip()
            if step:
                steps.append(step)
        return steps

    def _looks_like_step_sequence(text: str) -> bool:
        raw = " " + " ".join((text or "").split()) + " "
        markers = re.findall(r"(?:^|\s)\(?\d+\)?[\)\.\-:]\s*", raw)
        return len(markers) >= 2

    def _derive_steps_from_paragraph(text: str) -> list[str]:
        compact = " ".join((text or "").split())
        if not compact:
            return []
        parts = [p.strip(" ,;:-") for p in re.split(r"(?<=[.!?])\s+", compact) if p.strip()]
        if len(parts) >= 2:
            return parts
        parts = [p.strip(" ,;:-") for p in re.split(r"\s*(?:;|,\s+and\s+|,\s+then\s+|,\s+)\s*", compact) if p.strip()]
        return parts

    def _normalize_list_layout(text: str) -> str:
        raw = (text or "").replace("\r", "").strip()
        if not raw:
            return ""

        # Split inline list markers into separate lines.
        raw = re.sub(r"\s+(?=(?:\(?\d+\)?[\)\.\-:])\s+)", "\n", raw)
        raw = re.sub(r"\s+(?=(?:[-*•])\s+)", "\n", raw)

        normalized_lines: list[str] = []
        for line in [ln.strip() for ln in raw.splitlines() if ln.strip()]:
            numbered = re.match(r"^\(?(\d+)\)?[\)\.\-:]\s*(.+)$", line)
            if numbered:
                num, content = numbered.groups()
                normalized_lines.append(f"{num}. {' '.join(content.split())}")
                continue

            bullet = re.match(r"^[-*•]\s*(.+)$", line)
            if bullet:
                normalized_lines.append(f"- {' '.join(bullet.group(1).split())}")
                continue

            normalized_lines.append(" ".join(line.split()))

        return "\n".join(normalized_lines).strip()

    def _has_list_lines(text: str) -> bool:
        return bool(re.search(r"(?m)^\s*(?:\d+\.\s+|-\s+)", text or ""))

    def _format_as_paragraph_lines(text: str) -> str:
        compact = " ".join((text or "").split())
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", compact) if s.strip()]
        if len(sentences) >= 2:
            # Keep full content, but break long paragraphs for readability.
            wrapped: list[str] = []
            for idx in range(0, len(sentences), 2):
                wrapped.append(" ".join(sentences[idx:idx + 2]))
            return "\n".join(wrapped)
        words = compact.split()
        if len(words) > 16:
            mid = len(words) // 2
            return f"{' '.join(words[:mid])}\n{' '.join(words[mid:])}"
        return compact

    def _finalize_text(base_text: str) -> str:
        normalized = _replace_disallowed_phrases(_strip_format_noise(base_text))
        normalized = _normalize_list_layout(normalized)
        force_steps = (
            _looks_like_step_sequence(normalized)
            or _looks_like_step_sequence(answer)
            or _has_list_lines(normalized)
        )

        if query_type in {"GENERAL", "BUSINESS"}:
            return _format_as_paragraph_lines(normalized)

        if query_type == "INTEGRATION":
            extracted = _extract_integration_steps(normalized)
            if len(extracted) < 2:
                extracted = _extract_integration_steps(answer)
            if len(extracted) < 2:
                extracted = _derive_steps_from_paragraph(normalized)
            if len(extracted) < 2:
                extracted = _derive_steps_from_paragraph(answer)

            step_lines: list[str] = []
            for step in extracted:
                clean_step = " ".join((step or "").split()).strip(" -:;,.")
                if clean_step:
                    step_lines.append(clean_step)
            if not step_lines:
                fallback_steps = [s.strip() for s in re.split(r"(?<=[.!?])\s+", " ".join(normalized.split())) if s.strip()]
                step_lines = [s for s in fallback_steps if s]
            steps_block = "\n".join([f"{i + 1}. {s}" for i, s in enumerate(step_lines)])
            return f"Here is your step-by-step guide:\n{steps_block}".strip()

        if query_type in {"ISSUE", "RESOLUTION"}:
            if _has_list_lines(normalized):
                aligned_lines: list[str] = []
                for line in [ln.strip() for ln in normalized.splitlines() if ln.strip()]:
                    if re.match(r"^\d+\.\s+", line):
                        idx, _, content = line.partition(". ")
                        aligned_lines.append(f"{idx}. {' '.join(content.split())}")
                    elif line.startswith("- "):
                        aligned_lines.append(f"- {' '.join(line[2:].split())}")
                    else:
                        aligned_lines.append(" ".join(line.split()))
                aligned_block = "\n".join(aligned_lines)
                return f"Here is what to check to resolve this:\n{aligned_block}".strip()

            concise = " ".join(normalized.split())
            concise = re.sub(
                r"information not found in documentation|no information available",
                "Use the available logs, configuration, and retry checks",
                concise,
                flags=re.IGNORECASE,
            )
            return f"Here is what to check to resolve this: {concise}".strip()

        if force_steps:
            return _format_as_paragraph_lines(normalized)

        return " ".join(normalized.split())

    try:
        response = openai_client.chat.completions.create(
            model=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
            messages=[
                {"role": "system", "content": "You clean and format chatbot responses."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=6000,
        )
        formatted = response.choices[0].message.content or ""
        if not str(formatted).strip():
            formatted = answer
        return _finalize_text(formatted)
    except Exception:
        return _finalize_text(answer)


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

def _retrieve_context(query: str) -> str:
    chunks: list[str] = []
    try:
        if VectorizedQuery is None:
            return ""

        embedding = generate_embedding(query)
        vector_query = VectorizedQuery(
            vector=embedding,
            k_nearest_neighbors=TOP_K,
            fields=VECTOR_FIELD,
        )

        results = search_client.search(
            search_text=None,
            vector_queries=[vector_query],
            top=TOP_K,
        )

        for r in results:
            payload = r if isinstance(r, dict) else dict(r)
            content = str(payload.get("content") or payload.get("text") or "").strip()
            if content:
                chunks.append(content)
    except Exception as e:
        print("VECTOR RETRIEVAL ERROR:", str(e))
        return ""

    retrieved_docs = "\n\n---\n\n".join(chunks)
    print("\n====================")
    print("QUERY:", query)
    print("RETRIEVED DOCS:\n", retrieved_docs[:2000])
    print("====================\n")
    return retrieved_docs

# =========================
# 🔹 ISSUE STORAGE HELPERS
# =========================
ISSUE_FILE = "issues.json"
CONVERSATION_FILE = Path(__file__).resolve().parent.parent / "conversation.json"

def load_issues():
    if not os.path.exists(ISSUE_FILE):
        return {"clients": []}
    with open(ISSUE_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        return {"clients": []}
    clients = data.get("clients")
    if not isinstance(clients, list):
        data["clients"] = []
    return data

def save_issues(data):
    with open(ISSUE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _iter_all_issues(data: dict[str, Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
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


def _ensure_client_user_bucket(data: dict[str, Any], client_name: str, user_id: str) -> list[dict[str, Any]]:
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


def load_conversations():
    if not CONVERSATION_FILE.exists():
        return {"conversations": []}
    with open(CONVERSATION_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        return {"conversations": []}
    rows = data.get("conversations")
    if not isinstance(rows, list):
        return {"conversations": []}
    return {"conversations": rows}


def save_conversations(data):
    with open(CONVERSATION_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


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
    data = load_conversations()
    idx, existing = _find_conversation(data, thread_id)
    if idx < 0 or not existing:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msgs = existing.get("messages")
    if not isinstance(msgs, list):
        msgs = []
    msgs.append(message)
    existing["messages"] = msgs
    existing["updated_at"] = message.get("timestamp") or datetime.utcnow().isoformat() + "Z"
    data["conversations"][idx] = existing
    save_conversations(data)
    return {"ok": True}


@router.post("/send-ticket-email")
async def send_ticket_email(payload: dict = Body(...)):
    from_email = (payload.get("fromEmail") or "").strip()
    to_email = (payload.get("toEmail") or "").strip()
    subject = (payload.get("subject") or "").strip()
    body = (payload.get("body") or "").strip()

    if not from_email:
        raise HTTPException(status_code=400, detail="Missing from email")
    if not to_email:
        raise HTTPException(status_code=400, detail="Missing recipient email")
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


# =========================
# 🔹 LLM1 → CREATE ISSUE
# =========================
from datetime import datetime

def create_issue_from_llm(query, classification, user_id, client_name):
    if classification.get("type") != "ISSUE":
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

        # 🔹 NEW FIELD FOR ROUTING
        "category": classification.get("type"),

        "issue_type": classification.get("issue_type", ""),
        "sub_issue_type": classification.get("root_cause", ""),
        "product_area": "API",

        "issue_summary": query[:120],
        "tags": [],
        "message_count": 1,

        "rag_metrics": {
            "rag_used": True
        },

        "resolution": {
            "resolution_summary": None,
            "resolution_type": None,
            "resolved_by": None
        },

        "history": [
            {
                "event_id": f"EVT_{uuid.uuid4().hex[:8]}",
                "timestamp": now,
                "event_type": "CREATED",
                "input_type": "text",
                "user_input": query,
                "bot_response": None
            }
        ]
    }


# =========================
# 🔹 LLM2 → STORE / UPDATE
# =========================
def store_or_update_issue(issue_obj, query, answer, user_id, client_name):
    data = load_issues()
    issues = _iter_all_issues(data)

    matched_issue = None

    # 🔹 STEP 1: Try matching existing OPEN issue for user
    for issue in issues:
        if (
            issue.get("user_id") == user_id
            and issue.get("client_name") == client_name
            and issue.get("status") == "OPEN"
        ):
            matched_issue = issue
            break

    now = datetime.utcnow().isoformat() + "Z"

    # 🔹 CASE 1: EXISTING ISSUE → ALWAYS UPDATE (even if not classified ISSUE)
    if matched_issue:
        matched_issue["last_updated"] = now
        matched_issue["message_count"] += 1

        matched_issue["history"].append({
            "event_id": f"EVT_{uuid.uuid4().hex[:8]}",
            "timestamp": now,
            "event_type": "UPDATED",
            "input_type": "text",
            "user_input": query,
            "bot_response": answer
        })

    # 🔹 CASE 2: NEW ISSUE (only if LLM says ISSUE)
    elif issue_obj:
        issue_obj["history"][0]["bot_response"] = answer
        client_issues = _ensure_client_user_bucket(data, client_name, user_id)
        client_issues.append(issue_obj)

    # 🔹 CASE 3: NO ISSUE + NO MATCH → ignore (general chat)
    
    save_issues(data)
    
    
@router.post("/chat")
async def chat(
    query: str = Form(""),
    user_id: str = Form("default_user"),
    client_name: str = Form("Unknown Client"),
    persona: str = Form("technical"),  # 🔹 NEW
    image: UploadFile = File(None),
):
    if image:
        image_bytes = await image.read()
        image_text = extract_issue_from_image(image_bytes).strip()
        if query:
            query += f"\n\n[Image]\n{image_text}"
        else:
            query = image_text

    if not query:
        raise HTTPException(status_code=400, detail="Missing query")

    # 🔹 classification
    classification = classifier_llm(query)

    # 🔹 retrieve docs
    retrieved_docs = _retrieve_context(query)

    # 🔹 strict order: document-first, fallback-second.
    fallback_used = False
    if _has_useful_doc_context(query, retrieved_docs):
        answer = answer_llm_grounded(query, retrieved_docs, classification, persona)
        # If strict grounded path says not found but docs are usable, do a best-effort docs-only pass.
        if is_not_found_response(str(answer or "")):
            answer = answer_llm_doc_best_effort(query, retrieved_docs, classification)
    else:
        # Only when docs are empty/clearly irrelevant.
        answer = answer_llm_fallback(query, classification, persona)
        fallback_used = True

    # 🔹 issue handling
    issue_obj = create_issue_from_llm(query, classification, user_id, client_name)

    if issue_obj:
        store_or_update_issue(issue_obj, query, answer, user_id, client_name)

    # 🔹 formatter layer on final output only
    formatted_answer = formatter_llm(answer, classification)

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