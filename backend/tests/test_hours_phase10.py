"""
Phase 10: Operating Hours & Holiday Management - new feature coverage
Covers: /store/status extended fields, pause with body, special-hours CRUD,
advance-orders GET/PATCH, overview w/ conflict detection, holiday message.
"""
import pytest
import requests
import os
from datetime import datetime, timedelta, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
ADMIN = {"email": "admin@culinaryeditorial.com", "password": "Admin123!"}


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
    if r.status_code != 200:
        pytest.skip("Admin login failed")
    yield s
    # teardown: restore clean state
    try:
        # unpause
        s.post(f"{BASE_URL}/api/admin/store/pause", json={"paused": False})
        # restore max_days_ahead=7, accept_advance_orders=true
        s.patch(f"{BASE_URL}/api/admin/store/advance-orders",
                json={"accept_advance_orders": True, "max_days_ahead": 7})
        # Restore Monday delivery to 10:00-22:00
        cur = s.get(f"{BASE_URL}/api/admin/store/hours").json().get("hours", {})
        cur.setdefault("monday", {})["delivery"] = {"open_time": "10:00", "close_time": "22:00", "closed": False}
        s.put(f"{BASE_URL}/api/admin/store/hours", json={"hours": cur})
        # Remove any TEST_ holidays / specials created
        hols = s.get(f"{BASE_URL}/api/admin/store/holidays").json().get("holidays", [])
        for h in hols:
            if (h.get("reason") or "").startswith("TEST_"):
                s.delete(f"{BASE_URL}/api/admin/store/holidays/{h['id']}")
        sps = s.get(f"{BASE_URL}/api/admin/store/special-hours").json().get("special_hours", [])
        for sp in sps:
            if (sp.get("label") or "").startswith("TEST_"):
                s.delete(f"{BASE_URL}/api/admin/store/special-hours/{sp['id']}")
    except Exception:
        pass


# ─── /store/status extended fields ─────────────────────
class TestStoreStatusExtended:
    def test_status_has_new_fields(self):
        r = requests.get(f"{BASE_URL}/api/store/status")
        assert r.status_code == 200
        d = r.json()
        for f in ["pause_reason", "pause_until", "special_today",
                  "accept_advance_orders", "max_days_ahead",
                  "is_open", "pause_ordering", "services",
                  "active_holiday", "upcoming_holidays"]:
            assert f in d, f"missing {f}"
        assert isinstance(d["accept_advance_orders"], bool)
        assert isinstance(d["max_days_ahead"], int)


# ─── Pause with body ───────────────────────────────────
class TestPauseWithBody:
    def test_pause_explicit_with_reason_and_eta(self, admin_session):
        eta = (datetime.now(timezone.utc) + timedelta(hours=3)).isoformat()
        r = admin_session.post(f"{BASE_URL}/api/admin/store/pause",
                               json={"paused": True, "reason": "TEST_Kitchen fire", "estimated_reopen": eta})
        assert r.status_code == 200
        d = r.json()
        assert d["pause_ordering"] is True
        assert d["pause_reason"] == "TEST_Kitchen fire"
        assert d["pause_until"] == eta

        # Verify via public status
        s = requests.get(f"{BASE_URL}/api/store/status").json()
        assert s["pause_ordering"] is True
        assert s["pause_reason"] == "TEST_Kitchen fire"
        assert s["pause_until"] == eta
        assert s["is_open"] is False

    def test_unpause_clears_fields(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/admin/store/pause", json={"paused": False})
        assert r.status_code == 200
        d = r.json()
        assert d["pause_ordering"] is False
        assert d["pause_reason"] == ""
        assert d["pause_until"] is None

    def test_pause_toggle_when_omitted(self, admin_session):
        # ensure starting state
        admin_session.post(f"{BASE_URL}/api/admin/store/pause", json={"paused": False})
        r1 = admin_session.post(f"{BASE_URL}/api/admin/store/pause", json={})
        assert r1.json()["pause_ordering"] is True
        r2 = admin_session.post(f"{BASE_URL}/api/admin/store/pause", json={})
        assert r2.json()["pause_ordering"] is False


# ─── Special hours CRUD ───────────────────────────────
class TestSpecialHours:
    def test_special_hours_crud_lifecycle(self, admin_session):
        date_str = (datetime.now() + timedelta(days=20)).strftime("%Y-%m-%d")
        payload = {
            "date": date_str,
            "label": "TEST_NYE",
            "hours": {
                "delivery": {"open_time": "10:00", "close_time": "02:00", "closed": False},
                "pickup":   {"open_time": "10:00", "close_time": "02:00", "closed": False},
                "dine_in":  {"open_time": "10:00", "close_time": "02:00", "closed": False},
            },
        }
        # CREATE
        r = admin_session.post(f"{BASE_URL}/api/admin/store/special-hours", json=payload)
        assert r.status_code == 200
        created = r.json()
        assert created["date"] == date_str
        assert created["label"] == "TEST_NYE"
        sid = created["id"]

        # LIST
        lst = admin_session.get(f"{BASE_URL}/api/admin/store/special-hours").json()
        assert any(x["id"] == sid for x in lst["special_hours"])

        # REPLACE (upsert on same date)
        payload["label"] = "TEST_NYE_v2"
        r2 = admin_session.post(f"{BASE_URL}/api/admin/store/special-hours", json=payload)
        assert r2.status_code == 200
        sid2 = r2.json()["id"]
        lst2 = admin_session.get(f"{BASE_URL}/api/admin/store/special-hours").json()
        same_date = [x for x in lst2["special_hours"] if x["date"] == date_str]
        assert len(same_date) == 1, f"expected 1 override for {date_str}, got {len(same_date)}"
        assert same_date[0]["label"] == "TEST_NYE_v2"

        # DELETE
        rd = admin_session.delete(f"{BASE_URL}/api/admin/store/special-hours/{sid2}")
        assert rd.status_code == 200
        lst3 = admin_session.get(f"{BASE_URL}/api/admin/store/special-hours").json()
        assert not any(x["id"] == sid2 for x in lst3["special_hours"])

    def test_special_today_used_in_status(self, admin_session):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        admin_session.post(f"{BASE_URL}/api/admin/store/pause", json={"paused": False})
        payload = {
            "date": today, "label": "TEST_Today",
            "hours": {
                "delivery": {"open_time": "00:00", "close_time": "23:59", "closed": False},
                "pickup":   {"open_time": "00:00", "close_time": "23:59", "closed": False},
                "dine_in":  {"open_time": "00:00", "close_time": "23:59", "closed": False},
            },
        }
        r = admin_session.post(f"{BASE_URL}/api/admin/store/special-hours", json=payload)
        sid = r.json()["id"]
        try:
            s = requests.get(f"{BASE_URL}/api/store/status").json()
            assert s["special_today"] is not None
            assert s["special_today"]["label"] == "TEST_Today"
            assert s["is_open"] is True
        finally:
            admin_session.delete(f"{BASE_URL}/api/admin/store/special-hours/{sid}")


# ─── Advance orders ──────────────────────────────────
class TestAdvanceOrders:
    def test_get_advance_orders(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/store/advance-orders")
        assert r.status_code == 200
        d = r.json()
        assert "accept_advance_orders" in d
        assert "max_days_ahead" in d

    def test_patch_partial_and_clamp(self, admin_session):
        # set to 50 -> should clamp to 30
        r = admin_session.patch(f"{BASE_URL}/api/admin/store/advance-orders",
                                json={"max_days_ahead": 50})
        assert r.status_code == 200
        assert r.json()["max_days_ahead"] == 30

        # set to 0 -> should clamp to 1
        r2 = admin_session.patch(f"{BASE_URL}/api/admin/store/advance-orders",
                                 json={"max_days_ahead": 0})
        assert r2.json()["max_days_ahead"] == 1

        # partial: only toggle accept
        r3 = admin_session.patch(f"{BASE_URL}/api/admin/store/advance-orders",
                                 json={"accept_advance_orders": False})
        assert r3.json()["accept_advance_orders"] is False
        assert r3.json()["max_days_ahead"] == 1  # unchanged

        # restore
        admin_session.patch(f"{BASE_URL}/api/admin/store/advance-orders",
                            json={"accept_advance_orders": True, "max_days_ahead": 7})

    def test_patch_empty_rejects(self, admin_session):
        r = admin_session.patch(f"{BASE_URL}/api/admin/store/advance-orders", json={})
        assert r.status_code == 400


# ─── Holiday with message ────────────────────────────
class TestHolidayMessage:
    def test_create_holiday_with_message_and_visible_in_status(self, admin_session):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        # Ensure no existing holiday for today
        hols = admin_session.get(f"{BASE_URL}/api/admin/store/holidays").json().get("holidays", [])
        for h in hols:
            if h.get("date") == today:
                admin_session.delete(f"{BASE_URL}/api/admin/store/holidays/{h['id']}")
        created = admin_session.post(f"{BASE_URL}/api/admin/store/holidays", json={
            "date": today, "reason": "TEST_HolidayMsg",
            "message": "We'll be closed today. Back tomorrow at 10 AM.",
            "all_day": True,
        }).json()
        hid = created["id"]
        try:
            assert created["message"] == "We'll be closed today. Back tomorrow at 10 AM."
            # Listed
            ls = admin_session.get(f"{BASE_URL}/api/admin/store/holidays").json()["holidays"]
            assert any(h["id"] == hid and h.get("message") for h in ls)
            # Public status
            s = requests.get(f"{BASE_URL}/api/store/status").json()
            assert s["active_holiday"] is not None
            assert s["active_holiday"]["message"] == "We'll be closed today. Back tomorrow at 10 AM."
        finally:
            admin_session.delete(f"{BASE_URL}/api/admin/store/holidays/{hid}")


# ─── Overview + conflicts ────────────────────────────
class TestOverview:
    def test_overview_structure(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/store/overview")
        assert r.status_code == 200
        d = r.json()
        assert "days" in d and len(d["days"]) == 7
        first = d["days"][0]
        for k in ["date", "day_name", "is_today", "holiday", "special", "services", "conflicts"]:
            assert k in first
        for svc in ["delivery", "pickup", "dine_in"]:
            assert svc in first["services"]

    def test_overview_conflict_when_delivery_overnight(self, admin_session):
        # Set today's weekday delivery to overnight (09:00-08:59) while pickup is 10-22
        cur_resp = admin_session.get(f"{BASE_URL}/api/admin/store/hours").json()
        original = {k: {sk: dict(sv) for sk, sv in v.items()} for k, v in cur_resp.get("hours", {}).items()}
        DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]
        today_dow = DAYS[datetime.now(timezone.utc).weekday()]
        hours = {k: dict(v) for k, v in cur_resp.get("hours", {}).items()}
        hours.setdefault(today_dow, {})
        hours[today_dow] = dict(hours[today_dow])
        hours[today_dow]["delivery"] = {"open_time": "09:00", "close_time": "08:59", "closed": False}
        hours[today_dow]["pickup"]   = {"open_time": "10:00", "close_time": "22:00", "closed": False}
        hours[today_dow]["dine_in"]  = {"open_time": "10:00", "close_time": "22:00", "closed": False}
        admin_session.put(f"{BASE_URL}/api/admin/store/hours", json={"hours": hours})
        try:
            ov = admin_session.get(f"{BASE_URL}/api/admin/store/overview").json()
            today_row = ov["days"][0]
            assert today_row["is_today"] is True
            assert len(today_row["conflicts"]) >= 1
            assert today_row["conflicts"][0]["service"] == "delivery"
        finally:
            admin_session.put(f"{BASE_URL}/api/admin/store/hours", json={"hours": original})


# ─── Auth guards ──────────────────────────────────────
class TestAuthGuards:
    @pytest.mark.parametrize("method,path,body", [
        ("get",    "/api/admin/store/special-hours", None),
        ("post",   "/api/admin/store/special-hours", {"date":"2030-01-01","hours":{}}),
        ("delete", "/api/admin/store/special-hours/sp_x", None),
        ("get",    "/api/admin/store/advance-orders", None),
        ("patch",  "/api/admin/store/advance-orders", {"max_days_ahead":5}),
        ("get",    "/api/admin/store/overview", None),
    ])
    def test_requires_admin(self, method, path, body):
        fn = getattr(requests, method)
        r = fn(f"{BASE_URL}{path}", json=body) if body is not None else fn(f"{BASE_URL}{path}")
        assert r.status_code == 401, f"{method.upper()} {path} expected 401, got {r.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
