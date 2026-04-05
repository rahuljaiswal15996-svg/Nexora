from fastapi import APIRouter, Body, Header, HTTPException
from typing import Optional
from app.services.shadow import create_shadow_run, get_shadow_run, list_shadow_runs, set_shadow_review

router = APIRouter()


@router.post("/shadow")
async def create_shadow(payload: dict = Body(...), x_tenant_id: Optional[str] = Header(None)):
    tenant = x_tenant_id or "default"
    input_type = payload.get("input_type") or payload.get("type") or "code"
    input_blob = payload.get("input") or payload.get("code") or ""
    threshold = payload.get("threshold")
    if not input_blob:
        raise HTTPException(status_code=400, detail="input is required")
    created = create_shadow_run(tenant, input_type, input_blob, threshold)
    return {"status": "ok", "shadow_id": created["id"], "review_status": created["status"], "confidence": created["confidence"]}


@router.get("/shadow")
async def list_shadows(status: Optional[str] = None, x_tenant_id: Optional[str] = Header(None)):
    tenant = x_tenant_id or None
    rows = list_shadow_runs(tenant, status)
    return {"status": "ok", "count": len(rows), "items": rows}


@router.get("/shadow/{shadow_id}")
async def fetch_shadow(shadow_id: str):
    s = get_shadow_run(shadow_id)
    if not s:
        raise HTTPException(status_code=404, detail="shadow run not found")
    return s


@router.post("/shadow/{shadow_id}/review")
async def review_shadow(shadow_id: str, payload: dict = Body(...), x_tenant_id: Optional[str] = Header(None)):
    reviewer = payload.get("reviewer") or "unknown"
    action = payload.get("action")
    comment = payload.get("comment")
    if not action or action not in ("approve", "reject", "needs-fix"):
        raise HTTPException(status_code=400, detail="invalid action; must be one of approve|reject|needs-fix")
    updated = set_shadow_review(shadow_id, reviewer, action, comment)
    if not updated:
        raise HTTPException(status_code=404, detail="shadow run not found")
    return {"status": "ok", "shadow_id": shadow_id, "review": updated}
