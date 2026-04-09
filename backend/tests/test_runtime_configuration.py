from pathlib import Path
import sys

import pytest

# Ensure backend package is importable when running tests from repo root.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.settings import (
    get_allowed_origin_regex,
    get_allowed_origins,
    get_cors_configuration,
    get_default_role,
    get_dev_tokens_allowed,
    validate_runtime_configuration,
)


RUNTIME_ENV_KEYS = (
    "ENVIRONMENT",
    "NEXORA_ALLOWED_ORIGINS",
    "NEXORA_ALLOWED_ORIGIN_REGEX",
    "NEXORA_ALLOW_DEV_TOKENS",
    "NEXORA_DEFAULT_ROLE",
    "NEXORA_ENV",
    "NEXORA_JWKS_URL",
    "NEXORA_JWT_SECRET",
    "NEXORA_REQUIRE_EXPLICIT_CORS",
)


def _clear_runtime_env(monkeypatch):
    for key in RUNTIME_ENV_KEYS:
        monkeypatch.delenv(key, raising=False)


def test_allowed_origins_require_explicit_configuration(monkeypatch):
    _clear_runtime_env(monkeypatch)

    assert get_allowed_origins() == []


def test_allowed_origins_parse_comma_separated_values_without_duplicates(monkeypatch):
    _clear_runtime_env(monkeypatch)
    monkeypatch.setenv(
        "NEXORA_ALLOWED_ORIGINS",
        "https://app.example.com/, http://localhost:3000, https://app.example.com",
    )

    assert get_allowed_origins() == ["https://app.example.com", "http://localhost:3000"]


def test_allowed_origins_reject_non_origin_values(monkeypatch):
    _clear_runtime_env(monkeypatch)
    monkeypatch.setenv("NEXORA_ALLOWED_ORIGINS", "https://app.example.com/path")

    with pytest.raises(ValueError, match="must not include a path"):
        get_allowed_origins()


def test_allowed_origin_regex_is_optional_and_trimmed(monkeypatch):
    _clear_runtime_env(monkeypatch)
    assert get_allowed_origin_regex() is None

    monkeypatch.setenv("NEXORA_ALLOWED_ORIGIN_REGEX", "  https://.*\\.example\\.com  ")
    assert get_allowed_origin_regex() == "https://.*\\.example\\.com"


def test_production_requires_explicit_cors_configuration(monkeypatch):
    _clear_runtime_env(monkeypatch)
    monkeypatch.setenv("NEXORA_ENV", "production")

    with pytest.raises(RuntimeError, match="Configure NEXORA_ALLOWED_ORIGINS"):
        get_cors_configuration()


def test_dev_tokens_default_to_disabled_in_production(monkeypatch):
    _clear_runtime_env(monkeypatch)
    monkeypatch.setenv("NEXORA_ENV", "production")

    assert get_dev_tokens_allowed() is False


def test_default_role_is_viewer_in_production(monkeypatch):
    _clear_runtime_env(monkeypatch)
    monkeypatch.setenv("NEXORA_ENV", "production")

    assert get_default_role() == "viewer"


def test_runtime_validation_requires_auth_secret_or_jwks_in_production(monkeypatch):
    _clear_runtime_env(monkeypatch)
    monkeypatch.setenv("NEXORA_ENV", "production")
    monkeypatch.setenv("NEXORA_ALLOWED_ORIGINS", "https://app.example.com")

    with pytest.raises(RuntimeError, match="Set NEXORA_JWT_SECRET or configure NEXORA_JWKS_URL"):
        validate_runtime_configuration()

    monkeypatch.setenv("NEXORA_JWT_SECRET", "production-secret")
    validate_runtime_configuration()