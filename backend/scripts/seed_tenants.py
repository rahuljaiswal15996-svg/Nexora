from datetime import datetime
from uuid import uuid4
from app.services.db import init_db, get_connection


def seed():
    init_db()
    now = datetime.utcnow().isoformat() + "Z"
    tid = "default"
    uid = str(uuid4())
    with get_connection() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO tenants (id, name, plan, created_at) VALUES (?, ?, ?, ?)",
            (tid, "Default Tenant", "free", now),
        )
        conn.execute(
            "INSERT OR REPLACE INTO users (id, tenant_id, email, role, created_at) VALUES (?, ?, ?, ?, ?)",
            (uid, tid, "admin@local", "admin", now),
        )
        conn.commit()
    print("Seeded tenant=default user=admin@local")


if __name__ == "__main__":
    seed()
