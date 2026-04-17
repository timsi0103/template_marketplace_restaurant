"""
Backend API Tests for The Culinary Editorial
Tests all placeholder API endpoints for the F&B e-commerce template
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndRoot:
    """Health check and root endpoint tests"""
    
    def test_health_check(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] == "healthy"
        print("✓ Health check passed")
    
    def test_root_endpoint(self):
        """Test /api/ returns correct API info"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "The Culinary Editorial API"
        assert "version" in data
        print("✓ Root endpoint passed")


class TestMenuEndpoints:
    """Menu-related API endpoint tests"""
    
    def test_get_menu_items(self):
        """Test /api/menu/items returns items list"""
        response = requests.get(f"{BASE_URL}/api/menu/items")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "count" in data
        assert isinstance(data["items"], list)
        print(f"✓ Menu items endpoint passed - {data['count']} items")
    
    def test_get_menu_item_not_found(self):
        """Test /api/menu/items/{id} returns error for non-existent item"""
        response = requests.get(f"{BASE_URL}/api/menu/items/nonexistent-id")
        assert response.status_code == 200  # Skeleton returns 200 with error message
        data = response.json()
        assert "error" in data
        assert data["error"] == "Item not found"
        print("✓ Menu item not found handled correctly")
    
    def test_get_categories(self):
        """Test /api/menu/categories returns categories list"""
        response = requests.get(f"{BASE_URL}/api/menu/categories")
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        assert isinstance(data["categories"], list)
        print(f"✓ Categories endpoint passed - {len(data['categories'])} categories")


class TestOrderEndpoints:
    """Order-related API endpoint tests"""
    
    def test_get_orders(self):
        """Test /api/orders returns orders list"""
        response = requests.get(f"{BASE_URL}/api/orders")
        assert response.status_code == 200
        data = response.json()
        assert "orders" in data
        assert "count" in data
        assert isinstance(data["orders"], list)
        print(f"✓ Orders endpoint passed - {data['count']} orders")
    
    def test_get_order_not_found(self):
        """Test /api/orders/{id} returns error for non-existent order"""
        response = requests.get(f"{BASE_URL}/api/orders/nonexistent-id")
        assert response.status_code == 200  # Skeleton returns 200 with error message
        data = response.json()
        assert "error" in data
        assert data["error"] == "Order not found"
        print("✓ Order not found handled correctly")


class TestAdminEndpoints:
    """Admin dashboard API endpoint tests"""
    
    def test_admin_dashboard(self):
        """Test /api/admin/dashboard returns dashboard stats"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard")
        assert response.status_code == 200
        data = response.json()
        assert "daily_revenue" in data
        assert data["daily_revenue"] == 4285.00
        assert "active_orders" in data
        assert "menu_items" in data
        assert "top_selling" in data
        assert data["top_selling"] == "Truffle Risotto"
        print(f"✓ Admin dashboard passed - Revenue: ${data['daily_revenue']}")
    
    def test_admin_queue(self):
        """Test /api/admin/queue returns queue list"""
        response = requests.get(f"{BASE_URL}/api/admin/queue")
        assert response.status_code == 200
        data = response.json()
        assert "queue" in data
        assert isinstance(data["queue"], list)
        print(f"✓ Admin queue passed - {len(data['queue'])} items in queue")


class TestKitchenEndpoints:
    """Kitchen operations API endpoint tests"""
    
    def test_kitchen_orders(self):
        """Test /api/kitchen/orders returns kitchen orders"""
        response = requests.get(f"{BASE_URL}/api/kitchen/orders")
        assert response.status_code == 200
        data = response.json()
        assert "orders" in data
        assert isinstance(data["orders"], list)
        print(f"✓ Kitchen orders passed - {len(data['orders'])} orders")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
