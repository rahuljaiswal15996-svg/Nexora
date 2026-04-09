from typing import Dict, Any, cast

from app.core.settings import get_llm_provider


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


_registered_adapter: LLMAdapter | None = None


def _build_default_adapter() -> LLMAdapter:
    provider = get_llm_provider()
    if provider == "openai":
        try:
            from app.services.providers.openai_adapter import OpenAIAdapter

            return cast(LLMAdapter, OpenAIAdapter())
        except Exception:
            return MockAdapter()
    return MockAdapter()


def get_adapter() -> LLMAdapter:
    return _registered_adapter or _build_default_adapter()


def register_adapter(adapter: LLMAdapter) -> None:
    global _registered_adapter
    _registered_adapter = adapter
