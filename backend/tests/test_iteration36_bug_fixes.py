"""Test the 12 bug fixes from iteration 36.

Covers:
  - Chocolate desserts subcategory
  - Profile PATCH endpoint
  - Orders user_id OR contact_email
  - /coupons/active endpoint
  - /auth/me guest 401
"""
import os
import requests
import pytest

def _load_base_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if url:
        return url.rstrip("/")
    # Fall back to frontend/.env
    try:
        env_path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env")
        with open(env_path) as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass
    return "http://localhost:8001"


BASE_URL = _load_base_url()
DEMO_EMAIL = os.environ.get("TEST_DEMO_EMAIL", "demo@culinaryeditorial.com")
DEMO_PASSWORD = os.environ.get("TEST_DEMO_PASSWORD", "Demo123!")
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    return s


@pytest.fixture(scope="module")
def auth_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Demo login failed: {r.status_code} {r.text[:200]}")
    return s


# ---- 1. Chocolate desserts subcategory ----
def test_chocolate_desserts_subcategory(session):
    r = session.get(f"{BASE_URL}/api/menu/items", params={"category": "desserts", "subcategory": "chocolate"})
    assert r.status_code == 200, r.text
    data = r.json()
    items = data if isinstance(data, list) else data.get("items", [])
    assert len(items) >= 2, f"Expected >=2 chocolate desserts, got {len(items)}"
    names = {i.get("name") for i in items}
    assert "Valrhona 70% Lava Cake" in names
    assert "Triple-Chocolate Mousse" in names
    for i in items:
        assert i.get("subcategory") == "chocolate"


# ---- 2. Coupons active endpoint ----
def test_coupons_active_returns_list(session):
    r = session.get(f"{BASE_URL}/api/coupons/active", params={"subtotal": 50, "fulfillment_type": "delivery"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "coupons" in data and "count" in data
    assert isinstance(data["coupons"], list)
    assert data["count"] == len(data["coupons"])
    if data["count"] > 0:
        c = data["coupons"][0]
        for k in ("code", "type", "value", "min_subtotal", "description", "first_order_only", "applies_now"):
            assert k in c


def test_coupons_active_filters_free_delivery_for_pickup(session):
    r_delivery = session.get(f"{BASE_URL}/api/coupons/active", params={"subtotal": 50, "fulfillment_type": "delivery"})
    r_pickup = session.get(f"{BASE_URL}/api/coupons/active", params={"subtotal": 50, "fulfillment_type": "pickup"})
    assert r_delivery.status_code == 200 and r_pickup.status_code == 200
    pickup_types = {c["type"] for c in r_pickup.json()["coupons"]}
    assert "free_delivery" not in pickup_types


# ---- 3. PATCH /auth/me guest = 401 ----
def test_patch_auth_me_guest_returns_401(session):
    r = session.patch(f"{BASE_URL}/api/auth/me", json={"phone": "+15551234567"})
    assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text[:200]}"


# ---- 4. PATCH /auth/me authenticated updates phone ----
def test_patch_auth_me_updates_phone(auth_session):
    new_phone = "+15559998888"
    r = auth_session.patch(f"{BASE_URL}/api/auth/me", json={"phone": new_phone})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("phone") == new_phone
    # Verify via GET
    r2 = auth_session.get(f"{BASE_URL}/api/auth/me")
    assert r2.status_code == 200
    # restore
    auth_session.patch(f"{BASE_URL}/api/auth/me", json={"phone": "+15551112222"})


def test_patch_auth_me_empty_body_rejected(auth_session):
    r = auth_session.patch(f"{BASE_URL}/api/auth/me", json={})
    assert r.status_code == 400


# ---- 5. Orders flow: POST then GET returns the order for logged in user ----
def test_orders_post_then_get_returns_order(auth_session):
    # find a real item id
    r = requests.get(f"{BASE_URL}/api/menu/items", params={"category": "desserts", "subcategory": "chocolate"})
    items = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
    assert items, "no items available for ordering"
    item_id = items[0]["id"]

    payload = {
        "items": [{"item_id": item_id, "qty": 1}],
        "fulfillment_type": "pickup",
        "contact_email": DEMO_EMAIL,
        "contact_name": "Demo Customer",
        "contact_phone": "+15551234567",
        "origin_url": BASE_URL,
    }
    r = auth_session.post(f"{BASE_URL}/api/orders", json=payload)
    assert r.status_code == 200, f"Order creation failed: {r.text[:300]}"
    order_id = r.json().get("order_id")
    assert order_id

    # Now GET /api/orders should include this order
    r2 = auth_session.get(f"{BASE_URL}/api/orders")
    assert r2.status_code == 200
    orders = r2.json().get("orders", [])
    ids = {o["id"] for o in orders}
    assert order_id in ids, f"Order {order_id} not found in user's orders list"


def test_orders_get_unauthenticated_returns_empty(session):
    r = session.get(f"{BASE_URL}/api/orders")
    assert r.status_code == 200
    data = r.json()
    assert data.get("count", 0) == 0
    assert data.get("orders") == []
