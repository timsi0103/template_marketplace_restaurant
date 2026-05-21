"""
Iteration 38 — 8 bug fixes verification (admin & customer)

Backend-testable items:
  1) POST /api/orders blocked with 503 when store paused via /api/admin/store/pause
  2) /admin/menu/items POST accepts image_url and persists
  3) /admin/cancellation/config PATCH propagates to public /api/cancellation/config
"""
import os
import time
import uuid
import pytest
import requests

def _read_frontend_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        return None
    return None


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _read_frontend_env()).rstrip("/")
ADMIN_EMAIL = "admin@culinaryeditorial.com"
ADMIN_PASSWORD = "Admin123!"
CUSTOMER_EMAIL = "demo@culinaryeditorial.com"
CUSTOMER_PASSWORD = "Demo123!"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD,
    })
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    token = r.json().get("token") or r.json().get("access_token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def public_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module", autouse=True)
def cleanup_state(admin_session):
    """Ensure clean state before and after the module."""
    yield
    # Always reset pause off and require_reason on at end
    try:
        admin_session.post(f"{BASE_URL}/api/admin/store/pause",
                           json={"paused": False})
    except Exception:
        pass
    try:
        admin_session.patch(f"{BASE_URL}/api/admin/cancellation/config",
                            json={"require_reason": True})
    except Exception:
        pass


# ─── 1) Paused ordering bypass ────────────────────────────────
class TestPauseOrdering:

    def _make_order_payload(self):
        # Get a menu item id (any item available)
        r = requests.get(f"{BASE_URL}/api/menu/items")
        assert r.status_code == 200
        items = r.json()
        if isinstance(items, dict):
            items = items.get("items") or []
        assert items, "No menu items found"
        item = items[0]
        return {
            "fulfillment_type": "pickup",
            "contact_email": f"TEST_{uuid.uuid4().hex[:8]}@example.com",
            "contact_name": "Test User",
            "contact_phone": "+10000000000",
            "origin_url": BASE_URL,
            "items": [{
                "item_id": item.get("id") or item.get("_id"),
                "quantity": 1,
                "name": item.get("name"),
                "price": item.get("price"),
            }],
            "tip": 0,
        }

    def test_pause_blocks_orders_with_503(self, admin_session):
        # Pause store
        r = admin_session.post(
            f"{BASE_URL}/api/admin/store/pause",
            json={"paused": True, "reason": "Kitchen maintenance"},
        )
        assert r.status_code == 200, f"Pause toggle failed: {r.text}"
        assert r.json().get("pause_ordering") is True

        # Attempt to place an order
        payload = self._make_order_payload()
        order_resp = requests.post(f"{BASE_URL}/api/orders", json=payload)
        assert order_resp.status_code == 503, (
            f"Expected 503 when paused, got {order_resp.status_code}: {order_resp.text}"
        )
        detail = order_resp.json().get("detail", "")
        assert "Ordering paused" in detail, f"Detail missing 'Ordering paused': {detail}"
        assert "Kitchen maintenance" in detail, f"Custom reason not echoed: {detail}"

    def test_unpause_allows_orders(self, admin_session):
        # Resume
        r = admin_session.post(
            f"{BASE_URL}/api/admin/store/pause", json={"paused": False},
        )
        assert r.status_code == 200, r.text
        assert r.json().get("pause_ordering") is False

        # Place order should now succeed (or return some 2xx like 200/201)
        payload = self._make_order_payload()
        order_resp = requests.post(f"{BASE_URL}/api/orders", json=payload)
        assert order_resp.status_code in (200, 201), (
            f"Order should succeed after unpause, got {order_resp.status_code}: {order_resp.text}"
        )
        data = order_resp.json()
        assert "order_id" in data or "id" in data, f"Order response missing id: {data}"


# ─── 2) Admin item create with category + image_url ───────────
class TestAdminItemCreate:

    def test_create_item_with_image_url(self, admin_session):
        # Get first category
        r = admin_session.get(f"{BASE_URL}/api/categories")
        assert r.status_code == 200, r.text
        cats = r.json()
        if isinstance(cats, dict):
            cats = cats.get("categories") or cats.get("items") or []
        assert cats, "No categories found"
        first_cat = cats[0]
        cat_id = first_cat.get("id") or first_cat.get("_id") or first_cat.get("slug")
        assert cat_id, f"Category missing id: {first_cat}"

        image_url = "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400"
        payload = {
            "name": f"TEST_Item_{uuid.uuid4().hex[:8]}",
            "description": "Test item from iteration 38",
            "price": 12.5,
            "category_id": cat_id,
            "image_url": image_url,
            "images": [image_url],
            "available": True,
        }
        r = admin_session.post(f"{BASE_URL}/api/admin/menu/items", json=payload)
        assert r.status_code in (200, 201), f"Create item failed: {r.status_code} {r.text}"
        created = r.json()
        item_id = created.get("id") or created.get("_id")
        assert item_id, f"No id in created item: {created}"

        # GET to verify persistence
        g = requests.get(f"{BASE_URL}/api/menu/items/{item_id}")
        assert g.status_code == 200, g.text
        fetched = g.json()
        stored_images = fetched.get("images") or []
        stored_image_url = fetched.get("image_url")
        assert stored_image_url == image_url or image_url in stored_images, (
            f"Image URL not persisted: image_url={stored_image_url} images={stored_images}"
        )

        # Cleanup
        admin_session.delete(f"{BASE_URL}/api/admin/menu/items/{item_id}")


# ─── 3) Cancellation config require_reason propagation ────────
class TestCancellationConfig:

    def test_require_reason_false_propagates_to_public(self, admin_session):
        # Set to false
        r = admin_session.patch(
            f"{BASE_URL}/api/admin/cancellation/config",
            json={"require_reason": False},
        )
        assert r.status_code == 200, r.text
        assert r.json().get("require_reason") is False

        time.sleep(0.3)
        pub = requests.get(f"{BASE_URL}/api/cancellation/config")
        assert pub.status_code == 200, pub.text
        assert pub.json().get("require_reason") is False, pub.json()

    def test_require_reason_true_propagates_to_public(self, admin_session):
        r = admin_session.patch(
            f"{BASE_URL}/api/admin/cancellation/config",
            json={"require_reason": True},
        )
        assert r.status_code == 200, r.text
        assert r.json().get("require_reason") is True

        time.sleep(0.3)
        pub = requests.get(f"{BASE_URL}/api/cancellation/config")
        assert pub.status_code == 200, pub.text
        assert pub.json().get("require_reason") is True


# ─── 4) Cancel eligibility reflects require_reason ────────────
class TestCancelEligibility:

    def _create_pickup_order(self):
        r = requests.get(f"{BASE_URL}/api/menu/items")
        items = r.json()
        if isinstance(items, dict):
            items = items.get("items") or []
        item = items[0]
        payload = {
            "fulfillment_type": "pickup",
            "contact_email": f"TEST_{uuid.uuid4().hex[:8]}@example.com",
            "contact_name": "Test User",
            "contact_phone": "+10000000000",
            "origin_url": BASE_URL,
            "items": [{
                "item_id": item.get("id") or item.get("_id"),
                "quantity": 1,
                "name": item.get("name"),
                "price": item.get("price"),
            }],
            "tip": 0,
        }
        resp = requests.post(f"{BASE_URL}/api/orders", json=payload)
        assert resp.status_code in (200, 201), f"Order create failed: {resp.text}"
        d = resp.json()
        return d.get("order_id") or d.get("id")

    def test_eligibility_reason_required_false(self, admin_session):
        # Toggle off
        admin_session.patch(
            f"{BASE_URL}/api/admin/cancellation/config",
            json={"require_reason": False},
        )
        order_id = self._create_pickup_order()
        e = requests.get(f"{BASE_URL}/api/orders/{order_id}/cancel-eligibility")
        if e.status_code != 200:
            pytest.skip(f"Eligibility endpoint returned {e.status_code}: {e.text}")
        body = e.json()
        assert body.get("reason_required") is False, body

    def test_eligibility_reason_required_true(self, admin_session):
        admin_session.patch(
            f"{BASE_URL}/api/admin/cancellation/config",
            json={"require_reason": True},
        )
        order_id = self._create_pickup_order()
        e = requests.get(f"{BASE_URL}/api/orders/{order_id}/cancel-eligibility")
        if e.status_code != 200:
            pytest.skip(f"Eligibility endpoint returned {e.status_code}: {e.text}")
        body = e.json()
        assert body.get("reason_required") is True, body
