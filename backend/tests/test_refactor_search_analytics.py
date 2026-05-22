"""Iteration 18 — Backend regression after refactor + NEW search + analytics endpoints.

Covers:
- Auth: login / me
- Catalog: menu items, categories tree
- Store: status
- Orders: create, fetch, promo validate
- Admin: dashboard, queue, orders/new, accept, kds settings/board, print settings/jobs, coupons
- Printers: list / test (existing)
- NEW Search: /api/search/menu, /api/admin/search/orders, /api/admin/search/catalog
- NEW Analytics: /api/admin/analytics/summary (all ranges + 401 without auth)
"""

import os
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "admin@culinaryeditorial.com")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "Admin123!")
# ─────────────── Fixtures ───────────────
@pytest.fixture(scope="module")
def public_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture
def anon_client():
    """Fresh unauthenticated session (no cookies leaking from login fixtures)."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
               allow_redirects=True, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    return s


# ─────────────── Auth (regression) ───────────────
class TestAuth:
    def test_login_admin(self, anon_client):
        r = anon_client.post(f"{BASE_URL}/api/auth/login",
                               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                               allow_redirects=True, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        # Response may nest under "user" or be top-level
        email = data.get("email") or (data.get("user") or {}).get("email")
        role = data.get("role") or (data.get("user") or {}).get("role")
        assert email == ADMIN_EMAIL
        assert role == "admin"

    def test_me_with_cookie(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/auth/me", allow_redirects=True, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("email") == ADMIN_EMAIL


# ─────────────── Catalog / Store (regression) ───────────────
class TestCatalog:
    def test_menu_items(self, public_client):
        r = public_client.get(f"{BASE_URL}/api/menu/items", allow_redirects=True, timeout=15)
        assert r.status_code == 200
        data = r.json()
        # Accepts either list or {items: [...]}
        lst = data if isinstance(data, list) else data.get("items", [])
        assert isinstance(lst, list) and len(lst) > 0

    def test_categories_tree(self, public_client):
        r = public_client.get(f"{BASE_URL}/api/categories/tree", allow_redirects=True, timeout=15)
        assert r.status_code == 200
        data = r.json()
        lst = data if isinstance(data, list) else data.get("categories", [])
        assert isinstance(lst, list)

    def test_store_status(self, public_client):
        r = public_client.get(f"{BASE_URL}/api/store/status", allow_redirects=True, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "is_open" in data or "status" in data or "open" in data


# ─────────────── Orders (regression) ───────────────
class TestOrders:
    def test_validate_promo_save10(self, public_client):
        resp = public_client.get(f"{BASE_URL}/api/menu/items", timeout=15).json()
        items = resp if isinstance(resp, list) else resp.get("items", [])
        mi = items[0]
        payload = {
            "code": "SAVE10",
            "subtotal": 100.0,
            "items": [{"menu_item_id": mi["id"], "quantity": 1, "price": float(mi.get("price", 10))}],
        }
        r = public_client.post(f"{BASE_URL}/api/orders/validate-promo", json=payload,
                               allow_redirects=True, timeout=15)
        # endpoint should exist (200 valid or 400/404 invalid are also acceptable responses)
        assert r.status_code in (200, 400, 404), r.text

    def test_create_and_fetch_order(self, public_client):
        resp = public_client.get(f"{BASE_URL}/api/menu/items", timeout=15).json()
        items = resp if isinstance(resp, list) else resp.get("items", [])
        mi = items[0]
        payload = {
            "items": [{"item_id": mi["id"], "qty": 1, "price": float(mi.get("price", 10)),
                       "name": mi.get("name", "Item"),
                       "unit_base": float(mi.get("price", 10)),
                       "unit_modifiers_total": 0, "modifiers": [], "instructions": "",
                       "image": mi.get("image", "")}],
            "contact_name": "TEST_Buyer",
            "contact_email": "test_buyer@example.com",
            "contact_phone": "+14155550100",
            "fulfillment_type": "pickup",
            "subtotal": float(mi.get("price", 10)),
            "tax": 0,
            "tip": 0,
            "delivery_fee": 0,
            "discount": 0,
            "total": float(mi.get("price", 10)),
            "origin_url": BASE_URL,
        }
        r = public_client.post(f"{BASE_URL}/api/orders", json=payload, allow_redirects=True, timeout=20)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        oid = data.get("id") or data.get("order_id") or (data.get("order") or {}).get("id")
        assert oid, f"No order id in response: {data}"
        # fetch back
        r2 = public_client.get(f"{BASE_URL}/api/orders/{oid}", allow_redirects=True, timeout=15)
        assert r2.status_code == 200, r2.text


# ─────────────── Admin (regression) ───────────────
class TestAdmin:
    def test_dashboard(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/dashboard", allow_redirects=True, timeout=15)
        assert r.status_code == 200

    def test_queue(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/queue", allow_redirects=True, timeout=15)
        assert r.status_code == 200

    def test_orders_new(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/orders/new", allow_redirects=True, timeout=15)
        assert r.status_code == 200

    def test_kds_settings(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/kds/settings", allow_redirects=True, timeout=15)
        assert r.status_code == 200

    def test_kds_board(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/kds/board", allow_redirects=True, timeout=15)
        assert r.status_code == 200

    def test_printers_list(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/printers", allow_redirects=True, timeout=15)
        assert r.status_code == 200

    def test_print_settings(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/print-settings", allow_redirects=True, timeout=15)
        assert r.status_code == 200

    def test_print_jobs(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/print-jobs", allow_redirects=True, timeout=15)
        assert r.status_code == 200

    def test_coupons_list(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/coupons", allow_redirects=True, timeout=15)
        assert r.status_code == 200


# ─────────────── NEW: Search endpoints ───────────────
class TestSearch:
    def test_public_menu_search_basic(self, public_client):
        r = public_client.get(f"{BASE_URL}/api/search/menu?q=duck", allow_redirects=True, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "items" in data and "count" in data
        # duck should match at least one item in seeded menu
        assert data["count"] >= 1, f"Expected >=1 results for 'duck', got {data}"

    def test_public_menu_search_empty_q(self, public_client):
        r = public_client.get(f"{BASE_URL}/api/search/menu?q=", allow_redirects=True, timeout=15)
        assert r.status_code == 200
        data = r.json()
        # empty q -> returns items (no text filter) -- the route currently returns full list
        assert "items" in data

    def test_public_menu_search_regex_escape(self, public_client):
        # special chars should not crash
        r = public_client.get(f"{BASE_URL}/api/search/menu?q=.*", allow_redirects=True, timeout=15)
        assert r.status_code == 200
        assert r.json().get("count", 0) == 0  # literal ".*" shouldn't match item names

    def test_public_menu_search_category_filter(self, public_client):
        r = public_client.get(f"{BASE_URL}/api/search/menu?q=&category=mains", allow_redirects=True, timeout=15)
        assert r.status_code == 200
        # each returned item should have category=mains
        for it in r.json().get("items", []):
            assert it.get("category") == "mains"

    def test_admin_search_orders_requires_auth(self, anon_client):
        r = anon_client.get(f"{BASE_URL}/api/admin/search/orders?q=ORD", allow_redirects=True, timeout=15)
        assert r.status_code in (401, 403), r.text

    def test_admin_search_orders_works(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/search/orders?q=ORD", allow_redirects=True, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "orders" in data and "count" in data
        assert isinstance(data["orders"], list)

    def test_admin_search_orders_empty(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/search/orders?q=", allow_redirects=True, timeout=15)
        assert r.status_code == 200
        assert r.json().get("count", 0) == 0

    def test_admin_search_catalog_requires_auth(self, anon_client):
        r = anon_client.get(f"{BASE_URL}/api/admin/search/catalog?q=matcha", allow_redirects=True, timeout=15)
        assert r.status_code in (401, 403)

    def test_admin_search_catalog_works(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/search/catalog?q=matcha", allow_redirects=True, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "items" in data

    def test_admin_search_catalog_empty(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/search/catalog?q=", allow_redirects=True, timeout=15)
        assert r.status_code == 200
        assert r.json().get("count", 0) == 0


# ─────────────── NEW: Analytics ───────────────
class TestAnalytics:
    def test_requires_auth(self, anon_client):
        r = anon_client.get(f"{BASE_URL}/api/admin/analytics/summary?range=week",
                              allow_redirects=True, timeout=15)
        assert r.status_code in (401, 403), r.text

    @pytest.mark.parametrize("rng", ["day", "week", "month", "quarter", "year"])
    def test_all_ranges(self, admin_client, rng):
        r = admin_client.get(f"{BASE_URL}/api/admin/analytics/summary?range={rng}",
                             allow_redirects=True, timeout=25)
        assert r.status_code == 200, f"{rng}: {r.status_code} {r.text[:200]}"
        d = r.json()
        for key in ["order_count", "total_revenue", "average_order_value",
                    "customers", "fulfillment_mix", "top_items",
                    "top_categories", "busy_hours", "revenue_over_time", "top_customers"]:
            assert key in d, f"missing key {key} in {rng} response"
        assert isinstance(d["busy_hours"], list) and len(d["busy_hours"]) == 24
        assert isinstance(d["customers"], dict)
        for ck in ("unique", "new", "returning"):
            assert ck in d["customers"]
        assert isinstance(d["fulfillment_mix"], list)
        assert isinstance(d["top_items"], list)
        assert isinstance(d["revenue_over_time"], list)
