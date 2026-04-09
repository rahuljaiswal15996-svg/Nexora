from datetime import datetime
from uuid import uuid4
from app.services.db import init_db, get_connection, upsert_row


def seed():
    init_db()
    now = datetime.utcnow().isoformat() + "Z"
    tid = "default"
    uid = str(uuid4())
    with get_connection() as conn:
        upsert_row(
            "tenants",
            {"id": tid, "name": "Default Tenant", "plan": "free", "created_at": now},
            connection=conn,
        )
        upsert_row(
            "users",
            {
                "id": uid,
                "tenant_id": tid,
                "email": "admin@local",
                "role": "admin",
                "created_at": now,
            },
            connection=conn,
        )
        conn.commit()
    print("Seeded tenant=default user=admin@local")


if __name__ == "__main__":
    seed()
