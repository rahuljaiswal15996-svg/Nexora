"""initial schema

Revision ID: 20260407_0001
Revises:
Create Date: 2026-04-07 00:00:00.000000
"""

from __future__ import annotations

import sys
from pathlib import Path

from alembic import op

BASE_DIR = Path(__file__).resolve().parents[2]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.services.db import get_index_statements, get_schema_statements, get_schema_table_names

revision = "20260407_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    for statement in get_schema_statements():
        op.execute(statement)
    for statement in get_index_statements():
        op.execute(statement)


def downgrade() -> None:
    for table_name in reversed(get_schema_table_names()):
        op.execute(f"DROP TABLE IF EXISTS {table_name}")