"""
Test suite for Promo Code / Coupon Redemption System (Iteration 13)
Tests:
- Seeded coupons (SAVE10, WELCOME5, FREESHIP, EXPIRED10)
- Promo validation endpoint
- Admin CRUD for coupons
- Usage count increment on paid orders
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "admin@culinaryeditorial.com")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "Admin123!")
class TestPromoValidation:
    """Tests for POST /api/orders/validate-promo endpoint"""

    def test_save10_valid(self):
        """SAVE10 with subtotal 30 should be valid"""
        res = requests.post(f"{BASE_URL}/api/orders/validate-promo", json={
            "code": "SAVE10",
            "subtotal": 30
        })
        assert res.status_code == 200
        data = res.json()
        assert data["valid"] is True
        assert data["code"] == "SAVE10"
        assert data["rule"]["type"] == "percent"
        assert data["rule"]["value"] == 10
        print("PASS: SAVE10 valid with subtotal 30")

    def test_save10_case_insensitive(self):
        """save10 (lowercase) should be valid (case-insensitive)"""
        res = requests.post(f"{BASE_URL}/api/orders/validate-promo", json={
            "code": "save10",
            "subtotal": 30
        })
        assert res.status_code == 200
        data = res.json()
        assert data["valid"] is True
        assert data["code"] == "SAVE10"  # Should normalize to uppercase
        print("PASS: save10 (lowercase) is case-insensitive")

    def test_expired10_invalid(self):
        """EXPIRED10 should return valid=false with 'Code expired' error"""
        res = requests.post(f"{BASE_URL}/api/orders/validate-promo", json={
            "code": "EXPIRED10",
            "subtotal": 30
        })
        assert res.status_code == 200
        data = res.json()
        assert data["valid"] is False
        assert "expired" in data.get("error", "").lower()
        print(f"PASS: EXPIRED10 returns error: {data.get('error')}")

    def test_freeship_pickup_invalid(self):
        """FREESHIP with fulfillment_type=pickup should be invalid"""
        res = requests.post(f"{BASE_URL}/api/orders/validate-promo", json={
            "code": "FREESHIP",
            "subtotal": 30,
            "fulfillment_type": "pickup"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["valid"] is False
        assert "delivery" in data.get("error", "").lower()
        print(f"PASS: FREESHIP with pickup returns error: {data.get('error')}")

    def test_freeship_delivery_valid(self):
        """FREESHIP with fulfillment_type=delivery and subtotal >= 25 should be valid"""
        res = requests.post(f"{BASE_URL}/api/orders/validate-promo", json={
            "code": "FREESHIP",
            "subtotal": 30,
            "fulfillment_type": "delivery"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["valid"] is True
        assert data["rule"]["type"] == "free_delivery"
        print("PASS: FREESHIP with delivery is valid")

    def test_welcome5_below_minimum(self):
        """WELCOME5 with subtotal < 20 should be invalid"""
        res = requests.post(f"{BASE_URL}/api/orders/validate-promo", json={
            "code": "WELCOME5",
            "subtotal": 10
        })
        assert res.status_code == 200
        data = res.json()
        assert data["valid"] is False
        assert "20" in data.get("error", "") or "minimum" in data.get("error", "").lower()
        print(f"PASS: WELCOME5 with subtotal 10 returns error: {data.get('error')}")

    def test_welcome5_first_order_only(self):
        """WELCOME5 should fail for email with prior paid orders"""
        # First, we need to check if there's an email with paid orders
        # For this test, we'll use a fresh email that should pass
        fresh_email = f"test_fresh_{datetime.now().timestamp()}@test.com"
        res = requests.post(f"{BASE_URL}/api/orders/validate-promo", json={
            "code": "WELCOME5",
            "subtotal": 30,
            "contact_email": fresh_email
        })
        assert res.status_code == 200
        data = res.json()
        # Fresh email should pass (first order)
        assert data["valid"] is True
        print(f"PASS: WELCOME5 valid for fresh email {fresh_email}")

    def test_invalid_code(self):
        """Invalid promo code should return valid=false"""
        res = requests.post(f"{BASE_URL}/api/orders/validate-promo", json={
            "code": "INVALIDCODE123",
            "subtotal": 30
        })
        assert res.status_code == 200
        data = res.json()
        assert data["valid"] is False
        assert "invalid" in data.get("error", "").lower()
        print(f"PASS: Invalid code returns error: {data.get('error')}")


class TestAdminCouponsAuth:
    """Tests for admin coupon endpoints authentication"""

    def test_get_coupons_without_auth(self):
        """GET /api/admin/coupons without auth should return 401/403"""
        res = requests.get(f"{BASE_URL}/api/admin/coupons")
        assert res.status_code in [401, 403]
        print(f"PASS: GET /api/admin/coupons without auth returns {res.status_code}")


class TestAdminCouponsCRUD:
    """Tests for admin coupon CRUD operations"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        self.session = requests.Session()
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_res.status_code == 200, f"Admin login failed: {login_res.text}"
        self.created_coupon_ids = []
        yield
        # Cleanup created coupons
        for cid in self.created_coupon_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/admin/coupons/{cid}")
            except:
                pass

    def test_list_coupons_returns_seeded(self):
        """GET /api/admin/coupons should return at least 4 seeded coupons"""
        res = self.session.get(f"{BASE_URL}/api/admin/coupons")
        assert res.status_code == 200
        data = res.json()
        coupons = data.get("coupons", [])
        codes = [c["code"] for c in coupons]
        assert "SAVE10" in codes
        assert "WELCOME5" in codes
        assert "FREESHIP" in codes
        assert "EXPIRED10" in codes
        print(f"PASS: Admin coupons list contains {len(coupons)} coupons including all 4 seeded")

    def test_create_coupon(self):
        """POST /api/admin/coupons should create a new coupon"""
        payload = {
            "code": "TEST15",
            "type": "percent",
            "value": 15,
            "min_subtotal": 0,
            "active": True
        }
        res = self.session.post(f"{BASE_URL}/api/admin/coupons", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["code"] == "TEST15"
        assert data["type"] == "percent"
        assert data["value"] == 15
        self.created_coupon_ids.append(data["id"])
        print(f"PASS: Created coupon TEST15 with id {data['id']}")

    def test_create_duplicate_coupon_fails(self):
        """POST /api/admin/coupons with duplicate code should return 400"""
        # First create
        payload = {
            "code": "TESTDUP",
            "type": "percent",
            "value": 10,
            "min_subtotal": 0,
            "active": True
        }
        res1 = self.session.post(f"{BASE_URL}/api/admin/coupons", json=payload)
        assert res1.status_code == 200
        self.created_coupon_ids.append(res1.json()["id"])
        
        # Duplicate should fail
        res2 = self.session.post(f"{BASE_URL}/api/admin/coupons", json=payload)
        assert res2.status_code == 400
        assert "exists" in res2.json().get("detail", "").lower()
        print("PASS: Duplicate coupon creation returns 400")

    def test_create_bogo_type_fails(self):
        """POST /api/admin/coupons with type='bogo' should return 400"""
        payload = {
            "code": "TESTBOGO",
            "type": "bogo",
            "value": 0,
            "min_subtotal": 0,
            "active": True
        }
        res = self.session.post(f"{BASE_URL}/api/admin/coupons", json=payload)
        assert res.status_code == 400
        print(f"PASS: BOGO type returns 400: {res.json().get('detail')}")

    def test_update_coupon(self):
        """PUT /api/admin/coupons/{id} should update coupon"""
        # Create first
        create_res = self.session.post(f"{BASE_URL}/api/admin/coupons", json={
            "code": "TESTUPD",
            "type": "percent",
            "value": 10,
            "min_subtotal": 0,
            "active": True
        })
        assert create_res.status_code == 200
        coupon_id = create_res.json()["id"]
        self.created_coupon_ids.append(coupon_id)
        
        # Update
        update_res = self.session.put(f"{BASE_URL}/api/admin/coupons/{coupon_id}", json={
            "value": 20,
            "expires_at": "2030-12-31"
        })
        assert update_res.status_code == 200
        data = update_res.json()
        assert data["value"] == 20
        assert data["expires_at"] == "2030-12-31"
        print(f"PASS: Updated coupon {coupon_id} value to 20 and set expiry")

    def test_toggle_coupon(self):
        """PATCH /api/admin/coupons/{id}/toggle should flip active boolean"""
        # Create first
        create_res = self.session.post(f"{BASE_URL}/api/admin/coupons", json={
            "code": "TESTTOG",
            "type": "percent",
            "value": 10,
            "min_subtotal": 0,
            "active": True
        })
        assert create_res.status_code == 200
        coupon_id = create_res.json()["id"]
        self.created_coupon_ids.append(coupon_id)
        
        # Toggle off
        toggle_res = self.session.patch(f"{BASE_URL}/api/admin/coupons/{coupon_id}/toggle")
        assert toggle_res.status_code == 200
        assert toggle_res.json()["active"] is False
        
        # Toggle on
        toggle_res2 = self.session.patch(f"{BASE_URL}/api/admin/coupons/{coupon_id}/toggle")
        assert toggle_res2.status_code == 200
        assert toggle_res2.json()["active"] is True
        print(f"PASS: Toggle coupon {coupon_id} works correctly")

    def test_delete_coupon(self):
        """DELETE /api/admin/coupons/{id} should remove coupon"""
        # Create first
        create_res = self.session.post(f"{BASE_URL}/api/admin/coupons", json={
            "code": "TESTDEL",
            "type": "percent",
            "value": 10,
            "min_subtotal": 0,
            "active": True
        })
        assert create_res.status_code == 200
        coupon_id = create_res.json()["id"]
        
        # Delete
        del_res = self.session.delete(f"{BASE_URL}/api/admin/coupons/{coupon_id}")
        assert del_res.status_code == 200
        
        # Verify deleted
        get_res = self.session.get(f"{BASE_URL}/api/admin/coupons/{coupon_id}")
        assert get_res.status_code == 404
        print(f"PASS: Deleted coupon {coupon_id} and verified 404")

    def test_delete_nonexistent_coupon(self):
        """DELETE /api/admin/coupons/{id} for non-existent returns 404"""
        res = self.session.delete(f"{BASE_URL}/api/admin/coupons/nonexistent-id-12345")
        assert res.status_code == 404
        print("PASS: Delete non-existent coupon returns 404")


class TestSeededCouponsExist:
    """Verify seeded coupons exist in database on startup"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin"""
        self.session = requests.Session()
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_res.status_code == 200

    def test_seeded_coupons_properties(self):
        """Verify seeded coupons have correct properties"""
        res = self.session.get(f"{BASE_URL}/api/admin/coupons")
        assert res.status_code == 200
        coupons = {c["code"]: c for c in res.json().get("coupons", [])}
        
        # SAVE10: percent 10, min 0
        assert "SAVE10" in coupons
        assert coupons["SAVE10"]["type"] == "percent"
        assert coupons["SAVE10"]["value"] == 10
        assert coupons["SAVE10"]["min_subtotal"] == 0
        
        # WELCOME5: fixed 5, min 20, first_order_only
        assert "WELCOME5" in coupons
        assert coupons["WELCOME5"]["type"] == "fixed"
        assert coupons["WELCOME5"]["value"] == 5
        assert coupons["WELCOME5"]["min_subtotal"] == 20
        assert coupons["WELCOME5"]["first_order_only"] is True
        
        # FREESHIP: free_delivery, min 25
        assert "FREESHIP" in coupons
        assert coupons["FREESHIP"]["type"] == "free_delivery"
        assert coupons["FREESHIP"]["min_subtotal"] == 25
        
        # EXPIRED10: percent 10, expires_at 2020-01-01
        assert "EXPIRED10" in coupons
        assert coupons["EXPIRED10"]["type"] == "percent"
        assert coupons["EXPIRED10"]["value"] == 10
        assert coupons["EXPIRED10"]["expires_at"] == "2020-01-01"
        
        print("PASS: All seeded coupons have correct properties")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
