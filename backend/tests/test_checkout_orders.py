"""
Test suite for Checkout Flow and Orders API
Tests: POST /api/orders, POST /api/orders/validate-promo, GET /api/orders/{id}, GET /api/payments/status/{session_id}
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPromoCodeValidation:
    """Tests for POST /api/orders/validate-promo"""
    
    def test_valid_promo_save10(self):
        """SAVE10 promo code should return valid=true with 10% discount"""
        response = requests.post(
            f"{BASE_URL}/api/orders/validate-promo",
            json={"code": "SAVE10", "subtotal": 30},
            allow_redirects=True
        )
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] == True
        assert data["code"] == "SAVE10"
        assert data["rule"]["type"] == "percent"
        assert data["rule"]["value"] == 10
        print(f"PASS: SAVE10 promo valid with rule: {data['rule']}")
    
    def test_invalid_promo_code(self):
        """Invalid promo code should return valid=false"""
        response = requests.post(
            f"{BASE_URL}/api/orders/validate-promo",
            json={"code": "BAD", "subtotal": 30},
            allow_redirects=True
        )
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] == False
        assert "error" in data
        print(f"PASS: Invalid promo 'BAD' returns valid=false, error: {data['error']}")
    
    def test_welcome5_promo_min_subtotal(self):
        """WELCOME5 requires min $20 subtotal"""
        # Below minimum
        response = requests.post(
            f"{BASE_URL}/api/orders/validate-promo",
            json={"code": "WELCOME5", "subtotal": 15},
            allow_redirects=True
        )
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] == False
        print(f"PASS: WELCOME5 with $15 subtotal returns valid=false")
        
        # Above minimum
        response = requests.post(
            f"{BASE_URL}/api/orders/validate-promo",
            json={"code": "WELCOME5", "subtotal": 25},
            allow_redirects=True
        )
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] == True
        assert data["rule"]["type"] == "flat"
        assert data["rule"]["value"] == 5.0
        print(f"PASS: WELCOME5 with $25 subtotal returns valid=true")
    
    def test_freeship_promo(self):
        """FREESHIP requires min $25 subtotal"""
        response = requests.post(
            f"{BASE_URL}/api/orders/validate-promo",
            json={"code": "FREESHIP", "subtotal": 30},
            allow_redirects=True
        )
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] == True
        assert data["rule"]["type"] == "free_delivery"
        print(f"PASS: FREESHIP promo valid with rule: {data['rule']}")


class TestOrderCreation:
    """Tests for POST /api/orders"""
    
    @pytest.fixture
    def valid_order_payload(self):
        """Valid order payload for pickup"""
        return {
            "items": [
                {
                    "item_id": "item-001",
                    "variant_id": "var-duck-250",
                    "modifiers": [],
                    "qty": 1,
                    "instructions": ""
                }
            ],
            "fulfillment_type": "pickup",
            "address": None,
            "table_number": None,
            "scheduled_slot": "ASAP",
            "tip": 0,
            "promo_code": None,
            "contact_email": "guest@test.com",
            "contact_name": "Test Guest",
            "contact_phone": "+1234567890",
            "origin_url": BASE_URL
        }
    
    def test_create_order_pickup_success(self, valid_order_payload):
        """Create order with pickup fulfillment should succeed"""
        response = requests.post(
            f"{BASE_URL}/api/orders",
            json=valid_order_payload,
            allow_redirects=True
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "order_id" in data
        assert "order_number" in data
        assert "session_id" in data
        assert "checkout_url" in data
        assert "total" in data
        
        # Verify checkout_url starts with Stripe
        assert data["checkout_url"].startswith("https://checkout.stripe.com/"), f"checkout_url should start with Stripe: {data['checkout_url']}"
        
        print(f"PASS: Order created - order_id: {data['order_id']}, order_number: {data['order_number']}")
        print(f"  checkout_url: {data['checkout_url'][:80]}...")
        print(f"  total: ${data['total']}")
        
        # Store for later tests
        return data
    
    def test_create_order_delivery_missing_address(self, valid_order_payload):
        """Delivery without address should return 400"""
        valid_order_payload["fulfillment_type"] = "delivery"
        valid_order_payload["address"] = None
        
        response = requests.post(
            f"{BASE_URL}/api/orders",
            json=valid_order_payload,
            allow_redirects=True
        )
        assert response.status_code == 400
        data = response.json()
        assert "Address is required for delivery" in data.get("detail", "")
        print(f"PASS: Delivery without address returns 400: {data['detail']}")
    
    def test_create_order_dine_in_missing_table(self, valid_order_payload):
        """Dine-in without table number should return 400"""
        valid_order_payload["fulfillment_type"] = "dine_in"
        valid_order_payload["table_number"] = None
        
        response = requests.post(
            f"{BASE_URL}/api/orders",
            json=valid_order_payload,
            allow_redirects=True
        )
        assert response.status_code == 400
        data = response.json()
        assert "Table number is required for dine-in" in data.get("detail", "")
        print(f"PASS: Dine-in without table returns 400: {data['detail']}")
    
    def test_create_order_invalid_item_id(self, valid_order_payload):
        """Order with invalid item_id should return 400"""
        valid_order_payload["items"][0]["item_id"] = "invalid-item-xyz"
        valid_order_payload["items"][0]["variant_id"] = None
        
        response = requests.post(
            f"{BASE_URL}/api/orders",
            json=valid_order_payload,
            allow_redirects=True
        )
        assert response.status_code == 400
        data = response.json()
        assert "not found" in data.get("detail", "").lower()
        print(f"PASS: Invalid item_id returns 400: {data['detail']}")
    
    def test_create_order_delivery_with_address(self, valid_order_payload):
        """Delivery with valid address should succeed"""
        valid_order_payload["fulfillment_type"] = "delivery"
        valid_order_payload["address"] = {
            "label": "Home",
            "line1": "123 Test Street",
            "line2": "Apt 4B",
            "city": "New York",
            "postal_code": "10001",
            "lat": 40.7128,
            "lng": -74.006,
            "notes": "Ring doorbell"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orders",
            json=valid_order_payload,
            allow_redirects=True
        )
        assert response.status_code == 200
        data = response.json()
        assert "order_id" in data
        assert "checkout_url" in data
        print(f"PASS: Delivery order created - order_id: {data['order_id']}")
        return data
    
    def test_create_order_dine_in_with_table(self, valid_order_payload):
        """Dine-in with table number should succeed"""
        valid_order_payload["fulfillment_type"] = "dine_in"
        valid_order_payload["table_number"] = "12"
        
        response = requests.post(
            f"{BASE_URL}/api/orders",
            json=valid_order_payload,
            allow_redirects=True
        )
        assert response.status_code == 200
        data = response.json()
        assert "order_id" in data
        print(f"PASS: Dine-in order created - order_id: {data['order_id']}")
        return data


class TestOrderRetrieval:
    """Tests for GET /api/orders/{order_id}"""
    
    def test_get_order_by_id(self):
        """Create an order and retrieve it by ID"""
        # First create an order
        payload = {
            "items": [{"item_id": "item-001", "variant_id": "var-duck-250", "modifiers": [], "qty": 1, "instructions": ""}],
            "fulfillment_type": "pickup",
            "address": None,
            "table_number": None,
            "scheduled_slot": "ASAP",
            "tip": 0,
            "promo_code": None,
            "contact_email": "retrieval_test@test.com",
            "contact_name": "Retrieval Test",
            "contact_phone": "",
            "origin_url": BASE_URL
        }
        
        create_response = requests.post(f"{BASE_URL}/api/orders", json=payload, allow_redirects=True)
        assert create_response.status_code == 200
        created = create_response.json()
        order_id = created["order_id"]
        
        # Now retrieve it
        get_response = requests.get(f"{BASE_URL}/api/orders/{order_id}", allow_redirects=True)
        assert get_response.status_code == 200
        order = get_response.json()
        
        # Verify order data
        assert order["id"] == order_id
        assert order["order_number"] == created["order_number"]
        assert order["contact_email"] == "retrieval_test@test.com"
        assert order["status"] == "pending"
        assert order["payment_status"] == "initiated"
        assert order["fulfillment_type"] == "pickup"
        assert len(order["items"]) == 1
        
        print(f"PASS: Order retrieved - id: {order['id']}, status: {order['status']}, payment_status: {order['payment_status']}")
        return order
    
    def test_get_order_not_found(self):
        """Non-existent order should return 404"""
        response = requests.get(f"{BASE_URL}/api/orders/nonexistent-order-id", allow_redirects=True)
        assert response.status_code == 404
        print("PASS: Non-existent order returns 404")


class TestPaymentStatus:
    """Tests for GET /api/payments/status/{session_id}"""
    
    def test_payment_status_for_created_order(self):
        """Check payment status for a newly created order"""
        # Create an order first
        payload = {
            "items": [{"item_id": "item-001", "variant_id": "var-duck-250", "modifiers": [], "qty": 1, "instructions": ""}],
            "fulfillment_type": "pickup",
            "address": None,
            "table_number": None,
            "scheduled_slot": "ASAP",
            "tip": 0,
            "promo_code": None,
            "contact_email": "payment_test@test.com",
            "contact_name": "Payment Test",
            "contact_phone": "",
            "origin_url": BASE_URL
        }
        
        create_response = requests.post(f"{BASE_URL}/api/orders", json=payload, allow_redirects=True)
        assert create_response.status_code == 200
        created = create_response.json()
        session_id = created["session_id"]
        
        # Check payment status
        status_response = requests.get(f"{BASE_URL}/api/payments/status/{session_id}", allow_redirects=True)
        assert status_response.status_code == 200
        status = status_response.json()
        
        # Verify status structure
        assert "session_id" in status
        assert "status" in status
        assert "payment_status" in status
        assert "order" in status
        
        # Payment should be unpaid since we didn't complete checkout
        assert status["payment_status"] in ["unpaid", "initiated", "pending"]
        
        print(f"PASS: Payment status - session_id: {status['session_id']}, status: {status['status']}, payment_status: {status['payment_status']}")
        return status


class TestPricingMath:
    """Tests for backend pricing calculations"""
    
    def test_tax_calculation(self):
        """Tax should be 8.75% of (subtotal - discount)"""
        # Create order without promo
        payload = {
            "items": [{"item_id": "item-001", "variant_id": "var-duck-250", "modifiers": [], "qty": 1, "instructions": ""}],
            "fulfillment_type": "pickup",
            "address": None,
            "table_number": None,
            "scheduled_slot": "ASAP",
            "tip": 0,
            "promo_code": None,
            "contact_email": "tax_test@test.com",
            "contact_name": "Tax Test",
            "contact_phone": "",
            "origin_url": BASE_URL
        }
        
        create_response = requests.post(f"{BASE_URL}/api/orders", json=payload, allow_redirects=True)
        assert create_response.status_code == 200
        created = create_response.json()
        
        # Get order details
        order_response = requests.get(f"{BASE_URL}/api/orders/{created['order_id']}", allow_redirects=True)
        order = order_response.json()
        
        # Verify tax calculation: tax = 0.0875 * subtotal (no discount)
        expected_tax = round(order["subtotal"] * 0.0875, 2)
        assert abs(order["tax"] - expected_tax) < 0.01, f"Tax mismatch: expected {expected_tax}, got {order['tax']}"
        
        print(f"PASS: Tax calculation correct - subtotal: ${order['subtotal']}, tax: ${order['tax']} (expected: ${expected_tax})")
    
    def test_delivery_fee_only_for_delivery(self):
        """Delivery fee should only apply for delivery fulfillment"""
        base_payload = {
            "items": [{"item_id": "item-001", "variant_id": "var-duck-250", "modifiers": [], "qty": 1, "instructions": ""}],
            "address": None,
            "table_number": None,
            "scheduled_slot": "ASAP",
            "tip": 0,
            "promo_code": None,
            "contact_email": "delivery_fee_test@test.com",
            "contact_name": "Delivery Fee Test",
            "contact_phone": "",
            "origin_url": BASE_URL
        }
        
        # Pickup - no delivery fee
        pickup_payload = {**base_payload, "fulfillment_type": "pickup"}
        pickup_response = requests.post(f"{BASE_URL}/api/orders", json=pickup_payload, allow_redirects=True)
        pickup_order = requests.get(f"{BASE_URL}/api/orders/{pickup_response.json()['order_id']}", allow_redirects=True).json()
        assert pickup_order["delivery_fee"] == 0, f"Pickup should have no delivery fee, got {pickup_order['delivery_fee']}"
        print(f"PASS: Pickup has no delivery fee: ${pickup_order['delivery_fee']}")
        
        # Delivery - should have $4.99 fee
        delivery_payload = {
            **base_payload, 
            "fulfillment_type": "delivery",
            "address": {"line1": "123 Test St", "city": "NYC", "postal_code": "10001"}
        }
        delivery_response = requests.post(f"{BASE_URL}/api/orders", json=delivery_payload, allow_redirects=True)
        delivery_order = requests.get(f"{BASE_URL}/api/orders/{delivery_response.json()['order_id']}", allow_redirects=True).json()
        assert delivery_order["delivery_fee"] == 4.99, f"Delivery should have $4.99 fee, got {delivery_order['delivery_fee']}"
        print(f"PASS: Delivery has $4.99 fee: ${delivery_order['delivery_fee']}")
    
    def test_save10_discount_calculation(self):
        """SAVE10 should give 10% off subtotal"""
        payload = {
            "items": [{"item_id": "item-001", "variant_id": "var-duck-250", "modifiers": [], "qty": 2, "instructions": ""}],
            "fulfillment_type": "pickup",
            "address": None,
            "table_number": None,
            "scheduled_slot": "ASAP",
            "tip": 0,
            "promo_code": "SAVE10",
            "contact_email": "discount_test@test.com",
            "contact_name": "Discount Test",
            "contact_phone": "",
            "origin_url": BASE_URL
        }
        
        create_response = requests.post(f"{BASE_URL}/api/orders", json=payload, allow_redirects=True)
        assert create_response.status_code == 200
        
        order_response = requests.get(f"{BASE_URL}/api/orders/{create_response.json()['order_id']}", allow_redirects=True)
        order = order_response.json()
        
        # Verify 10% discount
        expected_discount = round(order["subtotal"] * 0.10, 2)
        assert abs(order["discount"] - expected_discount) < 0.01, f"Discount mismatch: expected {expected_discount}, got {order['discount']}"
        assert order["promo_applied"] == "SAVE10"
        
        print(f"PASS: SAVE10 discount correct - subtotal: ${order['subtotal']}, discount: ${order['discount']} (10%)")
    
    def test_freeship_makes_delivery_free(self):
        """FREESHIP should make delivery fee $0 when subtotal >= $25"""
        payload = {
            "items": [{"item_id": "item-001", "variant_id": "var-duck-250", "modifiers": [], "qty": 1, "instructions": ""}],
            "fulfillment_type": "delivery",
            "address": {"line1": "123 Test St", "city": "NYC", "postal_code": "10001"},
            "table_number": None,
            "scheduled_slot": "ASAP",
            "tip": 0,
            "promo_code": "FREESHIP",
            "contact_email": "freeship_test@test.com",
            "contact_name": "Freeship Test",
            "contact_phone": "",
            "origin_url": BASE_URL
        }
        
        create_response = requests.post(f"{BASE_URL}/api/orders", json=payload, allow_redirects=True)
        assert create_response.status_code == 200
        
        order_response = requests.get(f"{BASE_URL}/api/orders/{create_response.json()['order_id']}", allow_redirects=True)
        order = order_response.json()
        
        # FREESHIP discount should equal delivery fee
        assert order["discount"] == 4.99, f"FREESHIP discount should be $4.99, got {order['discount']}"
        assert order["promo_applied"] == "FREESHIP"
        
        print(f"PASS: FREESHIP makes delivery free - discount: ${order['discount']}")
    
    def test_backend_uses_db_prices_not_frontend(self):
        """Backend should compute prices from DB, ignoring frontend-sent prices"""
        # Get actual item price from DB
        menu_response = requests.get(f"{BASE_URL}/api/menu/items/item-001", allow_redirects=True)
        item = menu_response.json()
        variant = next((v for v in item.get("variants", []) if v["id"] == "var-duck-250"), None)
        db_price = variant["price"] if variant else item["price"]
        
        # Create order - backend should use DB price
        payload = {
            "items": [{"item_id": "item-001", "variant_id": "var-duck-250", "modifiers": [], "qty": 1, "instructions": ""}],
            "fulfillment_type": "pickup",
            "address": None,
            "table_number": None,
            "scheduled_slot": "ASAP",
            "tip": 0,
            "promo_code": None,
            "contact_email": "price_test@test.com",
            "contact_name": "Price Test",
            "contact_phone": "",
            "origin_url": BASE_URL
        }
        
        create_response = requests.post(f"{BASE_URL}/api/orders", json=payload, allow_redirects=True)
        assert create_response.status_code == 200
        
        order_response = requests.get(f"{BASE_URL}/api/orders/{create_response.json()['order_id']}", allow_redirects=True)
        order = order_response.json()
        
        # Verify backend used DB price
        assert order["subtotal"] == db_price, f"Backend should use DB price ${db_price}, got ${order['subtotal']}"
        
        print(f"PASS: Backend uses DB price ${db_price} for item-001 var-duck-250")


class TestOrderPersistence:
    """Tests for order persistence in MongoDB"""
    
    def test_order_persisted_with_correct_status(self):
        """Order should be persisted with status='pending' and payment_status='initiated'"""
        payload = {
            "items": [{"item_id": "item-001", "variant_id": "var-duck-250", "modifiers": [], "qty": 1, "instructions": ""}],
            "fulfillment_type": "pickup",
            "address": None,
            "table_number": None,
            "scheduled_slot": "ASAP",
            "tip": 0,
            "promo_code": None,
            "contact_email": "persistence_test@test.com",
            "contact_name": "Persistence Test",
            "contact_phone": "",
            "origin_url": BASE_URL
        }
        
        create_response = requests.post(f"{BASE_URL}/api/orders", json=payload, allow_redirects=True)
        assert create_response.status_code == 200
        created = create_response.json()
        
        # Retrieve and verify
        order_response = requests.get(f"{BASE_URL}/api/orders/{created['order_id']}", allow_redirects=True)
        order = order_response.json()
        
        assert order["status"] == "pending", f"Order status should be 'pending', got '{order['status']}'"
        assert order["payment_status"] == "initiated", f"Payment status should be 'initiated', got '{order['payment_status']}'"
        
        print(f"PASS: Order persisted with status='{order['status']}', payment_status='{order['payment_status']}'")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
