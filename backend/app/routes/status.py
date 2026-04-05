from fastapi import APIRouter

router = APIRouter()

@router.get("/status")
async def status():
    return {
        "status": "ok",
        "service": "Nexora MVP",
        "detail": "FastAPI backend is running",
    }
