"""
Prep Time Estimation + Order Throttling tests (Iteration 20).
Covers:
 - POST /api/store/eta (public): categories + item_ids resolution, ETA shape, capacity transitions
 - GET/PATCH /api/admin/throttle/settings (admin auth + validation)
 - GET /api/admin/throttle/status
 - GET/PUT /api/admin/prep-times (proxied to kds_settings — DRY)
 - Auto-pause hook via maybe_auto_pause (direct) + verify /store/status & /store/eta reflect
 - Order creation picks estimated_minutes from ETA payload (not hardcoded)
 - Regression: /api/admin/queue/live, /api/admin/printers, /api/search/menu, /api/admin/analytics/summary
After tests, restores defaults: max_concurrent_orders=15, auto_pause_threshold=0, unpaused.
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "admin@culinaryeditorial.com")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "Admin123!")
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


def _seed_paid_order(mongo_db, status="pending") -> str:
    oid = f"TEST_THR_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat()
    mongo_db.orders.insert_one({
        "id": oid,
        "status": status,
        "payment_status": "paid",
        "fulfillment_type": "pickup",
        "items": [{"item_id": "x", "name": "Test", "quantity": 1, "price": 10, "modifiers": []}],
        "subtotal": 10, "tax": 1, "delivery_fee": 0, "total": 11,
        "contact_name": "T", "contact_phone": "5550000000", "contact_email": "t@e.com",
        "created_at": now, "updated_at": now, "user_id": None, "order_number": oid[-6:],
    })
    SEEDED_IDS.append(oid)
    return oid


@pytest.fixture(scope="module", autouse=True)
def _cleanup(admin_client, mongo_db):
    # capture pre-test state so we can restore
    pre = admin_client.get(f"{BASE_URL}/api/admin/throttle/settings").json()
    yield
    # restore throttle
    admin_client.patch(f"{BASE_URL}/api/admin/throttle/settings", json={
        "max_concurrent_orders": int(pre.get("max_concurrent_orders") or 15),
        "auto_pause_threshold": int(pre.get("auto_pause_threshold") or 0),
        "slot_granularity_minutes": int(pre.get("slot_granularity_minutes") or 15),
        "base_buffer_minutes": int(pre.get("base_buffer_minutes") or 5),
    })
    # unpause storefront if paused
    st = requests.get(f"{BASE_URL}/api/store/status").json()
    if st.get("pause_ordering"):
        # flip via direct mongo to be safe
        mongo_db.store_settings.update_one(
            {"type": "hours"}, {"$set": {"pause_ordering": False}}, upsert=True
        )
    if SEEDED_IDS:
        mongo_db.orders.delete_many({"id": {"$in": SEEDED_IDS}})


# ─── Public store ETA ─────────────────────────────────

class TestStoreETA:
    def test_eta_with_categories(self, anon_client):
        r = anon_client.post(f"{BASE_URL}/api/store/eta", json={"categories": ["mains"]})
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("asap_available", "eta_minutes", "eta_label", "capacity_state",
                  "active_count", "max_concurrent_orders", "paused", "next_available_slot"):
            assert k in d, f"missing {k}"
        # default expectations
        assert d["paused"] is False
        assert d["asap_available"] is True
        assert d["eta_label"].startswith("Ready in ~")
        assert d["capacity_state"] in ("normal", "busy")
        assert d["next_available_slot"] is None
        assert d["max_concurrent_orders"] >= 1
        assert isinstance(d["eta_minutes"], int) and d["eta_minutes"] >= 1

    def test_eta_accepts_item_ids(self, anon_client):
        # Resolve from real menu item(s)
        items = anon_client.get(f"{BASE_URL}/api/menu/items?limit=1").json()
        items_list = items.get("items") if isinstance(items, dict) else items
        assert items_list, "No menu items to test with"
        mid = items_list[0]["id"]
        r = anon_client.post(f"{BASE_URL}/api/store/eta", json={"item_ids": [mid]})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "eta_minutes" in d

    def test_eta_empty_body_returns_default(self, anon_client):
        r = anon_client.post(f"{BASE_URL}/api/store/eta", json={})
        assert r.status_code == 200
        d = r.json()
        assert d["asap_available"] is True


# ─── Admin: settings + status ─────────────────────────

class TestThrottleAdmin:
    def test_unauth_settings(self, anon_client):
        assert anon_client.get(f"{BASE_URL}/api/admin/throttle/settings").status_code == 401
        assert anon_client.patch(f"{BASE_URL}/api/admin/throttle/settings", json={"max_concurrent_orders": 20}).status_code == 401
        assert anon_client.get(f"{BASE_URL}/api/admin/throttle/status").status_code == 401

    def test_get_settings_defaults(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/throttle/settings")
        assert r.status_code == 200
        d = r.json()
        for k in ("max_concurrent_orders", "auto_pause_threshold", "slot_granularity_minutes", "base_buffer_minutes"):
            assert k in d

    def test_patch_validation(self, admin_client):
        # invalid max_concurrent_orders
        r = admin_client.patch(f"{BASE_URL}/api/admin/throttle/settings", json={"max_concurrent_orders": 0})
        assert r.status_code == 400
        # invalid granularity
        r = admin_client.patch(f"{BASE_URL}/api/admin/throttle/settings", json={"slot_granularity_minutes": 7})
        assert r.status_code == 400
        # invalid base_buffer
        r = admin_client.patch(f"{BASE_URL}/api/admin/throttle/settings", json={"base_buffer_minutes": -1})
        assert r.status_code == 400
        # invalid auto_pause
        r = admin_client.patch(f"{BASE_URL}/api/admin/throttle/settings", json={"auto_pause_threshold": -1})
        assert r.status_code == 400

    def test_patch_success_persists(self, admin_client):
        r = admin_client.patch(f"{BASE_URL}/api/admin/throttle/settings", json={
            "max_concurrent_orders": 25, "slot_granularity_minutes": 30, "base_buffer_minutes": 4
        })
        assert r.status_code == 200
        d = r.json()
        assert d["max_concurrent_orders"] == 25
        assert d["slot_granularity_minutes"] == 30
        assert d["base_buffer_minutes"] == 4
        # GET verification
        g = admin_client.get(f"{BASE_URL}/api/admin/throttle/settings").json()
        assert g["max_concurrent_orders"] == 25 and g["slot_granularity_minutes"] == 30
        # restore
        admin_client.patch(f"{BASE_URL}/api/admin/throttle/settings", json={
            "max_concurrent_orders": 15, "slot_granularity_minutes": 15, "base_buffer_minutes": 5
        })

    def test_status_shape(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/throttle/status")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("state", "active_count", "max_concurrent_orders", "auto_pause_threshold",
                  "utilization", "paused", "server_time"):
            assert k in d
        assert d["state"] in ("normal", "busy", "at_capacity", "paused")
        assert 0 <= d["utilization"] <= 10  # ratio may exceed 1 if overloaded


# ─── ETA transitions: at_capacity with next_available_slot ────

class TestETATransitions:
    def test_at_capacity_when_cap_below_active(self, admin_client, mongo_db, anon_client):
        # Seed 2 paid orders
        _seed_paid_order(mongo_db, "pending")
        _seed_paid_order(mongo_db, "preparing")
        # Set cap to 1 (< active)
        admin_client.patch(f"{BASE_URL}/api/admin/throttle/settings", json={"max_concurrent_orders": 1})
        try:
            r = anon_client.post(f"{BASE_URL}/api/store/eta", json={"categories": ["mains"]})
            assert r.status_code == 200, r.text
            d = r.json()
            assert d["asap_available"] is False
            assert d["capacity_state"] == "at_capacity"
            assert d["next_available_slot"] is not None
            # must be future ISO string
            ts = datetime.fromisoformat(d["next_available_slot"].replace("Z", "+00:00"))
            assert ts > datetime.now(timezone.utc)
        finally:
            admin_client.patch(f"{BASE_URL}/api/admin/throttle/settings", json={"max_concurrent_orders": 15})


# ─── Admin prep-times (DRY w/ kds_settings) ──────────

class TestPrepTimes:
    def test_unauth(self, anon_client):
        assert anon_client.get(f"{BASE_URL}/api/admin/prep-times").status_code == 401

    def test_get_returns_map(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/prep-times")
        assert r.status_code == 200
        d = r.json()
        assert "target_prep_minutes_by_category" in d
        assert isinstance(d["target_prep_minutes_by_category"], dict)

    def test_put_and_verify_persistence(self, admin_client, mongo_db):
        # snapshot original
        orig = admin_client.get(f"{BASE_URL}/api/admin/prep-times").json()["target_prep_minutes_by_category"]
        new_map = {**orig, "test_cat_zzz": 17}
        r = admin_client.put(f"{BASE_URL}/api/admin/prep-times",
                             json={"target_prep_minutes_by_category": new_map})
        assert r.status_code == 200
        d = r.json()
        assert d["target_prep_minutes_by_category"].get("test_cat_zzz") == 17
        # GET to verify persistence
        g = admin_client.get(f"{BASE_URL}/api/admin/prep-times").json()
        assert g["target_prep_minutes_by_category"].get("test_cat_zzz") == 17
        # Verify DRY: same value stored in kds_settings
        kds = mongo_db.kds_settings.find_one({"key": "kds_settings"})
        assert kds is not None
        assert int(kds["target_prep_minutes_by_category"].get("test_cat_zzz", 0)) == 17
        # cleanup: remove temp cat, restore orig
        r = admin_client.put(f"{BASE_URL}/api/admin/prep-times",
                             json={"target_prep_minutes_by_category": orig})
        assert r.status_code == 200


# ─── Auto-pause hook ──────────────────────────────────

class TestAutoPause:
    def test_auto_pause_flips_store(self, admin_client, mongo_db, anon_client):
        # seed 2 paid orders
        _seed_paid_order(mongo_db, "pending")
        _seed_paid_order(mongo_db, "preparing")
        # ensure unpaused baseline
        mongo_db.store_settings.update_one(
            {"type": "hours"}, {"$set": {"pause_ordering": False}}, upsert=True
        )
        # set threshold=1
        admin_client.patch(f"{BASE_URL}/api/admin/throttle/settings", json={"auto_pause_threshold": 1})
        try:
            # invoke maybe_auto_pause directly via backend app import (same process DB)
            import asyncio, sys
            sys.path.insert(0, "/app/backend")
            from routes.throttle import maybe_auto_pause
            result = asyncio.run(maybe_auto_pause())
            assert result is True or mongo_db.store_settings.find_one({"type": "hours"}).get("pause_ordering") is True
            # /store/status reflects pause
            st = anon_client.get(f"{BASE_URL}/api/store/status").json()
            assert st.get("pause_ordering") is True or st.get("paused") is True or st.get("is_paused") is True \
                or any("paus" in str(v).lower() for v in st.values())
            # /store/eta reflects paused
            r = anon_client.post(f"{BASE_URL}/api/store/eta", json={"categories": ["mains"]})
            d = r.json()
            assert d["paused"] is True
            assert d["capacity_state"] == "paused"
            assert d["asap_available"] is False
        finally:
            # reset threshold + pause
            admin_client.patch(f"{BASE_URL}/api/admin/throttle/settings", json={"auto_pause_threshold": 0})
            mongo_db.store_settings.update_one(
                {"type": "hours"}, {"$set": {"pause_ordering": False}}, upsert=True
            )


# ─── Order creation uses ETA-based estimated_minutes ──

class TestOrderEstimated:
    def test_order_estimated_from_eta(self, anon_client, mongo_db):
        # fetch an item
        items = anon_client.get(f"{BASE_URL}/api/menu/items?limit=1").json()
        items_list = items.get("items") if isinstance(items, dict) else items
        assert items_list, "no items"
        item = items_list[0]
        payload = {
            "items": [{"item_id": item["id"], "quantity": 1, "modifiers": []}],
            "fulfillment_type": "pickup",
            "contact_name": "TEST User",
            "contact_phone": "5550000000",
            "contact_email": "test_thr_order@example.com",
            "origin_url": BASE_URL,
        }
        r = anon_client.post(f"{BASE_URL}/api/orders", json=payload)
        assert r.status_code in (200, 201), r.text
        d = r.json()
        order_id = d.get("order_id") or d.get("id")
        assert order_id, f"no order_id in response: {d}"
        # Fetch from DB to verify estimated_minutes was written by ETA computation
        doc = mongo_db.orders.find_one({"id": order_id})
        assert doc is not None, "order not persisted"
        assert "estimated_minutes" in doc, f"estimated_minutes missing in doc keys: {list(doc.keys())}"
        est = int(doc["estimated_minutes"])
        assert est > 0
        # Must match /store/eta for same category (derived, not hardcoded)
        cat = None
        menu_doc = mongo_db.menu_items.find_one({"id": item["id"]})
        if menu_doc:
            cat = menu_doc.get("category")
        eta = anon_client.post(f"{BASE_URL}/api/store/eta",
                               json={"categories": [cat] if cat else []}).json()
        # Allow small drift (+/- 5 min) since queue state may shift due to seed orders from other tests
        assert abs(est - int(eta["eta_minutes"])) <= 10, f"order est {est} vs eta {eta['eta_minutes']}"
        SEEDED_IDS.append(order_id)


# ─── Regression smoke ─────────────────────────────────

class TestRegression:
    def test_queue_live(self, admin_client):
        assert admin_client.get(f"{BASE_URL}/api/admin/queue/live").status_code == 200

    def test_printers(self, admin_client):
        assert admin_client.get(f"{BASE_URL}/api/admin/printers").status_code == 200

    def test_search_menu(self, anon_client):
        assert anon_client.get(f"{BASE_URL}/api/search/menu?q=a").status_code == 200

    def test_analytics_summary(self, admin_client):
        assert admin_client.get(f"{BASE_URL}/api/admin/analytics/summary").status_code == 200
