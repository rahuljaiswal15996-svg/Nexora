import ast
import re
import json
from uuid import uuid4
from typing import Dict, Any

# Minimal multi-language parser for MVP UIR generation
# - For Python: use builtin ast to generate a structural AST
# - For SQL/SAS: do statement-level splitting and token extraction


def _parse_python(code: str) -> Dict[str, Any]:
    try:
        tree = ast.parse(code)
        return {"ast": ast.dump(tree), "type": "python"}
    except Exception as e:
        return {"ast": None, "error": str(e), "type": "python"}


def _parse_sql(code: str) -> Dict[str, Any]:
    # naive SQL statement splitter
    statements = [s.strip() for s in re.split(r";\s*\n|;", code) if s.strip()]
    tokens = []
    for st in statements:
        parts = re.split(r"\s+", st)
        tokens.append({"statement": st, "tokens": parts[:20]})
    return {"statements": tokens, "type": "sql"}


def parse_to_uir(content: str, language: str | None = None) -> Dict[str, Any]:
    lang = (language or "auto").lower()
    uir = {
        "id": str(uuid4()),
        "language": lang,
        "metadata": {"length": len(content), "lines": content.count("\n") + 1},
        "ast": None,
        "symbols": [],
        "data_access": [],
    }

    if lang in ("py", "python") or (lang == "auto" and content.lstrip().startswith("def ")):
        parsed = _parse_python(content)
        uir["ast"] = parsed.get("ast")
        # simple symbol extraction (function names)
        try:
            tree = ast.parse(content)
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    uir["symbols"].append({"type": "function", "name": node.name})
        except Exception:
            pass

    elif lang in ("sql", "sas") or (lang == "auto" and content.strip().upper().startswith(("SELECT", "PROC", "INSERT", "UPDATE"))):
        parsed = _parse_sql(content)
        uir["ast"] = json.dumps(parsed)
        for st in parsed.get("statements", []):
            # quick heuristic: find tokens that look like table identifiers
            table_tokens = [t for t in st.get("tokens", []) if t.isidentifier() and t.lower() not in ("select", "from", "where", "join", "proc", "sql")]
            for t in table_tokens[:3]:
                uir["data_access"].append({"type": "table", "name": t})

    else:
        # fallback: simple tokenizer
        tokens = re.split(r"\s+", content.strip())[:200]
        uir["ast"] = json.dumps({"tokens": tokens})

    return uir
