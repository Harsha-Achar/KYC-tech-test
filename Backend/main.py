import importlib
import logging
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv("keys.env")

logger = logging.getLogger(__name__)
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def include_router_if_available(module_name: str, prefix: str, tags: list[str]) -> None:
    try:
        module = importlib.import_module(f"Routers.{module_name}")
        app.include_router(module.router, prefix=prefix, tags=tags)
    except Exception as exc:
        logger.warning("Skipping router '%s' due to import error: %s", module_name, exc)


include_router_if_available("upload", "/upload", ["Upload"])
include_router_if_available("dashboard", "/dashboard", ["Dashboard"])
include_router_if_available("issue", "/issues", ["Issues"])
include_router_if_available("issue_insights", "/issue-insights", ["Issue Insights"])
include_router_if_available("chatbot", "/chatbot", ["Chatbot"])
include_router_if_available("client_config", "/client-config", ["Client Configuration"])
include_router_if_available("compatibility", "/compatibility", ["Compatibility"])
include_router_if_available("start_mail", "/start-mail", ["Start Mail"])

@app.get("/")
def root():
    return {"message": "Backend running"}