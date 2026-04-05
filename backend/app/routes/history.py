from fastapi import APIRouter
from app.services.history import clear_history, load_history

router = APIRouter()

@router.get("/history")
async def get_history():
    return load_history()

@router.delete("/history")
async def delete_history():
    clear_history()
    return {"status": "ok", "cleared": True}
