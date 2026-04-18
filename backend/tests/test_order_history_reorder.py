"""
Test Order History & Reorder Feature (Iteration 15)
Tests:
- PATCH /api/orders/{id}/favorite - Toggle starred flag (requires login)
- GET /api/orders - List orders (authenticated user or guest email lookup)
- Favorite toggle authorization (owner/admin only)
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
ADMIN_EMAIL = "admin@culinaryeditorial.com"
ADMIN_PASSWORD = "Admin123!"


class TestFavoriteToggleAuth:
    """Test PATCH /api/orders/{id}/favorite requires login"""
    
    def test_favorite_without_auth_returns_401(self):
        """PATCH /api/orders/{id}/favorite without auth should return 401"""
        response = requests.patch(f"{BASE_URL}/api/orders/fake-order-id/favorite")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("PASS: PATCH /api/orders/{id}/favorite without auth returns 401")
    
    def test_favorite_nonexistent_order_returns_404(self):
        """PATCH /api/orders/{id}/favorite on non-existent order returns 404"""
        session = requests.Session()
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        
        fake_id = f"nonexistent-{uuid.uuid4().hex[:8]}"
        response = session.patch(f"{BASE_URL}/api/orders/{fake_id}/favorite")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("PASS: PATCH /api/orders/{id}/favorite on non-existent order returns 404")


class TestOrdersListEndpoint:
    """Test GET /api/orders endpoint"""
    
    def test_orders_without_auth_no_email_returns_empty(self):
        """GET /api/orders without auth and no email param returns empty list"""
        response = requests.get(f"{BASE_URL}/api/orders")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "orders" in data, "Response missing 'orders' field"
        assert "count" in data, "Response missing 'count' field"
        assert data["count"] == 0, f"Expected 0 orders without auth, got {data['count']}"
        print("PASS: GET /api/orders without auth returns empty list")
    
    def test_orders_with_email_param_returns_matching(self):
        """GET /api/orders?email=X returns orders matching contact_email"""
        # Test with a random email that shouldn't have orders
        test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.get(f"{BASE_URL}/api/orders", params={"email": test_email})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "orders" in data, "Response missing 'orders' field"
        # Should return empty for non-existent email
        assert data["count"] == 0, f"Expected 0 orders for random email, got {data['count']}"
        print(f"PASS: GET /api/orders?email={test_email} returns empty list for non-existent email")
    
    def test_orders_authenticated_returns_user_orders(self):
        """GET /api/orders (authenticated) returns user's own orders"""
        session = requests.Session()
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        
        response = session.get(f"{BASE_URL}/api/orders")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "orders" in data, "Response missing 'orders' field"
        assert "count" in data, "Response missing 'count' field"
        assert isinstance(data["orders"], list), "'orders' should be a list"
        print(f"PASS: GET /api/orders (authenticated) returns {data['count']} orders")


class TestFavoriteToggleFunctionality:
    """Test favorite toggle functionality with seeded orders"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin and seed test orders"""
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.admin_user = login_resp.json()
        self.test_order_ids = []
        yield
        # Cleanup is handled by MongoDB TTL or manual cleanup
    
    def test_favorite_toggle_flips_starred_boolean(self):
        """PATCH /api/orders/{id}/favorite toggles starred boolean back and forth"""
        # First, we need to create a test order via MongoDB
        # Since we can't directly insert, we'll check if there are existing orders
        # or skip this test if no orders exist
        
        orders_resp = self.session.get(f"{BASE_URL}/api/orders")
        assert orders_resp.status_code == 200
        orders = orders_resp.json().get("orders", [])
        
        if len(orders) == 0:
            pytest.skip("No orders exist for admin user - need to seed orders first")
        
        order = orders[0]
        order_id = order["id"]
        initial_starred = order.get("starred", False)
        
        # Toggle favorite
        toggle_resp = self.session.patch(f"{BASE_URL}/api/orders/{order_id}/favorite")
        assert toggle_resp.status_code == 200, f"Expected 200, got {toggle_resp.status_code}: {toggle_resp.text}"
        data = toggle_resp.json()
        assert data["id"] == order_id, "Response should contain order id"
        assert data["starred"] == (not initial_starred), f"Expected starred to flip from {initial_starred} to {not initial_starred}"
        
        # Toggle back
        toggle_resp2 = self.session.patch(f"{BASE_URL}/api/orders/{order_id}/favorite")
        assert toggle_resp2.status_code == 200
        data2 = toggle_resp2.json()
        assert data2["starred"] == initial_starred, f"Expected starred to flip back to {initial_starred}"
        
        print(f"PASS: Favorite toggle flips starred boolean: {initial_starred} → {not initial_starred} → {initial_starred}")


class TestFavoriteToggleAuthorization:
    """Test that favorite toggle is owner/admin scoped"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup sessions for different users"""
        # Admin session
        self.admin_session = requests.Session()
        login_resp = self.admin_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
        
        # Create a test user
        self.test_email = f"test_user_{uuid.uuid4().hex[:8]}@example.com"
        self.test_password = "TestPass123!"
        self.test_session = requests.Session()
        
        # Register test user
        register_resp = self.test_session.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "password": self.test_password,
            "name": "Test User"
        })
        if register_resp.status_code == 409:
            # User exists, login instead
            login_resp = self.test_session.post(f"{BASE_URL}/api/auth/login", json={
                "email": self.test_email,
                "password": self.test_password
            })
            assert login_resp.status_code == 200, f"Test user login failed: {login_resp.text}"
        else:
            assert register_resp.status_code == 200, f"Test user registration failed: {register_resp.text}"
        
        yield
    
    def test_non_owner_cannot_favorite_others_order(self):
        """Non-owner (non-admin) trying to favorite another user's order should get 403"""
        # Get admin's orders
        admin_orders_resp = self.admin_session.get(f"{BASE_URL}/api/orders")
        assert admin_orders_resp.status_code == 200
        admin_orders = admin_orders_resp.json().get("orders", [])
        
        if len(admin_orders) == 0:
            pytest.skip("No admin orders exist - need to seed orders first")
        
        admin_order_id = admin_orders[0]["id"]
        
        # Try to favorite admin's order as test user
        toggle_resp = self.test_session.patch(f"{BASE_URL}/api/orders/{admin_order_id}/favorite")
        assert toggle_resp.status_code == 403, f"Expected 403, got {toggle_resp.status_code}: {toggle_resp.text}"
        print("PASS: Non-owner cannot favorite another user's order (403)")


class TestMenuItemsForReorder:
    """Test menu items endpoint for reorder availability check"""
    
    def test_menu_items_returns_items_with_status(self):
        """GET /api/menu/items returns items with status field for availability check"""
        response = requests.get(f"{BASE_URL}/api/menu/items")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        items = data.get("items", data)
        assert len(items) > 0, "Expected at least one menu item"
        
        # Check that items have required fields for reorder
        for item in items[:3]:
            assert "id" in item, "Item missing 'id' field"
            assert "name" in item, "Item missing 'name' field"
            assert "price" in item, "Item missing 'price' field"
            assert "status" in item, "Item missing 'status' field"
        
        print(f"PASS: GET /api/menu/items returns {len(items)} items with status field")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
