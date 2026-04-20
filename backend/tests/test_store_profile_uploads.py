"""Backend tests for Store Profile + Branding + Uploads (iteration 26).
Covers: /api/admin/uploads, /api/files/{id}, /api/admin/store/locations (CRUD),
/api/admin/store/google-business (connect/sync/disconnect),
/api/admin/store/profile-completion, and /api/storefront/settings extensions
(cuisine_type, banner_image_url, social.whatsapp).
"""
import io
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@culinaryeditorial.com"
ADMIN_PASSWORD = "Admin123!"


# ─── Fixtures ─────────────────────────────────────────
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD,
    }, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def tiny_png_bytes():
    try:
        from PIL import Image
        buf = io.BytesIO()
        Image.new("RGB", (64, 64), (110, 28, 30)).save(buf, format="PNG")
        return buf.getvalue()
    except Exception:
        # minimal 1x1 PNG fallback
        return bytes.fromhex(
            "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4"
            "89000000016372545243B67E5B00000000096348524D00007A26000080840000"
            "FA000000008000000000080000749C0000000D49444154789C636060606000000005000"
            "1E30D0A2F0000000049454E44AE426082"
        )


# ─── Uploads + Files ──────────────────────────────────
class TestUploads:
    created_ids = []

    def test_reject_unauthed_upload(self, tiny_png_bytes):
        r = requests.post(
            f"{BASE_URL}/api/admin/uploads",
            files={"file": ("x.png", tiny_png_bytes, "image/png")},
            data={"purpose": "logo"}, timeout=30,
        )
        assert r.status_code in (401, 403)

    def test_upload_image_success(self, admin_session, tiny_png_bytes):
        r = admin_session.post(
            f"{BASE_URL}/api/admin/uploads",
            files={"file": ("logo.png", tiny_png_bytes, "image/png")},
            data={"purpose": "logo"}, timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("id", "url", "filename", "size", "content_type", "purpose"):
            assert k in data, f"missing key {k} in {data}"
        assert data["purpose"] == "logo"
        assert data["content_type"] == "image/png"
        assert data["url"] == f"/api/files/{data['id']}"
        assert data["size"] > 0
        TestUploads.created_ids.append(data["id"])

    def test_reject_non_image(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/admin/uploads",
            files={"file": ("x.txt", b"hello", "text/plain")},
            data={"purpose": "misc"}, timeout=30,
        )
        assert r.status_code == 400

    def test_reject_oversize(self, admin_session):
        big = b"\x89PNG\r\n\x1a\n" + b"0" * (6 * 1024 * 1024 + 1024)
        r = admin_session.post(
            f"{BASE_URL}/api/admin/uploads",
            files={"file": ("big.png", big, "image/png")},
            data={"purpose": "misc"}, timeout=60,
        )
        assert r.status_code == 413

    def test_public_file_proxy(self, tiny_png_bytes):
        assert TestUploads.created_ids, "no upload id from previous test"
        fid = TestUploads.created_ids[0]
        r = requests.get(f"{BASE_URL}/api/files/{fid}", timeout=30, allow_redirects=True)
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("image/")
        assert "cache-control" in {k.lower() for k in r.headers.keys()}
        assert len(r.content) > 0

    def test_file_proxy_404(self):
        r = requests.get(f"{BASE_URL}/api/files/up_doesnotexist", timeout=30, allow_redirects=True)
        assert r.status_code == 404

    def test_list_uploads_with_filter(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/uploads?purpose=logo", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "uploads" in data
        assert any(u["id"] == TestUploads.created_ids[0] for u in data["uploads"])
        for u in data["uploads"]:
            assert u.get("purpose") == "logo"

    def test_soft_delete_upload(self, admin_session):
        fid = TestUploads.created_ids[0]
        r = admin_session.delete(f"{BASE_URL}/api/admin/uploads/{fid}", timeout=30)
        assert r.status_code == 200, r.text
        # After soft delete, proxy should 404
        r2 = requests.get(f"{BASE_URL}/api/files/{fid}", timeout=30, allow_redirects=True)
        assert r2.status_code == 404

    def test_delete_unknown_upload(self, admin_session):
        r = admin_session.delete(f"{BASE_URL}/api/admin/uploads/up_doesnotexist", timeout=30)
        assert r.status_code == 404


# ─── Storefront extensions ────────────────────────────
class TestStorefrontExtensions:
    def test_settings_has_new_fields(self):
        r = requests.get(f"{BASE_URL}/api/storefront/settings", timeout=30, allow_redirects=True)
        assert r.status_code == 200, r.text
        s = r.json()
        assert "cuisine_type" in s
        assert "banner_image_url" in s
        assert "social" in s and "whatsapp" in s["social"]

    def test_patch_deep_merge(self, admin_session):
        # capture existing to restore
        original = requests.get(f"{BASE_URL}/api/storefront/settings", timeout=30).json()
        orig_brand = original.get("brand_name")
        orig_insta = (original.get("social") or {}).get("instagram", "")

        patch = {
            "cuisine_type": "TEST Cajun · Seafood",
            "banner_image_url": "/api/files/test_banner",
            "social": {"whatsapp": "+14155550123"},
        }
        r = admin_session.patch(f"{BASE_URL}/api/admin/storefront/settings", json=patch, timeout=30)
        assert r.status_code == 200, r.text

        after = requests.get(f"{BASE_URL}/api/storefront/settings", timeout=30).json()
        assert after["cuisine_type"] == "TEST Cajun · Seafood"
        assert after["banner_image_url"] == "/api/files/test_banner"
        assert after["social"]["whatsapp"] == "+14155550123"
        # Ensure other fields weren't wiped
        assert after.get("brand_name") == orig_brand
        assert after.get("social", {}).get("instagram", "") == orig_insta

        # restore
        admin_session.patch(f"{BASE_URL}/api/admin/storefront/settings", json={
            "cuisine_type": original.get("cuisine_type", ""),
            "banner_image_url": original.get("banner_image_url", ""),
            "social": {"whatsapp": (original.get("social") or {}).get("whatsapp", "")},
        }, timeout=30)


# ─── Multi-location CRUD ──────────────────────────────
class TestLocations:
    created = []

    def test_public_list(self):
        r = requests.get(f"{BASE_URL}/api/store/locations", timeout=30, allow_redirects=True)
        assert r.status_code == 200
        assert "locations" in r.json()

    def test_create_primary(self, admin_session):
        body = {"name": "TEST Main", "address": "1 Test St", "phone": "+1", "is_primary": True}
        r = admin_session.post(f"{BASE_URL}/api/admin/store/locations", json=body, timeout=30)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["name"] == "TEST Main"
        assert doc["is_primary"] is True
        assert doc["id"].startswith("loc_")
        TestLocations.created.append(doc["id"])

    def test_create_second_primary_demotes_first(self, admin_session):
        body = {"name": "TEST Second", "address": "2 Test St", "is_primary": True}
        r = admin_session.post(f"{BASE_URL}/api/admin/store/locations", json=body, timeout=30)
        assert r.status_code == 200, r.text
        TestLocations.created.append(r.json()["id"])

        listing = admin_session.get(f"{BASE_URL}/api/admin/store/locations", timeout=30).json()["locations"]
        primaries = [x for x in listing if x["is_primary"]]
        assert len(primaries) == 1, f"Expected exactly one primary, got {len(primaries)}"
        assert primaries[0]["name"] == "TEST Second"

    def test_patch_location(self, admin_session):
        lid = TestLocations.created[0]
        r = admin_session.patch(f"{BASE_URL}/api/admin/store/locations/{lid}",
                                json={"phone": "+1 999 000"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["phone"] == "+1 999 000"

    def test_patch_sets_primary_demotes_other(self, admin_session):
        lid = TestLocations.created[0]
        r = admin_session.patch(f"{BASE_URL}/api/admin/store/locations/{lid}",
                                json={"is_primary": True}, timeout=30)
        assert r.status_code == 200
        assert r.json()["is_primary"] is True
        listing = admin_session.get(f"{BASE_URL}/api/admin/store/locations", timeout=30).json()["locations"]
        assert sum(1 for x in listing if x["is_primary"]) == 1

    def test_delete_unknown(self, admin_session):
        r = admin_session.delete(f"{BASE_URL}/api/admin/store/locations/loc_missing", timeout=30)
        assert r.status_code == 404

    def test_cleanup_locations(self, admin_session):
        for lid in TestLocations.created:
            r = admin_session.delete(f"{BASE_URL}/api/admin/store/locations/{lid}", timeout=30)
            assert r.status_code == 200


# ─── Google Business (mocked) ─────────────────────────
class TestGoogleBusiness:
    def test_initial_disconnect_state(self, admin_session):
        # Ensure disconnected baseline
        admin_session.post(f"{BASE_URL}/api/admin/store/google-business/disconnect", timeout=30)
        r = admin_session.get(f"{BASE_URL}/api/admin/store/google-business", timeout=30)
        assert r.status_code == 200
        assert r.json()["connected"] is False

    def test_sync_before_connect_400(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/admin/store/google-business/sync", timeout=30)
        assert r.status_code == 400

    def test_connect_and_sync(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/admin/store/google-business/connect",
                               json={"account_email": "owner@example.com",
                                     "location_id": "gbp_test123"}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["connected"] is True
        assert data["account_email"] == "owner@example.com"
        assert data["gbp_location_id"] == "gbp_test123"

        r2 = admin_session.post(f"{BASE_URL}/api/admin/store/google-business/sync", timeout=30)
        assert r2.status_code == 200, r2.text
        sd = r2.json()
        assert sd.get("mocked") is True
        assert sd.get("last_sync_status") == "ok"
        assert sd.get("last_synced_at")
        assert "menu_link" in sd.get("synced_fields", [])

    def test_disconnect(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/admin/store/google-business/disconnect", timeout=30)
        assert r.status_code == 200
        r2 = admin_session.get(f"{BASE_URL}/api/admin/store/google-business", timeout=30)
        assert r2.json()["connected"] is False


# ─── Profile completion ───────────────────────────────
class TestProfileCompletion:
    def test_structure(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/store/profile-completion", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("percent", "complete_count", "total_count", "items"):
            assert k in data
        assert isinstance(data["items"], list)
        keys = [i["key"] for i in data["items"]]
        assert "locations" in keys
        assert "google_business" in keys
        # Percent is an int between 0-100
        assert 0 <= data["percent"] <= 100
        # Each item has expected fields
        for it in data["items"]:
            assert set(("key", "label", "complete", "link")).issubset(it.keys())
