"""
Phase 7: Product Variants Backend Tests
Tests for variant functionality on menu items including:
- GET /api/menu/items/:id returns variants array
- PUT /api/admin/menu/items/:id updates variants
- Variant structure: id, name, price, stock, status, image
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestVariantsBackend:
    """Test variant-related backend APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_admin_cookies(self):
        """Login as admin and return cookies"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@culinaryeditorial.com",
            "password": "Admin123!"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.cookies
    
    # ─── Test item-001 (Heritage Duck Breast) with 3 variants ───
    def test_get_item_001_has_variants(self):
        """GET /api/menu/items/item-001 returns item with 3 variants"""
        response = self.session.get(f"{BASE_URL}/api/menu/items/item-001")
        assert response.status_code == 200, f"Failed to get item-001: {response.text}"
        
        data = response.json()
        assert data["id"] == "item-001"
        assert data["name"] == "Heritage Duck Breast"
        assert "variants" in data, "Item should have variants field"
        
        variants = data["variants"]
        assert len(variants) == 3, f"Expected 3 variants, got {len(variants)}"
        
        # Check variant names
        variant_names = [v["name"] for v in variants]
        assert "250g" in variant_names, "Should have 250g variant"
        assert "500g" in variant_names, "Should have 500g variant"
        assert "1kg" in variant_names, "Should have 1kg variant"
        
    def test_item_001_variant_structure(self):
        """Verify variant structure has all required fields"""
        response = self.session.get(f"{BASE_URL}/api/menu/items/item-001")
        data = response.json()
        
        for variant in data["variants"]:
            assert "id" in variant, "Variant should have id"
            assert "name" in variant, "Variant should have name"
            assert "price" in variant, "Variant should have price"
            assert "stock" in variant, "Variant should have stock"
            assert "status" in variant, "Variant should have status"
            assert "image" in variant, "Variant should have image field"
            
    def test_item_001_variant_prices(self):
        """Verify variant prices for item-001"""
        response = self.session.get(f"{BASE_URL}/api/menu/items/item-001")
        data = response.json()
        
        variants = {v["name"]: v for v in data["variants"]}
        
        assert variants["250g"]["price"] == 42.00, "250g should be $42.00"
        assert variants["500g"]["price"] == 72.00, "500g should be $72.00"
        assert variants["1kg"]["price"] == 130.00, "1kg should be $130.00"
        
    def test_item_001_variant_stock_status(self):
        """Verify variant stock and status for item-001"""
        response = self.session.get(f"{BASE_URL}/api/menu/items/item-001")
        data = response.json()
        
        variants = {v["name"]: v for v in data["variants"]}
        
        # 250g: in stock with 15 left
        assert variants["250g"]["stock"] == 15, "250g should have 15 stock"
        assert variants["250g"]["status"] == "in_stock", "250g should be in_stock"
        
        # 500g: in stock with 8 left
        assert variants["500g"]["stock"] == 8, "500g should have 8 stock"
        assert variants["500g"]["status"] == "in_stock", "500g should be in_stock"
        
        # 1kg: sold out
        assert variants["1kg"]["stock"] == 0, "1kg should have 0 stock"
        assert variants["1kg"]["status"] == "sold_out", "1kg should be sold_out"
        
    # ─── Test item-005 (Hazelnut Ganache Tart) with 4 variants ───
    def test_get_item_005_has_variants(self):
        """GET /api/menu/items/item-005 returns item with 4 variants"""
        response = self.session.get(f"{BASE_URL}/api/menu/items/item-005")
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "Hazelnut Ganache Tart"
        
        variants = data["variants"]
        assert len(variants) == 4, f"Expected 4 variants, got {len(variants)}"
        
        variant_names = [v["name"] for v in variants]
        assert "Single" in variant_names
        assert "6-Pack" in variant_names
        assert "12-Pack" in variant_names
        assert "Case (24)" in variant_names
        
    def test_item_005_case_sold_out(self):
        """Verify Case (24) variant is sold out"""
        response = self.session.get(f"{BASE_URL}/api/menu/items/item-005")
        data = response.json()
        
        case_variant = next((v for v in data["variants"] if v["name"] == "Case (24)"), None)
        assert case_variant is not None, "Should have Case (24) variant"
        assert case_variant["status"] == "sold_out", "Case (24) should be sold_out"
        assert case_variant["stock"] == 0, "Case (24) should have 0 stock"
        
    # ─── Test item-010 (Reserve Cold Brew) with 3 size variants ───
    def test_get_item_010_has_variants(self):
        """GET /api/menu/items/item-010 returns item with 3 size variants"""
        response = self.session.get(f"{BASE_URL}/api/menu/items/item-010")
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "Reserve Cold Brew"
        
        variants = data["variants"]
        assert len(variants) == 3, f"Expected 3 variants, got {len(variants)}"
        
        variant_names = [v["name"] for v in variants]
        assert "Small (250ml)" in variant_names
        assert "Medium (500ml)" in variant_names
        assert "Large (750ml)" in variant_names
        
    def test_item_010_variant_prices(self):
        """Verify variant prices for item-010"""
        response = self.session.get(f"{BASE_URL}/api/menu/items/item-010")
        data = response.json()
        
        variants = {v["name"]: v for v in data["variants"]}
        
        assert variants["Small (250ml)"]["price"] == 8.00
        assert variants["Medium (500ml)"]["price"] == 12.00
        assert variants["Large (750ml)"]["price"] == 16.00
        
    # ─── Test item-002 (no variants) ───
    def test_item_002_no_variants(self):
        """GET /api/menu/items/item-002 returns item without variants"""
        response = self.session.get(f"{BASE_URL}/api/menu/items/item-002")
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "Heirloom Burrata"
        
        # Should have empty variants array or no variants field
        variants = data.get("variants", [])
        assert len(variants) == 0, f"item-002 should have no variants, got {len(variants)}"
        
    # ─── Test item-006 (Truffle Tagliatelle) with 2 variants ───
    def test_item_006_has_variants(self):
        """GET /api/menu/items/item-006 returns item with 2 variants"""
        response = self.session.get(f"{BASE_URL}/api/menu/items/item-006")
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "Truffle Infused Tagliatelle"
        
        variants = data["variants"]
        assert len(variants) == 2, f"Expected 2 variants, got {len(variants)}"
        
        variant_names = [v["name"] for v in variants]
        assert "Regular (200g)" in variant_names
        assert "Large (350g)" in variant_names
        
    # ─── Admin: Update variants ───
    def test_admin_update_variants(self):
        """PUT /api/admin/menu/items/:id with variants array updates variants"""
        cookies = self.get_admin_cookies()
        
        # First get current item
        response = self.session.get(f"{BASE_URL}/api/menu/items/item-001")
        original_data = response.json()
        original_variants = original_data.get("variants", [])
        
        # Update with modified variants (add a test variant)
        test_variants = original_variants + [{
            "id": "",
            "name": "TEST_2kg",
            "price": 200.00,
            "stock": 5,
            "status": "in_stock",
            "image": ""
        }]
        
        response = self.session.put(
            f"{BASE_URL}/api/admin/menu/items/item-001",
            json={"variants": test_variants},
            cookies=cookies
        )
        assert response.status_code == 200, f"Failed to update variants: {response.text}"
        
        updated_data = response.json()
        assert len(updated_data["variants"]) == len(original_variants) + 1
        
        # Verify test variant was added
        test_variant = next((v for v in updated_data["variants"] if v["name"] == "TEST_2kg"), None)
        assert test_variant is not None, "TEST_2kg variant should exist"
        assert test_variant["price"] == 200.00
        assert test_variant["stock"] == 5
        assert test_variant["id"] != "", "Variant should have auto-generated ID"
        
        # Cleanup: restore original variants
        response = self.session.put(
            f"{BASE_URL}/api/admin/menu/items/item-001",
            json={"variants": original_variants},
            cookies=cookies
        )
        assert response.status_code == 200
        
    def test_admin_update_variants_requires_auth(self):
        """PUT /api/admin/menu/items/:id requires admin auth"""
        response = self.session.put(
            f"{BASE_URL}/api/admin/menu/items/item-001",
            json={"variants": []}
        )
        assert response.status_code == 401, "Should require authentication"
        
    def test_admin_delete_variant(self):
        """Admin can delete a variant by updating with filtered array"""
        cookies = self.get_admin_cookies()
        
        # Get current item
        response = self.session.get(f"{BASE_URL}/api/menu/items/item-001")
        original_data = response.json()
        original_variants = original_data.get("variants", [])
        
        # Add a test variant first
        test_variants = original_variants + [{
            "id": "",
            "name": "TEST_DELETE_ME",
            "price": 999.00,
            "stock": 1,
            "status": "in_stock",
            "image": ""
        }]
        
        response = self.session.put(
            f"{BASE_URL}/api/admin/menu/items/item-001",
            json={"variants": test_variants},
            cookies=cookies
        )
        assert response.status_code == 200
        
        # Now delete by filtering out the test variant
        updated_data = response.json()
        filtered_variants = [v for v in updated_data["variants"] if v["name"] != "TEST_DELETE_ME"]
        
        response = self.session.put(
            f"{BASE_URL}/api/admin/menu/items/item-001",
            json={"variants": filtered_variants},
            cookies=cookies
        )
        assert response.status_code == 200
        
        final_data = response.json()
        test_variant = next((v for v in final_data["variants"] if v["name"] == "TEST_DELETE_ME"), None)
        assert test_variant is None, "TEST_DELETE_ME variant should be deleted"
        
    # ─── Test all items endpoint returns variants ───
    def test_get_all_items_includes_variants(self):
        """GET /api/menu/items returns items with their variants"""
        response = self.session.get(f"{BASE_URL}/api/menu/items")
        assert response.status_code == 200
        
        data = response.json()
        items = data["items"]
        
        # Find item-001 and verify it has variants
        item_001 = next((i for i in items if i["id"] == "item-001"), None)
        assert item_001 is not None
        assert "variants" in item_001
        assert len(item_001["variants"]) == 3


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
