from datetime import datetime
from fastapi import APIRouter, Header
from app.services.history import create_history_entry, save_history

router = APIRouter()


@router.post("/deploy")
async def deploy(payload: dict, x_tenant_id: str | None = Header(None)):
    """Simulated deploy endpoint - records a history event for the deployed asset.

    Payload example: {"artifact_id": "...", "notes": "..."}
    """
    tenant_id = x_tenant_id or "default"
    now = datetime.utcnow().isoformat() + "Z"
    entry = create_history_entry({
        "timestamp": now,
        "filename": payload.get("artifact_id", "unknown"),
        "summary": f"deployed: {payload.get('notes', '')}",
        "original_content": "",
        "converted_content": "",
    })
    save_history(entry)
    return {"status": "deployed", "tenant_id": tenant_id, "deployed_at": now}
