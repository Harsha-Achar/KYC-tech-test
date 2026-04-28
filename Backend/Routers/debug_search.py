# import os
# from azure.search.documents import SearchClient
# from azure.core.credentials import AzureKeyCredential
# from openai import AzureOpenAI

# from dotenv import load_dotenv
# load_dotenv("keys.env")
# # ===== CONFIG =====
# AZURE_SEARCH_ENDPOINT = "https://intellitag.search.windows.net"
# AZURE_SEARCH_KEY = os.getenv("AZURE_SEARCH_ADMIN_KEY")
# print("KEY:", AZURE_SEARCH_KEY)
# AZURE_SEARCH_INDEX = "tech-spec"

# AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
# AZURE_OPENAI_KEY = os.getenv("AZURE_OPENAI_API_KEY")
# EMBEDDING_MODEL = os.getenv("embedding_deployment")

# # ===== CLIENTS =====
# search_client = SearchClient(
#     endpoint=AZURE_SEARCH_ENDPOINT,
#     index_name=AZURE_SEARCH_INDEX,
#     credential=AzureKeyCredential(AZURE_SEARCH_KEY)
# )

# openai_client = AzureOpenAI(
#     api_key=AZURE_OPENAI_KEY,
#     azure_endpoint=AZURE_OPENAI_ENDPOINT,
#     api_version="2024-02-15-preview"
# )

# # ===== TEST QUERY =====
# query = "Business Value and Primary Use Cases"

# def generate_embedding(text):
#     res = openai_client.embeddings.create(
#         input=text,
#         model=EMBEDDING_MODEL
#     )
#     return res.data[0].embedding


# def run_test():
#     print("\n===== TEST START =====")

#     embedding = generate_embedding(query)

#     print("\n--- KEYWORD SEARCH ---")
#     results = search_client.search(search_text=query, top=5)

#     for i, r in enumerate(results):
#         print(f"\nResult {i+1}:")
#         print(r.get("content", "")[:500])

#     print("\n--- VECTOR SEARCH ---")
#     try:
#         from azure.search.documents.models import VectorizedQuery

#         vector_query = VectorizedQuery(
#             vector=embedding,
#             k_nearest_neighbors=5,
#             fields="embedding"
#         )

#         results = search_client.search(
#             search_text=None,
#             vector_queries=[vector_query],
#             top=5
#         )

#         for i, r in enumerate(results):
#             print(f"\nVector Result {i+1}:")
#             print(r.get("content", "")[:500])

#     except Exception as e:
#         print("Vector search failed:", e)

#     print("\n===== TEST END =====")


# if __name__ == "__main__":
#     run_test()

from azure.search.documents import SearchClient
from azure.core.credentials import AzureKeyCredential
import os
from dotenv import load_dotenv

load_dotenv("keys.env")

search_client = SearchClient(
    endpoint=os.getenv("AZURE_SEARCH_SERVICE_ENDPOINT"),
    index_name="tech-spec",
    credential=AzureKeyCredential(os.getenv("AZURE_SEARCH_ADMIN_KEY"))
)

def delete_all_documents():
    print("Fetching all document IDs...")

    results = search_client.search(
        search_text="*",
        select=["id"],
        top=1000   # batch size
    )

    ids = [doc["id"] for doc in results]

    print(f"Found {len(ids)} documents")

    if not ids:
        print("Index already empty.")
        return

    # delete in batch
    delete_actions = [{"id": doc_id} for doc_id in ids]
    search_client.delete_documents(documents=delete_actions)

    print("✅ All documents deleted!")

if __name__ == "__main__":
    delete_all_documents()


results = search_client.search(search_text="*", top=1)
print(list(results))