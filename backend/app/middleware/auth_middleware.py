import os
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

import jwt
try:
    from jwt import PyJWKClient  # type: ignore
except Exception:
    PyJWKClient = None

from app.core.settings import get_jwks_audience, get_jwks_url, get_jwt_algorithm, get_jwt_secret

logger = logging.getLogger("nexora.auth")

_jwk_client = None
_jwk_client_url = None


def _get_jwk_client(jwks_url: str):
    global _jwk_client
    global _jwk_client_url
    if _jwk_client is None or _jwk_client_url != jwks_url:
        _jwk_client = PyJWKClient(jwks_url)
        _jwk_client_url = jwks_url
    return _jwk_client


def decode_jwt(token: str):
    """Decode JWT using JWKS (if configured) or fallback to HMAC secret.

    Returns decoded payload dict or None on failure.
    """
    jwks_url = get_jwks_url()
    jwks_audience = get_jwks_audience()
    try:
        if jwks_url and PyJWKClient is not None:
            try:
                signing_key = _get_jwk_client(jwks_url).get_signing_key_from_jwt(token)
                key = signing_key.key
                alg = signing_key.algorithm or "RS256"
                options = {"verify_aud": bool(jwks_audience)}
                payload = jwt.decode(
                    token,
                    key=key,
                    algorithms=[alg],
                    audience=jwks_audience if jwks_audience else None,
                    options=options,
                )
                return payload
            except Exception as e:
                logger.debug("JWKS verification failed: %s", e)
                return None
        else:
            payload = jwt.decode(
                token,
                get_jwt_secret(),
                algorithms=[get_jwt_algorithm()],
                options={"verify_aud": False},
            )
            return payload
    except RuntimeError:
        raise
    except Exception as e:
        logger.debug("JWT decode failed: %s", e)
        return None


class AuthMiddleware(BaseHTTPMiddleware):
    """Middleware that decodes Authorization: Bearer <token> and populates request.state.

    Behavior:
    - If `NEXORA_JWKS_URL` is set and `PyJWKClient` is available, tokens are
      validated against the JWKS endpoint (supports RS* keys).
    - Otherwise falls back to HMAC using `NEXORA_JWT_SECRET` (dev mode).

    The middleware sets `request.state.user`, `request.state.jwt_payload`, and
    `request.state.tenant_id` (if present in claims).
    """

    async def dispatch(self, request: Request, call_next):
        auth = request.headers.get("authorization")
        if auth and auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1]
            payload = decode_jwt(token)
            if payload:
                request.state.user = payload.get("sub") or payload.get("email")
                request.state.jwt_payload = payload
                tenant = payload.get("tenant") or payload.get("tenant_id") or payload.get("tid")
                if tenant:
                    request.state.tenant_id = tenant
        response: Response = await call_next(request)
        return response
