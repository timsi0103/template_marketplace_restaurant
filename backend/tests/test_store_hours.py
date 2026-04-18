"""
Phase 9: Operating Hours & Availability Tests
Tests for store status, hours configuration, holidays, and pause ordering
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestStoreStatus:
    """Public store status endpoint tests"""
    
    def test_store_status_returns_200(self):
        """GET /api/store/status returns 200"""
        response = requests.get(f"{BASE_URL}/api/store/status")
        assert response.status_code == 200
        print(f"PASS: Store status endpoint returns 200")
    
    def test_store_status_has_required_fields(self):
        """Store status response has all required fields"""
        response = requests.get(f"{BASE_URL}/api/store/status")
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        required_fields = ["is_open", "pause_ordering", "close_time", "next_open", 
                          "active_holiday", "upcoming_holidays", "services", "day"]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        # Check services structure
        assert "delivery" in data["services"]
        assert "pickup" in data["services"]
        assert "dine_in" in data["services"]
        
        # Each service should have available and hours
        for svc in ["delivery", "pickup", "dine_in"]:
            assert "available" in data["services"][svc]
            assert "hours" in data["services"][svc]
        
        print(f"PASS: Store status has all required fields")
        print(f"  is_open: {data['is_open']}")
        print(f"  next_open: {data['next_open']}")
        print(f"  day: {data['day']}")
    
    def test_store_status_is_open_boolean(self):
        """is_open field is a boolean"""
        response = requests.get(f"{BASE_URL}/api/store/status")
        data = response.json()
        assert isinstance(data["is_open"], bool)
        print(f"PASS: is_open is boolean: {data['is_open']}")


class TestAdminHoursAuth:
    """Admin hours endpoints require authentication"""
    
    def test_get_hours_requires_auth(self):
        """GET /api/admin/store/hours requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/store/hours")
        assert response.status_code == 401
        print("PASS: GET /api/admin/store/hours requires auth (401)")
    
    def test_put_hours_requires_auth(self):
        """PUT /api/admin/store/hours requires authentication"""
        response = requests.put(f"{BASE_URL}/api/admin/store/hours", json={"hours": {}})
        assert response.status_code == 401
        print("PASS: PUT /api/admin/store/hours requires auth (401)")
    
    def test_pause_requires_auth(self):
        """POST /api/admin/store/pause requires authentication"""
        response = requests.post(f"{BASE_URL}/api/admin/store/pause")
        assert response.status_code == 401
        print("PASS: POST /api/admin/store/pause requires auth (401)")
    
    def test_get_holidays_requires_auth(self):
        """GET /api/admin/store/holidays requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/store/holidays")
        assert response.status_code == 401
        print("PASS: GET /api/admin/store/holidays requires auth (401)")
    
    def test_create_holiday_requires_auth(self):
        """POST /api/admin/store/holidays requires authentication"""
        response = requests.post(f"{BASE_URL}/api/admin/store/holidays", json={"date": "2026-12-25", "reason": "Christmas"})
        assert response.status_code == 401
        print("PASS: POST /api/admin/store/holidays requires auth (401)")


class TestAdminHoursAuthenticated:
    """Admin hours endpoints with authentication"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@culinaryeditorial.com", "password": "Admin123!"}
        )
        if login_response.status_code != 200:
            pytest.skip("Admin login failed - skipping authenticated tests")
        self.admin_user = login_response.json()
        print(f"Logged in as admin: {self.admin_user.get('email')}")
    
    def test_get_store_hours(self):
        """GET /api/admin/store/hours returns hours config"""
        response = self.session.get(f"{BASE_URL}/api/admin/store/hours")
        assert response.status_code == 200
        data = response.json()
        
        assert "hours" in data
        assert "pause_ordering" in data
        print(f"PASS: GET /api/admin/store/hours returns 200")
        print(f"  pause_ordering: {data['pause_ordering']}")
    
    def test_get_store_hours_has_day_config(self):
        """Hours config has day-by-day configuration"""
        response = self.session.get(f"{BASE_URL}/api/admin/store/hours")
        data = response.json()
        hours = data.get("hours", {})
        
        # Check that days are configured
        days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        for day in days:
            if day in hours:
                day_config = hours[day]
                # Each day should have service types
                assert "delivery" in day_config or len(day_config) > 0
                print(f"  {day}: configured")
        
        print(f"PASS: Hours config has day-by-day configuration")
    
    def test_sunday_has_different_hours(self):
        """Sunday should have 11:00 AM opening (seeded differently)"""
        response = self.session.get(f"{BASE_URL}/api/admin/store/hours")
        data = response.json()
        hours = data.get("hours", {})
        
        sunday = hours.get("sunday", {})
        delivery = sunday.get("delivery", {})
        open_time = delivery.get("open_time", "")
        
        # Sunday should open at 11:00 (seeded differently from weekdays 10:00)
        assert open_time == "11:00", f"Expected Sunday to open at 11:00, got {open_time}"
        print(f"PASS: Sunday opens at 11:00 AM (different from weekdays)")
    
    def test_update_store_hours(self):
        """PUT /api/admin/store/hours updates configuration"""
        # First get current hours
        get_response = self.session.get(f"{BASE_URL}/api/admin/store/hours")
        original_hours = get_response.json().get("hours", {})
        
        # Update Monday delivery hours
        updated_hours = dict(original_hours)
        if "monday" not in updated_hours:
            updated_hours["monday"] = {}
        if "delivery" not in updated_hours["monday"]:
            updated_hours["monday"]["delivery"] = {}
        updated_hours["monday"]["delivery"]["open_time"] = "09:00"
        updated_hours["monday"]["delivery"]["close_time"] = "21:00"
        updated_hours["monday"]["delivery"]["closed"] = False
        
        # Update
        put_response = self.session.put(
            f"{BASE_URL}/api/admin/store/hours",
            json={"hours": updated_hours}
        )
        assert put_response.status_code == 200
        
        # Verify update
        verify_response = self.session.get(f"{BASE_URL}/api/admin/store/hours")
        verify_data = verify_response.json()
        monday_delivery = verify_data["hours"].get("monday", {}).get("delivery", {})
        assert monday_delivery.get("open_time") == "09:00"
        
        # Restore original
        self.session.put(f"{BASE_URL}/api/admin/store/hours", json={"hours": original_hours})
        
        print(f"PASS: PUT /api/admin/store/hours updates configuration")
    
    def test_pause_ordering_toggle(self):
        """POST /api/admin/store/pause toggles pause_ordering"""
        # Get current state
        get_response = self.session.get(f"{BASE_URL}/api/admin/store/hours")
        original_pause = get_response.json().get("pause_ordering", False)
        
        # Toggle
        toggle_response = self.session.post(f"{BASE_URL}/api/admin/store/pause")
        assert toggle_response.status_code == 200
        data = toggle_response.json()
        assert data["pause_ordering"] == (not original_pause)
        
        # Toggle back
        self.session.post(f"{BASE_URL}/api/admin/store/pause")
        
        print(f"PASS: POST /api/admin/store/pause toggles pause_ordering")


class TestAdminHolidays:
    """Admin holiday CRUD tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@culinaryeditorial.com", "password": "Admin123!"}
        )
        if login_response.status_code != 200:
            pytest.skip("Admin login failed - skipping authenticated tests")
    
    def test_get_holidays(self):
        """GET /api/admin/store/holidays returns holidays list"""
        response = self.session.get(f"{BASE_URL}/api/admin/store/holidays")
        assert response.status_code == 200
        data = response.json()
        assert "holidays" in data
        assert isinstance(data["holidays"], list)
        print(f"PASS: GET /api/admin/store/holidays returns 200")
        print(f"  holidays count: {len(data['holidays'])}")
    
    def test_create_holiday(self):
        """POST /api/admin/store/holidays creates a holiday"""
        # Create a test holiday
        test_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        response = self.session.post(
            f"{BASE_URL}/api/admin/store/holidays",
            json={"date": test_date, "reason": "TEST_Holiday", "all_day": True}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        assert data["date"] == test_date
        assert data["reason"] == "TEST_Holiday"
        
        # Cleanup - delete the test holiday
        self.session.delete(f"{BASE_URL}/api/admin/store/holidays/{data['id']}")
        
        print(f"PASS: POST /api/admin/store/holidays creates holiday")
    
    def test_delete_holiday(self):
        """DELETE /api/admin/store/holidays/:id deletes a holiday"""
        # First create a holiday
        test_date = (datetime.now() + timedelta(days=31)).strftime("%Y-%m-%d")
        create_response = self.session.post(
            f"{BASE_URL}/api/admin/store/holidays",
            json={"date": test_date, "reason": "TEST_ToDelete", "all_day": True}
        )
        holiday_id = create_response.json()["id"]
        
        # Delete it
        delete_response = self.session.delete(f"{BASE_URL}/api/admin/store/holidays/{holiday_id}")
        assert delete_response.status_code == 200
        
        # Verify it's gone
        get_response = self.session.get(f"{BASE_URL}/api/admin/store/holidays")
        holidays = get_response.json()["holidays"]
        holiday_ids = [h["id"] for h in holidays]
        assert holiday_id not in holiday_ids
        
        print(f"PASS: DELETE /api/admin/store/holidays/:id deletes holiday")
    
    def test_delete_nonexistent_holiday_returns_404(self):
        """DELETE /api/admin/store/holidays/:id returns 404 for nonexistent"""
        response = self.session.delete(f"{BASE_URL}/api/admin/store/holidays/nonexistent_id")
        assert response.status_code == 404
        print(f"PASS: DELETE nonexistent holiday returns 404")


class TestHealthEndpoint:
    """Basic health check"""
    
    def test_health_endpoint(self):
        """GET /api/health returns 200"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"PASS: Health endpoint returns healthy")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
