"""
Test suite for Phase 4: Menu Catalog CRUD and Admin functionality
Tests: Menu items API, category filtering, admin CRUD, toggle availability
"""
import pytest
import requests
import os

# Use localhost for testing since external URL may have issues
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', os.environ.get('FRONTEND_URL', 'http://localhost:8001')).rstrip('/')
if 'localhost' not in BASE_URL and '127.0.0.1' not in BASE_URL:
    BASE_URL = 'http://localhost:8001'

ADMIN_EMAIL = "admin@culinaryeditorial.com"
ADMIN_PASSWORD = "Admin123!"


class TestMenuItemsPublic:
    """Public menu items API tests (no auth required)"""
    
    def test_get_all_menu_items(self):
        """GET /api/menu/items returns all 10 seeded items"""
        response = requests.get(f"{BASE_URL}/api/menu/items")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "items" in data, "Response should have 'items' key"
        assert "count" in data, "Response should have 'count' key"
        assert data["count"] == 10, f"Expected 10 items, got {data['count']}"
        print(f"✓ GET /api/menu/items returns {data['count']} items")
    
    def test_get_menu_items_by_category_starters(self):
        """GET /api/menu/items?category=starters returns only starters"""
        response = requests.get(f"{BASE_URL}/api/menu/items?category=starters")
        assert response.status_code == 200
        data = response.json()
        items = data.get("items", [])
        assert len(items) > 0, "Should have at least one starter"
        for item in items:
            assert item["category"] == "starters", f"Item {item['name']} has category {item['category']}, expected starters"
        print(f"✓ GET /api/menu/items?category=starters returns {len(items)} starters")
    
    def test_get_menu_items_by_category_mains(self):
        """GET /api/menu/items?category=mains returns only mains"""
        response = requests.get(f"{BASE_URL}/api/menu/items?category=mains")
        assert response.status_code == 200
        data = response.json()
        items = data.get("items", [])
        assert len(items) > 0, "Should have at least one main"
        for item in items:
            assert item["category"] == "mains", f"Item {item['name']} has category {item['category']}, expected mains"
        print(f"✓ GET /api/menu/items?category=mains returns {len(items)} mains")
    
    def test_get_menu_items_by_category_drinks(self):
        """GET /api/menu/items?category=drinks returns only drinks"""
        response = requests.get(f"{BASE_URL}/api/menu/items?category=drinks")
        assert response.status_code == 200
        data = response.json()
        items = data.get("items", [])
        assert len(items) > 0, "Should have at least one drink"
        for item in items:
            assert item["category"] == "drinks"
        print(f"✓ GET /api/menu/items?category=drinks returns {len(items)} drinks")
    
    def test_get_menu_items_by_category_desserts(self):
        """GET /api/menu/items?category=desserts returns only desserts"""
        response = requests.get(f"{BASE_URL}/api/menu/items?category=desserts")
        assert response.status_code == 200
        data = response.json()
        items = data.get("items", [])
        assert len(items) > 0, "Should have at least one dessert"
        for item in items:
            assert item["category"] == "desserts"
        print(f"✓ GET /api/menu/items?category=desserts returns {len(items)} desserts")
    
    def test_get_single_menu_item(self):
        """GET /api/menu/items/:id returns single item with all fields"""
        response = requests.get(f"{BASE_URL}/api/menu/items/item-006")
        assert response.status_code == 200
        item = response.json()
        assert item["id"] == "item-006"
        assert item["name"] == "Truffle Infused Tagliatelle"
        assert "images" in item, "Item should have images array"
        assert len(item["images"]) == 3, f"item-006 should have 3 images, got {len(item['images'])}"
        assert item["status"] == "in_stock"
        print(f"✓ GET /api/menu/items/item-006 returns item with {len(item['images'])} images")
    
    def test_get_sold_out_item(self):
        """GET /api/menu/items/item-007 returns sold out item"""
        response = requests.get(f"{BASE_URL}/api/menu/items/item-007")
        assert response.status_code == 200
        item = response.json()
        assert item["id"] == "item-007"
        assert item["name"] == "Spiced Lamb Kofta"
        assert item["status"] == "sold_out", f"Expected sold_out, got {item['status']}"
        assert item["available"] == False, "Sold out item should have available=False"
        print(f"✓ GET /api/menu/items/item-007 returns sold out item with status={item['status']}")
    
    def test_get_seasonal_item(self):
        """GET /api/menu/items/item-003 returns seasonal item"""
        response = requests.get(f"{BASE_URL}/api/menu/items/item-003")
        assert response.status_code == 200
        item = response.json()
        assert item["id"] == "item-003"
        assert item["name"] == "Earth Harvest Bowl"
        assert item["status"] == "seasonal", f"Expected seasonal, got {item['status']}"
        assert "SEASONAL" in item.get("tags", []), "Seasonal item should have SEASONAL tag"
        print(f"✓ GET /api/menu/items/item-003 returns seasonal item with tags={item['tags']}")
    
    def test_get_nonexistent_item_returns_404(self):
        """GET /api/menu/items/nonexistent returns 404"""
        response = requests.get(f"{BASE_URL}/api/menu/items/nonexistent-item")
        assert response.status_code == 404
        print("✓ GET /api/menu/items/nonexistent returns 404")
    
    def test_get_categories(self):
        """GET /api/menu/categories returns list of categories"""
        response = requests.get(f"{BASE_URL}/api/menu/categories")
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        categories = data["categories"]
        expected = {"starters", "mains", "drinks", "desserts"}
        assert expected.issubset(set(categories)), f"Missing categories. Got: {categories}"
        print(f"✓ GET /api/menu/categories returns {categories}")


def get_admin_token():
    """Helper to get admin access token from cookies"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        return None
    # Extract access_token from Set-Cookie header
    cookies = response.cookies
    access_token = cookies.get("access_token")
    return access_token


class TestAdminAuth:
    """Admin authentication tests"""
    
    def test_admin_login_success(self):
        """Admin can login with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert data["role"] == "admin", f"Expected admin role, got {data['role']}"
        assert data["email"] == ADMIN_EMAIL
        # Check that access_token cookie is set
        assert "access_token" in response.cookies, "access_token cookie should be set"
        print(f"✓ Admin login successful: {data['email']} with role={data['role']}")
    
    def test_admin_me_endpoint(self):
        """GET /api/auth/me returns admin user after login"""
        token = get_admin_token()
        assert token is not None, "Failed to get admin token"
        
        me_resp = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert me_resp.status_code == 200, f"GET /api/auth/me failed: {me_resp.text}"
        data = me_resp.json()
        assert data["role"] == "admin"
        print(f"✓ GET /api/auth/me returns admin user: {data['email']}")


class TestAdminMenuCRUD:
    """Admin menu CRUD operations (requires auth)"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin access token"""
        token = get_admin_token()
        if not token:
            pytest.skip("Admin login failed")
        return token
    
    @pytest.fixture
    def admin_headers(self, admin_token):
        """Headers with admin auth"""
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_create_menu_item_requires_auth(self):
        """POST /api/admin/menu/items requires admin auth"""
        response = requests.post(f"{BASE_URL}/api/admin/menu/items", json={
            "name": "Test Item",
            "price": 10.00
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ POST /api/admin/menu/items returns 401/403 without auth")
    
    def test_create_menu_item_success(self, admin_headers):
        """Admin can create a new menu item"""
        payload = {
            "name": "TEST_New Dish",
            "description": "A test dish for testing",
            "price": 25.99,
            "category": "mains",
            "status": "in_stock",
            "tags": ["TEST"],
            "images": ["https://example.com/test.jpg"]
        }
        response = requests.post(f"{BASE_URL}/api/admin/menu/items", json=payload, headers=admin_headers)
        assert response.status_code == 200, f"Create failed: {response.text}"
        item = response.json()
        assert item["name"] == "TEST_New Dish"
        assert item["price"] == 25.99
        assert item["category"] == "mains"
        assert item["status"] == "in_stock"
        assert "id" in item
        print(f"✓ Created item: {item['name']} with id={item['id']}")
        
        # Verify persistence with GET
        get_resp = requests.get(f"{BASE_URL}/api/menu/items/{item['id']}")
        assert get_resp.status_code == 200
        fetched = get_resp.json()
        assert fetched["name"] == "TEST_New Dish"
        print(f"✓ Verified item persisted via GET")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/menu/items/{item['id']}", headers=admin_headers)
    
    def test_update_menu_item(self, admin_headers):
        """Admin can update an existing menu item"""
        # First create an item
        create_resp = requests.post(f"{BASE_URL}/api/admin/menu/items", json={
            "name": "TEST_Update Item",
            "price": 15.00,
            "category": "starters"
        }, headers=admin_headers)
        assert create_resp.status_code == 200
        item_id = create_resp.json()["id"]
        
        # Update the item
        update_resp = requests.put(f"{BASE_URL}/api/admin/menu/items/{item_id}", json={
            "name": "TEST_Updated Item",
            "price": 20.00,
            "description": "Updated description"
        }, headers=admin_headers)
        assert update_resp.status_code == 200
        updated = update_resp.json()
        assert updated["name"] == "TEST_Updated Item"
        assert updated["price"] == 20.00
        assert updated["description"] == "Updated description"
        print(f"✓ Updated item: {updated['name']}")
        
        # Verify persistence
        get_resp = requests.get(f"{BASE_URL}/api/menu/items/{item_id}")
        assert get_resp.status_code == 200
        fetched = get_resp.json()
        assert fetched["name"] == "TEST_Updated Item"
        print(f"✓ Verified update persisted via GET")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/menu/items/{item_id}", headers=admin_headers)
    
    def test_delete_menu_item(self, admin_headers):
        """Admin can delete a menu item"""
        # First create an item
        create_resp = requests.post(f"{BASE_URL}/api/admin/menu/items", json={
            "name": "TEST_Delete Item",
            "price": 10.00,
            "category": "desserts"
        }, headers=admin_headers)
        assert create_resp.status_code == 200
        item_id = create_resp.json()["id"]
        
        # Delete the item
        delete_resp = requests.delete(f"{BASE_URL}/api/admin/menu/items/{item_id}", headers=admin_headers)
        assert delete_resp.status_code == 200
        print(f"✓ Deleted item with id={item_id}")
        
        # Verify deletion
        get_resp = requests.get(f"{BASE_URL}/api/menu/items/{item_id}")
        assert get_resp.status_code == 404
        print(f"✓ Verified item deleted (GET returns 404)")
    
    def test_toggle_item_availability(self, admin_headers):
        """Admin can toggle item availability via PATCH"""
        # Get current status of item-001
        get_resp = requests.get(f"{BASE_URL}/api/menu/items/item-001")
        assert get_resp.status_code == 200
        original_status = get_resp.json()["status"]
        
        # Toggle
        toggle_resp = requests.patch(f"{BASE_URL}/api/admin/menu/items/item-001/toggle", headers=admin_headers)
        assert toggle_resp.status_code == 200
        toggled = toggle_resp.json()
        expected_status = "sold_out" if original_status == "in_stock" else "in_stock"
        assert toggled["status"] == expected_status, f"Expected {expected_status}, got {toggled['status']}"
        print(f"✓ Toggled item-001 from {original_status} to {toggled['status']}")
        
        # Toggle back to restore original state
        requests.patch(f"{BASE_URL}/api/admin/menu/items/item-001/toggle", headers=admin_headers)
        print(f"✓ Restored item-001 to original status")
    
    def test_toggle_requires_admin(self):
        """PATCH /api/admin/menu/items/:id/toggle requires admin auth"""
        response = requests.patch(f"{BASE_URL}/api/admin/menu/items/item-001/toggle")
        assert response.status_code in [401, 403]
        print("✓ PATCH toggle returns 401/403 without auth")
    
    def test_delete_requires_admin(self):
        """DELETE /api/admin/menu/items/:id requires admin auth"""
        response = requests.delete(f"{BASE_URL}/api/admin/menu/items/item-001")
        assert response.status_code in [401, 403]
        print("✓ DELETE returns 401/403 without auth")


class TestAdminDashboard:
    """Admin dashboard endpoint tests"""
    
    def test_admin_dashboard_requires_auth(self):
        """GET /api/admin/dashboard requires admin auth"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard")
        assert response.status_code in [401, 403]
        print("✓ GET /api/admin/dashboard returns 401/403 without auth")
    
    def test_admin_dashboard_with_auth(self):
        """GET /api/admin/dashboard returns stats for admin"""
        token = get_admin_token()
        assert token is not None, "Failed to get admin token"
        
        dashboard_resp = requests.get(f"{BASE_URL}/api/admin/dashboard", headers={
            "Authorization": f"Bearer {token}"
        })
        assert dashboard_resp.status_code == 200, f"Dashboard failed: {dashboard_resp.text}"
        data = dashboard_resp.json()
        assert "menu_items" in data
        assert data["menu_items"] >= 10, f"Expected at least 10 menu items, got {data['menu_items']}"
        print(f"✓ GET /api/admin/dashboard returns stats: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
