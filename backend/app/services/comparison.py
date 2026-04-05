import difflib
import json
from typing import Any, Dict


def compare_code(original: str, converted: str) -> Dict[str, Any]:
    """Text-level comparison: unified diff + similarity ratio."""
    original_lines = original.splitlines()
    converted_lines = converted.splitlines()
    diff_lines = list(
        difflib.unified_diff(
            original_lines, converted_lines, fromfile="original", tofile="converted", lineterm=""
        )
    )
    ratio = difflib.SequenceMatcher(None, original, converted).ratio()

    return {
        "changed": original != converted,
        "original_length": len(original),
        "converted_length": len(converted),
        "original_line_count": len(original_lines),
        "converted_line_count": len(converted_lines),
        "similarity_ratio": round(ratio, 3),
        "diff": diff_lines,
        "diff_count": sum(1 for line in diff_lines if line.startswith("+") or line.startswith("-")),
    }


def _ensure_dict(obj: Any) -> Dict[str, Any]:
    if obj is None:
        return {}
    if isinstance(obj, str):
        try:
            return json.loads(obj)
        except Exception:
            return {}
    if isinstance(obj, dict):
        return obj
    return {}


def semantic_compare(uir_a: Any, uir_b: Any) -> Dict[str, Any]:
    """UIR-level semantic comparison (heuristic Jaccard scores on symbols/tables).

    This is intentionally lightweight for the MVP but exposes a clear contract
    for richer AST/semantic comparisons later.
    """
    a = _ensure_dict(uir_a)
    b = _ensure_dict(uir_b)

    def _names(items):
        out = set()
        for it in items or []:
            if isinstance(it, dict):
                name = it.get("name") or it.get("id")
                if name:
                    out.add(str(name))
            else:
                out.add(str(it))
        return out

    symbols_a = _names(a.get("symbols") or [])
    symbols_b = _names(b.get("symbols") or [])
    tables_a = _names(a.get("data_access") or [])
    tables_b = _names(b.get("data_access") or [])

    def _jaccard(x: set, y: set) -> float:
        if not x and not y:
            return 1.0
        union = x.union(y)
        inter = x.intersection(y)
        return round(len(inter) / max(1, len(union)), 3)

    symbols_jaccard = _jaccard(symbols_a, symbols_b)
    tables_jaccard = _jaccard(tables_a, tables_b)

    control_flow_changed = a.get("control_flow") != b.get("control_flow")

    return {
        "symbols_jaccard": symbols_jaccard,
        "tables_jaccard": tables_jaccard,
        "control_flow_changed": bool(control_flow_changed),
        "symbols_a": sorted(list(symbols_a))[:20],
        "symbols_b": sorted(list(symbols_b))[:20],
        "tables_a": sorted(list(tables_a))[:20],
        "tables_b": sorted(list(tables_b))[:20],
    }


def compute_diff_metrics(original: str, converted: str, uir_original: Any = None, uir_converted: Any = None) -> Dict[str, Any]:
    text_metrics = compare_code(original, converted)
    semantic = None
    if uir_original is not None and uir_converted is not None:
        try:
            semantic = semantic_compare(uir_original, uir_converted)
        except Exception:
            semantic = None

    out = {**text_metrics}
    out["semantic"] = semantic
    return out
