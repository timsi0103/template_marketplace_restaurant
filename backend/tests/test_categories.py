"""
Test suite for Phase 5: Categories & Subcategories API endpoints
Tests category CRUD operations, tree structure, and admin-only access
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@culinaryeditorial.com"
ADMIN_PASSWORD = "Admin123!"


class TestCategoryPublicEndpoints:
    """Public category endpoints - no auth required"""
    
    def test_get_categories_tree(self):
        """GET /api/categories/tree returns 4 top-level categories with nested subcategories"""
        response = requests.get(f"{BASE_URL}/api/categories/tree")
        assert response.status_code == 200
        
        data = response.json()
        assert "categories" in data
        categories = data["categories"]
        
        # Should have 4 top-level categories
        assert len(categories) == 4, f"Expected 4 top-level categories, got {len(categories)}"
        
        # Check category names
        cat_names = [c["name"] for c in categories]
        assert "Starters" in cat_names
        assert "Mains" in cat_names
        assert "Drinks" in cat_names
        assert "Desserts" in cat_names
        
        # Check subcategories are nested
        for cat in categories:
            assert "subcategories" in cat
            if cat["name"] == "Starters":
                assert len(cat["subcategories"]) == 3  # Soups, Salads, Small Plates
            elif cat["name"] == "Mains":
                assert len(cat["subcategories"]) == 3  # Meat, Seafood, Vegetarian
            elif cat["name"] == "Drinks":
                assert len(cat["subcategories"]) == 4  # Red Wine, White Wine, Sparkling, Non-Alcoholic
            elif cat["name"] == "Desserts":
                assert len(cat["subcategories"]) == 2  # Pastries, Chocolate
        
        print(f"SUCCESS: GET /api/categories/tree returns {len(categories)} categories with subcategories")
    
    def test_get_all_categories(self):
        """GET /api/categories returns all categories (flat list)"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200
        
        data = response.json()
        assert "categories" in data
        categories = data["categories"]
        
        # Should have 16 total (4 top-level + 12 subcategories)
        assert len(categories) == 16, f"Expected 16 categories, got {len(categories)}"
        print(f"SUCCESS: GET /api/categories returns {len(categories)} total categories")
    
    def test_get_category_by_slug_drinks(self):
        """GET /api/categories/drinks returns Drinks category with subcategories"""
        response = requests.get(f"{BASE_URL}/api/categories/drinks")
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "Drinks"
        assert data["slug"] == "drinks"
        assert "description" in data
        assert "image" in data
        assert "subcategories" in data
        
        # Check subcategories
        sub_names = [s["name"] for s in data["subcategories"]]
        assert "Red Wine" in sub_names
        assert "White Wine" in sub_names
        assert "Sparkling" in sub_names
        assert "Non-Alcoholic" in sub_names
        
        print(f"SUCCESS: GET /api/categories/drinks returns category with {len(data['subcategories'])} subcategories")
    
    def test_get_category_by_slug_mains(self):
        """GET /api/categories/mains returns Mains category with subcategories"""
        response = requests.get(f"{BASE_URL}/api/categories/mains")
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "Mains"
        assert data["slug"] == "mains"
        assert "subcategories" in data
        
        sub_names = [s["name"] for s in data["subcategories"]]
        assert "Meat" in sub_names
        assert "Seafood" in sub_names
        assert "Vegetarian" in sub_names
        
        print(f"SUCCESS: GET /api/categories/mains returns category with {len(data['subcategories'])} subcategories")
    
    def test_get_category_not_found(self):
        """GET /api/categories/nonexistent returns 404"""
        response = requests.get(f"{BASE_URL}/api/categories/nonexistent-category")
        assert response.status_code == 404
        print("SUCCESS: GET /api/categories/nonexistent returns 404")


class TestCategoryAdminEndpoints:
    """Admin-only category endpoints - require authentication"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, f"Admin login failed: {login_response.text}"
        self.admin_user = login_response.json()
        
        # Extract access_token from cookies and set as Authorization header
        access_token = login_response.cookies.get("access_token")
        if access_token:
            self.session.headers.update({"Authorization": f"Bearer {access_token}"})
        
        print(f"Logged in as admin: {self.admin_user['email']}")
    
    def test_create_category_top_level(self):
        """POST /api/admin/categories creates a new top-level category"""
        payload = {
            "name": "TEST_Specials",
            "slug": "test-specials",
            "description": "Test special items",
            "image": "https://example.com/specials.jpg",
            "parent_id": None,
            "visible": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/categories", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "TEST_Specials"
        assert data["slug"] == "test-specials"
        assert data["description"] == "Test special items"
        assert data["parent_id"] is None
        assert data["visible"] == True
        assert "id" in data
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/categories/{data['id']}")
        print(f"SUCCESS: POST /api/admin/categories creates top-level category")
    
    def test_create_subcategory(self):
        """POST /api/admin/categories creates a subcategory with parent"""
        # First get a parent category ID
        cats_response = self.session.get(f"{BASE_URL}/api/categories")
        cats = cats_response.json()["categories"]
        parent = next(c for c in cats if c["name"] == "Starters")
        
        payload = {
            "name": "TEST_Appetizers",
            "slug": "test-appetizers",
            "description": "Test appetizers subcategory",
            "parent_id": parent["id"],
            "visible": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/categories", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "TEST_Appetizers"
        assert data["parent_id"] == parent["id"]
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/categories/{data['id']}")
        print(f"SUCCESS: POST /api/admin/categories creates subcategory with parent")
    
    def test_update_category(self):
        """PUT /api/admin/categories/:id updates a category"""
        # Create a test category first
        create_payload = {"name": "TEST_ToUpdate", "slug": "test-to-update"}
        create_response = self.session.post(f"{BASE_URL}/api/admin/categories", json=create_payload)
        created = create_response.json()
        cat_id = created["id"]
        
        # Update it
        update_payload = {
            "name": "TEST_Updated",
            "description": "Updated description"
        }
        response = self.session.put(f"{BASE_URL}/api/admin/categories/{cat_id}", json=update_payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "TEST_Updated"
        assert data["description"] == "Updated description"
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/categories/{cat_id}")
        print(f"SUCCESS: PUT /api/admin/categories/:id updates category")
    
    def test_toggle_category_visibility(self):
        """PATCH /api/admin/categories/:id/toggle toggles visibility"""
        # Create a test category
        create_payload = {"name": "TEST_ToToggle", "slug": "test-to-toggle", "visible": True}
        create_response = self.session.post(f"{BASE_URL}/api/admin/categories", json=create_payload)
        created = create_response.json()
        cat_id = created["id"]
        
        # Toggle visibility (should become False)
        response = self.session.patch(f"{BASE_URL}/api/admin/categories/{cat_id}/toggle")
        assert response.status_code == 200
        
        data = response.json()
        assert data["visible"] == False
        
        # Toggle again (should become True)
        response2 = self.session.patch(f"{BASE_URL}/api/admin/categories/{cat_id}/toggle")
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["visible"] == True
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/categories/{cat_id}")
        print(f"SUCCESS: PATCH /api/admin/categories/:id/toggle toggles visibility")
    
    def test_delete_category(self):
        """DELETE /api/admin/categories/:id deletes category"""
        # Create a test category
        create_payload = {"name": "TEST_ToDelete", "slug": "test-to-delete"}
        create_response = self.session.post(f"{BASE_URL}/api/admin/categories", json=create_payload)
        created = create_response.json()
        cat_id = created["id"]
        
        # Delete it
        response = self.session.delete(f"{BASE_URL}/api/admin/categories/{cat_id}")
        assert response.status_code == 200
        
        # Verify it's gone
        get_response = requests.get(f"{BASE_URL}/api/categories/{created['slug']}")
        assert get_response.status_code == 404
        
        print(f"SUCCESS: DELETE /api/admin/categories/:id deletes category")
    
    def test_delete_category_with_subcategories(self):
        """DELETE /api/admin/categories/:id also deletes subcategories"""
        # Create parent
        parent_payload = {"name": "TEST_Parent", "slug": "test-parent"}
        parent_response = self.session.post(f"{BASE_URL}/api/admin/categories", json=parent_payload)
        parent = parent_response.json()
        
        # Create subcategory
        sub_payload = {"name": "TEST_Child", "slug": "test-child", "parent_id": parent["id"]}
        sub_response = self.session.post(f"{BASE_URL}/api/admin/categories", json=sub_payload)
        sub = sub_response.json()
        
        # Delete parent (should also delete child)
        response = self.session.delete(f"{BASE_URL}/api/admin/categories/{parent['id']}")
        assert response.status_code == 200
        
        # Verify child is also gone
        get_response = requests.get(f"{BASE_URL}/api/categories/{sub['slug']}")
        assert get_response.status_code == 404
        
        print(f"SUCCESS: DELETE /api/admin/categories/:id deletes subcategories too")
    
    def test_reorder_categories(self):
        """POST /api/admin/categories/reorder updates display_order"""
        # Get current categories
        cats_response = self.session.get(f"{BASE_URL}/api/categories")
        cats = cats_response.json()["categories"]
        top_level = [c for c in cats if c["parent_id"] is None]
        
        # Reorder (swap first two)
        reorder_items = [
            {"id": top_level[0]["id"], "display_order": 1},
            {"id": top_level[1]["id"], "display_order": 0}
        ]
        
        response = self.session.post(
            f"{BASE_URL}/api/admin/categories/reorder",
            json={"items": reorder_items}
        )
        assert response.status_code == 200
        
        # Restore original order
        restore_items = [
            {"id": top_level[0]["id"], "display_order": 0},
            {"id": top_level[1]["id"], "display_order": 1}
        ]
        self.session.post(f"{BASE_URL}/api/admin/categories/reorder", json={"items": restore_items})
        
        print(f"SUCCESS: POST /api/admin/categories/reorder updates display_order")


class TestCategoryAuthProtection:
    """Test that admin endpoints require authentication"""
    
    def test_create_category_requires_auth(self):
        """POST /api/admin/categories returns 401 without auth"""
        response = requests.post(
            f"{BASE_URL}/api/admin/categories",
            json={"name": "Unauthorized", "slug": "unauthorized"}
        )
        assert response.status_code == 401
        print("SUCCESS: POST /api/admin/categories requires auth (401)")
    
    def test_update_category_requires_auth(self):
        """PUT /api/admin/categories/:id returns 401 without auth"""
        response = requests.put(
            f"{BASE_URL}/api/admin/categories/cat-starters",
            json={"name": "Unauthorized Update"}
        )
        assert response.status_code == 401
        print("SUCCESS: PUT /api/admin/categories/:id requires auth (401)")
    
    def test_delete_category_requires_auth(self):
        """DELETE /api/admin/categories/:id returns 401 without auth"""
        response = requests.delete(f"{BASE_URL}/api/admin/categories/cat-starters")
        assert response.status_code == 401
        print("SUCCESS: DELETE /api/admin/categories/:id requires auth (401)")
    
    def test_toggle_category_requires_auth(self):
        """PATCH /api/admin/categories/:id/toggle returns 401 without auth"""
        response = requests.patch(f"{BASE_URL}/api/admin/categories/cat-starters/toggle")
        assert response.status_code == 401
        print("SUCCESS: PATCH /api/admin/categories/:id/toggle requires auth (401)")
    
    def test_reorder_categories_requires_auth(self):
        """POST /api/admin/categories/reorder returns 401 without auth"""
        response = requests.post(
            f"{BASE_URL}/api/admin/categories/reorder",
            json={"items": []}
        )
        assert response.status_code == 401
        print("SUCCESS: POST /api/admin/categories/reorder requires auth (401)")


class TestCategoryNonAdminAccess:
    """Test that admin endpoints require admin role"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Register and login as a regular user"""
        self.session = requests.Session()
        
        # Register a test user
        import uuid
        test_email = f"test_user_{uuid.uuid4().hex[:8]}@example.com"
        register_response = self.session.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": test_email, "password": "testpass123", "name": "Test User"}
        )
        if register_response.status_code == 200:
            self.user = register_response.json()
            # Extract access_token from cookies and set as Authorization header
            access_token = register_response.cookies.get("access_token")
            if access_token:
                self.session.headers.update({"Authorization": f"Bearer {access_token}"})
            print(f"Registered test user: {test_email}")
        else:
            pytest.skip("Could not register test user")
    
    def test_create_category_requires_admin_role(self):
        """POST /api/admin/categories returns 403 for non-admin"""
        response = self.session.post(
            f"{BASE_URL}/api/admin/categories",
            json={"name": "Non-Admin", "slug": "non-admin"}
        )
        assert response.status_code == 403
        print("SUCCESS: POST /api/admin/categories requires admin role (403)")
    
    def test_toggle_category_requires_admin_role(self):
        """PATCH /api/admin/categories/:id/toggle returns 403 for non-admin"""
        response = self.session.patch(f"{BASE_URL}/api/admin/categories/cat-starters/toggle")
        assert response.status_code == 403
        print("SUCCESS: PATCH /api/admin/categories/:id/toggle requires admin role (403)")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
