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
