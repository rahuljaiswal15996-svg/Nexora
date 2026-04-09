from __future__ import annotations

import json
from collections import defaultdict, deque
from copy import deepcopy
from typing import Any


NODE_TYPE_CATALOG: list[dict[str, Any]] = [
    {
        "kind": "dataset",
        "label": "Dataset",
        "description": "Register a source, managed, or published dataset and bind it to the execution graph.",
        "default_label": "Dataset Node",
        "config_schema": [
            {
                "name": "dataset_mode",
                "label": "Dataset mode",
                "type": "select",
                "required": True,
                "default": "source",
                "options": [
                    {"value": "source", "label": "Source"},
                    {"value": "managed", "label": "Managed"},
                    {"value": "published", "label": "Published output"},
                ],
            },
            {
                "name": "dataset_name",
                "label": "Dataset name",
                "type": "text",
                "required": True,
                "default": "dataset_name",
                "placeholder": "orders_curated",
            },
            {
                "name": "connection_id",
                "label": "Connection id",
                "type": "text",
                "required": False,
                "default": "",
                "placeholder": "snowflake-prod",
            },
            {
                "name": "format",
                "label": "Format",
                "type": "select",
                "required": True,
                "default": "table",
                "options": [
                    {"value": "table", "label": "Table"},
                    {"value": "file", "label": "File"},
                    {"value": "feature_set", "label": "Feature set"},
                ],
            },
            {
                "name": "write_mode",
                "label": "Write mode",
                "type": "select",
                "required": True,
                "default": "overwrite",
                "options": [
                    {"value": "read_only", "label": "Read only"},
                    {"value": "overwrite", "label": "Overwrite"},
                    {"value": "append", "label": "Append"},
                ],
            },
            {
                "name": "schema_policy",
                "label": "Schema policy",
                "type": "select",
                "required": True,
                "default": "inherit",
                "options": [
                    {"value": "inherit", "label": "Inherit"},
                    {"value": "enforce", "label": "Enforce"},
                    {"value": "drift_tolerant", "label": "Drift tolerant"},
                ],
            },
        ],
        "execution_binding_template": {
            "engine_type": "dataset",
            "runtime_profile": "catalog",
            "executor": "dataset.sync",
        },
    },
    {
        "kind": "recipe",
        "label": "SQL / Transformation",
        "description": "Run SQL, Python, or Spark transformation logic and publish a downstream dataset.",
        "default_label": "Transformation Node",
        "config_schema": [
            {
                "name": "language",
                "label": "Execution language",
                "type": "select",
                "required": True,
                "default": "sql",
                "options": [
                    {"value": "sql", "label": "SQL"},
                    {"value": "python", "label": "Python"},
                    {"value": "pyspark", "label": "PySpark"},
                ],
            },
            {
                "name": "runtime_profile",
                "label": "Runtime profile",
                "type": "select",
                "required": True,
                "default": "warehouse-sql",
                "options": [
                    {"value": "warehouse-sql", "label": "Warehouse SQL"},
                    {"value": "python-batch", "label": "Python batch"},
                    {"value": "spark-cluster", "label": "Spark cluster"},
                ],
            },
            {
                "name": "expression",
                "label": "Transformation logic",
                "type": "textarea",
                "required": True,
                "default": "SELECT * FROM input_dataset",
            },
            {
                "name": "output_dataset_name",
                "label": "Output dataset",
                "type": "text",
                "required": True,
                "default": "transformed_output",
            },
            {
                "name": "materialization",
                "label": "Materialization",
                "type": "select",
                "required": True,
                "default": "table",
                "options": [
                    {"value": "table", "label": "Table"},
                    {"value": "view", "label": "View"},
                    {"value": "incremental", "label": "Incremental"},
                ],
            },
            {
                "name": "parameter_bindings",
                "label": "Parameter bindings",
                "type": "json",
                "required": False,
                "default": {},
            },
            {
                "name": "retry_limit",
                "label": "Retry limit",
                "type": "number",
                "required": True,
                "default": 2,
                "min": 0,
            },
            {
                "name": "retry_backoff_seconds",
                "label": "Retry backoff seconds",
                "type": "number",
                "required": False,
                "default": 0.5,
                "min": 0,
            },
        ],
        "execution_binding_template": {
            "engine_type": "transform",
            "runtime_profile": "warehouse-sql",
            "executor": "transform.sql",
        },
    },
    {
        "kind": "notebook",
        "label": "Notebook",
        "description": "Bind a notebook asset, runtime profile, and parameter payload into the DAG.",
        "default_label": "Notebook Node",
        "config_schema": [
            {
                "name": "notebook_id",
                "label": "Notebook id",
                "type": "text",
                "required": True,
                "default": "",
                "placeholder": "notebook-123",
            },
            {
                "name": "runtime_profile",
                "label": "Runtime profile",
                "type": "select",
                "required": True,
                "default": "local",
                "options": [
                    {"value": "local", "label": "Local"},
                    {"value": "cluster", "label": "Cluster"},
                ],
            },
            {
                "name": "entrypoint_cell",
                "label": "Entrypoint cell",
                "type": "text",
                "required": False,
                "default": "",
                "placeholder": "main",
            },
            {
                "name": "parameters",
                "label": "Runtime parameters",
                "type": "json",
                "required": False,
                "default": {},
            },
            {
                "name": "linked_dataset_ids",
                "label": "Linked datasets",
                "type": "tags",
                "required": False,
                "default": [],
            },
            {
                "name": "retry_limit",
                "label": "Retry limit",
                "type": "number",
                "required": True,
                "default": 1,
                "min": 0,
            },
        ],
        "execution_binding_template": {
            "engine_type": "notebook_job",
            "runtime_profile": "local",
            "executor": "notebook.execute",
        },
    },
    {
        "kind": "model",
        "label": "ML",
        "description": "Train, evaluate, or batch-score a model and expose the output to the rest of the graph.",
        "default_label": "ML Node",
        "config_schema": [
            {
                "name": "task_type",
                "label": "ML task",
                "type": "select",
                "required": True,
                "default": "train",
                "options": [
                    {"value": "train", "label": "Train"},
                    {"value": "batch_infer", "label": "Batch infer"},
                    {"value": "evaluate", "label": "Evaluate"},
                ],
            },
            {
                "name": "model_name",
                "label": "Model name",
                "type": "text",
                "required": True,
                "default": "customer_churn_model",
            },
            {
                "name": "feature_inputs",
                "label": "Feature inputs",
                "type": "tags",
                "required": True,
                "default": [],
            },
            {
                "name": "runtime_profile",
                "label": "Runtime profile",
                "type": "select",
                "required": True,
                "default": "python-batch",
                "options": [
                    {"value": "python-batch", "label": "Python batch"},
                    {"value": "spark-cluster", "label": "Spark cluster"},
                ],
            },
            {
                "name": "target_column",
                "label": "Target column",
                "type": "text",
                "required": False,
                "default": "",
            },
            {
                "name": "registry_stage",
                "label": "Registry stage",
                "type": "select",
                "required": True,
                "default": "experiment",
                "options": [
                    {"value": "experiment", "label": "Experiment"},
                    {"value": "staging", "label": "Staging"},
                    {"value": "production", "label": "Production"},
                ],
            },
        ],
        "execution_binding_template": {
            "engine_type": "ml",
            "runtime_profile": "python-batch",
            "executor": "ml.train",
        },
    },
    {
        "kind": "validation",
        "label": "Validation",
        "description": "Define graph-blocking or advisory quality, schema, or parity validation checks.",
        "default_label": "Validation Gate",
        "config_schema": [
            {
                "name": "validation_mode",
                "label": "Validation mode",
                "type": "select",
                "required": True,
                "default": "quality",
                "options": [
                    {"value": "schema", "label": "Schema"},
                    {"value": "quality", "label": "Quality"},
                    {"value": "parity", "label": "Parity"},
                    {"value": "custom", "label": "Custom"},
                ],
            },
            {
                "name": "blocking",
                "label": "Blocking gate",
                "type": "boolean",
                "required": True,
                "default": True,
            },
            {
                "name": "rule_set",
                "label": "Rule set",
                "type": "json",
                "required": True,
                "default": {"rules": []},
            },
            {
                "name": "threshold",
                "label": "Threshold",
                "type": "number",
                "required": False,
                "default": 0.95,
                "min": 0,
                "max": 1,
            },
            {
                "name": "owner",
                "label": "Owner",
                "type": "text",
                "required": False,
                "default": "quality@nexora.local",
            },
        ],
        "execution_binding_template": {
            "engine_type": "validation",
            "runtime_profile": "control-plane",
            "executor": "validation.quality",
        },
    },
    {
        "kind": "deploy",
        "label": "Deployment",
        "description": "Bind rollout target, release strategy, and runtime target into the execution engine.",
        "default_label": "Deployment Node",
        "config_schema": [
            {
                "name": "target_platform",
                "label": "Target platform",
                "type": "select",
                "required": True,
                "default": "container",
                "options": [
                    {"value": "container", "label": "Container"},
                    {"value": "spark", "label": "Spark"},
                    {"value": "databricks", "label": "Databricks"},
                    {"value": "dbt", "label": "dbt"},
                    {"value": "api", "label": "API"},
                ],
            },
            {
                "name": "target_name",
                "label": "Target name",
                "type": "text",
                "required": True,
                "default": "prod-target",
            },
            {
                "name": "release_strategy",
                "label": "Release strategy",
                "type": "select",
                "required": True,
                "default": "manual",
                "options": [
                    {"value": "manual", "label": "Manual"},
                    {"value": "blue_green", "label": "Blue/green"},
                    {"value": "canary", "label": "Canary"},
                ],
            },
            {
                "name": "schedule_cron",
                "label": "Schedule cron",
                "type": "text",
                "required": False,
                "default": "",
                "placeholder": "0 3 * * *",
            },
            {
                "name": "rollout_config",
                "label": "Rollout config",
                "type": "json",
                "required": False,
                "default": {},
            },
            {
                "name": "endpoint_url",
                "label": "API endpoint URL",
                "type": "text",
                "required": False,
                "default": "",
                "placeholder": "https://api.example.com/hooks/orders",
            },
            {
                "name": "request_method",
                "label": "Request method",
                "type": "select",
                "required": False,
                "default": "POST",
                "options": [
                    {"value": "GET", "label": "GET"},
                    {"value": "POST", "label": "POST"},
                    {"value": "PUT", "label": "PUT"},
                    {"value": "PATCH", "label": "PATCH"},
                    {"value": "DELETE", "label": "DELETE"},
                ],
            },
            {
                "name": "request_headers",
                "label": "Request headers",
                "type": "json",
                "required": False,
                "default": {},
            },
            {
                "name": "request_body",
                "label": "Request body",
                "type": "json",
                "required": False,
                "default": {},
            },
            {
                "name": "timeout_seconds",
                "label": "Request timeout seconds",
                "type": "number",
                "required": False,
                "default": 30,
                "min": 1,
            },
            {
                "name": "retry_limit",
                "label": "Retry limit",
                "type": "number",
                "required": True,
                "default": 2,
                "min": 0,
            },
            {
                "name": "retry_backoff_seconds",
                "label": "Retry backoff seconds",
                "type": "number",
                "required": False,
                "default": 1,
                "min": 0,
            },
        ],
        "execution_binding_template": {
            "engine_type": "deployment",
            "runtime_profile": "runtime-ops",
            "executor": "deploy.container",
        },
    },
]


def list_node_types() -> list[dict[str, Any]]:
    return deepcopy(NODE_TYPE_CATALOG)


def _definition_by_kind(kind: str) -> dict[str, Any] | None:
    normalized = _normalize_node_kind(kind)
    for definition in NODE_TYPE_CATALOG:
        if definition["kind"] == normalized:
            return definition
    return None


def _normalize_node_kind(kind: Any) -> str:
    raw = str(kind or "recipe").strip().lower()
    aliases = {
        "sql": "recipe",
        "transformation": "recipe",
        "transform": "recipe",
        "ml": "model",
        "deployment": "deploy",
    }
    return aliases.get(raw, raw or "recipe")


def _default_config_for_definition(definition: dict[str, Any]) -> dict[str, Any]:
    return {field["name"]: deepcopy(field.get("default")) for field in definition.get("config_schema", [])}


def _normalize_position(position: Any, index: int) -> dict[str, float]:
    if isinstance(position, dict):
        x = position.get("x")
        y = position.get("y")
        if isinstance(x, (int, float)) and isinstance(y, (int, float)):
            return {"x": float(x), "y": float(y)}
    return {"x": float(100 + (index % 4) * 240), "y": float(120 + (index // 4) * 180)}


def _coerce_boolean(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


def _coerce_number(value: Any) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    return float(str(value).strip())


def _coerce_json(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return deepcopy(value)
    if value in (None, ""):
        return {}
    parsed = json.loads(str(value))
    if not isinstance(parsed, dict):
        raise ValueError("JSON value must be an object")
    return parsed


def _coerce_tags(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if value in (None, ""):
        return []
    return [item.strip() for item in str(value).split(",") if item.strip()]


def _coerce_field_value(field: dict[str, Any], value: Any) -> Any:
    field_type = field.get("type")
    if field_type == "boolean":
        return _coerce_boolean(value)
    if field_type == "number":
        return _coerce_number(value)
    if field_type == "json":
        return _coerce_json(value)
    if field_type == "tags":
        return _coerce_tags(value)
    return str(value).strip() if value is not None else ""


def _validate_required(field: dict[str, Any], value: Any) -> bool:
    if not field.get("required"):
        return True
    field_type = field.get("type")
    if field_type == "boolean":
        return True
    if field_type == "number":
        return value is not None
    if field_type == "json":
        return isinstance(value, dict)
    if field_type == "tags":
        return isinstance(value, list) and len(value) > 0
    return bool(str(value or "").strip())


def _validate_field(field: dict[str, Any], raw_value: Any) -> tuple[Any, list[dict[str, Any]]]:
    issues: list[dict[str, Any]] = []
    candidate = raw_value
    if candidate is None or candidate == "":
        candidate = deepcopy(field.get("default"))
    try:
        value = _coerce_field_value(field, candidate)
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        issues.append(
            {
                "severity": "error",
                "field": field["name"],
                "message": f"{field['label']} is invalid: {exc}",
            }
        )
        return deepcopy(field.get("default")), issues

    if not _validate_required(field, value):
        issues.append(
            {
                "severity": "error",
                "field": field["name"],
                "message": f"{field['label']} is required.",
            }
        )

    options = [item["value"] for item in field.get("options", [])]
    if options and value not in options:
        issues.append(
            {
                "severity": "error",
                "field": field["name"],
                "message": f"{field['label']} must be one of: {', '.join(options)}.",
            }
        )

    if field.get("type") == "number":
        minimum = field.get("min")
        maximum = field.get("max")
        if minimum is not None and value < minimum:
            issues.append(
                {
                    "severity": "error",
                    "field": field["name"],
                    "message": f"{field['label']} must be greater than or equal to {minimum}.",
                }
            )
        if maximum is not None and value > maximum:
            issues.append(
                {
                    "severity": "error",
                    "field": field["name"],
                    "message": f"{field['label']} must be less than or equal to {maximum}.",
                }
            )

    return value, issues


def _validate_node_config(kind: str, config: Any) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    definition = _definition_by_kind(kind)
    normalized_config = _default_config_for_definition(definition or {"config_schema": []})
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    incoming = config if isinstance(config, dict) else {}

    if not definition:
        errors.append({"severity": "error", "message": f"Unsupported node kind: {kind}."})
        return normalized_config, errors, warnings

    for field in definition.get("config_schema", []):
        value, issues = _validate_field(field, incoming.get(field["name"]))
        normalized_config[field["name"]] = value
        for issue in issues:
            target = errors if issue["severity"] == "error" else warnings
            target.append(issue)

    if kind == "recipe":
        expression = str(normalized_config.get("expression") or "").strip()
        if len(expression) < 8:
            errors.append({"severity": "error", "field": "expression", "message": "Transformation logic must contain executable content."})
    if kind == "notebook" and not str(normalized_config.get("notebook_id") or "").strip():
        errors.append({"severity": "error", "field": "notebook_id", "message": "Notebook id is required."})
    if kind == "model" and not normalized_config.get("feature_inputs"):
        errors.append({"severity": "error", "field": "feature_inputs", "message": "At least one feature input is required."})
    if kind == "validation":
        rule_set = normalized_config.get("rule_set") or {}
        rules = rule_set.get("rules") if isinstance(rule_set, dict) else None
        if not isinstance(rules, list) or not rules:
            warnings.append({"severity": "warning", "field": "rule_set", "message": "Validation rule set has no explicit rules yet."})
    if kind == "deploy" and normalized_config.get("release_strategy") == "canary" and not normalized_config.get("rollout_config"):
        warnings.append({"severity": "warning", "field": "rollout_config", "message": "Canary releases should define rollout_config thresholds."})
    if kind == "deploy" and normalized_config.get("target_platform") == "api":
        endpoint_candidate = str(normalized_config.get("endpoint_url") or normalized_config.get("target_name") or "").strip()
        if not endpoint_candidate.startswith(("http://", "https://")):
            warnings.append({
                "severity": "warning",
                "field": "endpoint_url",
                "message": "API deployment nodes should define a fully-qualified endpoint_url for real execution.",
            })

    return normalized_config, errors, warnings


def _build_execution_binding(kind: str, config: dict[str, Any]) -> dict[str, Any]:
    definition = _definition_by_kind(kind)
    base = deepcopy(definition.get("execution_binding_template", {})) if definition else {}

    if kind == "dataset":
        dataset_mode = config.get("dataset_mode")
        base.update(
            {
                "engine_type": "dataset",
                "runtime_profile": "catalog",
                "executor": "dataset.materialize" if dataset_mode in {"managed", "published"} else "dataset.reference",
                "target_ref": config.get("dataset_name"),
            }
        )
    elif kind == "recipe":
        language = config.get("language")
        executor_by_language = {
            "sql": "transform.sql",
            "python": "transform.python",
            "pyspark": "transform.pyspark",
        }
        base.update(
            {
                "engine_type": "transform",
                "runtime_profile": config.get("runtime_profile"),
                "executor": executor_by_language.get(language, "transform.sql"),
                "target_ref": config.get("output_dataset_name"),
            }
        )
    elif kind == "notebook":
        base.update(
            {
                "engine_type": "notebook_job",
                "runtime_profile": config.get("runtime_profile"),
                "executor": "notebook.execute",
                "target_ref": config.get("notebook_id"),
            }
        )
    elif kind == "model":
        task_type = config.get("task_type") or "train"
        base.update(
            {
                "engine_type": "ml",
                "runtime_profile": config.get("runtime_profile"),
                "executor": f"ml.{task_type}",
                "target_ref": config.get("model_name"),
            }
        )
    elif kind == "validation":
        validation_mode = config.get("validation_mode") or "quality"
        base.update(
            {
                "engine_type": "validation",
                "runtime_profile": "control-plane",
                "executor": f"validation.{validation_mode}",
                "target_ref": validation_mode,
            }
        )
    elif kind == "deploy":
        target_platform = config.get("target_platform") or "container"
        base.update(
            {
                "engine_type": "deployment",
                "runtime_profile": "runtime-ops",
                "executor": f"deploy.{target_platform}",
                "target_ref": config.get("endpoint_url") or config.get("target_name"),
            }
        )
    return base


def _topological_order(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> tuple[list[str], bool]:
    inbound_count: dict[str, int] = {str(node["id"]): 0 for node in nodes}
    downstream: dict[str, list[str]] = defaultdict(list)
    for edge in edges:
        source = str(edge["source"])
        target = str(edge["target"])
        downstream[source].append(target)
        inbound_count[target] = inbound_count.get(target, 0) + 1

    queue = deque(sorted([node_id for node_id, count in inbound_count.items() if count == 0]))
    ordered: list[str] = []
    while queue:
        node_id = queue.popleft()
        ordered.append(node_id)
        for target in downstream.get(node_id, []):
            inbound_count[target] -= 1
            if inbound_count[target] == 0:
                queue.append(target)
    return ordered, len(ordered) == len(nodes)


def validate_pipeline_dag(dag: Any) -> dict[str, Any]:
    payload = dag if isinstance(dag, dict) else {}
    raw_nodes = payload.get("nodes") if isinstance(payload.get("nodes"), list) else []
    raw_edges = payload.get("edges") if isinstance(payload.get("edges"), list) else []

    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    node_results: list[dict[str, Any]] = []
    normalized_nodes: list[dict[str, Any]] = []
    node_id_set: set[str] = set()
    outbound_by_node: dict[str, list[str]] = defaultdict(list)
    inbound_by_node: dict[str, list[str]] = defaultdict(list)

    for index, raw_node in enumerate(raw_nodes):
        node = raw_node if isinstance(raw_node, dict) else {}
        node_id = str(node.get("id") or f"node-{index + 1}")
        kind = _normalize_node_kind(node.get("kind") or node.get("data", {}).get("kind") if isinstance(node.get("data"), dict) else node.get("kind"))
        label = str(node.get("label") or node.get("data", {}).get("label") if isinstance(node.get("data"), dict) else node.get("label") or node_id)
        description = str(node.get("description") or node.get("data", {}).get("description") if isinstance(node.get("data"), dict) else node.get("description") or "")

        node_errors: list[dict[str, Any]] = []
        node_warnings: list[dict[str, Any]] = []
        if node_id in node_id_set:
            node_errors.append({"severity": "error", "message": f"Duplicate node id: {node_id}."})
        node_id_set.add(node_id)

        definition = _definition_by_kind(kind)
        if not definition:
            node_errors.append({"severity": "error", "message": f"Node kind {kind} is not supported."})

        normalized_config, config_errors, config_warnings = _validate_node_config(kind, node.get("config"))
        node_errors.extend(config_errors)
        node_warnings.extend(config_warnings)
        execution_binding = _build_execution_binding(kind, normalized_config)

        normalized_node = {
            **node,
            "id": node_id,
            "kind": kind,
            "label": label,
            "description": description,
            "position": _normalize_position(node.get("position"), index),
            "config": normalized_config,
            "execution_binding": execution_binding,
            "data": {
                **(node.get("data") if isinstance(node.get("data"), dict) else {}),
                "kind": kind,
                "label": label,
                "description": description,
                "config": normalized_config,
                "execution_binding": execution_binding,
            },
        }
        normalized_nodes.append(normalized_node)
        node_results.append(
            {
                "node_id": node_id,
                "kind": kind,
                "label": label,
                "valid": not node_errors,
                "errors": node_errors,
                "warnings": node_warnings,
                "execution_binding": execution_binding,
            }
        )
        errors.extend({**issue, "scope": "node", "node_id": node_id} for issue in node_errors)
        warnings.extend({**issue, "scope": "node", "node_id": node_id} for issue in node_warnings)

    normalized_edges: list[dict[str, Any]] = []
    edge_pairs: set[tuple[str, str]] = set()
    for index, raw_edge in enumerate(raw_edges):
        edge = raw_edge if isinstance(raw_edge, dict) else {}
        source = str(edge.get("source") or "").strip()
        target = str(edge.get("target") or "").strip()
        edge_id = str(edge.get("id") or f"edge-{index + 1}")
        if not source or not target:
            errors.append({"scope": "edge", "edge_id": edge_id, "message": "Edges must define source and target."})
            continue
        if source == target:
            errors.append({"scope": "edge", "edge_id": edge_id, "message": "Self-referencing edges are not allowed."})
            continue
        if source not in node_id_set or target not in node_id_set:
            errors.append({"scope": "edge", "edge_id": edge_id, "message": "Edges must connect existing nodes."})
            continue
        pair = (source, target)
        if pair in edge_pairs:
            warnings.append({"scope": "edge", "edge_id": edge_id, "message": "Duplicate edge detected; only one logical connection is needed."})
            continue
        edge_pairs.add(pair)
        outbound_by_node[source].append(target)
        inbound_by_node[target].append(source)
        normalized_edges.append(
            {
                **edge,
                "id": edge_id,
                "source": source,
                "target": target,
            }
        )

    topological_order, is_acyclic = _topological_order(normalized_nodes, normalized_edges)
    if not is_acyclic:
        errors.append({"scope": "graph", "message": "Graph contains a cycle. Flow Builder requires an acyclic DAG."})

    entrypoint_node_ids = [node["id"] for node in normalized_nodes if not inbound_by_node.get(node["id"])]
    terminal_node_ids = [node["id"] for node in normalized_nodes if not outbound_by_node.get(node["id"])]
    if not entrypoint_node_ids:
        errors.append({"scope": "graph", "message": "Graph must contain at least one entrypoint node."})
    if not terminal_node_ids:
        errors.append({"scope": "graph", "message": "Graph must contain at least one terminal node."})

    for node in normalized_nodes:
        node_id = node["id"]
        kind = node["kind"]
        if kind == "deploy" and outbound_by_node.get(node_id):
            errors.append({"scope": "node", "node_id": node_id, "message": "Deployment nodes must be terminal nodes."})
        if kind == "validation" and not inbound_by_node.get(node_id):
            warnings.append({"scope": "node", "node_id": node_id, "message": "Validation nodes should usually validate an upstream branch."})
        if kind == "model" and not inbound_by_node.get(node_id):
            warnings.append({"scope": "node", "node_id": node_id, "message": "ML nodes should usually consume upstream feature-producing nodes."})

    executable_node_ids = [node["id"] for node in normalized_nodes if node["kind"] != "dataset"]
    if not executable_node_ids:
        errors.append({"scope": "graph", "message": "Graph must include at least one executable node beyond datasets."})

    return {
        "valid": not errors,
        "errors": errors,
        "warnings": warnings,
        "node_results": node_results,
        "graph": {
            "entrypoint_node_ids": entrypoint_node_ids,
            "terminal_node_ids": terminal_node_ids,
            "topological_order": topological_order,
            "executable_node_ids": executable_node_ids,
        },
        "normalized_dag": {
            "nodes": normalized_nodes,
            "edges": normalized_edges,
            "metadata": {
                **(payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}),
                "authoring_summary": {
                    "node_count": len(normalized_nodes),
                    "edge_count": len(normalized_edges),
                    "entrypoint_count": len(entrypoint_node_ids),
                    "terminal_count": len(terminal_node_ids),
                    "executable_node_count": len(executable_node_ids),
                },
            },
        },
    }