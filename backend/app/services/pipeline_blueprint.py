import ast
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, cast

from app.services.parser import PYTHON_FAMILY, SQL_FAMILY, parse_to_uir
from app.services.pipeline_runner import create_pipeline

MAX_OPERATION_STEPS = 8
TABLE_PATTERN = re.compile(r"\b(?:from|join|into|update|table)\s+([a-zA-Z_][\w.$]*)", re.IGNORECASE)
OUTPUT_PATTERN = re.compile(r"\b(?:create\s+table|insert\s+into|merge\s+into|update)\s+([a-zA-Z_][\w.$]*)", re.IGNORECASE)


def _normalize_language(language: str | None) -> str:
    candidate = (language or "auto").strip().lower()
    return candidate or "auto"


def _friendly_artifact_name(artifact_name: str | None) -> str:
    stem = Path(artifact_name or "uploaded_code").stem
    cleaned = stem.replace("_", " ").replace("-", " ").strip()
    return cleaned.title() or "Uploaded Code"


def _truncate(text: str, limit: int = 88) -> str:
    compact = " ".join((text or "").split())
    if len(compact) <= limit:
        return compact
    return f"{compact[: limit - 1].rstrip()}..."


def _safe_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-") or "node"


def _display_name(value: str) -> str:
    cleaned = value.replace("_", " ").replace("-", " ").strip()
    return cleaned.title() or "Output"


def _call_name(node: ast.AST) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        base = _call_name(node.value)
        return f"{base}.{node.attr}" if base else node.attr
    if isinstance(node, ast.Call):
        return _call_name(node.func)
    return node.__class__.__name__.lower()


def _python_label(node: ast.stmt) -> str:
    if isinstance(node, ast.Import):
        return "Import dependencies"
    if isinstance(node, ast.ImportFrom):
        return f"Import from {node.module or 'module'}"
    if isinstance(node, ast.FunctionDef):
        return f"Define {node.name}()"
    if isinstance(node, ast.AsyncFunctionDef):
        return f"Define async {node.name}()"
    if isinstance(node, ast.ClassDef):
        return f"Define class {node.name}"
    if isinstance(node, ast.Assign):
        target_name = _call_name(node.targets[0]) if node.targets else "value"
        if isinstance(node.value, ast.Call):
            return f"Assign {target_name} from {_call_name(node.value.func)}()"
        return f"Set {target_name}"
    if isinstance(node, ast.AnnAssign):
        return f"Set {_call_name(node.target)}"
    if isinstance(node, ast.Expr) and isinstance(node.value, ast.Call):
        return f"Execute {_call_name(node.value.func)}()"
    if isinstance(node, ast.For):
        return "Iterate through records"
    if isinstance(node, ast.If):
        return "Apply conditional branch"
    if isinstance(node, ast.With):
        return "Open execution context"
    if isinstance(node, ast.Return):
        return "Return output"
    return node.__class__.__name__.replace("_", " ").title()


def _python_operations(code: str) -> List[Dict[str, str]]:
    try:
        tree = ast.parse(code)
    except Exception:
        return []

    operations: List[Dict[str, str]] = []
    for index, node in enumerate(tree.body[:MAX_OPERATION_STEPS]):
        segment = ast.get_source_segment(code, node) or _python_label(node)
        operations.append(
            {
                "id": f"python-step-{index + 1}",
                "label": _python_label(node),
                "description": _truncate(segment),
            }
        )
    return operations


def _sql_operations(code: str) -> List[Dict[str, str]]:
    statements = [segment.strip() for segment in re.split(r";\s*\n|;", code) if segment.strip()]
    operations: List[Dict[str, str]] = []
    for index, statement in enumerate(statements[:MAX_OPERATION_STEPS]):
        keyword = re.split(r"\s+", statement, maxsplit=1)[0].upper()
        match = TABLE_PATTERN.search(statement)
        target = match.group(1) if match else "dataset"
        if keyword == "PROC" and statement.upper().startswith("PROC SQL"):
            label = f"PROC SQL on {target}"
        elif keyword in {"SELECT", "INSERT", "UPDATE", "DELETE", "MERGE", "CREATE"}:
            label = f"{keyword.title()} {target}"
        else:
            label = f"{keyword.title()} step"
        operations.append(
            {
                "id": f"sql-step-{index + 1}",
                "label": label,
                "description": _truncate(statement),
            }
        )
    return operations


def _fallback_operations(code: str, language: str) -> List[Dict[str, str]]:
    lines = [line.strip() for line in code.splitlines() if line.strip()]
    preview_lines = lines[:MAX_OPERATION_STEPS]
    operations: List[Dict[str, str]] = []
    for index, line in enumerate(preview_lines):
        operations.append(
            {
                "id": f"fallback-step-{index + 1}",
                "label": f"{language.title()} step {index + 1}",
                "description": _truncate(line),
            }
        )
    return operations


def _extract_inputs(uir: Dict[str, Any], code: str, language: str, preferred_inputs: Optional[List[str]] = None) -> List[str]:
    inputs: List[str] = []
    for item in cast(List[Any], uir.get("data_access") or []):
        if isinstance(item, dict):
            name = item.get("name")
            if name:
                inputs.append(str(name))

    if not inputs and language in SQL_FAMILY:
        inputs = [match.group(1) for match in TABLE_PATTERN.finditer(code)]

    if not inputs and preferred_inputs:
        inputs = [value for value in preferred_inputs if value]

    deduped: List[str] = []
    seen: set[str] = set()
    for value in inputs:
        normalized = value.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(value)
    return deduped[:4]


def _extract_operations(code: str, language: str) -> List[Dict[str, str]]:
    if language in SQL_FAMILY:
        return _sql_operations(code)
    if language in PYTHON_FAMILY:
        return _python_operations(code)
    return _fallback_operations(code, language)


def _python_outputs(code: str) -> List[str]:
    try:
        tree = ast.parse(code)
    except Exception:
        return []

    outputs: List[str] = []
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                name = _call_name(target)
                if name:
                    outputs.append(name)
        elif isinstance(node, ast.AnnAssign):
            name = _call_name(node.target)
            if name:
                outputs.append(name)

    deduped: List[str] = []
    seen: set[str] = set()
    for value in outputs:
        normalized = value.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(value)
    return deduped[:3]


def _derived_output_name(artifact_label: str, language: str, stage: str, inputs: List[str]) -> str:
    if inputs:
        base = _safe_name(inputs[0]).replace("-", "_")
        if stage == "converted":
            return f"curated_{base}"
        return f"prepared_{base}"
    base = _safe_name(artifact_label).replace("-", "_")
    if stage == "converted":
        return f"{base}_{language}_output"
    return f"{base}_output"


def _extract_outputs(code: str, language: str, artifact_label: str, stage: str, inputs: List[str]) -> List[str]:
    outputs: List[str] = []
    if language in SQL_FAMILY:
        outputs = [match.group(1) for match in OUTPUT_PATTERN.finditer(code)]
    elif language in PYTHON_FAMILY:
        outputs = _python_outputs(code)

    deduped: List[str] = []
    seen: set[str] = set()
    for value in outputs:
        normalized = value.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(value)

    if not deduped:
        deduped = [_derived_output_name(artifact_label, language, stage, inputs)]
    return deduped[:3]


def _node(node_id: str, label: str, description: str, kind: str, x: int, y: int) -> Dict[str, Any]:
    return {
        "id": node_id,
        "type": "default",
        "label": label,
        "description": description,
        "kind": kind,
        "position": {"x": x, "y": y},
        "data": {
            "label": label,
            "description": description,
            "kind": kind,
        },
    }


def _edge(source: str, target: str) -> Dict[str, str]:
    return {
        "id": f"{source}-to-{target}",
        "source": source,
        "target": target,
    }


def build_pipeline_blueprint(
    code: str,
    language: str | None,
    artifact_name: str | None,
    stage: str,
    uir: Optional[Dict[str, Any]] = None,
    preferred_inputs: Optional[List[str]] = None,
) -> Dict[str, Any]:
    normalized_language = _normalize_language(language)
    pipeline_uir = uir or parse_to_uir(code, normalized_language)
    artifact_label = _friendly_artifact_name(artifact_name)
    inputs = _extract_inputs(pipeline_uir, code, normalized_language, preferred_inputs)
    operations = _extract_operations(code, normalized_language)
    outputs = _extract_outputs(code, normalized_language, artifact_label, stage, inputs)
    if not operations:
        operations = [
            {
                "id": "generic-step-1",
                "label": f"Inspect {normalized_language.title()} logic",
                "description": "No explicit statements were detected, so Nexora created a single execution step.",
            }
        ]

    stage_prefix = "Source" if stage == "source" else "Converted"
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, str]] = []

    artifact_node_id = f"{stage}-artifact"
    nodes.append(
        _node(
            artifact_node_id,
            f"{stage_prefix} asset",
            f"{artifact_label} ({normalized_language})",
            "artifact",
            40,
            120,
        )
    )

    for index, input_name in enumerate(inputs):
        input_node_id = f"{stage}-input-{_safe_name(input_name)}"
        nodes.append(
            _node(
                input_node_id,
                input_name,
                "Detected upstream source",
                "input",
                40,
                250 + index * 110,
            )
        )

    step_node_ids: List[str] = []
    for index, operation in enumerate(operations):
        node_id = f"{stage}-step-{index + 1}"
        step_node_ids.append(node_id)
        nodes.append(
            _node(
                node_id,
                operation["label"],
                operation["description"],
                "transform",
                300 + index * 220,
                180,
            )
        )

    output_node_id = f"{stage}-output"
    nodes.append(
        _node(
            output_node_id,
            f"Materialize {stage_prefix.lower()} result",
            f"Auto-generated {stage} flow ready for review, scheduling, and deployment handoff.",
            "output",
            300 + len(step_node_ids) * 220,
            180,
        )
    )

    output_asset_ids: List[str] = []
    for index, output_name in enumerate(outputs):
        output_asset_id = f"{stage}-output-asset-{_safe_name(output_name)}"
        output_asset_ids.append(output_asset_id)
        nodes.append(
            _node(
                output_asset_id,
                _display_name(output_name),
                f"Detected downstream {stage} dataset or deliverable.",
                "artifact",
                560 + len(step_node_ids) * 220,
                110 + index * 110,
            )
        )

    first_step_id = step_node_ids[0]
    edges.append(_edge(artifact_node_id, first_step_id))
    for input_name in inputs:
        edges.append(_edge(f"{stage}-input-{_safe_name(input_name)}", first_step_id))
    for source_id, target_id in zip(step_node_ids, step_node_ids[1:]):
        edges.append(_edge(source_id, target_id))

    last_step_id = step_node_ids[-1]
    edges.append(_edge(last_step_id, output_node_id))
    for output_asset_id in output_asset_ids:
        edges.append(_edge(output_node_id, output_asset_id))

    lineage_paths = [
        {
            "source": input_name,
            "target": output_name,
            "via": [operation["label"] for operation in operations],
        }
        for input_name in (inputs or [artifact_label])
        for output_name in outputs
    ]

    summary = {
        "artifact": artifact_label,
        "language": normalized_language,
        "stage": stage,
        "inputs": inputs,
        "outputs": outputs,
        "operations": [operation["label"] for operation in operations],
        "lineage_paths": lineage_paths,
        "input_count": len(inputs),
        "output_count": len(outputs),
        "operation_count": len(operations),
        "line_count": code.count("\n") + 1,
    }

    return {
        "name": f"{artifact_label} {stage_prefix} Flow",
        "dag": {"nodes": nodes, "edges": edges, "metadata": {"summary": summary}},
        "summary": summary,
        "uir": pipeline_uir,
    }


def persist_pipeline_blueprint(tenant_id: str, blueprint: Dict[str, Any]) -> Dict[str, Any]:
    created = create_pipeline(tenant_id, str(blueprint.get("name") or "Auto-generated Flow"), blueprint.get("dag") or {})
    return {
        "pipeline_id": created["id"],
        "created_at": created["created_at"],
        "name": blueprint.get("name"),
        "dag": blueprint.get("dag") or {},
        "summary": blueprint.get("summary") or {},
    }


def build_conversion_pipeline_artifacts(
    original_code: str,
    converted_code: str,
    source_language: str | None,
    target_language: str | None,
    artifact_name: str | None,
) -> Dict[str, Any]:
    normalized_source = _normalize_language(source_language)
    normalized_target = _normalize_language(target_language)
    source_blueprint = build_pipeline_blueprint(
        original_code,
        normalized_source,
        artifact_name,
        stage="source",
    )
    converted_blueprint = build_pipeline_blueprint(
        converted_code,
        normalized_target,
        artifact_name,
        stage="converted",
        preferred_inputs=cast(List[str], source_blueprint.get("summary", {}).get("inputs") or []),
    )
    return {
        "source_pipeline": source_blueprint,
        "converted_pipeline": converted_blueprint,
        "migration_summary": {
            "source_operations": source_blueprint["summary"]["operation_count"],
            "converted_operations": converted_blueprint["summary"]["operation_count"],
            "shared_inputs": converted_blueprint["summary"]["inputs"] or source_blueprint["summary"]["inputs"],
            "target_outputs": converted_blueprint["summary"]["outputs"],
            "lineage_paths": converted_blueprint["summary"]["lineage_paths"],
            "source_language": normalized_source,
            "target_language": normalized_target,
        },
    }