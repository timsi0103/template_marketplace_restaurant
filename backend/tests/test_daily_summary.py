"""Daily End-of-Day Summary & Reports tests.
Covers:
- GET /api/admin/daily-summary (today + ?date=YYYY-MM-DD, zero-activity day)
- Summary payload schema fields (KPIs, fulfillment_mix, top_items, customers, compare_last_week, compare_last_month)
- POST /api/admin/daily-summary/generate (send_email false + true with/without recipients)
- GET /api/admin/daily-summary/history (sort + date_from/date_to filter)
- GET/DELETE /api/admin/daily-summary/{sid}; 404 unknown
- GET/PATCH /api/admin/daily-summary/delivery-settings (defaults, lowercased emails, invalid send_at 400)
- Router order: /delivery-settings NOT caught by /{sid}
- Admin auth guard on all endpoints
- Cleanup: delete created snapshots + reset delivery-settings to defaults
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": os.environ.get("TEST_ADMIN_EMAIL", "admin@culinaryeditorial.com"), "password": os.environ.get("TEST_ADMIN_PASSWORD", "Admin123!")},
    )
    if r.status_code != 200:
        pytest.skip("Admin login failed")
    return s


@pytest.fixture(scope="module")
def created_snapshots():
    ids: list[str] = []
    yield ids


@pytest.fixture(scope="module", autouse=True)
def cleanup_after(admin_session, created_snapshots):
    yield
    # delete snapshots left
    for sid in list(created_snapshots):
        admin_session.delete(f"{BASE_URL}/api/admin/daily-summary/{sid}")
    # reset delivery settings to defaults
    admin_session.patch(
        f"{BASE_URL}/api/admin/daily-summary/delivery-settings",
        json={"enabled": False, "recipients": [], "send_at": "21:00", "format": "pdf"},
    )


# ─── Auth guard (no cookie) ───────────────────────────
class TestAuthGuard:
    def test_daily_summary_unauth(self):
        r = requests.get(f"{BASE_URL}/api/admin/daily-summary")
        assert r.status_code in (401, 403)

    def test_history_unauth(self):
        r = requests.get(f"{BASE_URL}/api/admin/daily-summary/history")
        assert r.status_code in (401, 403)

    def test_delivery_settings_unauth(self):
        r = requests.get(f"{BASE_URL}/api/admin/daily-summary/delivery-settings")
        assert r.status_code in (401, 403)

    def test_generate_unauth(self):
        r = requests.post(f"{BASE_URL}/api/admin/daily-summary/generate", json={})
        assert r.status_code in (401, 403)


# ─── Live summary ─────────────────────────────────────
class TestLiveSummary:
    def test_summary_today(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/daily-summary")
        assert r.status_code == 200
        data = r.json()
        expected = {
            "date", "order_count", "total_revenue", "average_order_value", "tips",
            "fulfillment_mix", "top_items", "refunds_count", "cancellations_count",
            "customers", "compare_last_week", "compare_last_month",
        }
        assert expected.issubset(data.keys()), f"missing keys: {expected - data.keys()}"
        assert isinstance(data["fulfillment_mix"], list)
        assert isinstance(data["top_items"], list)
        assert len(data["top_items"]) <= 5
        customers = data["customers"]
        for k in ("total", "new", "returning", "returning_ratio"):
            assert k in customers
        lw = data["compare_last_week"]
        for k in ("date", "order_count", "total_revenue", "aov", "revenue_delta_pct", "order_delta_pct", "aov_delta_pct"):
            assert k in lw, f"last_week missing {k}"
        lm = data["compare_last_month"]
        for k in ("mtd", "prev_mtd", "revenue_delta_pct", "order_delta_pct"):
            assert k in lm, f"last_month missing {k}"

    def test_summary_specific_date(self, admin_session):
        # A date far in the past → zero-activity day
        r = admin_session.get(f"{BASE_URL}/api/admin/daily-summary", params={"date": "2020-01-01"})
        assert r.status_code == 200
        data = r.json()
        assert data["date"] == "2020-01-01"
        assert data["order_count"] == 0
        assert data["total_revenue"] == 0
        assert data["top_items"] == []
        assert data["customers"]["total"] == 0


# ─── Generate + history + get + delete ─────────────────
class TestSnapshots:
    def test_generate_without_email(self, admin_session, created_snapshots):
        r = admin_session.post(
            f"{BASE_URL}/api/admin/daily-summary/generate",
            json={"date": "2020-01-02", "send_email": False},
        )
        assert r.status_code == 200
        body = r.json()
        snap = body["snapshot"]
        assert snap["id"].startswith("ds_")
        assert snap["date"] == "2020-01-02"
        assert snap["delivery_status"] is None
        assert snap["delivery_log"] == []
        assert body["mocked_email"] is False
        created_snapshots.append(snap["id"])

    def test_generate_with_email_no_recipients(self, admin_session, created_snapshots):
        # Ensure no recipients configured
        admin_session.patch(
            f"{BASE_URL}/api/admin/daily-summary/delivery-settings",
            json={"recipients": []},
        )
        r = admin_session.post(
            f"{BASE_URL}/api/admin/daily-summary/generate",
            json={"date": "2020-01-03", "send_email": True},
        )
        assert r.status_code == 200
        snap = r.json()["snapshot"]
        assert snap["delivery_status"] == "skipped_no_recipients"
        assert len(snap["delivery_log"]) == 1
        assert snap["delivery_log"][0]["mocked"] is True
        created_snapshots.append(snap["id"])

    def test_generate_with_email_recipients(self, admin_session, created_snapshots):
        admin_session.patch(
            f"{BASE_URL}/api/admin/daily-summary/delivery-settings",
            json={"recipients": ["TEST_ops@example.com"]},
        )
        r = admin_session.post(
            f"{BASE_URL}/api/admin/daily-summary/generate",
            json={"date": "2020-01-04", "send_email": True},
        )
        assert r.status_code == 200
        snap = r.json()["snapshot"]
        assert snap["delivery_status"] == "sent"
        assert snap["delivery_log"][0]["status"] == "sent"
        assert "test_ops@example.com" in snap["delivery_log"][0]["recipients"]
        created_snapshots.append(snap["id"])

    def test_history_sorted_and_filtered(self, admin_session, created_snapshots):
        r = admin_session.get(f"{BASE_URL}/api/admin/daily-summary/history")
        assert r.status_code == 200
        snaps = r.json()["snapshots"]
        assert isinstance(snaps, list)
        ids = [s["id"] for s in snaps]
        for sid in created_snapshots:
            assert sid in ids
        # sorted desc by generated_at
        gens = [s["generated_at"] for s in snaps]
        assert gens == sorted(gens, reverse=True)

        # date range filter
        r2 = admin_session.get(
            f"{BASE_URL}/api/admin/daily-summary/history",
            params={"date_from": "2020-01-03", "date_to": "2020-01-04"},
        )
        assert r2.status_code == 200
        for s in r2.json()["snapshots"]:
            assert "2020-01-03" <= s["date"] <= "2020-01-04"

    def test_get_snapshot_and_404(self, admin_session, created_snapshots):
        if not created_snapshots:
            pytest.skip("no created snapshots")
        sid = created_snapshots[0]
        r = admin_session.get(f"{BASE_URL}/api/admin/daily-summary/{sid}")
        assert r.status_code == 200
        assert r.json()["id"] == sid

        r404 = admin_session.get(f"{BASE_URL}/api/admin/daily-summary/ds_nonexistent_xyz")
        assert r404.status_code == 404

    def test_delete_snapshot_and_404(self, admin_session, created_snapshots):
        if not created_snapshots:
            pytest.skip("no created snapshots")
        sid = created_snapshots.pop()  # remove last
        r = admin_session.delete(f"{BASE_URL}/api/admin/daily-summary/{sid}")
        assert r.status_code == 200
        assert r.json().get("deleted") is True
        # second delete → 404
        r2 = admin_session.delete(f"{BASE_URL}/api/admin/daily-summary/{sid}")
        assert r2.status_code == 404


# ─── Delivery settings ────────────────────────────────
class TestDeliverySettings:
    def test_get_defaults(self, admin_session):
        # reset first
        admin_session.patch(
            f"{BASE_URL}/api/admin/daily-summary/delivery-settings",
            json={"enabled": False, "recipients": [], "send_at": "21:00", "format": "pdf"},
        )
        r = admin_session.get(f"{BASE_URL}/api/admin/daily-summary/delivery-settings")
        assert r.status_code == 200
        d = r.json()
        assert d["enabled"] is False
        assert d["recipients"] == []
        assert d["send_at"] == "21:00"
        assert d["format"] == "pdf"
        assert "last_sent_date" in d
        assert "key" not in d  # internal key removed

    def test_patch_lowercases_emails(self, admin_session):
        r = admin_session.patch(
            f"{BASE_URL}/api/admin/daily-summary/delivery-settings",
            json={"recipients": ["Admin@EXAMPLE.com", "OTHER@Example.com"]},
        )
        assert r.status_code == 200
        d = r.json()
        assert "admin@example.com" in d["recipients"]
        assert "other@example.com" in d["recipients"]
        assert all(e == e.lower() for e in d["recipients"])

    def test_patch_invalid_send_at(self, admin_session):
        r = admin_session.patch(
            f"{BASE_URL}/api/admin/daily-summary/delivery-settings",
            json={"send_at": "xx:yy"},
        )
        assert r.status_code == 400

    def test_patch_valid_send_at_and_format(self, admin_session):
        r = admin_session.patch(
            f"{BASE_URL}/api/admin/daily-summary/delivery-settings",
            json={"send_at": "09:30", "format": "html", "enabled": True},
        )
        assert r.status_code == 200
        d = r.json()
        assert d["send_at"] == "09:30"
        assert d["format"] == "html"
        assert d["enabled"] is True

    def test_delivery_settings_not_caught_by_sid_route(self, admin_session):
        # Critical: ensure the delivery-settings path is not treated as a {sid} lookup (would return 404)
        r = admin_session.get(f"{BASE_URL}/api/admin/daily-summary/delivery-settings")
        assert r.status_code == 200
        assert "recipients" in r.json()
