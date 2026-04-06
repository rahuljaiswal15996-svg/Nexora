import sqlite3
from pathlib import Path
from typing import Iterator

DB_FILE = Path(__file__).resolve().parents[1] / "data" / "nexora.db"
DB_FILE.parent.mkdir(parents=True, exist_ok=True)

CREATE_TABLE_SQL = """
BEGIN;
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
    created_at TEXT
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
    dag_json TEXT,
    created_at TEXT
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
    status TEXT,
    run_metadata TEXT,
    started_at TEXT,
    finished_at TEXT
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

COMMIT;
"""


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_connection() as conn:
        # CREATE_TABLE_SQL contains multiple statements; use executescript
        conn.executescript(CREATE_TABLE_SQL)
        conn.commit()


def iter_rows(query: str, params: tuple = ()) -> Iterator[sqlite3.Row]:
    with get_connection() as conn:
        cursor = conn.execute(query, params)
        yield from cursor
