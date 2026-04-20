"""
Backend tests for Guest Checkout Conversion endpoints:
- POST /api/auth/check-email
- POST /api/auth/claim-orders
"""
import os
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://food-delivery-hub-275.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


@pytest.fixture(scope="module")
def db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def test_email_suffix():
    return f"_{uuid.uuid4().hex[:6]}_test_guest@example.com"


@pytest.fixture(scope="module")
def cleanup(db, test_email_suffix):
    yield
    # Delete any test-seeded users + orders
    db.users.delete_many({"email": {"$regex": test_email_suffix.replace(".", r"\.")}})
    db.orders.delete_many({"contact_email": {"$regex": test_email_suffix.replace(".", r"\.")}})


# ------- check-email -------

class TestCheckEmail:
    def test_check_existing_admin_email(self, api):
        r = api.post(f"{BASE_URL}/api/auth/check-email", json={"email": "admin@culinaryeditorial.com"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["exists"] is True
        assert data["auth_provider"] == "email"

    def test_check_fresh_email(self, api):
        fresh = f"nouser_{uuid.uuid4().hex[:10]}@example.com"
        r = api.post(f"{BASE_URL}/api/auth/check-email", json={"email": fresh})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["exists"] is False
        assert data["auth_provider"] is None


# ------- claim-orders -------

class TestClaimOrders:
    def _seed_order(self, db, email, total=42.5, order_id=None):
        oid = order_id or f"order_{uuid.uuid4().hex[:10]}"
        db.orders.insert_one({
            "id": oid,
            "contact_email": email,
            "contact_name": "Guest Tester",
            "payment_status": "paid",
            "total": total,
            "user_id": None,
            "status": "pending",
        })
        return oid

    def test_claim_order_not_found(self, api, test_email_suffix):
        email = f"nf{test_email_suffix}"
        r = api.post(f"{BASE_URL}/api/auth/claim-orders", json={
            "email": email, "password": "testpw123", "order_id": "order_does_not_exist_xyz"
        })
        assert r.status_code == 404, r.text

    def test_claim_email_mismatch(self, api, db, test_email_suffix):
        email = f"mm{test_email_suffix}"
        oid = self._seed_order(db, email)
        r = api.post(f"{BASE_URL}/api/auth/claim-orders", json={
            "email": f"other{test_email_suffix}", "password": "testpw123", "order_id": oid
        })
        assert r.status_code == 400, r.text
        assert "match" in r.json().get("detail", "").lower()

    def test_claim_short_password(self, api, db, test_email_suffix):
        email = f"sp{test_email_suffix}"
        oid = self._seed_order(db, email)
        r = api.post(f"{BASE_URL}/api/auth/claim-orders", json={
            "email": email, "password": "12345", "order_id": oid
        })
        assert r.status_code == 400, r.text
        assert "6 character" in r.json().get("detail", "").lower()

    def test_claim_happy_path_multi_order(self, api, db, test_email_suffix, cleanup):
        """Seed 2 guest orders same email; claim via one → both linked; points = sum of floor(total)."""
        email = f"hp{test_email_suffix}"
        oid1 = self._seed_order(db, email, total=42.5)
        oid2 = self._seed_order(db, email, total=17.25)

        sess = requests.Session()
        sess.headers.update({"Content-Type": "application/json"})
        r = sess.post(f"{BASE_URL}/api/auth/claim-orders", json={
            "email": email, "password": "testpw123", "order_id": oid1
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == email
        assert "user_id" in data and data["user_id"].startswith("user_")
        assert data["claimed_orders"] == 2
        # floor(42.5)=42 + floor(17.25)=17 → 59
        assert data["loyalty_points"] == 59, f"expected 59, got {data['loyalty_points']}"

        # Auth cookies should be set (allow either cookie jar or set-cookie header)
        cookies_set = bool(sess.cookies.get("access_token")) or "access_token" in (r.headers.get("set-cookie") or "").lower()
        assert cookies_set, "Expected auth cookies after claim-orders"

        # Both orders now linked to new user_id
        new_uid = data["user_id"]
        o1 = db.orders.find_one({"id": oid1})
        o2 = db.orders.find_one({"id": oid2})
        assert o1["user_id"] == new_uid
        assert o2["user_id"] == new_uid

        # /api/auth/me returns new user
        me = sess.get(f"{BASE_URL}/api/auth/me")
        assert me.status_code == 200, me.text
        assert me.json()["email"] == email

        # Existing-user conflict path: second claim with different order but same email → 409
        oid3 = self._seed_order(db, email, total=10.0)
        sess2 = requests.Session()
        sess2.headers.update({"Content-Type": "application/json"})
        r_dup = sess2.post(f"{BASE_URL}/api/auth/claim-orders", json={
            "email": email, "password": "otherpw456", "order_id": oid3
        })
        assert r_dup.status_code == 409, r_dup.text
        assert "already exists" in r_dup.json().get("detail", "").lower()

        # Subsequent login with claimed email + ORIGINAL password works
        login = requests.Session()
        login.headers.update({"Content-Type": "application/json"})
        lr = login.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "testpw123"})
        assert lr.status_code == 200, lr.text
        assert lr.json()["email"] == email


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
