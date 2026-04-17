"""
Test suite for Phase 6: Modifiers, Add-Ons & Customization
Tests modifier group CRUD endpoints and item-modifier linking
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestModifierEndpoints:
    """Test modifier group public endpoints"""
    
    def test_get_all_modifiers(self):
        """GET /api/modifiers returns 4 seeded modifier groups"""
        response = requests.get(f"{BASE_URL}/api/modifiers", allow_redirects=True)
        assert response.status_code == 200
        data = response.json()
        assert "groups" in data
        assert "count" in data
        assert data["count"] == 4
        
        # Verify seeded groups exist
        group_names = [g["name"] for g in data["groups"]]
        assert "Size" in group_names
        assert "Add-Ons" in group_names
        assert "Temperature" in group_names
        assert "Protein Choice" in group_names
    
    def test_modifier_group_structure(self):
        """Verify modifier group has correct structure"""
        response = requests.get(f"{BASE_URL}/api/modifiers", allow_redirects=True)
        assert response.status_code == 200
        data = response.json()
        
        # Find Size group (required)
        size_group = next((g for g in data["groups"] if g["name"] == "Size"), None)
        assert size_group is not None
        assert size_group["type"] == "required"
        assert size_group["min_selections"] == 1
        assert size_group["max_selections"] == 1
        assert len(size_group["options"]) == 3
        
        # Verify options structure
        option_names = [o["name"] for o in size_group["options"]]
        assert "Small" in option_names
        assert "Medium" in option_names
        assert "Large" in option_names
        
        # Verify price adjustments
        small = next(o for o in size_group["options"] if o["name"] == "Small")
        large = next(o for o in size_group["options"] if o["name"] == "Large")
        assert small["price_adjustment"] == 0
        assert large["price_adjustment"] == 6
    
    def test_get_item_modifiers_item_001(self):
        """GET /api/menu/items/item-001/modifiers returns linked modifier groups"""
        response = requests.get(f"{BASE_URL}/api/menu/items/item-001/modifiers", allow_redirects=True)
        assert response.status_code == 200
        data = response.json()
        assert "groups" in data
        
        # item-001 (Heritage Duck Breast - mains) should have Size, Add-Ons, Protein Choice
        group_names = [g["name"] for g in data["groups"]]
        assert "Size" in group_names
        assert "Add-Ons" in group_names
        assert "Protein Choice" in group_names
        # Temperature is only for drinks
        assert "Temperature" not in group_names
    
    def test_get_item_modifiers_item_008(self):
        """GET /api/menu/items/item-008/modifiers returns drink-specific modifiers"""
        response = requests.get(f"{BASE_URL}/api/menu/items/item-008/modifiers", allow_redirects=True)
        assert response.status_code == 200
        data = response.json()
        
        # item-008 (Elderflower Spritz - drinks) should have Size, Add-Ons, Temperature
        group_names = [g["name"] for g in data["groups"]]
        assert "Size" in group_names
        assert "Add-Ons" in group_names
        assert "Temperature" in group_names
        # Protein Choice is only for mains
        assert "Protein Choice" not in group_names
    
    def test_addons_group_structure(self):
        """Verify Add-Ons group is optional with correct options"""
        response = requests.get(f"{BASE_URL}/api/modifiers", allow_redirects=True)
        data = response.json()
        
        addons = next((g for g in data["groups"] if g["name"] == "Add-Ons"), None)
        assert addons is not None
        assert addons["type"] == "optional"
        assert addons["min_selections"] == 0
        assert addons["max_selections"] == 5
        
        # Verify options
        option_names = [o["name"] for o in addons["options"]]
        assert "Extra Cheese" in option_names
        assert "Extra Shot" in option_names
        assert "Truffle Oil Drizzle" in option_names
        assert "Avocado" in option_names
        
        # Verify prices
        cheese = next(o for o in addons["options"] if o["name"] == "Extra Cheese")
        assert cheese["price_adjustment"] == 1.5
    
    def test_temperature_group_structure(self):
        """Verify Temperature group is required for drinks"""
        response = requests.get(f"{BASE_URL}/api/modifiers", allow_redirects=True)
        data = response.json()
        
        temp = next((g for g in data["groups"] if g["name"] == "Temperature"), None)
        assert temp is not None
        assert temp["type"] == "required"
        assert temp["min_selections"] == 1
        assert temp["max_selections"] == 1
        
        # Verify only linked to drinks
        assert "item-008" in temp["linked_item_ids"]  # Elderflower Spritz
        assert "item-010" in temp["linked_item_ids"]  # Reserve Cold Brew
        assert "item-001" not in temp["linked_item_ids"]  # Heritage Duck Breast


class TestAdminModifierEndpoints:
    """Test admin modifier CRUD endpoints (requires authentication)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        self.session = requests.Session()
        login_resp = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@culinaryeditorial.com", "password": "Admin123!"},
            allow_redirects=True
        )
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
        self.admin_user = login_resp.json()
        yield
        # Cleanup: logout
        self.session.post(f"{BASE_URL}/api/auth/logout", allow_redirects=True)
    
    def test_create_modifier_group(self):
        """POST /api/admin/modifiers creates a new modifier group"""
        payload = {
            "name": "TEST_Spice Level",
            "type": "optional",
            "min_selections": 0,
            "max_selections": 1,
            "options": [
                {"name": "Mild", "price_adjustment": 0},
                {"name": "Medium", "price_adjustment": 0},
                {"name": "Hot", "price_adjustment": 0.5}
            ],
            "linked_item_ids": ["item-001", "item-004"]
        }
        response = self.session.post(
            f"{BASE_URL}/api/admin/modifiers",
            json=payload,
            allow_redirects=True
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["name"] == "TEST_Spice Level"
        assert data["type"] == "optional"
        assert len(data["options"]) == 3
        assert "id" in data
        
        # Cleanup: delete the created group
        self.session.delete(f"{BASE_URL}/api/admin/modifiers/{data['id']}", allow_redirects=True)
    
    def test_update_modifier_group(self):
        """PUT /api/admin/modifiers/:id updates a modifier group"""
        # First create a group
        create_payload = {
            "name": "TEST_Update Group",
            "type": "optional",
            "min_selections": 0,
            "max_selections": 2,
            "options": [{"name": "Option A", "price_adjustment": 1}],
            "linked_item_ids": []
        }
        create_resp = self.session.post(
            f"{BASE_URL}/api/admin/modifiers",
            json=create_payload,
            allow_redirects=True
        )
        assert create_resp.status_code == 200
        group_id = create_resp.json()["id"]
        
        # Update the group
        update_payload = {
            "name": "TEST_Updated Group Name",
            "type": "required",
            "min_selections": 1,
            "max_selections": 1,
            "options": [
                {"name": "Option A Updated", "price_adjustment": 2},
                {"name": "Option B New", "price_adjustment": 3}
            ]
        }
        update_resp = self.session.put(
            f"{BASE_URL}/api/admin/modifiers/{group_id}",
            json=update_payload,
            allow_redirects=True
        )
        assert update_resp.status_code == 200
        updated = update_resp.json()
        
        assert updated["name"] == "TEST_Updated Group Name"
        assert updated["type"] == "required"
        assert updated["min_selections"] == 1
        assert len(updated["options"]) == 2
        
        # Verify persistence with GET
        get_resp = requests.get(f"{BASE_URL}/api/modifiers", allow_redirects=True)
        all_groups = get_resp.json()["groups"]
        found = next((g for g in all_groups if g["id"] == group_id), None)
        assert found is not None
        assert found["name"] == "TEST_Updated Group Name"
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/modifiers/{group_id}", allow_redirects=True)
    
    def test_delete_modifier_group(self):
        """DELETE /api/admin/modifiers/:id deletes a modifier group"""
        # Create a group to delete
        create_payload = {
            "name": "TEST_Delete Group",
            "type": "optional",
            "min_selections": 0,
            "max_selections": 1,
            "options": [{"name": "Delete Option", "price_adjustment": 0}],
            "linked_item_ids": []
        }
        create_resp = self.session.post(
            f"{BASE_URL}/api/admin/modifiers",
            json=create_payload,
            allow_redirects=True
        )
        assert create_resp.status_code == 200
        group_id = create_resp.json()["id"]
        
        # Delete the group
        delete_resp = self.session.delete(
            f"{BASE_URL}/api/admin/modifiers/{group_id}",
            allow_redirects=True
        )
        assert delete_resp.status_code == 200
        
        # Verify deletion
        get_resp = requests.get(f"{BASE_URL}/api/modifiers", allow_redirects=True)
        all_groups = get_resp.json()["groups"]
        found = next((g for g in all_groups if g["id"] == group_id), None)
        assert found is None
    
    def test_admin_endpoints_require_auth(self):
        """Admin modifier endpoints return 401 without authentication"""
        # Use a new session without auth
        unauth_session = requests.Session()
        
        # POST should fail
        post_resp = unauth_session.post(
            f"{BASE_URL}/api/admin/modifiers",
            json={"name": "Test", "type": "optional", "options": []},
            allow_redirects=True
        )
        assert post_resp.status_code == 401
        
        # PUT should fail
        put_resp = unauth_session.put(
            f"{BASE_URL}/api/admin/modifiers/mod-size",
            json={"name": "Updated"},
            allow_redirects=True
        )
        assert put_resp.status_code == 401
        
        # DELETE should fail
        delete_resp = unauth_session.delete(
            f"{BASE_URL}/api/admin/modifiers/mod-size",
            allow_redirects=True
        )
        assert delete_resp.status_code == 401
    
    def test_delete_nonexistent_modifier_returns_404(self):
        """DELETE /api/admin/modifiers/:id returns 404 for nonexistent group"""
        response = self.session.delete(
            f"{BASE_URL}/api/admin/modifiers/nonexistent-id",
            allow_redirects=True
        )
        assert response.status_code == 404


class TestMenuItemWithModifiers:
    """Test menu item endpoints with modifier data"""
    
    def test_get_menu_item_details(self):
        """GET /api/menu/items/:id returns item details"""
        response = requests.get(f"{BASE_URL}/api/menu/items/item-001", allow_redirects=True)
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == "item-001"
        assert data["name"] == "Heritage Duck Breast"
        assert data["price"] == 42.00
        assert data["category"] == "mains"
    
    def test_item_modifiers_match_category(self):
        """Verify modifiers are correctly linked based on item category"""
        # Get all modifiers
        mod_resp = requests.get(f"{BASE_URL}/api/modifiers", allow_redirects=True)
        all_mods = mod_resp.json()["groups"]
        
        # Get item-001 (mains) modifiers
        item_001_resp = requests.get(f"{BASE_URL}/api/menu/items/item-001/modifiers", allow_redirects=True)
        item_001_mods = item_001_resp.json()["groups"]
        
        # Get item-008 (drinks) modifiers
        item_008_resp = requests.get(f"{BASE_URL}/api/menu/items/item-008/modifiers", allow_redirects=True)
        item_008_mods = item_008_resp.json()["groups"]
        
        # Mains should have Protein Choice but not Temperature
        item_001_names = [g["name"] for g in item_001_mods]
        assert "Protein Choice" in item_001_names
        assert "Temperature" not in item_001_names
        
        # Drinks should have Temperature but not Protein Choice
        item_008_names = [g["name"] for g in item_008_mods]
        assert "Temperature" in item_008_names
        assert "Protein Choice" not in item_008_names


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
