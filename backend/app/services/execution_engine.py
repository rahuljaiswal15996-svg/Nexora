# pyright: reportMissingTypeStubs=false, reportUnknownArgumentType=false, reportUnknownLambdaType=false, reportUnknownMemberType=false, reportUnknownParameterType=false, reportUnknownVariableType=false, reportUnnecessaryIsInstance=false
from __future__ import annotations

import ast
import contextlib
import io
import json
import re
import time
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Protocol

import requests
from sqlalchemy import text

try:
    from sqlalchemy.exc import OperationalError, SQLAlchemyError
except Exception:  # pragma: no cover - SQLAlchemy is a required backend dependency
    OperationalError = Exception  # type: ignore[assignment]
    SQLAlchemyError = Exception  # type: ignore[assignment]

from app.services import db


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class NodeExecutionError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        retryable: bool = False,
        code: str = "execution_failed",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.retryable = bool(retryable)
        self.code = str(code or "execution_failed")
        self.details = dict(details or {})


@dataclass(slots=True)
class NodeExecutionRequest:
    node: dict[str, Any]
    run_context: dict[str, Any] = field(default_factory=dict)
    executor: str = ""
    attempt: int = 1
    max_attempts: int = 1


@dataclass(slots=True)
class NodeExecutionResult:
    metadata: dict[str, Any] = field(default_factory=dict)
    log_entries: list[dict[str, Any]] = field(default_factory=list)
    output_artifacts: list[dict[str, Any]] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "metadata": dict(self.metadata),
            "log_entries": list(self.log_entries),
            "output_artifacts": list(self.output_artifacts),
        }


class ExecutionHandler(Protocol):
    def matches(self, executor: str) -> bool:
        ...

    def execute(self, request: NodeExecutionRequest) -> NodeExecutionResult:
        ...


class BaseExecutionHandler:
    executors: tuple[str, ...] = ()
    prefixes: tuple[str, ...] = ()

    def matches(self, executor: str) -> bool:
        candidate = str(executor or "").strip().lower()
        return candidate in self.executors or any(candidate.startswith(prefix) for prefix in self.prefixes)


def _as_dict(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    return dict(value)


def _serialize_value(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(key): _serialize_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_serialize_value(item) for item in value]
    return str(value)


def _binding_details(node: dict[str, Any], executor: str | None = None) -> dict[str, Any]:
    data = _as_dict(node.get("data"))
    binding = _as_dict(node.get("execution_binding") or data.get("execution_binding"))
    resolved_executor = str(executor or binding.get("executor") or resolve_executor(node))
    details = {
        "executor": resolved_executor,
        "engine_type": binding.get("engine_type"),
        "runtime_profile": binding.get("runtime_profile"),
        "target_ref": binding.get("target_ref"),
        "node_id": node.get("id") or data.get("id"),
        "node_kind": node.get("kind") or data.get("kind") or node.get("type") or data.get("type"),
        "node_label": node.get("label") or data.get("label") or node.get("name") or data.get("name"),
    }
    return {key: value for key, value in details.items() if value not in {None, ""}}


def _log_entry(level: str, message: str, *, stream: str = "stdout", metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "level": str(level or "info"),
        "message": str(message or ""),
        "stream": str(stream or "stdout"),
        "metadata": metadata or {},
    }


def _normalize_log_entries(
    entries: Sequence[dict[str, Any]] | None,
    request: NodeExecutionRequest,
    *,
    base_metadata: dict[str, Any],
) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for entry in entries or []:
        payload = _as_dict(entry)
        metadata = {
            **base_metadata,
            **_as_dict(payload.get("metadata")),
            "attempt": int(request.attempt),
            "max_attempts": int(request.max_attempts),
        }
        normalized.append(
            _log_entry(
                str(payload.get("level") or "info"),
                str(payload.get("message") or ""),
                stream=str(payload.get("stream") or "stdout"),
                metadata=metadata,
            )
        )
    return normalized


def _artifact_from_value(value: Any, title: str) -> list[dict[str, Any]]:
    if value is None:
        return []
    if isinstance(value, list) and value and isinstance(value[0], dict):
        first_row = value[0]
        columns = [{"name": str(name), "type": "unknown"} for name in first_row.keys()]
        return [
            {
                "output_type": "table",
                "title": title,
                "columns": columns,
                "rows": [_serialize_value(item) for item in value[:200]],
            }
        ]
    if isinstance(value, dict):
        return [
            {
                "output_type": "json",
                "title": title,
                "data": _serialize_value(value),
            }
        ]
    return [
        {
            "output_type": "text",
            "title": title,
            "text": str(value),
        }
    ]


def _safe_identifier(value: Any, default: str) -> str:
    candidate = re.sub(r"[^0-9A-Za-z_]", "_", str(value or "").strip())
    if not candidate:
        candidate = default
    if candidate[0].isdigit():
        candidate = f"n_{candidate}"
    return candidate


def _quote_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def _split_sql_statements(script: str) -> list[str]:
    statements: list[str] = []
    current: list[str] = []
    in_single_quote = False
    in_double_quote = False

    for char in script:
        if char == "'" and not in_double_quote:
            in_single_quote = not in_single_quote
        elif char == '"' and not in_single_quote:
            in_double_quote = not in_double_quote

        if char == ";" and not in_single_quote and not in_double_quote:
            statement = "".join(current).strip()
            if statement:
                statements.append(statement)
            current = []
            continue

        current.append(char)

    trailing = "".join(current).strip()
    if trailing:
        statements.append(trailing)
    return statements


def _table_columns_from_result(result: dict[str, Any]) -> list[str]:
    columns, _ = _table_rows_from_result(result)
    if columns:
        return columns
    metadata = _as_dict(result.get("metadata"))
    if metadata.get("dataset_name"):
        return ["id"]
    return ["value"]


def _table_rows_from_result(result: dict[str, Any]) -> tuple[list[str], list[dict[str, Any]]]:
    artifacts = result.get("output_artifacts")
    if isinstance(artifacts, list):
        for artifact in artifacts:
            payload = _as_dict(artifact)
            if payload.get("output_type") != "table":
                continue
            raw_columns_value = payload.get("columns")
            raw_columns: list[Any] = list(raw_columns_value) if isinstance(raw_columns_value, list) else []
            columns: list[str] = []
            for index, column in enumerate(raw_columns):
                if isinstance(column, dict):
                    columns.append(_safe_identifier(column.get("name"), f"column_{index + 1}"))
                else:
                    columns.append(_safe_identifier(column, f"column_{index + 1}"))
            raw_rows_value = payload.get("rows")
            raw_rows: list[Any] = list(raw_rows_value) if isinstance(raw_rows_value, list) else []
            rows: list[dict[str, Any]] = []
            for raw_row in raw_rows[:200]:
                if isinstance(raw_row, dict):
                    rows.append({column: _serialize_value(raw_row.get(column)) for column in columns})
                elif isinstance(raw_row, Sequence) and not isinstance(raw_row, (str, bytes, bytearray)):
                    rows.append(
                        {
                            column: _serialize_value(raw_row[index]) if index < len(raw_row) else None
                            for index, column in enumerate(columns)
                        }
                    )
            return columns, rows

    metadata = _as_dict(result.get("metadata"))
    materialized = metadata.get("result")
    if isinstance(materialized, list) and materialized and isinstance(materialized[0], dict):
        columns = [_safe_identifier(name, f"column_{index + 1}") for index, name in enumerate(materialized[0].keys())]
        return columns, [{column: _serialize_value(row.get(column)) for column in columns} for row in materialized[:200]]
    if isinstance(materialized, dict):
        columns = [_safe_identifier(name, f"column_{index + 1}") for index, name in enumerate(materialized.keys())]
        return columns, [{column: _serialize_value(materialized.get(column)) for column in columns}]
    return [], []


def _sql_cell_value(value: Any) -> Any:
    serialized = _serialize_value(value)
    if isinstance(serialized, (dict, list)):
        return json.dumps(serialized)
    return serialized


def _ensure_upstream_sql_inputs(connection: Any, run_context: dict[str, Any]) -> None:
    upstream_results = _as_dict(run_context.get("upstream_results"))
    for index, (node_id, raw_result) in enumerate(upstream_results.items()):
        result = _as_dict(raw_result)
        metadata = _as_dict(result.get("metadata"))
        aliases = {_safe_identifier(node_id, f"input_{index + 1}")}
        if index == 0:
            aliases.add("input_dataset")
        for candidate in (metadata.get("dataset_name"), metadata.get("target_ref"), metadata.get("node_label")):
            if candidate:
                aliases.add(_safe_identifier(candidate, f"dataset_{index + 1}"))

        column_names, rows = _table_rows_from_result(result)
        if not column_names:
            column_names = _table_columns_from_result(result)
        column_sql = ", ".join(f"{_quote_identifier(column_name)} TEXT" for column_name in column_names)
        for alias in aliases:
            quoted_alias = _quote_identifier(alias)
            connection.exec_driver_sql(f"DROP TABLE IF EXISTS {quoted_alias}")
            connection.exec_driver_sql(f"CREATE TEMP TABLE {quoted_alias} ({column_sql})")
            if not rows:
                continue
            columns_sql = ", ".join(_quote_identifier(column_name) for column_name in column_names)
            placeholders_sql = ", ".join(f":{column_name}" for column_name in column_names)
            statement = text(f"INSERT INTO {quoted_alias} ({columns_sql}) VALUES ({placeholders_sql})")
            for row in rows:
                connection.execute(
                    statement,
                    {column_name: _sql_cell_value(row.get(column_name)) for column_name in column_names},
                )


def _namespace_for_node(node: dict[str, Any], run_context: dict[str, Any]) -> dict[str, Any]:
    config = _as_dict(node.get("config"))
    parameters = _as_dict(run_context.get("parameters") or config.get("parameter_bindings"))
    upstream_results = _as_dict(run_context.get("upstream_results"))
    return {
        "__builtins__": __builtins__,
        "json": json,
        "requests": requests,
        "parameters": parameters,
        "upstream_results": upstream_results,
        "node": node,
        "result": None,
    }


def _evaluate_validation_rules(rule_set: dict[str, Any], namespace: dict[str, Any]) -> list[dict[str, Any]]:
    evaluations: list[dict[str, Any]] = []
    rules = rule_set.get("rules") if isinstance(rule_set, dict) else []
    if not isinstance(rules, Sequence):
        return evaluations

    for index, rule in enumerate(rules):
        if not isinstance(rule, dict):
            continue
        expression = str(rule.get("expression") or rule.get("condition") or "").strip()
        if not expression:
            evaluations.append({"index": index, "passed": True, "message": "No condition defined"})
            continue
        try:
            passed = bool(eval(expression, namespace, namespace))
        except Exception as exc:  # pragma: no cover - surfaced by runtime tests through failures
            raise NodeExecutionError(
                f"Validation rule {index + 1} failed to evaluate: {exc}",
                retryable=False,
                code="validation_rule_error",
                details={"rule_index": index + 1},
            ) from exc
        evaluations.append({"index": index, "passed": passed, "message": rule.get("message") or expression})
    return evaluations


def node_error_is_retryable(exc: Exception) -> bool:
    return bool(exc.retryable) if isinstance(exc, NodeExecutionError) else False


def node_execution_error_details(exc: Exception, *, node: dict[str, Any] | None = None) -> dict[str, Any]:
    details = {
        "error_message": str(exc),
        "error_type": type(exc).__name__,
        "retryable": node_error_is_retryable(exc),
        "error_code": exc.code if isinstance(exc, NodeExecutionError) else "unexpected_runtime_error",
    }
    if isinstance(exc, NodeExecutionError):
        details.update(_as_dict(exc.details))
    if node:
        details.update(_binding_details(node))
    return details


class PythonExecutionHandler(BaseExecutionHandler):
    executors = (
        "transform.python",
        "transform.pyspark",
        "notebook.execute",
        "notebook.cell.python",
        "notebook.cell.pyspark",
    )

    def execute(self, request: NodeExecutionRequest) -> NodeExecutionResult:
        expression = str(_as_dict(request.node.get("config")).get("expression") or "").strip()
        if not expression:
            raise NodeExecutionError(
                "Python executor requires config.expression",
                retryable=False,
                code="python_missing_expression",
            )

        stdout = io.StringIO()
        stderr = io.StringIO()
        namespace = _namespace_for_node(request.node, request.run_context)

        try:
            parsed = ast.parse(expression)
        except SyntaxError as exc:
            raise NodeExecutionError(
                f"Python syntax error: {exc}",
                retryable=False,
                code="python_syntax_error",
                details={"line": exc.lineno, "offset": exc.offset},
            ) from exc

        result_value: Any = None
        try:
            with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                if parsed.body and isinstance(parsed.body[-1], ast.Expr):
                    prefix = ast.Module(body=parsed.body[:-1], type_ignores=[])
                    if prefix.body:
                        exec(compile(prefix, "<nexora-python>", "exec"), namespace, namespace)
                    expression_value = ast.Expression(parsed.body[-1].value)
                    result_value = eval(compile(expression_value, "<nexora-python>", "eval"), namespace, namespace)
                else:
                    exec(compile(parsed, "<nexora-python>", "exec"), namespace, namespace)
                    result_value = namespace.get("result")
        except Exception as exc:
            raise NodeExecutionError(
                f"Python execution failed: {exc}",
                retryable=False,
                code="python_runtime_error",
            ) from exc

        stdout_value = stdout.getvalue().strip()
        stderr_value = stderr.getvalue().strip()
        logs: list[dict[str, Any]] = []
        if stdout_value:
            for line in stdout_value.splitlines():
                logs.append(_log_entry("info", line, stream="stdout"))
        if stderr_value:
            for line in stderr_value.splitlines():
                logs.append(_log_entry("error", line, stream="stderr"))

        artifacts = _artifact_from_value(result_value, "Python result")
        if not artifacts and stdout_value:
            artifacts = [{"output_type": "text", "title": "Python stdout", "text": stdout_value}]

        return NodeExecutionResult(
            metadata={
                "result": _serialize_value(result_value),
                "stdout": stdout_value,
                "stderr": stderr_value,
            },
            log_entries=logs,
            output_artifacts=artifacts,
        )


class SqlExecutionHandler(BaseExecutionHandler):
    executors = ("transform.sql", "notebook.cell.sql")

    def execute(self, request: NodeExecutionRequest) -> NodeExecutionResult:
        expression = str(_as_dict(request.node.get("config")).get("expression") or "").strip()
        statements = _split_sql_statements(expression)
        if not statements:
            raise NodeExecutionError(
                "SQL node does not contain any executable statements",
                retryable=False,
                code="sql_empty_script",
            )

        engine = db.get_engine()
        logs = [_log_entry("info", f"Executing {len(statements)} SQL statement(s).")]
        last_rows: list[dict[str, Any]] = []
        last_columns: list[dict[str, Any]] = []
        affected_rows = 0

        try:
            with engine.begin() as connection:
                _ensure_upstream_sql_inputs(connection, request.run_context)
                for index, statement in enumerate(statements, start=1):
                    result = connection.exec_driver_sql(statement)
                    if result.returns_rows:
                        keys = list(result.keys())
                        fetched_rows = result.fetchall()
                        last_rows = [
                            {str(key): _serialize_value(row[position]) for position, key in enumerate(keys)}
                            for row in fetched_rows[:200]
                        ]
                        last_columns = [{"name": str(key), "type": "unknown"} for key in keys]
                        logs.append(_log_entry("info", f"SQL statement {index} returned {len(last_rows)} row(s)."))
                    else:
                        affected = max(0, int(result.rowcount or 0))
                        affected_rows += affected
                        logs.append(_log_entry("info", f"SQL statement {index} affected {affected} row(s)."))
        except OperationalError as exc:
            raise NodeExecutionError(
                f"SQL execution failed: {exc}",
                retryable=True,
                code="sql_operational_error",
            ) from exc
        except SQLAlchemyError as exc:
            raise NodeExecutionError(
                f"SQL execution failed: {exc}",
                retryable=False,
                code="sql_execution_error",
            ) from exc

        artifacts: list[dict[str, Any]] = []
        if last_columns:
            artifacts.append(
                {
                    "output_type": "table",
                    "title": "SQL result",
                    "columns": last_columns,
                    "rows": last_rows,
                }
            )
        else:
            artifacts.append(
                {
                    "output_type": "text",
                    "title": "SQL execution summary",
                    "text": f"Statements completed. Total affected rows: {affected_rows}.",
                }
            )

        return NodeExecutionResult(
            metadata={
                "statement_count": len(statements),
                "affected_rows": affected_rows,
                "row_count": len(last_rows),
            },
            log_entries=logs,
            output_artifacts=artifacts,
        )


class ApiExecutionHandler(BaseExecutionHandler):
    executors = ("deploy.api", "api.call")

    def execute(self, request: NodeExecutionRequest) -> NodeExecutionResult:
        config = _as_dict(request.node.get("config"))
        url = str(config.get("endpoint_url") or config.get("target_name") or "").strip()
        if not url:
            raise NodeExecutionError(
                "API executor requires endpoint_url or target_name",
                retryable=False,
                code="api_missing_endpoint",
            )
        if not url.startswith(("http://", "https://")):
            raise NodeExecutionError(
                "API executor requires a fully-qualified http(s) URL",
                retryable=False,
                code="api_invalid_endpoint",
                details={"endpoint_url": url},
            )

        method = str(config.get("request_method") or config.get("method") or "POST").strip().upper()
        payload = config.get("request_body")
        if payload is None:
            payload = config.get("parameter_bindings") or request.run_context.get("parameters") or {}
        headers = _as_dict(config.get("request_headers"))
        timeout_seconds = float(config.get("timeout_seconds") or 30)

        try:
            response = requests.request(
                method,
                url,
                headers=headers,
                json=payload if isinstance(payload, (dict, list)) else None,
                data=None if isinstance(payload, (dict, list)) else payload,
                timeout=timeout_seconds,
            )
        except requests.Timeout as exc:
            raise NodeExecutionError(
                f"API request timed out after {timeout_seconds} second(s)",
                retryable=True,
                code="api_timeout",
                details={"endpoint_url": url, "request_method": method, "timeout_seconds": timeout_seconds},
            ) from exc
        except requests.ConnectionError as exc:
            raise NodeExecutionError(
                f"API request connection failed: {exc}",
                retryable=True,
                code="api_connection_error",
                details={"endpoint_url": url, "request_method": method},
            ) from exc
        except requests.RequestException as exc:
            raise NodeExecutionError(
                f"API request failed: {exc}",
                retryable=True,
                code="api_request_error",
                details={"endpoint_url": url, "request_method": method},
            ) from exc

        if response.status_code >= 500 or response.status_code == 429:
            raise NodeExecutionError(
                f"API request failed with status {response.status_code}: {response.text[:400]}",
                retryable=True,
                code="api_server_error",
                details={"status_code": response.status_code, "endpoint_url": url, "request_method": method},
            )
        if response.status_code >= 400:
            raise NodeExecutionError(
                f"API request failed with status {response.status_code}: {response.text[:400]}",
                retryable=False,
                code="api_client_error",
                details={"status_code": response.status_code, "endpoint_url": url, "request_method": method},
            )

        body: Any
        content_type = response.headers.get("content-type", "")
        if "application/json" in content_type:
            try:
                body = response.json()
            except ValueError:
                body = response.text
        else:
            body = response.text

        return NodeExecutionResult(
            metadata={
                "status_code": response.status_code,
                "response_headers": dict(response.headers),
                "request_method": method,
                "endpoint_url": url,
                "timeout_seconds": timeout_seconds,
                "response_kind": "json" if isinstance(body, (dict, list)) else "text",
            },
            log_entries=[
                _log_entry("info", f"API request {method} {url} returned status {response.status_code}.")
            ],
            output_artifacts=_artifact_from_value(body, "API response"),
        )


class DatasetExecutionHandler(BaseExecutionHandler):
    prefixes = ("dataset.",)

    def execute(self, request: NodeExecutionRequest) -> NodeExecutionResult:
        config = _as_dict(request.node.get("config"))
        dataset_name = str(config.get("dataset_name") or request.node.get("label") or request.node.get("id") or "dataset")
        dataset_mode = str(config.get("dataset_mode") or "source")
        return NodeExecutionResult(
            metadata={
                "dataset_name": dataset_name,
                "dataset_mode": dataset_mode,
            },
            log_entries=[
                _log_entry("info", f"Registered dataset node {dataset_name} in {dataset_mode} mode.")
            ],
            output_artifacts=[
                {
                    "output_type": "dataset_ref",
                    "title": "Dataset reference",
                    "dataset_name": dataset_name,
                    "dataset_mode": dataset_mode,
                }
            ],
        )


class ValidationExecutionHandler(BaseExecutionHandler):
    prefixes = ("validation.",)

    def execute(self, request: NodeExecutionRequest) -> NodeExecutionResult:
        config = _as_dict(request.node.get("config"))
        blocking = bool(config.get("blocking", True))
        namespace = _namespace_for_node(request.node, request.run_context)
        evaluations = _evaluate_validation_rules(_as_dict(config.get("rule_set")), namespace)
        failed = [item for item in evaluations if not item.get("passed")]
        if failed and blocking:
            raise NodeExecutionError(
                f"Validation failed for {len(failed)} rule(s)",
                retryable=False,
                code="validation_failed",
                details={"failed_rules": len(failed), "evaluated_rules": len(evaluations)},
            )

        summary = {
            "evaluated_rules": len(evaluations),
            "failed_rules": len(failed),
            "blocking": blocking,
        }
        return NodeExecutionResult(
            metadata=summary,
            log_entries=[
                _log_entry(
                    "info" if not failed else "warn",
                    f"Validation evaluated {summary['evaluated_rules']} rule(s) with {summary['failed_rules']} failure(s).",
                )
            ],
            output_artifacts=[
                {
                    "output_type": "validation",
                    "title": "Validation summary",
                    "summary": summary,
                    "rules": evaluations,
                }
            ],
        )


class PassthroughExecutionHandler(BaseExecutionHandler):
    prefixes = ("",)

    def execute(self, request: NodeExecutionRequest) -> NodeExecutionResult:
        return NodeExecutionResult(
            metadata={
                "handled": "passthrough",
            },
            log_entries=[
                _log_entry(
                    "info",
                    f"Executor {request.executor} completed through the generic control-plane path.",
                )
            ],
            output_artifacts=[
                {
                    "output_type": "text",
                    "title": "Execution summary",
                    "text": f"Executor {request.executor} completed through the generic control-plane path.",
                }
            ],
        )


_HANDLERS: tuple[ExecutionHandler, ...] = (
    PythonExecutionHandler(),
    SqlExecutionHandler(),
    ApiExecutionHandler(),
    DatasetExecutionHandler(),
    ValidationExecutionHandler(),
    PassthroughExecutionHandler(),
)


def _resolve_handler(executor: str) -> ExecutionHandler:
    for handler in _HANDLERS:
        if handler.matches(executor):
            return handler
    return PassthroughExecutionHandler()


def resolve_executor(node: dict[str, Any]) -> str:
    execution_binding = _as_dict(node.get("execution_binding"))
    if execution_binding.get("executor"):
        return str(execution_binding.get("executor"))
    data = _as_dict(node.get("data"))
    binding = _as_dict(data.get("execution_binding"))
    if binding.get("executor"):
        return str(binding.get("executor"))

    config = _as_dict(node.get("config") or data.get("config"))
    kind = str(node.get("kind") or data.get("kind") or node.get("type") or data.get("type") or "recipe").strip().lower()
    if kind == "dataset":
        return "dataset.reference"
    if kind == "validation":
        return "validation.quality"
    if kind == "deploy":
        return f"deploy.{str(config.get('target_platform') or 'container').strip().lower()}"
    if kind == "model":
        return f"ml.{str(config.get('task_type') or 'train').strip().lower()}"

    language = str(config.get("language") or "").strip().lower()
    if language == "sql":
        return "transform.sql"
    if language == "pyspark":
        return "transform.pyspark"
    if config.get("expression"):
        return "transform.python"
    return "control.passthrough"


def execute_node(
    node: dict[str, Any],
    run_context: dict[str, Any] | None = None,
    attempt: int = 1,
    max_attempts: int = 1,
) -> dict[str, Any]:
    context = run_context or {}
    context_attempt = context.get("_attempt")
    context_max_attempts = context.get("_max_attempts")
    executor = resolve_executor(node)
    request = NodeExecutionRequest(
        node=node,
        run_context=context,
        executor=executor,
        attempt=max(1, int(context_attempt or attempt or 1)),
        max_attempts=max(1, int(context_max_attempts or max_attempts or 1)),
    )
    started_at = time.time()
    started_at_iso = _now_iso()
    handler = _resolve_handler(executor)
    result = handler.execute(request)
    finished_at_iso = _now_iso()
    duration_ms = int((time.time() - started_at) * 1000)

    binding_metadata = _binding_details(node, executor)
    metadata = {
        **binding_metadata,
        **_as_dict(result.metadata),
        "attempt": request.attempt,
        "max_attempts": request.max_attempts,
        "duration_ms": duration_ms,
        "started_at": started_at_iso,
        "finished_at": finished_at_iso,
    }
    log_entries = _normalize_log_entries(result.log_entries, request, base_metadata=binding_metadata)

    return NodeExecutionResult(
        metadata=metadata,
        log_entries=log_entries,
        output_artifacts=list(result.output_artifacts),
    ).as_dict()
