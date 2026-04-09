from typing import Dict, Any

from app.core.settings import get_openai_api_key, get_openai_model

try:
    import openai
except Exception:
    openai = None


class OpenAIAdapter:
    """Adapter for OpenAI's API.

    Reads API key and model from environment variables:
    - `OPENAI_API_KEY` or `NEXORA_OPENAI_API_KEY`
    - `NEXORA_OPENAI_MODEL` (defaults to `gpt-4o-mini`)

    This is intentionally lightweight: errors are surfaced to callers
    so the ConversionEngine can fall back to rule-based conversion.
    """

    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or get_openai_api_key()
        self.model = model or get_openai_model()
        if openai and self.api_key:
            openai.api_key = self.api_key

    def generate(self, prompt: str, context: Dict[str, Any] | None = None) -> Dict[str, Any]:
        if openai is None:
            raise RuntimeError("openai package is not installed")

        # Prefer ChatCompletion API when available
        try:
            if hasattr(openai, "ChatCompletion"):
                resp = openai.ChatCompletion.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.0,
                )
                text = resp["choices"][0]["message"]["content"]
                meta = {"model_version": self.model, "usage": resp.get("usage", {})}
                return {"converted": text, **meta}

            # Fallback to legacy Completion API
            resp = openai.Completion.create(
                model=self.model,
                prompt=prompt,
                max_tokens=1024,
                temperature=0.0,
            )
            text = resp["choices"][0]["text"]
            meta = {"model_version": self.model, "usage": resp.get("usage", {})}
            return {"converted": text, **meta}

        except Exception as e:
            # Let callers decide how to handle adapter failures
            raise
