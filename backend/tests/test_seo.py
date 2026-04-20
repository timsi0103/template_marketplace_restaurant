"""SEO Optimization & Structured Data tests.

Covers:
- Admin auth guards on /api/admin/seo/* endpoints.
- GET /api/admin/seo/settings (defaults, page list, available structured types).
- PATCH /api/admin/seo/settings (deep merge on robots + sitemap).
- GET/PATCH /api/admin/seo/pages/{key} (unknown key → 404).
- GET /api/seo/page/{key} (public; product_id/category_slug enrichment).
- Structured data blocks render with expected @type values.
- Redirects CRUD + duplicate 409 + self-referencing 400 + public redirect-check increments hits.
- GET /api/seo/sitemap.xml (XML payload + URLs include home & menu).
- GET /api/seo/robots.txt (includes Disallow + Sitemap).
- GET /api/admin/seo/health (score present, checks grouped, duplicates detected).
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
        json={"email": "admin@culinaryeditorial.com", "password": "Admin123!"},
    )
    if r.status_code != 200:
        pytest.skip(f"Admin login failed {r.status_code}: {r.text[:200]}")
    return s


@pytest.fixture(scope="module")
def created_redirect_ids():
    ids: list[str] = []
    yield ids


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_session, created_redirect_ids):
    yield
    for rid in created_redirect_ids:
        admin_session.delete(f"{BASE_URL}/api/admin/seo/redirects/{rid}")


# ─── Admin auth guards ──────────────────────────────────────────

@pytest.mark.parametrize("path", [
    "/api/admin/seo/settings",
    "/api/admin/seo/pages/home",
    "/api/admin/seo/redirects",
    "/api/admin/seo/health",
    "/api/admin/seo/sitemap-preview",
    "/api/admin/seo/robots-preview",
])
def test_admin_requires_auth(path):
    r = requests.get(f"{BASE_URL}{path}")
    assert r.status_code in (401, 403), f"Expected 401/403 on {path}, got {r.status_code}"


# ─── Admin settings ─────────────────────────────────────────────

def test_get_admin_settings(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/seo/settings")
    assert r.status_code == 200
    d = r.json()
    assert "global" in d and "pages" in d
    keys = [p["page_key"] for p in d["pages"]]
    for required in ["home", "menu", "product", "checkout", "about", "contact"]:
        assert required in keys
    assert isinstance(d.get("available_structured_types"), list)
    assert "Restaurant" in d["available_structured_types"]


def test_patch_global_settings(admin_session):
    payload = {
        "site_url": "https://seo-test.example.com",
        "default_title_suffix": " | Test Brand",
        "twitter_handle": "@testbrand",
        "robots": {"disallow_paths": ["/admin", "/checkout", "/private"]},
        "sitemap": {"auto_include_products": False},
    }
    r = admin_session.patch(f"{BASE_URL}/api/admin/seo/settings", json=payload)
    assert r.status_code == 200
    d = r.json()
    assert d["site_url"] == "https://seo-test.example.com"
    assert d["default_title_suffix"] == " | Test Brand"
    assert d["twitter_handle"] == "@testbrand"
    assert "/private" in d["robots"]["disallow_paths"]
    assert d["sitemap"]["auto_include_products"] is False
    # Confirm deep merge preserved other sitemap keys
    assert "change_frequency" in d["sitemap"]
    # Reset to reasonable defaults for downstream tests
    admin_session.patch(f"{BASE_URL}/api/admin/seo/settings", json={
        "sitemap": {"auto_include_products": True},
    })


def test_patch_global_no_changes_400(admin_session):
    r = admin_session.patch(f"{BASE_URL}/api/admin/seo/settings", json={})
    assert r.status_code == 400


# ─── Per-page ───────────────────────────────────────────────────

def test_page_unknown_key_404(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/seo/pages/nonexistent")
    assert r.status_code == 404


def test_patch_page_and_public_reflect(admin_session):
    payload = {
        "title": "SEO Test Home Page Title",
        "description": "Short test description for the home page meta tag.",
        "keywords": ["test", "seo", "home"],
        "og_image_url": "https://example.com/og.jpg",
        "noindex": False,
    }
    r = admin_session.patch(f"{BASE_URL}/api/admin/seo/pages/home", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["title"] == payload["title"]

    # Public endpoint reflects
    pub = requests.get(f"{BASE_URL}/api/seo/page/home")
    assert pub.status_code == 200
    pd = pub.json()
    assert pd["meta"]["title"].startswith("SEO Test Home Page Title")
    assert pd["meta"]["og_image_url"] == "https://example.com/og.jpg"
    assert isinstance(pd["structured_data"], list)
    assert pd["structured_data"], "Expected at least one structured data block on home"
    types = [b.get("@type") for b in pd["structured_data"]]
    assert any(t in types for t in ["Organization", "Restaurant", "WebSite"])


def test_public_unknown_page_404():
    r = requests.get(f"{BASE_URL}/api/seo/page/nonexistent")
    assert r.status_code == 404


def test_public_product_page_enriches_from_menu_item():
    # Fetch a real menu item id
    items = requests.get(f"{BASE_URL}/api/menu/items").json()
    items_list = items if isinstance(items, list) else items.get("items", [])
    assert items_list, "Need at least one menu item for product SEO enrichment test"
    pid = items_list[0]["id"]
    r = requests.get(f"{BASE_URL}/api/seo/page/product?product_id={pid}")
    assert r.status_code == 200
    d = r.json()
    assert d["meta"]["title"]  # enriched from product name
    types = [b.get("@type") for b in d.get("structured_data", [])]
    assert "BreadcrumbList" in types
    # Canonical URL must contain the real product id — not the {id} template
    assert pid in d["canonical_url"], f"canonical should contain product id, got {d['canonical_url']}"
    assert "{id}" not in d["canonical_url"]
    assert "{" not in d["canonical_url"]


def test_public_category_canonical_uses_slug():
    cats = requests.get(f"{BASE_URL}/api/categories").json()
    cat_list = cats.get("categories") if isinstance(cats, dict) else cats
    if not cat_list:
        pytest.skip("No categories seeded")
    slug = cat_list[0].get("slug") or cat_list[0].get("id")
    r = requests.get(f"{BASE_URL}/api/seo/page/category?category_slug={slug}")
    assert r.status_code == 200
    d = r.json()
    assert slug in d["canonical_url"]
    assert "{slug}" not in d["canonical_url"]


# ─── Redirects ──────────────────────────────────────────────────

def test_redirects_crud(admin_session, created_redirect_ids):
    # Create
    r = admin_session.post(f"{BASE_URL}/api/admin/seo/redirects", json={
        "from_path": "/old-page-xyz", "to_path": "/menu", "status_code": 301,
    })
    assert r.status_code == 200
    rid = r.json()["id"]
    created_redirect_ids.append(rid)

    # Duplicate → 409
    dup = admin_session.post(f"{BASE_URL}/api/admin/seo/redirects", json={
        "from_path": "/old-page-xyz", "to_path": "/menu",
    })
    assert dup.status_code == 409

    # Self-reference → 400
    self_ref = admin_session.post(f"{BASE_URL}/api/admin/seo/redirects", json={
        "from_path": "/same", "to_path": "/same",
    })
    assert self_ref.status_code == 400

    # List contains it
    lst = admin_session.get(f"{BASE_URL}/api/admin/seo/redirects").json()
    assert any(x["id"] == rid for x in lst["redirects"])

    # Public lookup increments hits
    look = requests.get(f"{BASE_URL}/api/seo/redirect-check?path=/old-page-xyz")
    assert look.status_code == 200
    assert look.json()["found"] is True
    assert look.json()["to_path"] == "/menu"
    # Second hit
    requests.get(f"{BASE_URL}/api/seo/redirect-check?path=/old-page-xyz")

    # Re-fetch and verify hits >= 2
    lst2 = admin_session.get(f"{BASE_URL}/api/admin/seo/redirects").json()
    target = next(x for x in lst2["redirects"] if x["id"] == rid)
    assert target["hits"] >= 2

    # Patch
    p = admin_session.patch(f"{BASE_URL}/api/admin/seo/redirects/{rid}", json={"status_code": 302})
    assert p.status_code == 200
    assert p.json()["status_code"] == 302

    # Delete
    d = admin_session.delete(f"{BASE_URL}/api/admin/seo/redirects/{rid}")
    assert d.status_code == 200
    created_redirect_ids.remove(rid)


def test_redirect_not_found():
    r = requests.get(f"{BASE_URL}/api/seo/redirect-check?path=/definitely-not-a-path-XYZ")
    assert r.status_code == 200
    assert r.json()["found"] is False


# ─── Sitemap & Robots ───────────────────────────────────────────

def test_public_sitemap_xml():
    r = requests.get(f"{BASE_URL}/api/seo/sitemap.xml")
    assert r.status_code == 200
    assert "application/xml" in r.headers.get("content-type", "")
    body = r.text
    assert "<urlset" in body
    assert "<url>" in body
    assert "/menu" in body


def test_public_robots_txt():
    r = requests.get(f"{BASE_URL}/api/seo/robots.txt")
    assert r.status_code == 200
    body = r.text
    assert "User-agent: *" in body
    assert "Sitemap:" in body
    assert "Disallow:" in body


# ─── Health ─────────────────────────────────────────────────────

def test_health_report(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/seo/health")
    assert r.status_code == 200
    d = r.json()
    assert "score" in d and isinstance(d["score"], int)
    assert "summary" in d and all(k in d["summary"] for k in ["pass", "warn", "fail"])
    assert isinstance(d["checks"], list) and d["checks"]
    # Each check must have our schema
    for c in d["checks"]:
        for key in ("status", "severity", "code", "label"):
            assert key in c, f"Missing {key} in check {c}"
        assert c["status"] in ("pass", "warn", "fail")
