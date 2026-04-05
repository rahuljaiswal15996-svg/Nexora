import re
import logging
import textwrap
from datetime import datetime, timezone
from typing import Dict, Any

from app.services.comparison import compare_code
from app.services.llm_adapter import get_adapter
from app.services.prompt_store import get_prompt

logger = logging.getLogger("nexora.conversion")

SQL_SOURCE_LANGUAGES = {"sql", "sas", "spark_sql", "hive", "impala"}
PYTHON_SOURCE_LANGUAGES = {"python", "py", "pyspark"}
DEFAULT_TARGET_LANGUAGE = "python"

class ConversionEngine:
    """Hybrid conversion engine: deterministic rules + LLM hook (placeholder).

    This is a lightweight, versionable entrypoint for conversions. LLM calls
    should be routed through a provider adapter (not implemented here).
    """

    def __init__(self):
        self.version = "v0.1-rule-first"

    def normalize_language(self, language: str | None, fallback: str = "auto") -> str:
        return (language or fallback or "auto").lower()

    def _to_sql(self, code: str) -> str:
        out = code
        # Simple heuristics for SAS PROC SQL -> SQL
        out = re.sub(r"(?im)^\s*proc\s+sql;?", "", out)
        out = re.sub(r"(?im)^\s*quit;?\s*$", "", out, flags=re.M)
        out = out.replace("PROC SQL", "SELECT").replace("proc sql", "select")
        # strip common SAS comments (/* ... */)
        out = re.sub(r"/\*.*?\*/", "", out, flags=re.S)
        # placeholder comment transformations
        out = out.replace("%LET", "-- %LET")
        return out.strip()

    def _manual_conversion_note(self, source_language: str, target_language: str, code: str) -> str:
        indented_code = textwrap.indent(code.strip() or "# empty input", "# ")
        return (
            f"# Manual follow-up required: {source_language} to {target_language}\n"
            "# Nexora preserved the original logic below for deterministic review.\n"
            f"{indented_code}"
        )

    def _to_python(self, code: str, source_language: str) -> str:
        sql_body = self._to_sql(code)
        if source_language in SQL_SOURCE_LANGUAGES or sql_body.upper().startswith("SELECT"):
            return (
                "import pandas as pd\n\n"
                "query = \"\"\"\n"
                f"{sql_body}\n"
                "\"\"\"\n\n"
                "result_df = pd.read_sql_query(query, connection)\n"
                "result_df.head()\n"
            )
        if source_language in PYTHON_SOURCE_LANGUAGES:
            return code.strip()
        return self._manual_conversion_note(source_language, "python", code)

    def _to_pyspark(self, code: str, source_language: str) -> str:
        sql_body = self._to_sql(code)
        if source_language in SQL_SOURCE_LANGUAGES or sql_body.upper().startswith("SELECT"):
            return (
                "from pyspark.sql import SparkSession\n\n"
                "spark = SparkSession.builder.getOrCreate()\n"
                "result_df = spark.sql(\"\"\"\n"
                f"{sql_body}\n"
                "\"\"\")\n"
                "result_df.show()\n"
            )
        if source_language == "python":
            return (
                "from pyspark.sql import SparkSession\n\n"
                "spark = SparkSession.builder.getOrCreate()\n\n"
                f"{code.strip()}\n"
            )
        return self._manual_conversion_note(source_language, "pyspark", code)

    def _to_dbt(self, code: str, source_language: str) -> str:
        sql_body = self._to_sql(code)
        if source_language in SQL_SOURCE_LANGUAGES or sql_body.upper().startswith("SELECT"):
            return (
                "{{ config(materialized='view') }}\n\n"
                f"{sql_body}\n"
            )
        return self._manual_conversion_note(source_language, "dbt", code)

    def rule_based_convert(
        self,
        code: str,
        source_language: str | None = None,
        target_language: str | None = None,
    ) -> str:
        normalized_source = self.normalize_language(source_language)
        normalized_target = self.normalize_language(target_language, DEFAULT_TARGET_LANGUAGE)

        if normalized_target == "sql":
            return self._to_sql(code)
        if normalized_target == "python":
            return self._to_python(code, normalized_source)
        if normalized_target == "pyspark":
            return self._to_pyspark(code, normalized_source)
        if normalized_target == "dbt":
            return self._to_dbt(code, normalized_source)
        return self._manual_conversion_note(normalized_source, normalized_target, code)

    def llm_convert(
        self,
        code: str,
        source_language: str | None = None,
        target_language: str | None = None,
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
            tmpl = p.get("template") if p else None
            if isinstance(tmpl, str) and tmpl:
                prompt_text = tmpl.replace("{code}", code).replace("{{code}}", code)
            else:
                prompt_text = (
                    f"Convert {source_language or 'legacy'} code to modern {target_language or DEFAULT_TARGET_LANGUAGE}:\n\n{code}"
                )
        else:
            prompt_text = (
                f"Convert {source_language or 'legacy'} code to modern {target_language or DEFAULT_TARGET_LANGUAGE}:\n\n{code}"
            )

        try:
            resp = adapter.generate(
                prompt_text,
                {"language": source_language, "target_language": target_language},
            )
            converted = resp.get("converted") or resp.get("text") or self.rule_based_convert(code, source_language, target_language)
            # attach adapter info in logs for traceability
            logger.debug("LLM adapter responded: %s", {k: v for k, v in resp.items() if k != 'prompt'})
            return converted
        except Exception:
            logger.exception("LLM conversion failed; falling back to rules")
            return self.rule_based_convert(code, source_language, target_language)

    def convert(
        self,
        code: str,
        language: str | None = None,
        target_language: str | None = None,
        tenant_id: str = "default",
        request_id: str | None = None,
        prompt_name: str | None = None,
        prompt_version: str | None = None,
    ) -> Dict[str, Any]:
        original = code
        source_language = self.normalize_language(language)
        normalized_target = self.normalize_language(target_language, DEFAULT_TARGET_LANGUAGE)
        converted = self.rule_based_convert(code, source_language, normalized_target)
        adapter_meta = None

        # If rule-based conversion made no changes, attempt LLM-assisted conversion
        if not converted.strip() or converted.strip() == original.strip():
            try:
                # Use named prompt if provided
                prompt_text = None
                if prompt_name:
                    p = get_prompt(tenant_id, prompt_name, prompt_version)
                    tmpl = p.get("template") if p else None
                    if isinstance(tmpl, str) and tmpl:
                        prompt_text = tmpl.replace("{code}", code).replace("{{code}}", code)

                adapter = get_adapter()
                resp = adapter.generate(
                    prompt_text or f"Convert {source_language} code to modern {normalized_target}:\n\n{code}",
                    {
                        "language": source_language,
                        "target_language": normalized_target,
                        "tenant_id": tenant_id,
                    },
                )
                adapter_meta = {k: v for k, v in resp.items() if k != "prompt"}
                converted = resp.get("converted") or resp.get("text") or converted
            except Exception:
                logger.exception("LLM adapter failed; keeping rule-based conversion")

        comparison = compare_code(original, converted)

        meta: Dict[str, Any] = {
            "engine_version": self.version,
            "tenant_id": tenant_id,
            "request_id": request_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "supported_targets": ["python", "sql", "pyspark", "dbt"],
        }
        if adapter_meta:
            meta["adapter"] = adapter_meta

        return {
            "original": original,
            "converted": converted,
            "comparison": comparison,
            "source_language": source_language,
            "target_language": normalized_target,
            "meta": meta,
        }


_engine = ConversionEngine()


def convert_code(
    code: str,
    language: str | None = None,
    target_language: str | None = None,
    tenant_id: str = "default",
    request_id: str | None = None,
    prompt_name: str | None = None,
    prompt_version: str | None = None,
) -> Dict[str, Any]:
    return _engine.convert(
        code,
        language=language,
        target_language=target_language,
        tenant_id=tenant_id,
        request_id=request_id,
        prompt_name=prompt_name,
        prompt_version=prompt_version,
    )
