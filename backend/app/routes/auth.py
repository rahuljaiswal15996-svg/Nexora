from fastapi import APIRouter, HTTPException, Body
from datetime import datetime, timedelta
import os
import jwt

router = APIRouter()

SECRET = os.getenv("NEXORA_JWT_SECRET", "dev-secret")
ALGO = "HS256"
DEV_TOKENS_ALLOWED = os.getenv("NEXORA_ALLOW_DEV_TOKENS", "true").lower() == "true"


@router.post("/auth/token")
async def issue_token(payload: dict = Body(...)):
    if not DEV_TOKENS_ALLOWED:
        raise HTTPException(status_code=403, detail="Dev token issuance disabled")

    tenant = payload.get("tenant_id", "default")
    user = payload.get("user", "dev@local")
    role = payload.get("role", "admin")
    exp_seconds = int(payload.get("exp_seconds", 86400))
    now = datetime.utcnow()
    claims = {
        "sub": user,
        "tenant": tenant,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=exp_seconds)).timestamp()),
    }
    token = jwt.encode(claims, SECRET, algorithm=ALGO)
    return {"access_token": token, "token_type": "bearer", "expires_in": exp_seconds}
