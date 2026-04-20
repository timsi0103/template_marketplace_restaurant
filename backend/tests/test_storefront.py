"""Tests for branded storefront endpoints (public + admin)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://restaurant-stack.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@culinaryeditorial.com"
ADMIN_PASSWORD = "Admin123!"

DEFAULTS = {
    "colors": {"primary": "#6E1C1E", "secondary": "#D4A456", "accent": "#1E3A2F"},
    "tagline": "Seasonal · Considered · Crafted",
}


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    return s


# ---------- Public endpoints ----------
class TestPublicStorefront:
    def test_public_settings_shape(self, client):
        r = client.get(f"{BASE_URL}/api/storefront/settings")
        assert r.status_code == 200
        data = r.json()
        for key in ["brand_name", "tagline", "logo_url", "favicon_url",
                    "hero", "about", "social", "contact", "colors", "seo"]:
            assert key in data, f"missing {key}"
        assert "primary" in data["colors"]
        assert "title" in data["hero"]
        assert "heading" in data["about"]

    def test_social_proof_shape(self, client):
        r = client.get(f"{BASE_URL}/api/storefront/social-proof")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data.get("total_orders"), int)
        assert "average_rating" in data
        assert isinstance(data.get("review_count"), int)
        assert isinstance(data.get("featured_reviews"), list)
        assert len(data["featured_reviews"]) <= 4
        if data["featured_reviews"]:
            rev = data["featured_reviews"][0]
            for f in ["author", "rating", "body"]:
                assert f in rev


# ---------- Admin auth required ----------
class TestAdminAuth:
    def test_admin_settings_requires_auth(self, client):
        r = client.get(f"{BASE_URL}/api/admin/storefront/settings")
        assert r.status_code in (401, 403)

    def test_admin_patch_requires_auth(self, client):
        r = client.patch(f"{BASE_URL}/api/admin/storefront/settings", json={"tagline": "x"})
        assert r.status_code in (401, 403)


# ---------- Admin CRUD ----------
class TestAdminStorefront:
    def test_admin_get_full_settings(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/storefront/settings")
        assert r.status_code == 200
        data = r.json()
        for key in ["brand_name", "tagline", "hero", "about", "colors", "seo", "social", "contact"]:
            assert key in data

    def test_patch_partial_tagline_only_preserves_other(self, admin_client):
        # capture current
        before = admin_client.get(f"{BASE_URL}/api/admin/storefront/settings").json()
        new_tag = "TEST_partial_patch_tagline"
        r = admin_client.patch(f"{BASE_URL}/api/admin/storefront/settings", json={"tagline": new_tag})
        assert r.status_code == 200
        after = r.json()
        assert after["tagline"] == new_tag
        # Other sections retained
        assert after["brand_name"] == before["brand_name"]
        assert after["hero"]["title"] == before["hero"]["title"]
        assert after["colors"]["primary"] == before["colors"]["primary"]
        # Verify persistence via GET
        r2 = admin_client.get(f"{BASE_URL}/api/admin/storefront/settings").json()
        assert r2["tagline"] == new_tag
        assert r2["hero"]["title"] == before["hero"]["title"]

    def test_patch_deep_merge_colors(self, admin_client):
        before = admin_client.get(f"{BASE_URL}/api/admin/storefront/settings").json()
        before_secondary = before["colors"]["secondary"]
        r = admin_client.patch(
            f"{BASE_URL}/api/admin/storefront/settings",
            json={"colors": {"primary": "#112233"}},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["colors"]["primary"] == "#112233"
        assert data["colors"]["secondary"] == before_secondary  # not wiped
        assert "accent" in data["colors"]

    def test_patch_hero_partial(self, admin_client):
        before = admin_client.get(f"{BASE_URL}/api/admin/storefront/settings").json()
        r = admin_client.patch(
            f"{BASE_URL}/api/admin/storefront/settings",
            json={"hero": {"eyebrow": "TEST_EYEBROW"}},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["hero"]["eyebrow"] == "TEST_EYEBROW"
        assert data["hero"]["title"] == before["hero"]["title"]
        assert data["hero"]["cta_label"] == before["hero"]["cta_label"]

    def test_patch_empty_body_rejected(self, admin_client):
        r = admin_client.patch(f"{BASE_URL}/api/admin/storefront/settings", json={})
        assert r.status_code == 400

    def test_public_reflects_admin_update(self, admin_client, client):
        admin_client.patch(
            f"{BASE_URL}/api/admin/storefront/settings",
            json={"tagline": "TEST_public_visible"},
        )
        r = client.get(f"{BASE_URL}/api/storefront/settings")
        assert r.status_code == 200
        assert r.json()["tagline"] == "TEST_public_visible"

    def test_restore_defaults(self, admin_client):
        r = admin_client.patch(
            f"{BASE_URL}/api/admin/storefront/settings",
            json={"colors": DEFAULTS["colors"], "tagline": DEFAULTS["tagline"]},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["tagline"] == DEFAULTS["tagline"]
        assert data["colors"]["primary"] == DEFAULTS["colors"]["primary"]
        assert data["colors"]["secondary"] == DEFAULTS["colors"]["secondary"]
        assert data["colors"]["accent"] == DEFAULTS["colors"]["accent"]
