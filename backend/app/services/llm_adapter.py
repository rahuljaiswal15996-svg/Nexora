import os
from typing import Dict, Any


class LLMAdapter:
    """Abstract adapter interface for LLM providers."""

    def generate(self, prompt: str, context: Dict[str, Any] | None = None) -> Dict[str, Any]:
        raise NotImplementedError()


class MockAdapter(LLMAdapter):
    """Simple deterministic mock adapter for local development and tests.

    It returns a mildly transformed version of the provided prompt/code and
    includes metadata (model version, confidence). This allows the conversion
    engine to be exercised without calling external APIs.
    """

    def __init__(self, version: str = "mock-v1"):
        self.version = version

    def generate(self, prompt: str, context: Dict[str, Any] | None = None) -> Dict[str, Any]:
        # Heuristic transformations to simulate a converted candidate
        code = prompt or ""
        converted = code.replace("PROC SQL", "SELECT").replace("proc sql", "select")
        converted = converted.replace("%LET", "-- %LET")
        # Add a mock footer so downstream can detect mock output
        converted = converted + "\n-- converted-by: mock-adapter/" + self.version

        return {
            "converted": converted,
            "model_version": self.version,
            "confidence": 0.75,
            "prompt": prompt,
            "context": context or {},
        }


# configure global adapter from environment (supports pluggable providers)
_provider = os.getenv("NEXORA_LLM_PROVIDER", "mock").lower()
if _provider == "openai":
    try:
        from app.services.providers.openai_adapter import OpenAIAdapter

        _default_adapter: LLMAdapter = OpenAIAdapter()
    except Exception:
        # fallback to mock adapter if provider initialization fails
        _default_adapter: LLMAdapter = MockAdapter()
else:
    _default_adapter: LLMAdapter = MockAdapter()


def get_adapter() -> LLMAdapter:
    return _default_adapter


def register_adapter(adapter: LLMAdapter) -> None:
    global _default_adapter
    _default_adapter = adapter
