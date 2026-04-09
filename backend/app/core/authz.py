from typing import Any, Dict

from fastapi import Header, HTTPException, Request

from app.core.settings import get_default_role, get_default_tenant_id, get_default_user_id


ROLE_ORDER = {
    "viewer": 0,
    "editor": 1,
    "admin": 2,
}
Principal = Dict[str, Any]


def normalize_role(role: str | None) -> str:
    candidate = (role or get_default_role() or "viewer").lower()
    return candidate if candidate in ROLE_ORDER else "viewer"


def build_principal(
    request: Request,
    x_user_id: str | None = None,
    x_user_role: str | None = None,
    x_tenant_id: str | None = None,
) -> Dict[str, Any]:
    payload = getattr(request.state, "jwt_payload", None) or {}
    tenant_id = (
        x_tenant_id
        or getattr(request.state, "tenant_id", None)
        or payload.get("tenant")
        or payload.get("tenant_id")
        or payload.get("tid")
        or get_default_tenant_id()
    )
    user_id = (
        payload.get("sub")
        or getattr(request.state, "user", None)
        or x_user_id
        or get_default_user_id()
    )
    role = normalize_role(payload.get("role") or x_user_role)

    principal = {
        "tenant_id": tenant_id,
        "user_id": user_id,
        "role": role,
    }
    request.state.principal = principal
    request.state.user = user_id
    request.state.tenant_id = tenant_id
    return principal


def principal_tenant(request: Request, principal: Principal) -> str:
    return str(principal.get("tenant_id") or getattr(request.state, "tenant_id", get_default_tenant_id()))


def principal_user(principal: Principal) -> str:
    return str(principal.get("user_id") or get_default_user_id())


def require_min_role(min_role: str):
    minimum = normalize_role(min_role)

    async def dependency(
        request: Request,
        x_user_id: str | None = Header(None),
        x_user_role: str | None = Header(None),
        x_tenant_id: str | None = Header(None),
    ) -> Dict[str, Any]:
        principal = build_principal(request, x_user_id, x_user_role, x_tenant_id)
        if ROLE_ORDER[principal["role"]] < ROLE_ORDER[minimum]:
            raise HTTPException(
                status_code=403,
                detail=f"{minimum} role required for this action",
            )
        return principal

    return dependency


require_viewer = require_min_role("viewer")
require_editor = require_min_role("editor")
require_admin = require_min_role("admin")