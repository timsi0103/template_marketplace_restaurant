"""Tests for new analytics summary fields + /admin/reports/* endpoints (iteration_25)."""
import os
import pathlib
import pytest
import requests


def _load_base_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        env = pathlib.Path("/app/frontend/.env")
        if env.exists():
            for line in env.read_text().splitlines():
                if line.startswith("REACT_APP_BACKEND_URL="):
                    url = line.split("=", 1)[1].strip()
                    break
    assert url, "REACT_APP_BACKEND_URL not configured"
    return url.rstrip("/")


BASE_URL = _load_base_url()
ADMIN_EMAIL = "admin@culinaryeditorial.com"
ADMIN_PASSWORD = "Admin123!"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return s


# ─── Analytics summary shape ───────────────────────────────
class TestAnalyticsSummary:
    def test_summary_structure(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/analytics/summary?range=week", timeout=30)
        assert r.status_code == 200
        d = r.json()
        # today block
        assert "today" in d
        for k in ("order_count", "total_revenue", "average_order_value", "fulfillment_mix"):
            assert k in d["today"], f"today.{k} missing"
        # previous_period block
        assert "previous_period" in d
        for k in ("order_count", "total_revenue", "average_order_value",
                  "revenue_delta_pct", "order_delta_pct", "aov_delta_pct"):
            assert k in d["previous_period"], f"previous_period.{k} missing"
        # heatmap 7x24
        hm = d.get("heatmap")
        assert isinstance(hm, list) and len(hm) == 7
        assert all(isinstance(row, list) and len(row) == 24 for row in hm)
        assert all(isinstance(v, int) for row in hm for v in row)
        # top_items enrichment
        assert isinstance(d.get("top_items"), list)
        for ti in d["top_items"]:
            for k in ("name", "qty", "revenue", "image", "item_id", "category",
                      "trend_pct", "direction"):
                assert k in ti, f"top_items missing {k}"
            assert ti["direction"] in ("up", "down", "flat")
        # revenue_over_time has previous
        rot = d.get("revenue_over_time") or []
        assert isinstance(rot, list) and len(rot) > 0
        for b in rot:
            for k in ("label", "revenue", "previous"):
                assert k in b

    def test_unauthenticated_blocked(self):
        r = requests.get(f"{BASE_URL}/api/admin/analytics/summary", timeout=30)
        assert r.status_code in (401, 403)


# ─── CSV export ───────────────────────────────────────────
class TestExport:
    @pytest.mark.parametrize("rtype,first_col", [
        ("orders", "order_number"),
        ("revenue", "date"),
        ("items", "item_name"),
    ])
    def test_export_csv(self, admin_session, rtype, first_col):
        r = admin_session.get(f"{BASE_URL}/api/admin/reports/export?type={rtype}", timeout=30)
        assert r.status_code == 200, r.text
        assert "text/csv" in r.headers.get("content-type", "").lower()
        assert "attachment" in r.headers.get("content-disposition", "").lower()
        body = r.text.strip()
        assert body, "empty CSV"
        header = body.splitlines()[0]
        assert header.startswith(first_col), f"expected header to start with {first_col}, got {header}"

    def test_export_invalid_type(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/reports/export?type=garbage", timeout=30)
        # FastAPI Literal -> 422 is acceptable per spec
        assert r.status_code in (400, 422), r.text

    def test_export_with_range(self, admin_session):
        r = admin_session.get(
            f"{BASE_URL}/api/admin/reports/export?type=orders&start=2025-01-01T00:00:00Z&end=2026-01-01T00:00:00Z",
            timeout=30,
        )
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "").lower()

    def test_export_unauthenticated(self):
        r = requests.get(f"{BASE_URL}/api/admin/reports/export?type=orders", timeout=30)
        assert r.status_code in (401, 403)


# ─── Schedule CRUD ────────────────────────────────────────
class TestSchedules:
    def test_full_lifecycle(self, admin_session):
        # CREATE
        payload = {"report_type": "orders", "frequency": "daily", "email": "TEST_qa@example.com", "enabled": True}
        r = admin_session.post(f"{BASE_URL}/api/admin/reports/schedules", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        sched = r.json()
        sid = sched["id"]
        assert sid.startswith("sched_")
        assert sched["next_send_at"] is not None
        assert sched["report_type"] == "orders"
        assert sched["frequency"] == "daily"
        assert sched["enabled"] is True

        try:
            # LIST contains it
            r = admin_session.get(f"{BASE_URL}/api/admin/reports/schedules", timeout=30)
            assert r.status_code == 200
            ids = [s["id"] for s in r.json()["schedules"]]
            assert sid in ids

            # PATCH disable → clears next_send_at
            r = admin_session.patch(f"{BASE_URL}/api/admin/reports/schedules/{sid}", json={"enabled": False}, timeout=30)
            assert r.status_code == 200
            assert r.json()["enabled"] is False
            assert r.json()["next_send_at"] is None

            # PATCH re-enable + change frequency → recomputes
            r = admin_session.patch(
                f"{BASE_URL}/api/admin/reports/schedules/{sid}",
                json={"enabled": True, "frequency": "weekly"}, timeout=30,
            )
            assert r.status_code == 200
            body = r.json()
            assert body["enabled"] is True
            assert body["frequency"] == "weekly"
            assert body["next_send_at"] is not None

            # SEND-NOW mocked
            r = admin_session.post(f"{BASE_URL}/api/admin/reports/schedules/{sid}/send-now", timeout=30)
            assert r.status_code == 200, r.text
            b = r.json()
            for k in ("sent", "mocked", "report_type", "frequency", "email", "row_count", "sent_at"):
                assert k in b, f"send-now missing {k}"
            assert b["sent"] is True
            assert b["mocked"] is True
            assert isinstance(b["row_count"], int)

            # verify last_sent_at persisted
            r = admin_session.get(f"{BASE_URL}/api/admin/reports/schedules", timeout=30)
            doc = next(s for s in r.json()["schedules"] if s["id"] == sid)
            assert doc["last_sent_at"] is not None
            assert doc["last_status"] == "sent"
            assert doc.get("last_row_count") == b["row_count"]
        finally:
            # DELETE
            r = admin_session.delete(f"{BASE_URL}/api/admin/reports/schedules/{sid}", timeout=30)
            assert r.status_code == 200
            assert r.json() == {"deleted": True}

    def test_delete_unknown(self, admin_session):
        r = admin_session.delete(f"{BASE_URL}/api/admin/reports/schedules/sched_doesnotexist", timeout=30)
        assert r.status_code == 404

    def test_invalid_frequency_rejected(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/admin/reports/schedules",
            json={"report_type": "orders", "frequency": "hourly", "email": "TEST_x@example.com"},
            timeout=30,
        )
        assert r.status_code == 422

    def test_invalid_type_rejected(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/admin/reports/schedules",
            json={"report_type": "nope", "frequency": "daily", "email": "TEST_x@example.com"},
            timeout=30,
        )
        assert r.status_code == 422

    def test_unauthenticated_blocked(self):
        r = requests.get(f"{BASE_URL}/api/admin/reports/schedules", timeout=30)
        assert r.status_code in (401, 403)
