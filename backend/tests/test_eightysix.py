"""Quick 86 / Sold-Out feature tests — per-item toggle, batch, log, settings, auto-restore."""
import pytest
import requests
import os
from datetime import datetime, timezone

BASE_URL = (os.environ.get('REACT_APP_BACKEND_URL') or 'https://job-builder-6.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = "admin@culinaryeditorial.com"
ADMIN_PASSWORD = "Admin123!"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def anon_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def seed_items(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/menu/items")
    assert r.status_code == 200
    items = r.json().get("items", [])
    assert len(items) >= 3, "Need at least 3 menu items"
    return items


class TestAuthGuard:
    def test_log_requires_admin(self, anon_session):
        r = anon_session.get(f"{BASE_URL}/api/admin/86/log")
        assert r.status_code in (401, 403)

    def test_toggle_requires_admin(self, anon_session, seed_items):
        iid = seed_items[0]["id"]
        r = anon_session.post(f"{BASE_URL}/api/admin/86/items/{iid}/toggle", json={})
        assert r.status_code in (401, 403)

    def test_settings_requires_admin(self, anon_session):
        r = anon_session.get(f"{BASE_URL}/api/admin/86/settings")
        assert r.status_code in (401, 403)


class TestSettings:
    def test_get_settings_default(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/86/settings")
        assert r.status_code == 200
        data = r.json()
        assert "auto_restore_on_open" in data
        assert isinstance(data["auto_restore_on_open"], bool)

    def test_patch_settings_toggles(self, admin_session):
        r = admin_session.patch(f"{BASE_URL}/api/admin/86/settings", json={"auto_restore_on_open": False})
        assert r.status_code == 200
        assert r.json()["auto_restore_on_open"] is False
        r = admin_session.patch(f"{BASE_URL}/api/admin/86/settings", json={"auto_restore_on_open": True})
        assert r.status_code == 200
        assert r.json()["auto_restore_on_open"] is True

    def test_patch_empty_body_400(self, admin_session):
        r = admin_session.patch(f"{BASE_URL}/api/admin/86/settings", json={})
        assert r.status_code == 400


class TestToggleItem:
    def test_toggle_flip_to_sold_out(self, admin_session, seed_items):
        iid = seed_items[0]["id"]
        # ensure in_stock first
        admin_session.post(f"{BASE_URL}/api/admin/86/items/{iid}/toggle", json={"status": "in_stock"})
        r = admin_session.post(f"{BASE_URL}/api/admin/86/items/{iid}/toggle", json={})
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "sold_out"
        assert data["available"] is False
        # verify via public menu
        g = admin_session.get(f"{BASE_URL}/api/menu/items/{iid}")
        assert g.status_code == 200
        assert g.json().get("status") == "sold_out"
        assert g.json().get("available") is False

    def test_toggle_explicit_in_stock_restores(self, admin_session, seed_items):
        iid = seed_items[0]["id"]
        r = admin_session.post(f"{BASE_URL}/api/admin/86/items/{iid}/toggle", json={"status": "in_stock", "source": "admin_86"})
        assert r.status_code == 200
        assert r.json()["status"] == "in_stock"
        assert r.json()["available"] is True

    def test_toggle_invalid_status(self, admin_session, seed_items):
        iid = seed_items[0]["id"]
        r = admin_session.post(f"{BASE_URL}/api/admin/86/items/{iid}/toggle", json={"status": "gone"})
        assert r.status_code == 400

    def test_toggle_unknown_item(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/admin/86/items/does-not-exist/toggle", json={})
        assert r.status_code == 404


class TestBatch:
    def test_batch_by_ids_sold_out(self, admin_session, seed_items):
        ids = [seed_items[0]["id"], seed_items[1]["id"]]
        r = admin_session.post(f"{BASE_URL}/api/admin/86/batch",
                               json={"item_ids": ids, "status": "sold_out", "source": "batch"})
        assert r.status_code == 200
        body = r.json()
        assert body["target_status"] == "sold_out"
        assert body["updated"] >= 2
        assert set(ids).issubset(set(body["item_ids"]))
        # verify DB state
        for iid in ids:
            g = admin_session.get(f"{BASE_URL}/api/menu/items/{iid}")
            assert g.status_code == 200
            assert g.json()["status"] == "sold_out"

    def test_batch_restore_by_ids(self, admin_session, seed_items):
        ids = [seed_items[0]["id"], seed_items[1]["id"]]
        r = admin_session.post(f"{BASE_URL}/api/admin/86/batch",
                               json={"item_ids": ids, "status": "in_stock"})
        assert r.status_code == 200
        for iid in ids:
            g = admin_session.get(f"{BASE_URL}/api/menu/items/{iid}")
            assert g.json()["status"] == "in_stock"
            assert g.json()["available"] is True

    def test_batch_by_category(self, admin_session, seed_items):
        # pick category of first item
        cat = seed_items[0].get("category")
        if not cat:
            pytest.skip("No category on seed items")
        r = admin_session.post(f"{BASE_URL}/api/admin/86/batch",
                               json={"category": cat, "status": "sold_out", "source": "batch_category"})
        assert r.status_code == 200
        data = r.json()
        assert data["target_status"] == "sold_out"
        assert data["updated"] >= 1
        # cleanup - restore
        r2 = admin_session.post(f"{BASE_URL}/api/admin/86/batch",
                                json={"category": cat, "status": "in_stock"})
        assert r2.status_code == 200
        assert r2.json()["updated"] >= 1

    def test_batch_invalid_status(self, admin_session, seed_items):
        r = admin_session.post(f"{BASE_URL}/api/admin/86/batch",
                               json={"item_ids": [seed_items[0]["id"]], "status": "weird"})
        assert r.status_code == 400

    def test_batch_empty_match(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/admin/86/batch",
                               json={"item_ids": [], "category": None, "status": "sold_out"})
        assert r.status_code == 400


class TestLog:
    def test_log_contains_recent_entries(self, admin_session, seed_items):
        iid = seed_items[2]["id"]
        # create a toggle so we have an entry
        admin_session.post(f"{BASE_URL}/api/admin/86/items/{iid}/toggle", json={"status": "sold_out", "source": "admin_86"})
        admin_session.post(f"{BASE_URL}/api/admin/86/items/{iid}/toggle", json={"status": "in_stock", "source": "admin_86"})
        r = admin_session.get(f"{BASE_URL}/api/admin/86/log?limit=50")
        assert r.status_code == 200
        data = r.json()
        assert "logs" in data and isinstance(data["logs"], list)
        assert data["count"] == len(data["logs"])
        assert len(data["logs"]) > 0
        first = data["logs"][0]
        for k in ("id", "item_id", "item_name", "prev_status", "new_status", "source", "created_at"):
            assert k in first, f"missing {k}"

    def test_log_filter_by_item(self, admin_session, seed_items):
        iid = seed_items[2]["id"]
        r = admin_session.get(f"{BASE_URL}/api/admin/86/log", params={"item_id": iid, "limit": 10})
        assert r.status_code == 200
        logs = r.json()["logs"]
        assert all(l["item_id"] == iid for l in logs)


class TestMenuRegression:
    def test_menu_items_unchanged_shape(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/menu/items")
        assert r.status_code == 200
        data = r.json()
        assert "items" in data
        assert isinstance(data["items"], list)

    def test_sold_out_item_renders_in_menu(self, admin_session, seed_items):
        iid = seed_items[0]["id"]
        admin_session.post(f"{BASE_URL}/api/admin/86/items/{iid}/toggle", json={"status": "sold_out"})
        r = admin_session.get(f"{BASE_URL}/api/menu/items")
        items = r.json().get("items", [])
        match = next((i for i in items if i["id"] == iid), None)
        assert match is not None, "sold_out item should still appear in /menu/items"
        assert match["status"] == "sold_out"
        assert match["available"] is False
        # cleanup
        admin_session.post(f"{BASE_URL}/api/admin/86/items/{iid}/toggle", json={"status": "in_stock"})


class TestAutoRestore:
    def test_auto_restore_fires_on_open_when_fresh_day(self, admin_session, seed_items):
        # Enable auto-restore
        admin_session.patch(f"{BASE_URL}/api/admin/86/settings", json={"auto_restore_on_open": True})
        # mark a couple items sold_out
        ids = [seed_items[0]["id"], seed_items[1]["id"]]
        for iid in ids:
            admin_session.post(f"{BASE_URL}/api/admin/86/items/{iid}/toggle", json={"status": "sold_out"})
        # Reset last_auto_restore_date via directly patching mongo (no such admin endpoint) -
        # Instead, we can't reach db directly. We rely on /store/status call.
        # Strategy: call /store/status; if store is open and last date != today, items restore.
        # We'll simulate by forcibly resetting via pymongo if available.
        try:
            from pymongo import MongoClient
            mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
            db_name = os.environ.get("DB_NAME", "test_database")
            client = MongoClient(mongo_url)
            client[db_name].app_settings.update_one(
                {"key": "86_settings"},
                {"$set": {"last_auto_restore_date": None}},
                upsert=True,
            )
        except Exception as e:
            pytest.skip(f"Cannot reset last_auto_restore_date directly: {e}")

        s = admin_session.get(f"{BASE_URL}/api/store/status")
        assert s.status_code == 200
        is_open = s.json().get("is_open")
        if not is_open:
            # restore manually to cleanup
            for iid in ids:
                admin_session.post(f"{BASE_URL}/api/admin/86/items/{iid}/toggle", json={"status": "in_stock"})
            pytest.skip("Store not open in current env — auto-restore cannot fire")

        # After /store/status, items should be restored
        for iid in ids:
            g = admin_session.get(f"{BASE_URL}/api/menu/items/{iid}")
            assert g.json()["status"] == "in_stock", f"{iid} should have been auto-restored"

        # Second call same day should NOT create additional restore logs
        logs_before = admin_session.get(f"{BASE_URL}/api/admin/86/log?limit=200").json()["logs"]
        auto_before = sum(1 for l in logs_before if l.get("source") == "auto_restore_on_open")
        admin_session.get(f"{BASE_URL}/api/store/status")
        logs_after = admin_session.get(f"{BASE_URL}/api/admin/86/log?limit=200").json()["logs"]
        auto_after = sum(1 for l in logs_after if l.get("source") == "auto_restore_on_open")
        assert auto_after == auto_before, "auto-restore should not re-fire same day"


@pytest.fixture(scope="module", autouse=True)
def cleanup_restore_all(admin_session):
    yield
    # final cleanup: restore everything to in_stock
    try:
        r = admin_session.get(f"{BASE_URL}/api/menu/items")
        items = r.json().get("items", [])
        sold = [i["id"] for i in items if i.get("status") == "sold_out"]
        if sold:
            admin_session.post(f"{BASE_URL}/api/admin/86/batch", json={"item_ids": sold, "status": "in_stock"})
    except Exception:
        pass
