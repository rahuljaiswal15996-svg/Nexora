import os
import re
from urllib.parse import urlparse


_TRUE_VALUES = {"1", "true", "yes", "on"}
_FALSE_VALUES = {"0", "false", "no", "off"}
_PRODUCTION_ENVIRONMENTS = {"production", "prod"}


def _get_string_env(name: str, default: str | None = None) -> str | None:
    configured = os.getenv(name)
    if configured is None:
        return default
    normalized = configured.strip()
    return normalized or default


def _get_bool_env(name: str, default: bool = False) -> bool:
    configured = os.getenv(name)
    if configured is None:
        return default
    normalized = configured.strip().lower()
    if normalized in _TRUE_VALUES:
        return True
    if normalized in _FALSE_VALUES:
        return False
    raise ValueError(f"{name} must be one of: {', '.join(sorted(_TRUE_VALUES | _FALSE_VALUES))}")


def _split_csv_env(name: str) -> list[str]:
    return [item.strip() for item in os.getenv(name, "").split(",") if item.strip()]


def _normalize_origin(origin: str) -> str:
    if origin == "*":
        raise ValueError("NEXORA_ALLOWED_ORIGINS must list explicit origins when credentials are enabled")

    parsed = urlparse(origin)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError(f"{origin!r} is not a valid HTTP origin")
    if parsed.path not in {"", "/"} or parsed.params or parsed.query or parsed.fragment:
        raise ValueError(f"{origin!r} must not include a path, query, or fragment")
    return f"{parsed.scheme}://{parsed.netloc}"


def get_environment() -> str:
    return (_get_string_env("NEXORA_ENV") or _get_string_env("ENVIRONMENT") or "development").lower()


def is_production_environment() -> bool:
    return get_environment() in _PRODUCTION_ENVIRONMENTS


def get_allowed_origins() -> list[str]:
    unique: list[str] = []
    seen: set[str] = set()
    for origin in _split_csv_env("NEXORA_ALLOWED_ORIGINS"):
        normalized = _normalize_origin(origin)
        if normalized in seen:
            continue
        seen.add(normalized)
        unique.append(normalized)
    return unique


def get_allowed_origin_regex() -> str | None:
    configured = _get_string_env("NEXORA_ALLOWED_ORIGIN_REGEX")
    if configured is None:
        return None
    re.compile(configured)
    return configured


def require_explicit_cors_configuration() -> bool:
    return _get_bool_env("NEXORA_REQUIRE_EXPLICIT_CORS", default=is_production_environment())


def get_cors_configuration() -> tuple[list[str], str | None]:
    allowed_origins = get_allowed_origins()
    allowed_origin_regex = get_allowed_origin_regex()
    if require_explicit_cors_configuration() and not allowed_origins and allowed_origin_regex is None:
        raise RuntimeError(
            "Configure NEXORA_ALLOWED_ORIGINS or NEXORA_ALLOWED_ORIGIN_REGEX before starting Nexora in production."
        )
    return allowed_origins, allowed_origin_regex


def get_optional_url(name: str) -> str | None:
    configured = _get_string_env(name)
    if not configured:
        return None
    return configured.rstrip("/")


def get_jwks_url() -> str | None:
    return get_optional_url("NEXORA_JWKS_URL")


def get_jwks_audience() -> str | None:
    return _get_string_env("NEXORA_JWKS_AUD")


def get_jwt_secret() -> str:
    configured = _get_string_env("NEXORA_JWT_SECRET")
    if configured:
        return configured
    if is_production_environment() and get_jwks_url() is None:
        raise RuntimeError(
            "Set NEXORA_JWT_SECRET or configure NEXORA_JWKS_URL before starting Nexora in production."
        )
    return "dev-secret"


def get_jwt_algorithm() -> str:
    return _get_string_env("NEXORA_JWT_ALGO", "HS256") or "HS256"


def get_dev_tokens_allowed() -> bool:
    return _get_bool_env("NEXORA_ALLOW_DEV_TOKENS", default=not is_production_environment())


def get_dev_token_expiration_seconds() -> int:
    configured = _get_string_env("NEXORA_DEV_TOKEN_EXP_SECONDS", "86400") or "86400"
    return max(1, int(configured))


def get_default_role() -> str:
    default_role = "viewer" if is_production_environment() else "admin"
    return (_get_string_env("NEXORA_DEFAULT_ROLE", default_role) or default_role).lower()


def get_default_tenant_id() -> str:
    return _get_string_env("NEXORA_DEFAULT_TENANT_ID", "default") or "default"


def get_default_user_id() -> str:
    default_user = "anonymous@nexora.local" if is_production_environment() else "dev@local"
    return _get_string_env("NEXORA_DEFAULT_USER_ID", default_user) or default_user


def get_llm_provider() -> str:
    return (_get_string_env("NEXORA_LLM_PROVIDER", "mock") or "mock").lower()


def get_openai_api_key() -> str | None:
    return _get_string_env("OPENAI_API_KEY") or _get_string_env("NEXORA_OPENAI_API_KEY")


def get_openai_model() -> str:
    return _get_string_env("NEXORA_OPENAI_MODEL", "gpt-4o-mini") or "gpt-4o-mini"


def validate_runtime_configuration() -> None:
    get_cors_configuration()
    if is_production_environment() and get_dev_tokens_allowed():
        raise RuntimeError("NEXORA_ALLOW_DEV_TOKENS must be disabled when NEXORA_ENV=production")
    if get_jwks_url() is None:
        get_jwt_secret()