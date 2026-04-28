# import os
# from dotenv import load_dotenv
# from pathlib import Path
# from openai import AzureOpenAI
# from azure.search.documents import SearchClient
# from azure.search.documents.models import VectorizedQuery
# from azure.core.credentials import AzureKeyCredential

# load_dotenv(Path(r"C:\Users\sowmya\Downloads\Projects\JPMC-TechSpec\Backend\keys.env"))

# openai_client = AzureOpenAI(
#     api_key=os.getenv("AZURE_OPENAI_API_KEY"),
#     api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
#     azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
# )

# search_client = SearchClient(
#     endpoint=os.getenv("AZURE_SEARCH_SERVICE_ENDPOINT"),
#     index_name=os.getenv("AZURE_SEARCH_INDEX_NAME") or "tech-spec",
#     credential=AzureKeyCredential(os.getenv("AZURE_SEARCH_ADMIN_KEY")),
# )

# question = "What certifications should I be aware of before integrating Cortexa?"

# embedding = openai_client.embeddings.create(
#     input=question,
#     model=os.getenv("embedding_deployment"),
# ).data[0].embedding

# vector_query = VectorizedQuery(
#     vector=embedding,
#     k_nearest_neighbors=10,
#     fields=os.getenv("AZURE_SEARCH_VECTOR_FIELD", "embedding"),
# )

# results = list(search_client.search(
#     search_text=None,
#     vector_queries=[vector_query],
#     top=10,
# ))

# for r in results:
#     print(r.get("file_name"), "|", str(r.get("content", ""))[:150])
#     print("---")

import requests

with open(r"C:\Users\sowmya\Downloads\Projects\JPMC-TechSpec\Backend\Input\Cortexa_Certificates.docx", "rb") as f:
    response = requests.post(
        "http://127.0.0.1:8000/chatbot/index",
        files={"file": ("Cortexa_Certificates.docx", f, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    )
print(response.json())