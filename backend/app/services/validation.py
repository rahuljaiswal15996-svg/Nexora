from typing import Dict, Any


def validate_row_counts(ref_stats: Dict[str, Any], target_stats: Dict[str, Any], threshold: float = 0.01) -> Dict[str, Any]:
    """Compare row counts; threshold is relative difference allowed (e.g., 0.01 = 1%)."""
    ref = int(ref_stats.get("row_count", 0))
    tgt = int(target_stats.get("row_count", 0))
    if ref == 0:
        percent_diff = 0.0 if tgt == 0 else 1.0
    else:
        percent_diff = abs(ref - tgt) / max(1, ref)
    passed = percent_diff <= threshold
    return {"check": "row_count", "passed": passed, "percent_diff": round(percent_diff, 6), "ref": ref, "target": tgt}


def validate_schema(ref_schema: Dict[str, Any], target_schema: Dict[str, Any]) -> Dict[str, Any]:
    """Basic schema equality check on column names."""
    ref_cols = set(ref_schema.get("columns", []))
    tgt_cols = set(target_schema.get("columns", []))
    missing_in_target = sorted(list(ref_cols - tgt_cols))
    extra_in_target = sorted(list(tgt_cols - ref_cols))
    passed = len(missing_in_target) == 0
    return {"check": "schema", "passed": passed, "missing_in_target": missing_in_target, "extra_in_target": extra_in_target}


def validate_distribution(ref_hist: Dict[str, Any], target_hist: Dict[str, Any], tolerance: float = 0.2) -> Dict[str, Any]:
    """Naive histogram comparison. Expects dicts of {bucket: count} for MVP."""
    buckets = set(ref_hist.keys()).union(set(target_hist.keys()))
    total_ref = sum(ref_hist.get(k, 0) for k in buckets) or 1
    total_tgt = sum(target_hist.get(k, 0) for k in buckets) or 1
    diffs = 0.0
    for k in buckets:
        ref_p = ref_hist.get(k, 0) / total_ref
        tgt_p = target_hist.get(k, 0) / total_tgt
        diffs += abs(ref_p - tgt_p)
    # diffs in [0,2], normalize to [0,1]
    normalized = min(1.0, diffs / 2.0)
    passed = normalized <= tolerance
    return {"check": "distribution", "passed": passed, "score": round(1.0 - normalized, 3), "raw_diff": round(normalized, 6)}


def validate_all(ref: Dict[str, Any], tgt: Dict[str, Any], thresholds: Dict[str, float] | None = None) -> Dict[str, Any]:
    thresholds = thresholds or {}
    results = []
    if "row_count" in ref and "row_count" in tgt:
        results.append(validate_row_counts({"row_count": ref["row_count"]}, {"row_count": tgt["row_count"]}, thresholds.get("row_count", 0.01)))
    if "columns" in ref and "columns" in tgt:
        results.append(validate_schema({"columns": ref["columns"]}, {"columns": tgt["columns"]}))
    if "histogram" in ref and "histogram" in tgt:
        results.append(validate_distribution(ref["histogram"], tgt["histogram"], thresholds.get("distribution", 0.2)))
    return {"overall_passed": all(r.get("passed") for r in results), "results": results}
