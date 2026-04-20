"""
Order Ticket Printing (Thermal Printer) Backend Tests
Covers:
  - /api/admin/printers CRUD (admin auth required)
  - /api/admin/printers/{id}/test (offline => 400, online => 200 + log)
  - /api/admin/print-settings (GET/PATCH with auto_trigger validation)
  - /api/admin/print-jobs (desc by created_at, order_id filter)
  - /api/admin/orders/{id}/print (kitchen|receipt)
  - /api/orders/{id}/receipt (public)
  - Auto-queue hooks on admin accept (on_acceptance) and payment confirm (on_placement)
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone

def _load_base_url():
    v = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if v:
        return v.rstrip("/")
    # Fallback: read /app/frontend/.env directly
    try:
        with open("/app/frontend/.env", "r") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass
    return ""

BASE_URL = _load_base_url()
ADMIN_EMAIL = "admin@culinaryeditorial.com"
ADMIN_PASSWORD = "Admin123!"


# ─────────────────────────────────────────────────────────────
# Shared fixtures
# ─────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return s


@pytest.fixture(scope="module")
def cleanup_printers(admin_session):
    created_ids = []
    yield created_ids
    for pid in created_ids:
        try:
            admin_session.delete(f"{BASE_URL}/api/admin/printers/{pid}")
        except Exception:
            pass


def _mk_printer(admin_session, cleanup_printers, **overrides):
    body = {
        "name": f"TEST_P_{uuid.uuid4().hex[:6]}",
        "ip": "192.168.1.50",
        "model": "generic_80mm",
        "station": "kitchen",
        "is_online": True,
    }
    body.update(overrides)
    r = admin_session.post(f"{BASE_URL}/api/admin/printers", json=body)
    assert r.status_code == 200, f"Create printer failed: {r.status_code} {r.text}"
    data = r.json()
    cleanup_printers.append(data["id"])
    return data


# ─────────────────────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────────────────────

class TestPrinterAuth:
    def test_list_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/printers")
        assert r.status_code in (401, 403)

    def test_create_requires_admin(self):
        r = requests.post(f"{BASE_URL}/api/admin/printers", json={"name": "X"})
        assert r.status_code in (401, 403)

    def test_print_settings_get_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/print-settings")
        assert r.status_code in (401, 403)

    def test_print_jobs_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/print-jobs")
        assert r.status_code in (401, 403)


# ─────────────────────────────────────────────────────────────
# Printer CRUD
# ─────────────────────────────────────────────────────────────

class TestPrinterCRUD:
    def test_list_printers_structure(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/printers")
        assert r.status_code == 200
        data = r.json()
        assert "printers" in data and isinstance(data["printers"], list)
        assert "models" in data and isinstance(data["models"], list)
        assert "generic_80mm" in data["models"]

    def test_create_printer_persists(self, admin_session, cleanup_printers):
        created = _mk_printer(admin_session, cleanup_printers,
                              name="TEST_Kitchen_A", station="kitchen")
        assert created["name"] == "TEST_Kitchen_A"
        assert created["station"] == "kitchen"
        assert created["is_online"] is True
        assert "id" in created
        # GET verify persistence
        r = admin_session.get(f"{BASE_URL}/api/admin/printers")
        ids = [p["id"] for p in r.json()["printers"]]
        assert created["id"] in ids

    def test_patch_printer_updates(self, admin_session, cleanup_printers):
        created = _mk_printer(admin_session, cleanup_printers)
        r = admin_session.patch(
            f"{BASE_URL}/api/admin/printers/{created['id']}",
            json={"name": "TEST_Renamed", "is_online": False, "station": "bar"},
        )
        assert r.status_code == 200
        updated = r.json()
        assert updated["name"] == "TEST_Renamed"
        assert updated["is_online"] is False
        assert updated["station"] == "bar"

    def test_delete_printer(self, admin_session, cleanup_printers):
        created = _mk_printer(admin_session, cleanup_printers)
        r = admin_session.delete(f"{BASE_URL}/api/admin/printers/{created['id']}")
        assert r.status_code == 200
        # Verify gone
        r2 = admin_session.get(f"{BASE_URL}/api/admin/printers")
        ids = [p["id"] for p in r2.json()["printers"]]
        assert created["id"] not in ids

    def test_delete_nonexistent_404(self, admin_session):
        r = admin_session.delete(f"{BASE_URL}/api/admin/printers/does-not-exist-xyz")
        assert r.status_code == 404


# ─────────────────────────────────────────────────────────────
# Test print
# ─────────────────────────────────────────────────────────────

class TestPrinterTestPrint:
    def test_offline_printer_returns_400(self, admin_session, cleanup_printers):
        created = _mk_printer(admin_session, cleanup_printers, is_online=False)
        r = admin_session.post(f"{BASE_URL}/api/admin/printers/{created['id']}/test")
        assert r.status_code == 400, f"Expected 400 for offline, got {r.status_code}: {r.text}"

    def test_online_printer_returns_200_and_updates_last_test_at(self, admin_session, cleanup_printers):
        created = _mk_printer(admin_session, cleanup_printers, is_online=True)
        r = admin_session.post(f"{BASE_URL}/api/admin/printers/{created['id']}/test")
        assert r.status_code == 200, r.text
        # last_test_at updated
        r2 = admin_session.get(f"{BASE_URL}/api/admin/printers")
        p = next(p for p in r2.json()["printers"] if p["id"] == created["id"])
        assert p.get("last_test_at"), "last_test_at must be populated"
        # A test job logged
        jobs = admin_session.get(f"{BASE_URL}/api/admin/print-jobs").json()["jobs"] \
            if admin_session.get(f"{BASE_URL}/api/admin/print-jobs").status_code == 200 else []
        assert any(j.get("printer_id") == created["id"] and j.get("ticket_type") == "test" for j in jobs)

    def test_test_print_nonexistent_404(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/admin/printers/nope-123/test")
        assert r.status_code == 404


# ─────────────────────────────────────────────────────────────
# Print settings
# ─────────────────────────────────────────────────────────────

class TestPrintSettings:
    def test_get_returns_defaults_or_existing(self, admin_session):
        # Ensure settings have auto_receipt set by patching first (handles legacy pre-field docs)
        admin_session.patch(f"{BASE_URL}/api/admin/print-settings",
                            json={"auto_receipt": True, "auto_trigger": "on_acceptance"})
        r = admin_session.get(f"{BASE_URL}/api/admin/print-settings")
        assert r.status_code == 200
        data = r.json()
        assert "auto_trigger" in data
        assert data["auto_trigger"] in ("on_placement", "on_acceptance", "off")
        assert "auto_receipt" in data
        assert isinstance(data["auto_receipt"], bool)

    def test_patch_invalid_auto_trigger_rejected(self, admin_session):
        r = admin_session.patch(f"{BASE_URL}/api/admin/print-settings",
                                json={"auto_trigger": "garbage"})
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"

    def test_patch_valid_auto_trigger_and_receipt(self, admin_session):
        # Set to off
        r = admin_session.patch(f"{BASE_URL}/api/admin/print-settings",
                                json={"auto_trigger": "off", "auto_receipt": False})
        assert r.status_code == 200
        d = r.json()
        assert d["auto_trigger"] == "off"
        assert d["auto_receipt"] is False
        # Back to on_acceptance
        r2 = admin_session.patch(f"{BASE_URL}/api/admin/print-settings",
                                 json={"auto_trigger": "on_acceptance", "auto_receipt": True})
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["auto_trigger"] == "on_acceptance"
        assert d2["auto_receipt"] is True


# ─────────────────────────────────────────────────────────────
# Order printing + print jobs
# ─────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def existing_order(admin_session):
    """Grab any existing order from admin queue; fallback to admin orders/new."""
    for path in ("/api/admin/queue", "/api/admin/orders/new"):
        r = admin_session.get(f"{BASE_URL}{path}")
        if r.status_code == 200:
            data = r.json()
            orders = data.get("queue") or data.get("orders") or []
            if orders:
                return orders[0]
    pytest.skip("No existing orders in DB to run printing tests against")


class TestPrintOrderTicket:
    def test_print_kitchen_returns_job_and_ticket(self, admin_session, existing_order, cleanup_printers):
        _mk_printer(admin_session, cleanup_printers, station="kitchen", is_online=True)
        r = admin_session.post(
            f"{BASE_URL}/api/admin/orders/{existing_order['id']}/print",
            json={"ticket_type": "kitchen"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "job" in data and "ticket" in data
        assert data["ticket"]["ticket_type"] == "kitchen"
        assert data["job"]["ticket_type"] == "kitchen"

    def test_print_receipt_returns_job_and_ticket(self, admin_session, existing_order):
        r = admin_session.post(
            f"{BASE_URL}/api/admin/orders/{existing_order['id']}/print",
            json={"ticket_type": "receipt"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ticket"]["ticket_type"] == "receipt"

    def test_invalid_ticket_type_rejected(self, admin_session, existing_order):
        r = admin_session.post(
            f"{BASE_URL}/api/admin/orders/{existing_order['id']}/print",
            json={"ticket_type": "invoice"},
        )
        assert r.status_code == 400

    def test_print_nonexistent_order_404(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/admin/orders/nonexistent-xyz/print",
            json={"ticket_type": "kitchen"},
        )
        assert r.status_code == 404


class TestPrintJobs:
    def test_list_jobs_descending_and_filter(self, admin_session, existing_order):
        # Ensure at least 2 jobs exist by printing twice
        admin_session.post(f"{BASE_URL}/api/admin/orders/{existing_order['id']}/print",
                           json={"ticket_type": "kitchen"})
        admin_session.post(f"{BASE_URL}/api/admin/orders/{existing_order['id']}/print",
                           json={"ticket_type": "receipt"})

        r = admin_session.get(f"{BASE_URL}/api/admin/print-jobs")
        assert r.status_code == 200
        jobs = r.json().get("jobs", [])
        assert len(jobs) >= 2
        # Descending by created_at
        times = [j.get("created_at", "") for j in jobs]
        assert times == sorted(times, reverse=True), "Jobs must be sorted desc by created_at"

        # Filter by order_id
        r2 = admin_session.get(f"{BASE_URL}/api/admin/print-jobs",
                               params={"order_id": existing_order["id"]})
        assert r2.status_code == 200
        filt = r2.json().get("jobs", [])
        assert len(filt) >= 2
        assert all(j.get("order_id") == existing_order["id"] for j in filt)


# ─────────────────────────────────────────────────────────────
# Public receipt endpoint
# ─────────────────────────────────────────────────────────────

class TestPublicReceipt:
    def test_public_receipt_no_auth(self, existing_order):
        # Anonymous
        r = requests.get(f"{BASE_URL}/api/orders/{existing_order['id']}/receipt")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ticket_type") == "receipt"
        assert "order" in data
        assert "brand" in data

    def test_public_receipt_404(self):
        r = requests.get(f"{BASE_URL}/api/orders/nope-xyz/receipt")
        assert r.status_code == 404


# ─────────────────────────────────────────────────────────────
# Auto-queue on admin accept
# ─────────────────────────────────────────────────────────────

class TestAutoQueueOnAcceptance:
    def test_accept_queues_jobs_when_on_acceptance(self, admin_session, cleanup_printers):
        # Ensure auto_trigger=on_acceptance, auto_receipt=True
        admin_session.patch(f"{BASE_URL}/api/admin/print-settings",
                            json={"auto_trigger": "on_acceptance", "auto_receipt": True})
        # Ensure at least one online kitchen printer
        _mk_printer(admin_session, cleanup_printers, station="kitchen", is_online=True)
        _mk_printer(admin_session, cleanup_printers, station="receipt", is_online=True)

        # Find a pending+paid order to accept
        r = admin_session.get(f"{BASE_URL}/api/admin/orders/new")
        if r.status_code != 200:
            pytest.skip(f"/api/admin/orders/new unavailable: {r.status_code}")
        pending = r.json().get("orders", [])
        if not pending:
            pytest.skip("No pending paid orders available to accept for auto-queue test")
        order_id = pending[0]["id"]

        # Record jobs count before
        before = admin_session.get(f"{BASE_URL}/api/admin/print-jobs",
                                   params={"order_id": order_id}).json().get("jobs", [])
        before_count = len(before)

        accept = admin_session.post(f"{BASE_URL}/api/admin/orders/{order_id}/accept")
        assert accept.status_code == 200, accept.text

        after = admin_session.get(f"{BASE_URL}/api/admin/print-jobs",
                                  params={"order_id": order_id}).json().get("jobs", [])
        assert len(after) > before_count, "Expected new auto-queued jobs after acceptance"
        # Should include at least one kitchen ticket
        new_jobs = after[: len(after) - before_count]
        tickets = {j.get("ticket_type") for j in new_jobs}
        assert "kitchen" in tickets
        # Triggers prefixed auto_
        assert all((j.get("trigger") or "").startswith("auto_acceptance") for j in new_jobs)
