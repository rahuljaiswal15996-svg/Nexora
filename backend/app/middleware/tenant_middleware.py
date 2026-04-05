from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import logging

logger = logging.getLogger("nexora.tenant")


class TenantMiddleware(BaseHTTPMiddleware):
    """Simple tenant scoping middleware.

    - Reads `X-Tenant-ID` header and sets `request.state.tenant_id`.
    - If header missing, falls back to 'default'.
    - Future: validate tenant existence, JWT claim extraction, and tenant scoping enforcement.
    """

    async def dispatch(self, request: Request, call_next):
        tenant = request.headers.get("x-tenant-id") or request.headers.get("X-Tenant-ID") or "default"
        request.state.tenant_id = tenant
        logger.debug("Request for tenant=%s path=%s", tenant, request.url.path)
        response: Response = await call_next(request)
        # expose tenant in response headers for debugging
        response.headers.setdefault("x-tenant-id", tenant)
        return response
