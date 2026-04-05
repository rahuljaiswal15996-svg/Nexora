import re
import json
import logging
from datetime import datetime
from uuid import uuid4
from typing import Dict, Any

from app.services.comparison import compare_code
from app.services.llm_adapter import get_adapter
from app.services.prompt_store import get_prompt

logger = logging.getLogger("nexora.conversion")

class ConversionEngine:
    """Hybrid conversion engine: deterministic rules + LLM hook (placeholder).

    This is a lightweight, versionable entrypoint for conversions. LLM calls
    should be routed through a provider adapter (not implemented here).
    """

    def __init__(self):
        self.version = "v0.1-rule-first"

    def rule_based_convert(self, code: str, language: str | None = None) -> str:
        out = code
        # Simple heuristics for SAS PROC SQL -> SQL
        out = re.sub(r"(?im)^\s*proc\s+sql;?", "", out)
        out = re.sub(r"(?im)^\s*quit;?\s*$", "", out, flags=re.M)
        out = out.replace("PROC SQL", "SELECT").replace("proc sql", "select")
        # strip common SAS comments (/* ... */)
        out = re.sub(r"/\*.*?\*/", "", out, flags=re.S)
        # placeholder comment transformations
        out = out.replace("%LET", "-- %LET")
        return out

    def llm_convert(
        self,
        code: str,
        language: str | None = None,
        prompt: str | None = None,
        prompt_name: str | None = None,
        prompt_version: str | None = None,
    ) -> str:
        adapter = get_adapter()

        # Resolve prompt template: explicit prompt string > named prompt in store > default
        if prompt:
            prompt_text = prompt
        elif prompt_name:
            p = get_prompt("default", prompt_name, prompt_version) if prompt_name else None
            if p and p.get("template"):
                tmpl = p.get("template")
                prompt_text = tmpl.replace("{code}", code).replace("{{code}}", code)
            else:
                prompt_text = f"Convert legacy code to modern SQL:\n\n{code}"
        else:
            prompt_text = f"Convert legacy code to modern SQL:\n\n{code}"

        try:
            resp = adapter.generate(prompt_text, {"language": language})
            converted = resp.get("converted") or resp.get("text") or self.rule_based_convert(code, language)
            # attach adapter info in logs for traceability
            logger.debug("LLM adapter responded: %s", {k: v for k, v in resp.items() if k != 'prompt'})
            return converted
        except Exception:
            logger.exception("LLM conversion failed; falling back to rules")
            return self.rule_based_convert(code, language)

    def convert(
        self,
        code: str,
        language: str | None = None,
        tenant_id: str = "default",
        request_id: str | None = None,
        prompt_name: str | None = None,
        prompt_version: str | None = None,
    ) -> Dict[str, Any]:
        original = code
        converted = self.rule_based_convert(code, language)
        adapter_meta = None

        # If rule-based conversion made no changes, attempt LLM-assisted conversion
        if not converted.strip() or converted.strip() == original.strip():
            try:
                # Use named prompt if provided
                prompt_text = None
                if prompt_name:
                    p = get_prompt(tenant_id, prompt_name, prompt_version)
                    if p and p.get("template"):
                        prompt_text = p.get("template").replace("{code}", code).replace("{{code}}", code)

                adapter = get_adapter()
                resp = adapter.generate(prompt_text or f"Convert legacy code to modern SQL:\n\n{code}", {"language": language, "tenant_id": tenant_id})
                adapter_meta = {k: v for k, v in resp.items() if k != "prompt"}
                converted = resp.get("converted") or resp.get("text") or converted
            except Exception:
                logger.exception("LLM adapter failed; keeping rule-based conversion")

        comparison = compare_code(original, converted)

        meta = {"engine_version": self.version, "tenant_id": tenant_id, "request_id": request_id}
        if adapter_meta:
            meta["adapter"] = adapter_meta

        return {
            "original": original,
            "converted": converted,
            "comparison": comparison,
            "meta": meta,
        }


_engine = ConversionEngine()


def convert_code(
    code: str,
    language: str | None = None,
    tenant_id: str = "default",
    request_id: str | None = None,
    prompt_name: str | None = None,
    prompt_version: str | None = None,
) -> Dict[str, Any]:
    return _engine.convert(
        code, language=language, tenant_id=tenant_id, request_id=request_id, prompt_name=prompt_name, prompt_version=prompt_version
    )
