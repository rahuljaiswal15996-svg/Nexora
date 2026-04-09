from fastapi import APIRouter, HTTPException, Body
from datetime import datetime, timedelta, timezone
import jwt

from app.core.settings import (
    get_default_role,
    get_default_tenant_id,
    get_default_user_id,
    get_dev_token_expiration_seconds,
    get_dev_tokens_allowed,
    get_jwt_algorithm,
    get_jwt_secret,
)

router = APIRouter()


@router.post("/auth/token")
async def issue_token(payload: dict = Body(...)):
    if not get_dev_tokens_allowed():
        raise HTTPException(status_code=403, detail="Dev token issuance disabled")

    tenant = payload.get("tenant_id", get_default_tenant_id())
    user = payload.get("user", get_default_user_id())
    role = payload.get("role", get_default_role())
    exp_seconds = int(payload.get("exp_seconds", get_dev_token_expiration_seconds()))
    now = datetime.now(timezone.utc)
    claims = {
        "sub": user,
        "tenant": tenant,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=exp_seconds)).timestamp()),
    }
    token = jwt.encode(claims, get_jwt_secret(), algorithm=get_jwt_algorithm())
    return {"access_token": token, "token_type": "bearer", "expires_in": exp_seconds}
