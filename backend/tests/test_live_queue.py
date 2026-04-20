"""
Live Queue + Batch Accept tests.
Covers:
 - GET /api/admin/queue/live (admin auth required, summary + orders + server_time)
 - POST /api/admin/orders-batch/accept (accepted/skipped, non-colliding path)
 - Regression: existing /admin/orders/new, /admin/orders/{id}/accept,
   /admin/orders/{id}/reject, /admin/orders/{id}/advance endpoints.
Seeds pending paid orders directly via MongoDB for the queue tests.
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

# Load frontend/.env for REACT_APP_BACKEND_URL
load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

ADMIN_EMAIL = "admin@culinaryeditorial.com"
ADMIN_PASSWORD = "Admin123!"

# Seeded doc IDs created in this test module so we can clean up after
SEEDED_IDS: list[str] = []


@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def anon_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def mongo_db():
    from pymongo import MongoClient
    c = MongoClient(MONGO_URL)
    return c[DB_NAME]


def _seed_order(mongo_db, status="pending", fulfillment_type="pickup") -> str:
    """Directly insert a paid pending order, return its id."""
    oid = f"TEST_LQ_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": oid,
        "status": status,
        "payment_status": "paid",
        "fulfillment_type": fulfillment_type,
        "items": [{"item_id": "x", "name": "Test Item", "quantity": 1, "price": 12.00, "modifiers": []}],
        "subtotal": 12.00,
        "tax": 1.20,
        "delivery_fee": 0,
        "total": 13.20,
        "contact_name": "TEST Buyer",
        "contact_phone": "5551230000",
        "contact_email": "test_lq@example.com",
        "created_at": now,
        "updated_at": now,
        "user_id": None,
        "order_number": oid[-6:],
    }
    mongo_db.orders.insert_one(doc)
    SEEDED_IDS.append(oid)
    return oid


# ─── Live queue ──────────────────────────────────────────

class TestLiveQueue:
    def test_unauth_live_queue(self, anon_client):
        r = anon_client.get(f"{BASE_URL}/api/admin/queue/live")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"

    def test_live_queue_shape(self, admin_client, mongo_db):
        # seed 1 pending so queue has at least one row
        oid = _seed_order(mongo_db, "pending")
        r = admin_client.get(f"{BASE_URL}/api/admin/queue/live")
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("orders", "summary", "server_time"):
            assert k in data
        s = data["summary"]
        for k in ("orders_today", "revenue_today", "pending_count", "in_progress_count", "avg_prep_minutes"):
            assert k in s, f"summary missing {k}"
        assert isinstance(data["orders"], list)
        # seeded order should be present
        ids = {o.get("id") for o in data["orders"]}
        assert oid in ids
        # server_time is ISO8601
        assert isinstance(data["server_time"], str) and "T" in data["server_time"]
        # pending_count should be >= 1
        assert s["pending_count"] >= 1

    def test_live_queue_includes_active_statuses(self, admin_client, mongo_db):
        pend = _seed_order(mongo_db, "pending")
        prep = _seed_order(mongo_db, "preparing")
        ready = _seed_order(mongo_db, "ready")
        oft = _seed_order(mongo_db, "out_for_delivery", fulfillment_type="delivery")
        r = admin_client.get(f"{BASE_URL}/api/admin/queue/live")
        assert r.status_code == 200
        ids = {o.get("id") for o in r.json()["orders"]}
        for oid in (pend, prep, ready, oft):
            assert oid in ids, f"{oid} missing from live queue"


# ─── Batch accept ────────────────────────────────────────

class TestBatchAccept:
    def test_unauth_batch_accept(self, anon_client):
        r = anon_client.post(f"{BASE_URL}/api/admin/orders-batch/accept", json={"order_ids": []})
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"

    def test_batch_accept_empty_rejected(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/admin/orders-batch/accept", json={"order_ids": []})
        assert r.status_code == 400, r.text

    def test_batch_accept_accepts_and_skips(self, admin_client, mongo_db):
        a = _seed_order(mongo_db, "pending")
        b = _seed_order(mongo_db, "pending")
        bogus = "ORD_does_not_exist_xyz"
        already = _seed_order(mongo_db, "preparing")  # not pending — should be skipped

        r = admin_client.post(
            f"{BASE_URL}/api/admin/orders-batch/accept",
            json={"order_ids": [a, b, bogus, already]},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert set(data["accepted"]) == {a, b}
        assert set(data["skipped"]) == {bogus, already}

        # Verify persistence — a & b are now 'preparing' with accepted_at set
        for oid in (a, b):
            doc = mongo_db.orders.find_one({"id": oid}, {"_id": 0})
            assert doc["status"] == "preparing"
            assert doc.get("accepted_at")

    def test_batch_route_does_not_collide(self, admin_client, mongo_db):
        """Make sure /admin/orders-batch/accept is distinct from /admin/orders/{id}/accept."""
        # parametric accept with an id that looks like 'batch'
        r = admin_client.post(f"{BASE_URL}/api/admin/orders/batch/accept", json={})
        # This path should be interpreted as /admin/orders/{id='batch'}/accept -> 404 (order not found)
        assert r.status_code in (404, 405), f"unexpected status {r.status_code} body={r.text[:200]}"


# ─── Regression: existing admin order endpoints ───────────

class TestAdminOrdersRegression:
    def test_admin_new_orders_auth(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/orders/new")
        assert r.status_code == 200
        data = r.json()
        for k in ("orders", "count", "server_time"):
            assert k in data

    def test_accept_reject_advance_flow(self, admin_client, mongo_db):
        oid = _seed_order(mongo_db, "pending", fulfillment_type="delivery")
        # accept
        r = admin_client.post(f"{BASE_URL}/api/admin/orders/{oid}/accept")
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "preparing"
        # advance -> ready
        r = admin_client.post(f"{BASE_URL}/api/admin/orders/{oid}/advance")
        assert r.status_code == 200
        assert r.json()["status"] == "ready"
        # advance -> out_for_delivery (because fulfillment_type==delivery)
        r = admin_client.post(f"{BASE_URL}/api/admin/orders/{oid}/advance")
        assert r.status_code == 200
        assert r.json()["status"] == "out_for_delivery"
        # advance -> delivered
        r = admin_client.post(f"{BASE_URL}/api/admin/orders/{oid}/advance")
        assert r.status_code == 200
        assert r.json()["status"] == "delivered"

    def test_reject_flow(self, admin_client, mongo_db):
        oid = _seed_order(mongo_db, "pending")
        r = admin_client.post(f"{BASE_URL}/api/admin/orders/{oid}/reject", json={"reason": "Out of stock"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "rejected"
        assert data.get("rejection_reason") == "Out of stock"

    def test_accept_nonexistent_404(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/admin/orders/NOPE_xxx/accept")
        assert r.status_code == 404


# ─── Cleanup ─────────────────────────────────────────────

def teardown_module(_module):
    """Delete all test-seeded orders."""
    try:
        from pymongo import MongoClient
        c = MongoClient(MONGO_URL)
        db = c[DB_NAME]
        if SEEDED_IDS:
            db.orders.delete_many({"id": {"$in": SEEDED_IDS}})
    except Exception as e:
        print(f"cleanup warning: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
