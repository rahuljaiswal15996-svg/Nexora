from pathlib import Path
import sys

# Ensure backend package is importable when running tests from repo root
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from app.main import app
from app.services.db import init_db


def setup_module():
    # initialize sqlite schema
    init_db()


def test_shadow_hitl_flow():
    client = TestClient(app)

    sample = "PROC SQL; SELECT id, name FROM users; quit;"

    # create a shadow run with a high threshold to force manual review
    resp = client.post("/shadow", json={"input": sample, "input_type": "code", "threshold": 0.99}, headers={"X-Tenant-Id": "default"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    sid = data["shadow_id"]
    assert sid
    assert data["review_status"] == "manual_review"

    # perform a human review action
    r = client.post(f"/shadow/{sid}/review", json={"reviewer": "tester", "action": "approve", "comment": "looks good"})
    assert r.status_code == 200
    rr = r.json()
    assert rr["status"] == "ok"

    # fetch and assert review recorded
    f = client.get(f"/shadow/{sid}")
    assert f.status_code == 200
    ff = f.json()
    assert ff.get("review_action") == "approve"
    assert ff.get("status", "").startswith("reviewed")
