"""
KDS (Kitchen Display System) Backend API Tests
Tests for: /api/admin/kds/settings, /api/admin/kds/board, 
           /api/admin/kds/orders/{id}/items/{idx}, /api/admin/kds/orders/{id}/bump
"""
import pytest
import requests
import os
import subprocess
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "admin@culinaryeditorial.com")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "Admin123!")
def _run_mongosh(script: str):
    """Safely execute a mongosh script using list-form subprocess.run.

    Using shell=True with f-string interpolation would be a command-injection
    vector; passing args as a list prevents shell parsing of the script body.
    """
    return subprocess.run(
        ["mongosh", "--quiet", "--eval", script],
        capture_output=True,
        text=True,
        check=False,
    )


class TestKDSSettingsAuth:
    """Test KDS settings endpoint authentication"""
    
    def test_get_settings_without_auth_returns_401(self):
        """GET /api/admin/kds/settings without auth should return 401"""
        response = requests.get(f"{BASE_URL}/api/admin/kds/settings")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("PASS: GET /api/admin/kds/settings without auth returns 401")
    
    def test_put_settings_without_auth_returns_401(self):
        """PUT /api/admin/kds/settings without auth should return 401"""
        response = requests.put(f"{BASE_URL}/api/admin/kds/settings", json={"audio_enabled": True})
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("PASS: PUT /api/admin/kds/settings without auth returns 401")


class TestKDSSettingsAdmin:
    """Test KDS settings with admin authentication"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin and get session"""
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
        self.admin_user = login_resp.json()
        print(f"Logged in as admin: {self.admin_user.get('email')}")
    
    def test_get_settings_returns_defaults_on_first_call(self):
        """GET /api/admin/kds/settings returns seeded defaults"""
        response = self.session.get(f"{BASE_URL}/api/admin/kds/settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify required fields exist
        assert "audio_enabled" in data, "Missing audio_enabled field"
        assert "default_columns" in data, "Missing default_columns field"
        assert "target_prep_minutes_by_category" in data, "Missing target_prep_minutes_by_category"
        assert "station_routing" in data, "Missing station_routing"
        
        # Verify default values
        assert isinstance(data["audio_enabled"], bool), "audio_enabled should be boolean"
        assert data["default_columns"] in [2, 3, 4], f"default_columns should be 2/3/4, got {data['default_columns']}"
        assert isinstance(data["target_prep_minutes_by_category"], dict), "target_prep_minutes_by_category should be dict"
        assert isinstance(data["station_routing"], dict), "station_routing should be dict"
        
        print(f"PASS: GET /api/admin/kds/settings returns valid settings: columns={data['default_columns']}, audio={data['audio_enabled']}")
    
    def test_put_settings_invalid_columns_returns_400(self):
        """PUT /api/admin/kds/settings with invalid columns (5) returns 400"""
        response = self.session.put(f"{BASE_URL}/api/admin/kds/settings", json={
            "default_columns": 5
        })
        assert response.status_code == 400, f"Expected 400 for invalid columns, got {response.status_code}: {response.text}"
        print("PASS: PUT /api/admin/kds/settings with default_columns=5 returns 400")
    
    def test_put_settings_invalid_columns_1_returns_400(self):
        """PUT /api/admin/kds/settings with invalid columns (1) returns 400"""
        response = self.session.put(f"{BASE_URL}/api/admin/kds/settings", json={
            "default_columns": 1
        })
        assert response.status_code == 400, f"Expected 400 for invalid columns, got {response.status_code}: {response.text}"
        print("PASS: PUT /api/admin/kds/settings with default_columns=1 returns 400")
    
    def test_put_settings_valid_columns_and_audio(self):
        """PUT /api/admin/kds/settings with valid {default_columns: 2, audio_enabled: false} persists"""
        response = self.session.put(f"{BASE_URL}/api/admin/kds/settings", json={
            "default_columns": 2,
            "audio_enabled": False
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["default_columns"] == 2, f"Expected columns=2, got {data['default_columns']}"
        assert data["audio_enabled"] == False, f"Expected audio_enabled=False, got {data['audio_enabled']}"
        
        # Verify persistence with GET
        get_resp = self.session.get(f"{BASE_URL}/api/admin/kds/settings")
        assert get_resp.status_code == 200
        get_data = get_resp.json()
        assert get_data["default_columns"] == 2, "Columns not persisted"
        assert get_data["audio_enabled"] == False, "Audio setting not persisted"
        
        print("PASS: PUT /api/admin/kds/settings with valid columns/audio persists correctly")
    
    def test_put_settings_add_category_to_prep_times(self):
        """PUT /api/admin/kds/settings can add categories to target_prep_minutes_by_category"""
        # First get current settings
        get_resp = self.session.get(f"{BASE_URL}/api/admin/kds/settings")
        current = get_resp.json()
        
        # Add a new category
        new_prep = dict(current.get("target_prep_minutes_by_category", {}))
        new_prep["test_category"] = 12
        
        response = self.session.put(f"{BASE_URL}/api/admin/kds/settings", json={
            "target_prep_minutes_by_category": new_prep
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "test_category" in data["target_prep_minutes_by_category"], "New category not added"
        assert data["target_prep_minutes_by_category"]["test_category"] == 12, "Category prep time incorrect"
        
        print("PASS: Can add categories to target_prep_minutes_by_category")
    
    def test_put_settings_remove_category_from_prep_times(self):
        """PUT /api/admin/kds/settings can remove categories from target_prep_minutes_by_category"""
        # First get current settings
        get_resp = self.session.get(f"{BASE_URL}/api/admin/kds/settings")
        current = get_resp.json()
        
        # Remove test_category if it exists
        new_prep = {k: v for k, v in current.get("target_prep_minutes_by_category", {}).items() if k != "test_category"}
        
        response = self.session.put(f"{BASE_URL}/api/admin/kds/settings", json={
            "target_prep_minutes_by_category": new_prep
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "test_category" not in data["target_prep_minutes_by_category"], "Category not removed"
        
        print("PASS: Can remove categories from target_prep_minutes_by_category")
    
    def test_put_settings_add_station_to_routing(self):
        """PUT /api/admin/kds/settings can add stations to station_routing"""
        # First get current settings
        get_resp = self.session.get(f"{BASE_URL}/api/admin/kds/settings")
        current = get_resp.json()
        
        # Add a new station
        new_routing = dict(current.get("station_routing", {}))
        new_routing["test_station"] = ["mains", "appetizers"]
        
        response = self.session.put(f"{BASE_URL}/api/admin/kds/settings", json={
            "station_routing": new_routing
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "test_station" in data["station_routing"], "New station not added"
        assert "mains" in data["station_routing"]["test_station"], "Station categories incorrect"
        
        print("PASS: Can add stations to station_routing")
    
    def test_put_settings_remove_station_from_routing(self):
        """PUT /api/admin/kds/settings can remove stations from station_routing"""
        # First get current settings
        get_resp = self.session.get(f"{BASE_URL}/api/admin/kds/settings")
        current = get_resp.json()
        
        # Remove test_station if it exists
        new_routing = {k: v for k, v in current.get("station_routing", {}).items() if k != "test_station"}
        
        response = self.session.put(f"{BASE_URL}/api/admin/kds/settings", json={
            "station_routing": new_routing
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "test_station" not in data["station_routing"], "Station not removed"
        
        print("PASS: Can remove stations from station_routing")
    
    def test_put_settings_restore_defaults(self):
        """Restore default settings for other tests"""
        response = self.session.put(f"{BASE_URL}/api/admin/kds/settings", json={
            "default_columns": 3,
            "audio_enabled": True
        })
        assert response.status_code == 200
        print("PASS: Restored default settings (columns=3, audio=True)")


class TestKDSBoardAuth:
    """Test KDS board endpoint authentication"""
    
    def test_get_board_without_auth_returns_401(self):
        """GET /api/admin/kds/board without auth should return 401"""
        response = requests.get(f"{BASE_URL}/api/admin/kds/board")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("PASS: GET /api/admin/kds/board without auth returns 401")


class TestKDSBoard:
    """Test KDS board endpoint with admin authentication"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin and get session"""
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
    
    def test_get_board_returns_structure(self):
        """GET /api/admin/kds/board returns {orders, settings, server_time, count}"""
        response = self.session.get(f"{BASE_URL}/api/admin/kds/board")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "orders" in data, "Missing orders field"
        assert "settings" in data, "Missing settings field"
        assert "server_time" in data, "Missing server_time field"
        assert "count" in data, "Missing count field"
        
        assert isinstance(data["orders"], list), "orders should be a list"
        assert isinstance(data["count"], int), "count should be an integer"
        
        print(f"PASS: GET /api/admin/kds/board returns valid structure with {data['count']} orders")
    
    def test_get_board_with_station_filter(self):
        """GET /api/admin/kds/board?station=grill filters by station categories"""
        response = self.session.get(f"{BASE_URL}/api/admin/kds/board", params={"station": "grill"})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "orders" in data, "Missing orders field"
        
        # If there are orders, verify items have _line_index
        for order in data["orders"]:
            for item in order.get("items", []):
                assert "_line_index" in item, f"Item missing _line_index: {item}"
        
        print(f"PASS: GET /api/admin/kds/board?station=grill returns {data['count']} filtered orders")


class TestKDSItemStatus:
    """Test KDS item status update endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin and get session"""
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
    
    def test_patch_item_status_without_auth_returns_401(self):
        """PATCH /api/admin/kds/orders/{id}/items/{idx} without auth returns 401"""
        response = requests.patch(
            f"{BASE_URL}/api/admin/kds/orders/fake-id/items/0",
            json={"status": "started"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("PASS: PATCH item status without auth returns 401")
    
    def test_patch_item_status_invalid_status_returns_400(self):
        """PATCH with invalid status returns 400"""
        response = self.session.patch(
            f"{BASE_URL}/api/admin/kds/orders/fake-id/items/0",
            json={"status": "invalid_status"}
        )
        assert response.status_code == 400, f"Expected 400 for invalid status, got {response.status_code}: {response.text}"
        print("PASS: PATCH with invalid status returns 400")
    
    def test_patch_item_status_nonexistent_order_returns_404(self):
        """PATCH on non-existent order returns 404"""
        response = self.session.patch(
            f"{BASE_URL}/api/admin/kds/orders/nonexistent-order-id/items/0",
            json={"status": "started"}
        )
        assert response.status_code == 404, f"Expected 404 for non-existent order, got {response.status_code}: {response.text}"
        print("PASS: PATCH on non-existent order returns 404")


class TestKDSBump:
    """Test KDS bump order endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin and get session"""
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
    
    def test_bump_without_auth_returns_401(self):
        """POST /api/admin/kds/orders/{id}/bump without auth returns 401"""
        response = requests.post(f"{BASE_URL}/api/admin/kds/orders/fake-id/bump")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("PASS: POST bump without auth returns 401")
    
    def test_bump_nonexistent_order_returns_404(self):
        """POST bump on non-existent order returns 404"""
        response = self.session.post(f"{BASE_URL}/api/admin/kds/orders/nonexistent-order-id/bump")
        assert response.status_code == 404, f"Expected 404 for non-existent order, got {response.status_code}: {response.text}"
        print("PASS: POST bump on non-existent order returns 404")


class TestKDSIntegration:
    """Integration tests for KDS with real order data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin and get session"""
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
        self.test_order_id = None

    def test_create_test_order_and_verify_on_board(self):
        """Create a test order via MongoDB and verify it appears on board"""
        # Create a test order directly in MongoDB
        order_id = f"kds-test-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
        order_number = f"KDS-TEST-{datetime.now(timezone.utc).strftime('%H%M%S')}"

        mongo_script = f"""
        use('test_database');
        db.orders.insertOne({{
            id: '{order_id}',
            order_number: '{order_number}',
            items: [
                {{
                    item_id: 'item-001',
                    name: 'Test Item',
                    qty: 2,
                    price: 25.00,
                    category: 'mains',
                    kds_status: 'pending',
                    modifiers: [],
                    instructions: 'Test instructions'
                }}
            ],
            fulfillment_type: 'dine_in',
            table_number: '99',
            status: 'preparing',
            payment_status: 'paid',
            contact_email: 'kds-test@example.com',
            total: 50.00,
            accepted_at: new Date(),
            created_at: new Date(),
            subtotal: 50.00,
            tax: 4.38,
            delivery_fee: 0,
            discount: 0,
            tip: 0,
            estimated_minutes: 15
        }});
        print('Order created: {order_id}');
        """

        result = _run_mongosh(mongo_script)
        print(f"MongoDB insert result: {result.stdout} {result.stderr}")
        
        self.test_order_id = order_id
        
        # Verify order appears on board
        response = self.session.get(f"{BASE_URL}/api/admin/kds/board")
        assert response.status_code == 200
        
        data = response.json()
        order_ids = [o["id"] for o in data["orders"]]
        assert order_id in order_ids, f"Test order {order_id} not found on board. Found: {order_ids}"
        
        # Find our order and verify structure
        test_order = next((o for o in data["orders"] if o["id"] == order_id), None)
        assert test_order is not None, "Test order not found"
        assert test_order["order_number"] == order_number
        assert len(test_order["items"]) == 1
        assert test_order["items"][0]["kds_status"] == "pending"
        
        print(f"PASS: Test order {order_number} appears on KDS board")
        
        # Test item status update
        response = self.session.patch(
            f"{BASE_URL}/api/admin/kds/orders/{order_id}/items/0",
            json={"status": "started"}
        )
        assert response.status_code == 200, f"Item status update failed: {response.text}"
        
        updated_order = response.json()
        assert updated_order["items"][0]["kds_status"] == "started", "Item status not updated"
        assert "kds_updated_at" in updated_order["items"][0], "kds_updated_at not set"
        
        print("PASS: Item status updated to 'started'")
        
        # Test bump order (dine_in should go to 'ready')
        response = self.session.post(f"{BASE_URL}/api/admin/kds/orders/{order_id}/bump")
        assert response.status_code == 200, f"Bump failed: {response.text}"
        
        bumped_order = response.json()
        assert bumped_order["status"] == "ready", f"Expected status='ready' after bump, got {bumped_order['status']}"
        assert "bumped_at" in bumped_order, "bumped_at not set"
        
        print("PASS: Order bumped to 'ready' status")
        
        # Verify order no longer on board (status changed)
        response = self.session.get(f"{BASE_URL}/api/admin/kds/board")
        data = response.json()
        order_ids = [o["id"] for o in data["orders"]]
        # Note: 'ready' is still in the board filter, so it might still be there
        # But the status should be 'ready' now
        
        # Cleanup
        cleanup_script = f"""
        use('test_database');
        db.orders.deleteOne({{id: '{order_id}'}});
        print('Cleaned up test order');
        """
        _run_mongosh(cleanup_script)
        print("PASS: Test order cleaned up")
    
    def test_delivery_order_bump_sets_out_for_delivery(self):
        """Bump on delivery order sets status to 'out_for_delivery'"""
        order_id = f"kds-delivery-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
        order_number = f"KDS-DEL-{datetime.now(timezone.utc).strftime('%H%M%S')}"

        mongo_script = f"""
        use('test_database');
        db.orders.insertOne({{
            id: '{order_id}',
            order_number: '{order_number}',
            items: [{{item_id: 'item-001', name: 'Delivery Item', qty: 1, price: 20.00, category: 'mains', kds_status: 'pending'}}],
            fulfillment_type: 'delivery',
            status: 'preparing',
            payment_status: 'paid',
            contact_email: 'delivery-test@example.com',
            total: 24.99,
            accepted_at: new Date(),
            created_at: new Date(),
            address: {{line1: '123 Test St', city: 'Test City'}}
        }});
        """
        _run_mongosh(mongo_script)

        # Bump the delivery order
        response = self.session.post(f"{BASE_URL}/api/admin/kds/orders/{order_id}/bump")
        assert response.status_code == 200, f"Bump failed: {response.text}"
        
        bumped_order = response.json()
        assert bumped_order["status"] == "out_for_delivery", f"Expected 'out_for_delivery', got {bumped_order['status']}"
        
        print("PASS: Delivery order bumped to 'out_for_delivery'")
        
        # Cleanup
        cleanup_script = f"""
        use('test_database');
        db.orders.deleteOne({{id: '{order_id}'}});
        """
        _run_mongosh(cleanup_script)
    
    def test_station_filter_returns_only_matching_items(self):
        """Station filter returns only orders with items matching station categories"""
        order_id = f"kds-station-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"

        # Create order with mixed categories
        mongo_script = f"""
        use('test_database');
        db.orders.insertOne({{
            id: '{order_id}',
            order_number: 'KDS-STATION-TEST',
            items: [
                {{item_id: 'item-001', name: 'Steak', qty: 1, price: 35.00, category: 'mains', kds_status: 'pending'}},
                {{item_id: 'item-002', name: 'Cocktail', qty: 2, price: 12.00, category: 'drinks', kds_status: 'pending'}},
                {{item_id: 'item-003', name: 'Salad', qty: 1, price: 10.00, category: 'salads', kds_status: 'pending'}}
            ],
            fulfillment_type: 'dine_in',
            table_number: '5',
            status: 'preparing',
            payment_status: 'paid',
            contact_email: 'station-test@example.com',
            total: 69.00,
            accepted_at: new Date(),
            created_at: new Date()
        }});
        """
        _run_mongosh(mongo_script)

        # Test grill station (should only show mains/entrees)
        response = self.session.get(f"{BASE_URL}/api/admin/kds/board", params={"station": "grill"})
        assert response.status_code == 200
        
        data = response.json()
        test_order = next((o for o in data["orders"] if o["id"] == order_id), None)
        
        if test_order:
            # Should only have mains item
            categories = [it.get("category", "").lower() for it in test_order["items"]]
            assert all(c in ["mains", "entrees"] for c in categories), f"Grill station has non-grill items: {categories}"
            # Verify _line_index is preserved
            for item in test_order["items"]:
                assert "_line_index" in item, "Missing _line_index on filtered item"
            print(f"PASS: Grill station filter shows only mains/entrees items with _line_index")
        
        # Test bar station (should only show drinks/cocktails)
        response = self.session.get(f"{BASE_URL}/api/admin/kds/board", params={"station": "bar"})
        data = response.json()
        test_order = next((o for o in data["orders"] if o["id"] == order_id), None)
        
        if test_order:
            categories = [it.get("category", "").lower() for it in test_order["items"]]
            assert all(c in ["drinks", "cocktails"] for c in categories), f"Bar station has non-bar items: {categories}"
            print(f"PASS: Bar station filter shows only drinks/cocktails items")
        
        # Cleanup
        cleanup_script = f"""
        use('test_database');
        db.orders.deleteOne({{id: '{order_id}'}});
        """
        _run_mongosh(cleanup_script)


class TestKDSItemStatusValidation:
    """Test item status validation edge cases"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin and get session"""
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_resp.status_code == 200
    
    def test_invalid_line_index_returns_400(self):
        """PATCH with invalid line_index returns 400"""
        order_id = f"kds-idx-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"

        # Create order with 1 item
        mongo_script = f"""
        use('test_database');
        db.orders.insertOne({{
            id: '{order_id}',
            order_number: 'KDS-IDX-TEST',
            items: [{{item_id: 'item-001', name: 'Single Item', qty: 1, price: 10.00, category: 'mains', kds_status: 'pending'}}],
            fulfillment_type: 'pickup',
            status: 'preparing',
            payment_status: 'paid',
            contact_email: 'idx-test@example.com',
            total: 10.00,
            created_at: new Date()
        }});
        """
        _run_mongosh(mongo_script)

        # Try to update item at index 5 (doesn't exist)
        response = self.session.patch(
            f"{BASE_URL}/api/admin/kds/orders/{order_id}/items/5",
            json={"status": "started"}
        )
        assert response.status_code == 400, f"Expected 400 for invalid line_index, got {response.status_code}"
        
        # Try negative index
        response = self.session.patch(
            f"{BASE_URL}/api/admin/kds/orders/{order_id}/items/-1",
            json={"status": "started"}
        )
        assert response.status_code == 400, f"Expected 400 for negative line_index, got {response.status_code}"
        
        print("PASS: Invalid line_index returns 400")
        
        # Cleanup
        cleanup_script = f"""
        use('test_database');
        db.orders.deleteOne({{id: '{order_id}'}});
        """
        _run_mongosh(cleanup_script)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
