# # # # # # import os
# # # # # # from dotenv import load_dotenv
# # # # # # load_dotenv("keys.env")

# # # # # # print("Embedding model:", os.getenv("embedding_deployment"))

# # # # # import os
# # # # # import smtplib
# # # # # from email.mime.text import MIMEText
# # # # # from email.mime.multipart import MIMEMultipart
# # # # # from pathlib import Path
# # # # # from dotenv import load_dotenv

# # # # # BASE_DIR = Path(__file__).resolve().parent
# # # # # env_path = BASE_DIR / "keys.env"
# # # # # load_dotenv(env_path)

# # # # # def send_test_email(to_email: str):
# # # # #     smtp_host = os.getenv("SMTP_HOST")
# # # # #     smtp_port = int(os.getenv("SMTP_PORT", 587))
# # # # #     smtp_username = os.getenv("SMTP_USERNAME")
# # # # #     smtp_password = os.getenv("SMTP_PASSWORD")
# # # # #     smtp_from_email = os.getenv("SMTP_FROM_EMAIL")
# # # # #     use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

# # # # #     # Create message
# # # # #     msg = MIMEMultipart()
# # # # #     msg["From"] = smtp_from_email
# # # # #     msg["To"] = to_email
# # # # #     msg["Subject"] = "Test Email"

# # # # #     body = "This is a test email from your SMTP setup."
# # # # #     msg.attach(MIMEText(body, "plain"))

# # # # #     try:
# # # # #         server = smtplib.SMTP(smtp_host, smtp_port)
        
# # # # #         if use_tls:
# # # # #             server.starttls()

# # # # #         server.login(smtp_username, smtp_password)
# # # # #         server.send_message(msg)
# # # # #         server.quit()

# # # # #         print("✅ Email sent successfully")

# # # # #     except Exception as e:
# # # # #         print("❌ Failed to send email:", str(e))

# # # # # send_test_email("sowmya.sri0112@gmail.com")

# # # # # ========================================================

# # # # from dotenv import load_dotenv
# # # # load_dotenv("keys.env")
# # # # from openai import AzureOpenAI
# # # # import os

# # # # client = AzureOpenAI(
# # # #     api_key=os.getenv("AZURE_OPENAI_API_KEY"),
# # # #     azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
# # # #     api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
# # # # )

# # # # response = client.chat.completions.create(
# # # #     model=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
# # # #     messages=[{"role": "user", "content": "hello"}],
# # # # )

# # # # print(response.choices[0].message.content)


# # # import os, json
# # # from dotenv import load_dotenv
# # # from openai import AzureOpenAI
# # # from autogen import AssistantAgent

# # # from pathlib import Path

# # # env_path = Path(
# # #     r"C:\Users\sowmya\Downloads\Projects\JPMC-TechSpec\Backend\keys.env"
# # # )

# # # load_dotenv(env_path)

# # # AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
# # # AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
# # # AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION")
# # # AZURE_OPENAI_DEPLOYMENT_NAME = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")

# # # def test_direct_azure_openai():
# # #     client = AzureOpenAI(
# # #         api_key=AZURE_OPENAI_API_KEY,
# # #         azure_endpoint=AZURE_OPENAI_ENDPOINT,
# # #         api_version=AZURE_OPENAI_API_VERSION,
# # #     )

# # #     response = client.chat.completions.create(
# # #         model=AZURE_OPENAI_DEPLOYMENT_NAME,
# # #         messages=[
# # #             {"role": "system", "content": "Return strict JSON only."},
# # #             {"role": "user", "content": "Classify this: Why is my JWT token expired?"}
# # #         ],
# # #         temperature=0.1,
# # #     )

# # #     print("DIRECT AZURE TEST OK:")
# # #     print(response.choices[0].message.content)


# # # def test_autogen_agent():
# # #     llm_config = {
# # #         "config_list": [
# # #             {
# # #                 "model": AZURE_OPENAI_DEPLOYMENT_NAME,
# # #                 "api_key": AZURE_OPENAI_API_KEY,
# # #                 "base_url": AZURE_OPENAI_ENDPOINT.rstrip("/"),
# # #                 "api_type": "azure",
# # #                 "api_version": AZURE_OPENAI_API_VERSION,
# # #             }
# # #         ],
# # #         "temperature": 0.1,
# # #     }

# # #     classification_agent = AssistantAgent(
# # #         name="classification_agent",
# # #         system_message="""
# # # You classify user questions for an API integration assistant.

# # # Return STRICT JSON only:
# # # {
# # #   "type": "GENERAL | INTEGRATION | ISSUE",
# # #   "issue_type": "short label",
# # #   "root_cause": "short explanation",
# # #   "confidence": "HIGH | LOW",
# # #   "next_agent": "retriever"
# # # }
# # # """,
# # #         llm_config=llm_config,
# # #         human_input_mode="NEVER",
# # #         max_consecutive_auto_reply=1,
# # #     )

# # #     reply = classification_agent.generate_reply(
# # #         messages=[
# # #             {
# # #                 "role": "user",
# # #                 "content": "Why is my JWT token expired?"
# # #             }
# # #         ]
# # #     )

# # #     print("AUTOGEN TEST OK:")
# # #     print(reply)


# # # if __name__ == "__main__":
# # #     print("Deployment:", AZURE_OPENAI_DEPLOYMENT_NAME)
# # #     print("Endpoint:", AZURE_OPENAI_ENDPOINT)
# # #     print("API Version:", AZURE_OPENAI_API_VERSION)

# # #     test_direct_azure_openai()
# # #     test_autogen_agent()

# # # save as check_index.py and run it
# # from azure.search.documents import SearchClient
# # from azure.core.credentials import AzureKeyCredential
# # import os
# # from dotenv import load_dotenv
# # from pathlib import Path

# # load_dotenv(Path(r"C:\Users\sowmya\Downloads\Projects\JPMC-TechSpec\Backend\keys.env"))

# # client = SearchClient(
# #     endpoint=os.getenv("AZURE_SEARCH_SERVICE_ENDPOINT"),
# #     index_name=os.getenv("AZURE_SEARCH_INDEX_NAME") or "tech-spec",
# #     credential=AzureKeyCredential(os.getenv("AZURE_SEARCH_ADMIN_KEY")),
# # )

# # results = list(client.search(search_text="certification SOC2 ISO27001 GDPR", top=5))
# # for r in results:
# #     print(r.get("file_name"), "|", str(r.get("content", ""))[:100])

# import requests

# url = "http://127.0.0.1:8000/chatbot/index"

# with open(r"C:\path\to\Cortexa_Certificates.docx", "rb") as f:
#     response = requests.post(url, files={"file": ("Cortexa_Certificates.docx", f)})

# print(response.json())

# test.py - replace with this
from azure.search.documents import SearchClient
from azure.search.documents.models import VectorizedQuery
from azure.core.credentials import AzureKeyCredential
from openai import AzureOpenAI
import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(r"C:\Users\sowmya\Downloads\Projects\JPMC-TechSpec\Backend\keys.env"))

openai_client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
)

search_client = SearchClient(
    endpoint=os.getenv("AZURE_SEARCH_SERVICE_ENDPOINT"),
    index_name=os.getenv("AZURE_SEARCH_INDEX_NAME") or "tech-spec",
    credential=AzureKeyCredential(os.getenv("AZURE_SEARCH_ADMIN_KEY")),
)

question = "What certifications should I be aware of before integrating Cortexa?"

embedding = openai_client.embeddings.create(
    input=question,
    model=os.getenv("embedding_deployment"),
).data[0].embedding

vector_query = VectorizedQuery(
    vector=embedding,
    k_nearest_neighbors=10,
    fields=os.getenv("AZURE_SEARCH_VECTOR_FIELD", "embedding"),
)

results = list(search_client.search(
    search_text=None,
    vector_queries=[vector_query],
    top=10,
))

for r in results:
    print(r.get("file_name"), "|", str(r.get("content", ""))[:150])
    print("---")