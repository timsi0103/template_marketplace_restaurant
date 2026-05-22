"""Tests for catalog settings (public+admin) + advanced menu search (dietary, price, stock, sort)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "admin@culinaryeditorial.com")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "Admin123!")
DEFAULTS = {
    "visible_dietary_tags": ["vegan", "vegetarian", "gluten_free", "halal", "nut_free", "spicy"],
    "default_sort": "popularity",
    "quick_view_enabled": True,
    "price_min": 0,
    "price_max": 100,
    "sticky_category_bar": True,
    "show_in_stock_toggle": True,
}


# ───────── fixtures ─────────

@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    token = r.cookies.get("access_token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module", autouse=True)
def restore_defaults_after(admin_session):
    yield
    admin_session.patch(f"{BASE_URL}/api/admin/catalog/settings", json=DEFAULTS)


# ───────── catalog settings ─────────

class TestCatalogSettingsPublic:
    def test_public_get(self):
        r = requests.get(f"{BASE_URL}/api/catalog/settings")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["visible_dietary_tags", "default_sort", "quick_view_enabled",
                  "price_min", "price_max", "sticky_category_bar",
                  "show_in_stock_toggle", "all_dietary_tags"]:
            assert k in d, f"missing {k}"
        assert isinstance(d["visible_dietary_tags"], list)
        assert isinstance(d["all_dietary_tags"], list)
        assert "vegan" in d["all_dietary_tags"]


class TestCatalogSettingsAdmin:
    def test_admin_get_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/catalog/settings")
        assert r.status_code in (401, 403)

    def test_patch_requires_auth(self):
        r = requests.patch(f"{BASE_URL}/api/admin/catalog/settings", json={"default_sort": "newest"})
        assert r.status_code in (401, 403)

    def test_admin_get(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/catalog/settings")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "all_dietary_tags" in d
        assert "visible_dietary_tags" in d

    def test_patch_partial_default_sort(self, admin_session):
        r = admin_session.patch(f"{BASE_URL}/api/admin/catalog/settings",
                                 json={"default_sort": "newest"})
        assert r.status_code == 200, r.text
        assert r.json()["default_sort"] == "newest"
        # verify persistence
        r2 = requests.get(f"{BASE_URL}/api/catalog/settings")
        assert r2.json()["default_sort"] == "newest"

    def test_patch_invalid_sort_returns_400(self, admin_session):
        r = admin_session.patch(f"{BASE_URL}/api/admin/catalog/settings",
                                 json={"default_sort": "banana"})
        assert r.status_code == 400

    def test_patch_filters_dietary_whitelist(self, admin_session):
        r = admin_session.patch(f"{BASE_URL}/api/admin/catalog/settings",
                                 json={"visible_dietary_tags": ["vegan", "made_up_tag", "halal"]})
        assert r.status_code == 200, r.text
        tags = r.json()["visible_dietary_tags"]
        assert "made_up_tag" not in tags
        assert set(tags).issubset({"vegan", "halal"}) or ("vegan" in tags and "halal" in tags)

    def test_patch_quick_view_toggle(self, admin_session):
        r = admin_session.patch(f"{BASE_URL}/api/admin/catalog/settings",
                                 json={"quick_view_enabled": False})
        assert r.status_code == 200
        assert r.json()["quick_view_enabled"] is False
        # reflected publicly
        d = requests.get(f"{BASE_URL}/api/catalog/settings").json()
        assert d["quick_view_enabled"] is False
        # restore
        admin_session.patch(f"{BASE_URL}/api/admin/catalog/settings",
                            json={"quick_view_enabled": True})


# ───────── search/menu ─────────

class TestSearchMenu:
    def test_basic_search(self):
        r = requests.get(f"{BASE_URL}/api/search/menu", params={"q": "", "limit": 30})
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "count" in d
        assert d["count"] > 0

    def test_search_text_query(self):
        r = requests.get(f"{BASE_URL}/api/search/menu", params={"q": "Tagliatelle"})
        assert r.status_code == 200
        items = r.json()["items"]
        assert any("tagliatelle" in (i.get("name", "") + i.get("description", "")).lower() for i in items)

    def test_dietary_filter_single(self):
        r = requests.get(f"{BASE_URL}/api/search/menu", params=[("dietary", "vegan")])
        assert r.status_code == 200
        items = r.json()["items"]
        # should only have items with vegan in dietary_tags
        for it in items:
            assert "vegan" in (it.get("dietary_tags") or []), f"{it.get('name')} missing vegan tag"

    def test_dietary_filter_multi_uses_all(self):
        r = requests.get(f"{BASE_URL}/api/search/menu",
                         params=[("dietary", "vegan"), ("dietary", "gluten_free")])
        assert r.status_code == 200
        items = r.json()["items"]
        for it in items:
            tags = it.get("dietary_tags") or []
            assert "vegan" in tags and "gluten_free" in tags

    def test_price_range(self):
        r = requests.get(f"{BASE_URL}/api/search/menu",
                         params={"min_price": 10, "max_price": 20})
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert 10 <= it["price"] <= 20

    def test_in_stock_only(self):
        r = requests.get(f"{BASE_URL}/api/search/menu", params={"in_stock_only": "true"})
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert it.get("status") != "sold_out"

    def test_sort_price_asc(self):
        r = requests.get(f"{BASE_URL}/api/search/menu", params={"sort": "price_asc", "limit": 30})
        assert r.status_code == 200
        prices = [i["price"] for i in r.json()["items"]]
        assert prices == sorted(prices)

    def test_sort_price_desc(self):
        r = requests.get(f"{BASE_URL}/api/search/menu", params={"sort": "price_desc", "limit": 30})
        prices = [i["price"] for i in r.json()["items"]]
        assert prices == sorted(prices, reverse=True)

    def test_sort_name_asc(self):
        r = requests.get(f"{BASE_URL}/api/search/menu", params={"sort": "name_asc", "limit": 30})
        names = [i["name"] for i in r.json()["items"]]
        assert names == sorted(names)

    def test_sort_invalid_falls_back(self):
        r = requests.get(f"{BASE_URL}/api/search/menu", params={"sort": "junk"})
        assert r.status_code == 200  # must not error

    def test_limit_cap(self):
        r = requests.get(f"{BASE_URL}/api/search/menu", params={"limit": 500})
        assert r.status_code == 200
        assert len(r.json()["items"]) <= 60


# ───────── seed backfill validation ─────────

class TestSeedDietaryBackfill:
    def test_items_001_010_have_dietary_tags(self):
        for i in range(1, 11):
            iid = f"item-{i:03d}"
            r = requests.get(f"{BASE_URL}/api/menu/items/{iid}")
            assert r.status_code == 200, f"{iid} missing"
            item = r.json()
            assert "dietary_tags" in item
            assert isinstance(item["dietary_tags"], list)
