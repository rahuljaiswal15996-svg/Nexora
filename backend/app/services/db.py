import os
import time
from collections.abc import Iterator, Mapping, MutableMapping, Sequence
from functools import lru_cache
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Connection as SAConnection
from sqlalchemy.engine import CursorResult, Engine
from sqlalchemy.exc import ResourceClosedError

DB_FILE = Path(__file__).resolve().parents[1] / "data" / "nexora.db"
DEFAULT_SQLITE_DATABASE_URL = f"sqlite:///{DB_FILE.as_posix()}"

TABLE_SCHEMA_SQL_TEMPLATE = """
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    permissions_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS policies (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    effect TEXT NOT NULL,
    conditions_json TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS history (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    event_type TEXT,
    payload TEXT,
    created_at TEXT,
    timestamp TEXT,
    filename TEXT,
    summary TEXT,
    original_length INTEGER,
    converted_length INTEGER,
    similarity_ratio REAL,
    diff_count INTEGER,
    original_preview TEXT,
    converted_preview TEXT
);

CREATE TABLE IF NOT EXISTS uir (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    source_filename TEXT,
    language TEXT,
    uir_json TEXT,
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS conversions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    uir_id TEXT,
    request_id TEXT,
    status TEXT,
    result_json TEXT,
    metrics_json TEXT,
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS pipelines (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT,
    project_id TEXT,
    workspace_id TEXT,
    dag_json TEXT,
    created_at TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    owner_id TEXT NOT NULL,
    metadata_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_members (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    added_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS datasets (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    project_id TEXT,
    connection_id TEXT,
    source_path TEXT,
    name TEXT NOT NULL,
    schema_json TEXT,
    metadata_json TEXT,
    tags_json TEXT,
    row_count INTEGER,
    size_bytes INTEGER,
    quality_score REAL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dataset_lineage (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    source_dataset_id TEXT NOT NULL,
    target_dataset_id TEXT NOT NULL,
    transform_id TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dataset_quality_checks (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    check_name TEXT NOT NULL,
    status TEXT NOT NULL,
    metrics_json TEXT,
    last_run TEXT,
    frequency TEXT
);

CREATE TABLE IF NOT EXISTS platform_jobs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    job_type TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    execution_mode TEXT NOT NULL DEFAULT 'local',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    claimed_by TEXT,
    claimed_at TEXT,
    heartbeat_at TEXT,
    lease_expires_at TEXT,
    status TEXT NOT NULL,
    payload_json TEXT,
    result_json TEXT,
    error_text TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scenarios (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    project_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    base_uir_id TEXT,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scenario_versions (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    version TEXT NOT NULL,
    uir_id TEXT,
    converted_code TEXT,
    metadata_json TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scenario_comparisons (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    scenario_version_a TEXT NOT NULL,
    scenario_version_b TEXT NOT NULL,
    similarity_score REAL,
    diff_json TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pipeline_runs (
    id TEXT PRIMARY KEY,
    pipeline_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    execution_mode TEXT NOT NULL DEFAULT 'local',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    claimed_by TEXT,
    claimed_at TEXT,
    heartbeat_at TEXT,
    lease_expires_at TEXT,
    status TEXT,
    run_metadata TEXT,
    started_at TEXT,
    finished_at TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS pipeline_run_nodes (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    pipeline_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    node_label TEXT,
    node_kind TEXT,
    stage_index INTEGER NOT NULL,
    status TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    metadata_json TEXT,
    error_text TEXT,
    started_at TEXT,
    finished_at TEXT,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pipeline_run_logs (
    id {pipeline_run_logs_id_column},
    run_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    node_execution_id TEXT,
    node_id TEXT,
    level TEXT NOT NULL,
    stream TEXT NOT NULL DEFAULT 'stdout',
    message TEXT NOT NULL,
    metadata_json TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT,
    metadata_json TEXT,
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS model_versions (
    id TEXT PRIMARY KEY,
    model_id TEXT NOT NULL,
    version TEXT,
    artifact_location TEXT,
    metrics_json TEXT,
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS features (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT,
    definition_json TEXT,
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS prompts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT 'v1',
    template TEXT NOT NULL,
    metadata_json TEXT,
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS lineage (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    source_json TEXT,
    target_json TEXT,
    metadata_json TEXT,
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS usage (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    metric TEXT NOT NULL,
    value REAL,
    recorded_at TEXT
);

CREATE TABLE IF NOT EXISTS credential_vault (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    secret_ref TEXT,
    metadata_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deployment_targets (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    platform_type TEXT NOT NULL,
    endpoint_config_json TEXT,
    credentials_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deployments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    pipeline_id TEXT,
    target_id TEXT,
    target_platform TEXT NOT NULL,
    target_config_json TEXT,
    status TEXT NOT NULL,
    deployed_at TEXT,
    deployed_by TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deployment_runs (
    id TEXT PRIMARY KEY,
    deployment_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    run_id TEXT,
    status TEXT NOT NULL,
    status_details TEXT,
    started_at TEXT,
    finished_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    old_value_json TEXT,
    new_value_json TEXT,
    timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS governance_policies (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    rule_json TEXT NOT NULL,
    enforcement TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_quotas (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    limit_value REAL NOT NULL,
    unit TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cost_tracking (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    period TEXT NOT NULL,
    service_type TEXT NOT NULL,
    quantity REAL,
    cost REAL,
    metadata_json TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS review_requests (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    assigned_to TEXT,
    status TEXT NOT NULL,
    comments_json TEXT,
    created_at TEXT NOT NULL,
    resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS change_log (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    version TEXT NOT NULL,
    change_json TEXT NOT NULL,
    changed_by TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS experiments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    project_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS experiment_runs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    experiment_id TEXT NOT NULL,
    model_id TEXT,
    status TEXT NOT NULL,
    run_params_json TEXT,
    metrics_json TEXT,
    artifacts_json TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS model_serving (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    model_version_id TEXT NOT NULL,
    endpoint_url TEXT NOT NULL,
    status TEXT NOT NULL,
    metadata_json TEXT,
    deployed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shadow_runs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    input_type TEXT,
    input_blob TEXT,
    legacy_output TEXT,
    converted_output TEXT,
    comparison_json TEXT,
    confidence REAL,
    status TEXT,
    created_at TEXT,
    reviewed_at TEXT,
    reviewer_id TEXT,
    review_action TEXT,
    review_comment TEXT
);

CREATE TABLE IF NOT EXISTS notebooks (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    project_id TEXT,
    workspace_id TEXT,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    config TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_tested TEXT,
    last_test_result TEXT
);
"""

INDEX_STATEMENTS = [
    "CREATE INDEX IF NOT EXISTS idx_notebooks_scope_inventory ON notebooks (tenant_id, user_id, project_id, workspace_id, updated_at)",
    "CREATE INDEX IF NOT EXISTS idx_pipelines_scope_inventory ON pipelines (tenant_id, project_id, workspace_id, updated_at)",
    "CREATE INDEX IF NOT EXISTS idx_platform_jobs_remote_claim ON platform_jobs (execution_mode, status, tenant_id, job_type, lease_expires_at, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_pipeline_runs_remote_claim ON pipeline_runs (execution_mode, status, tenant_id, lease_expires_at, started_at)",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_run_nodes_run_node ON pipeline_run_nodes (run_id, node_id)",
    "CREATE INDEX IF NOT EXISTS idx_pipeline_run_nodes_run_stage ON pipeline_run_nodes (run_id, stage_index, status, updated_at)",
    "CREATE INDEX IF NOT EXISTS idx_pipeline_run_logs_run_cursor ON pipeline_run_logs (run_id, id)",
    "CREATE INDEX IF NOT EXISTS idx_pipeline_run_logs_run_node_cursor ON pipeline_run_logs (run_id, node_id, id)",
]

LEGACY_COLUMN_DEFINITIONS: dict[str, list[tuple[str, str]]] = {
    "notebooks": [
        ("project_id", "TEXT"),
        ("workspace_id", "TEXT"),
    ],
    "pipelines": [
        ("project_id", "TEXT"),
        ("workspace_id", "TEXT"),
        ("updated_at", "TEXT"),
    ],
    "platform_jobs": [
        ("execution_mode", "TEXT NOT NULL DEFAULT 'local'"),
        ("attempt_count", "INTEGER NOT NULL DEFAULT 0"),
        ("max_attempts", "INTEGER NOT NULL DEFAULT 3"),
        ("claimed_by", "TEXT"),
        ("claimed_at", "TEXT"),
        ("heartbeat_at", "TEXT"),
        ("lease_expires_at", "TEXT"),
    ],
    "pipeline_runs": [
        ("execution_mode", "TEXT NOT NULL DEFAULT 'local'"),
        ("attempt_count", "INTEGER NOT NULL DEFAULT 0"),
        ("max_attempts", "INTEGER NOT NULL DEFAULT 3"),
        ("claimed_by", "TEXT"),
        ("claimed_at", "TEXT"),
        ("heartbeat_at", "TEXT"),
        ("lease_expires_at", "TEXT"),
        ("updated_at", "TEXT"),
    ],
    "history": [
        ("timestamp", "TEXT"),
        ("filename", "TEXT"),
        ("summary", "TEXT"),
        ("original_length", "INTEGER"),
        ("converted_length", "INTEGER"),
        ("similarity_ratio", "REAL"),
        ("diff_count", "INTEGER"),
        ("original_preview", "TEXT"),
        ("converted_preview", "TEXT"),
        ("created_at", "TEXT"),
    ],
    "connections": [
        ("last_tested", "TEXT"),
        ("last_test_result", "TEXT"),
    ],
}


def _normalize_database_url(raw_url: str | None) -> str:
    if not raw_url:
        return DEFAULT_SQLITE_DATABASE_URL
    if raw_url.startswith("postgres://"):
        return raw_url.replace("postgres://", "postgresql+psycopg://", 1)
    if raw_url.startswith("postgresql://") and "+psycopg" not in raw_url and "+psycopg2" not in raw_url:
        return raw_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return raw_url


def get_database_url() -> str:
    return _normalize_database_url(os.getenv("DATABASE_URL") or os.getenv("NEXORA_DATABASE_URL"))


def get_database_backend() -> str:
    return "sqlite" if get_database_url().startswith("sqlite") else "postgresql"


def _pipeline_run_logs_id_column_sql() -> str:
    if get_database_backend() == "sqlite":
        return "INTEGER PRIMARY KEY AUTOINCREMENT"
    return "INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY"


def _split_sql_script(script: str) -> list[str]:
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


@lru_cache(maxsize=1)
def _table_statements() -> tuple[str, ...]:
    schema_sql = TABLE_SCHEMA_SQL_TEMPLATE.format(
        pipeline_run_logs_id_column=_pipeline_run_logs_id_column_sql(),
    )
    return tuple(_split_sql_script(schema_sql))


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    database_url = get_database_url()
    engine_kwargs: dict[str, Any] = {"pool_pre_ping": True, "future": True}
    if database_url.startswith("sqlite"):
        DB_FILE.parent.mkdir(parents=True, exist_ok=True)
        engine_kwargs["connect_args"] = {"check_same_thread": False}
    return create_engine(database_url, **engine_kwargs)


def dispose_engine() -> None:
    try:
        engine = get_engine()
    except Exception:
        get_engine.cache_clear()
        _table_statements.cache_clear()
        return
    engine.dispose()
    get_engine.cache_clear()
    _table_statements.cache_clear()


class DBRow(MutableMapping[str, Any]):
    def __init__(self, columns: Sequence[str], values: Sequence[Any]):
        self._columns = list(columns)
        self._values = list(values)
        self._data = {column: value for column, value in zip(self._columns, self._values)}

    def __getitem__(self, key: str | int) -> Any:
        if isinstance(key, int):
            return self._values[key]
        return self._data[key]

    def __setitem__(self, key: str | int, value: Any) -> None:
        if isinstance(key, int):
            column = self._columns[key]
            self._values[key] = value
            self._data[column] = value
            return
        if key in self._data:
            index = self._columns.index(key)
            self._values[index] = value
        else:
            self._columns.append(key)
            self._values.append(value)
        self._data[key] = value

    def __delitem__(self, key: str | int) -> None:
        if isinstance(key, int):
            column = self._columns.pop(key)
            self._values.pop(key)
            del self._data[column]
            return
        index = self._columns.index(key)
        self._columns.pop(index)
        self._values.pop(index)
        del self._data[key]

    def __iter__(self):
        return iter(self._values)

    def __len__(self) -> int:
        return len(self._columns)

    def keys(self):
        return self._data.keys()

    def items(self):
        return self._data.items()

    def values(self):
        return self._data.values()

    def get(self, key: str, default: Any = None) -> Any:
        return self._data.get(key, default)

    def copy(self) -> dict[str, Any]:
        return dict(self._data)

    def __repr__(self) -> str:
        return repr(self._data)


def _to_row(result_row: Any, keys: Sequence[str]) -> DBRow:
    if isinstance(result_row, DBRow):
        return result_row
    if hasattr(result_row, "_mapping"):
        mapping = result_row._mapping
        return DBRow(list(keys), [mapping[key] for key in keys])
    if isinstance(result_row, Mapping):
        columns = list(keys) or list(result_row.keys())
        return DBRow(columns, [result_row[key] for key in columns])
    values = list(result_row)
    columns = list(keys) or [str(index) for index in range(len(values))]
    return DBRow(columns, values)


def _replace_positional_placeholders(query: str, param_count: int) -> str:
    rewritten: list[str] = []
    index = 0
    in_single_quote = False
    in_double_quote = False

    for char in query:
        if char == "'" and not in_double_quote:
            in_single_quote = not in_single_quote
        elif char == '"' and not in_single_quote:
            in_double_quote = not in_double_quote

        if char == "?" and not in_single_quote and not in_double_quote:
            rewritten.append(f":p{index}")
            index += 1
            continue

        rewritten.append(char)

    if index != param_count:
        raise ValueError(f"Expected {param_count} placeholders in query, found {index}")
    return "".join(rewritten)


def _normalize_query(query: str, params: Mapping[str, Any] | Sequence[Any] | None) -> tuple[str, dict[str, Any]]:
    if params is None:
        return query, {}
    if isinstance(params, Mapping):
        return query, dict(params)

    positional = tuple(params)
    if not positional:
        return query, {}
    normalized_query = _replace_positional_placeholders(query, len(positional))
    return normalized_query, {f"p{index}": value for index, value in enumerate(positional)}


class DBCursor:
    def __init__(self, connection: "DBConnection"):
        self._connection = connection
        self._result: CursorResult | None = None
        self._keys: tuple[str, ...] = ()
        self.rowcount: int = 0
        self.lastrowid: Any = None

    def _set_result(self, result: CursorResult) -> None:
        self._result = result
        try:
            self._keys = tuple(result.keys())
        except ResourceClosedError:
            self._keys = ()
        raw_rowcount = result.rowcount
        self.rowcount = raw_rowcount if isinstance(raw_rowcount, int) else 0
        # On psycopg, touching lastrowid on row-returning statements can close the cursor.
        self.lastrowid = getattr(result, "lastrowid", None) if not result.returns_rows else None

    def execute(self, query: str, params: Mapping[str, Any] | Sequence[Any] | None = None) -> "DBCursor":
        result = self._connection._execute(query, params)
        self._set_result(result)
        return self

    def fetchone(self) -> DBRow | None:
        if self._result is None:
            return None
        try:
            row = self._result.fetchone()
        except ResourceClosedError:
            return None
        if row is None:
            return None
        return _to_row(row, self._keys)

    def fetchall(self) -> list[DBRow]:
        if self._result is None:
            return []
        try:
            rows = self._result.fetchall()
        except ResourceClosedError:
            return []
        return [_to_row(row, self._keys) for row in rows]

    def close(self) -> None:
        if self._result is not None:
            self._result.close()

    def __iter__(self):
        while True:
            row = self.fetchone()
            if row is None:
                break
            yield row


class DBConnection:
    def __init__(self, connection: SAConnection):
        self._connection = connection
        self._transaction = self._connection.begin()

    def _execute(self, query: str, params: Mapping[str, Any] | Sequence[Any] | None = None) -> CursorResult:
        normalized_query, bind_params = _normalize_query(query, params)
        return self._connection.execute(text(normalized_query), bind_params)

    def execute(self, query: str, params: Mapping[str, Any] | Sequence[Any] | None = None) -> DBCursor:
        return self.cursor().execute(query, params)

    def cursor(self) -> DBCursor:
        return DBCursor(self)

    def commit(self) -> None:
        if self._transaction.is_active:
            self._transaction.commit()
        self._transaction = self._connection.begin()

    def rollback(self) -> None:
        if self._transaction.is_active:
            self._transaction.rollback()
        if not self._connection.closed:
            self._transaction = self._connection.begin()

    def close(self) -> None:
        if self._transaction.is_active:
            self._transaction.rollback()
        self._connection.close()

    def __enter__(self) -> "DBConnection":
        return self

    def __exit__(self, exc_type, exc, _tb) -> None:
        try:
            if exc_type is None:
                if self._transaction.is_active:
                    self._transaction.commit()
            elif self._transaction.is_active:
                self._transaction.rollback()
        finally:
            self._connection.close()


def get_connection() -> DBConnection:
    return DBConnection(get_engine().connect())


def _ensure_columns(connection: SAConnection) -> None:
    inspector = inspect(connection)
    for table_name, columns in LEGACY_COLUMN_DEFINITIONS.items():
        existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
        for column_name, definition in columns:
            if column_name not in existing_columns:
                connection.exec_driver_sql(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}")
                existing_columns.add(column_name)


def _initialize_schema() -> None:
    with get_engine().begin() as connection:
        for statement in _table_statements():
            connection.exec_driver_sql(statement)
        _ensure_columns(connection)
        for statement in INDEX_STATEMENTS:
            connection.exec_driver_sql(statement)


def init_db() -> None:
    max_attempts = max(1, int(os.getenv("NEXORA_DB_CONNECT_RETRIES", "5")))
    retry_delay = max(0.0, float(os.getenv("NEXORA_DB_CONNECT_RETRY_DELAY", "2")))
    last_error: Exception | None = None

    for attempt in range(1, max_attempts + 1):
        try:
            _initialize_schema()
            return
        except Exception as exc:
            last_error = exc
            dispose_engine()
            if attempt == max_attempts:
                break
            time.sleep(retry_delay)

    if last_error is not None:
        raise last_error


def get_schema_statements() -> tuple[str, ...]:
    return _table_statements()


def get_index_statements() -> tuple[str, ...]:
    return tuple(INDEX_STATEMENTS)


def get_schema_table_names() -> tuple[str, ...]:
    names: list[str] = []
    prefix = "CREATE TABLE IF NOT EXISTS "
    for statement in _table_statements():
        if not statement.startswith(prefix):
            continue
        names.append(statement[len(prefix):].split("(", 1)[0].strip())
    return tuple(names)


def iter_rows(query: str, params: Mapping[str, Any] | Sequence[Any] | None = None) -> Iterator[DBRow]:
    with get_connection() as conn:
        cursor = conn.execute(query, params)
        yield from cursor


def upsert_row(
    table_name: str,
    values: Mapping[str, Any],
    *,
    conflict_columns: Sequence[str] = ("id",),
    connection: DBConnection | None = None,
) -> None:
    columns = list(values.keys())
    if not columns:
        raise ValueError("upsert_row requires at least one column")
    if not conflict_columns:
        raise ValueError("upsert_row requires at least one conflict column")

    missing_conflict_columns = [column for column in conflict_columns if column not in values]
    if missing_conflict_columns:
        missing = ", ".join(missing_conflict_columns)
        raise ValueError(f"Missing conflict columns for upsert_row: {missing}")

    column_sql = ", ".join(columns)
    placeholder_sql = ", ".join(f":{column}" for column in columns)
    conflict_sql = ", ".join(conflict_columns)
    update_columns = [column for column in columns if column not in conflict_columns]
    if update_columns:
        update_sql = ", ".join(f"{column} = EXCLUDED.{column}" for column in update_columns)
        statement = (
            f"INSERT INTO {table_name} ({column_sql}) VALUES ({placeholder_sql}) "
            f"ON CONFLICT ({conflict_sql}) DO UPDATE SET {update_sql}"
        )
    else:
        statement = (
            f"INSERT INTO {table_name} ({column_sql}) VALUES ({placeholder_sql}) "
            f"ON CONFLICT ({conflict_sql}) DO NOTHING"
        )

    if connection is not None:
        connection.execute(statement, values)
        return

    with get_connection() as conn:
        conn.execute(statement, values)
        conn.commit()


def list_table_names() -> list[str]:
    with get_engine().connect() as connection:
        return sorted(inspect(connection).get_table_names())
