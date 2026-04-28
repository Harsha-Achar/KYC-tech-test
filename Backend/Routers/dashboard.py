from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def get_dashboard():
    return {
        "total_clients": 10,
        "successful": 6,
        "in_progress": 2,
        "issues": 2
    }