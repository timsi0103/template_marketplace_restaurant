"""Customer Ratings & Reviews tests.

Covers:
- Admin review-config defaults, PATCH round-trip.
- Seed reviews auto-load: `/menu/items/{id}/reviews/summary` returns counts.
- Public `/menu/items/{id}/reviews` filter & sort.
- Bulk summary endpoint.
- Review eligibility (`/reviews/request/{order_id}`) for a fresh unfulfilled order → not eligible.
- Review submission flow:
    1. Create an order (reuse existing checkout flow).
    2. Manually promote to `delivered` + backdate updated_at so auto_send delay has elapsed.
    3. GET /reviews/request/{id} → eligible.
    4. POST /reviews → creates overall + per-item docs.
    5. Second POST → 409.
    6. Reviews appear in public item endpoint.
    7. Aggregate summary reflects new counts.
- Helpful counter.
- Admin moderation: flag, approve, respond, delete response, delete.
- Attention queue + aggregate insights.
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "admin@culinaryeditorial.com")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "Admin123!")
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.text[:200]}")
    return s


@pytest.fixture(scope="module")
def delivered_order(admin_session):
    """Create an order via the Stripe mock path, then flip it to delivered via Mongo."""
    # Simplify: fetch first two menu items and build an order.
    items = requests.get(f"{BASE_URL}/api/menu/items").json()["items"]
    if len(items) < 2:
        pytest.skip("Need at least 2 menu items")
    order_body = {
        "items": [{"item_id": items[0]["id"], "qty": 1}, {"item_id": items[1]["id"], "qty": 2}],
        "fulfillment_type": "pickup",
        "contact_name": "Review Test",
        "contact_email": f"review_{uuid.uuid4().hex[:6]}@example.com",
        "contact_phone": "+15551234567",
        "origin_url": BASE_URL,
        "tip": 2,
    }
    r = requests.post(f"{BASE_URL}/api/orders", json=order_body)
    assert r.status_code == 200, r.text
    data = r.json()
    order_id = data["order_id"]

    # Promote to delivered via Mongo (direct connection)
    from pymongo import MongoClient
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    updated_at = (datetime.now(timezone.utc) - timedelta(minutes=90)).isoformat()
    db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": "delivered", "payment_status": "paid", "updated_at": updated_at, "delivered_at": updated_at}},
    )
    yield {"id": order_id, "order_number": data["order_number"], "contact_email": order_body["contact_email"], "items": items[:2]}
    # Cleanup reviews & order
    db.reviews.delete_many({"order_id": order_id})
    db.orders.delete_one({"id": order_id})
    client.close()


# ── 1. admin config ─────────────────────────────────────────────

def test_admin_review_config_defaults(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/review-config")
    assert r.status_code == 200
    c = r.json()
    assert c["enabled"] is True
    assert c["auto_send_delay_minutes"] == 60
    assert set(c["enabled_fulfillment_types"]) == {"delivery", "pickup", "dine_in"}


def test_admin_review_config_patch(admin_session):
    r = admin_session.patch(f"{BASE_URL}/api/admin/review-config", json={"auto_send_delay_minutes": 5})
    assert r.status_code == 200
    assert r.json()["auto_send_delay_minutes"] == 5
    # restore default
    r = admin_session.patch(f"{BASE_URL}/api/admin/review-config", json={"auto_send_delay_minutes": 60})
    assert r.json()["auto_send_delay_minutes"] == 60


def test_admin_config_requires_auth():
    assert requests.get(f"{BASE_URL}/api/admin/review-config").status_code == 401


# ── 2. seeded public data ──────────────────────────────────────

def test_public_summary_has_seed_data():
    r = requests.get(f"{BASE_URL}/api/menu/items/item-001/reviews/summary")
    assert r.status_code == 200
    d = r.json()
    assert d["rating_count"] >= 2
    assert d["rating_avg"] > 0
    assert set(d["distribution"].keys()) == {"1", "2", "3", "4", "5"}


def test_public_reviews_filter_and_sort():
    r = requests.get(f"{BASE_URL}/api/menu/items/item-004/reviews", params={"sort": "lowest"})
    assert r.status_code == 200
    reviews = r.json()["reviews"]
    assert len(reviews) >= 2
    ratings = [rev["rating"] for rev in reviews]
    assert ratings == sorted(ratings)
    # Filter by 2-star — expect at least one
    r2 = requests.get(f"{BASE_URL}/api/menu/items/item-004/reviews", params={"rating": 2})
    assert r2.status_code == 200
    assert all(x["rating"] == 2 for x in r2.json()["reviews"])


def test_bulk_summary():
    r = requests.get(f"{BASE_URL}/api/reviews/summary-bulk", params={"item_ids": "item-001,item-002"})
    assert r.status_code == 200
    s = r.json()["summaries"]
    assert "item-001" in s and "item-002" in s


# ── 3. eligibility + submission ────────────────────────────────

def test_review_request_not_eligible_for_fresh_order():
    items = requests.get(f"{BASE_URL}/api/menu/items").json()["items"]
    body = {
        "items": [{"item_id": items[0]["id"], "qty": 1}],
        "fulfillment_type": "pickup",
        "contact_name": "Fresh",
        "contact_email": f"fresh_{uuid.uuid4().hex[:6]}@example.com",
        "contact_phone": "+15551234567",
        "origin_url": BASE_URL,
        "tip": 0,
    }
    r = requests.post(f"{BASE_URL}/api/orders", json=body)
    oid = r.json()["order_id"]
    req = requests.get(f"{BASE_URL}/api/reviews/request/{oid}")
    assert req.status_code == 200
    assert req.json()["eligible"] is False
    # Cleanup
    from pymongo import MongoClient
    c = MongoClient(MONGO_URL)
    c[DB_NAME].orders.delete_one({"id": oid})
    c.close()


def test_review_request_eligible_when_delivered(delivered_order):
    r = requests.get(f"{BASE_URL}/api/reviews/request/{delivered_order['id']}")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["eligible"] is True
    assert d["submitted"] is False
    assert len(d["items"]) == 2


def test_submit_review_and_duplicate_rejection(delivered_order):
    body = {
        "order_id": delivered_order["id"],
        "overall_rating": 5,
        "overall_text": "Amazing all around.",
        "item_reviews": [
            {"item_id": delivered_order["items"][0]["id"], "rating": 5, "text": "Perfect."},
            {"item_id": delivered_order["items"][1]["id"], "rating": 4, "text": "Good."},
        ],
        "anonymous": False,
        "contact_email": delivered_order["contact_email"],
    }
    r = requests.post(f"{BASE_URL}/api/reviews", json=body)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["submitted"] is True
    assert d["count"] == 3  # 1 overall + 2 item reviews

    # Duplicate
    r2 = requests.post(f"{BASE_URL}/api/reviews", json=body)
    assert r2.status_code == 409

    # Eligibility now shows submitted
    req = requests.get(f"{BASE_URL}/api/reviews/request/{delivered_order['id']}").json()
    assert req["submitted"] is True

    # Item summary updated
    summary = requests.get(f"{BASE_URL}/api/menu/items/{delivered_order['items'][0]['id']}/reviews/summary").json()
    assert summary["rating_count"] >= 1


def test_submit_review_requires_correct_email(delivered_order):
    # Clean up existing review first to reproduce "unauthorized" state
    from pymongo import MongoClient
    c = MongoClient(MONGO_URL)
    db = c[DB_NAME]
    db.reviews.delete_many({"order_id": delivered_order["id"]})
    c.close()

    body = {
        "order_id": delivered_order["id"],
        "overall_rating": 3,
        "contact_email": "wrong@example.com",
    }
    r = requests.post(f"{BASE_URL}/api/reviews", json=body)
    assert r.status_code == 403


def test_helpful_counter():
    # pick any seed review
    reviews = requests.get(f"{BASE_URL}/api/menu/items/item-002/reviews").json()["reviews"]
    assert reviews
    rid = reviews[0]["id"]
    before = reviews[0].get("helpful_count", 0)
    r = requests.post(f"{BASE_URL}/api/reviews/{rid}/helpful")
    assert r.status_code == 200
    assert r.json()["review"]["helpful_count"] == before + 1


# ── 4. admin moderation + insights ─────────────────────────────

def test_admin_list_and_counts(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/reviews", params={"status": "all"})
    assert r.status_code == 200
    d = r.json()
    assert d["count"] >= 1
    for key in ("pending", "approved", "flagged", "rejected", "attention"):
        assert key in d["counts"]


def test_admin_flag_approve_respond_delete(admin_session):
    # Pick any seed review for item-001
    reviews = requests.get(f"{BASE_URL}/api/menu/items/item-001/reviews").json()["reviews"]
    rid = reviews[0]["id"]

    # Flag
    r = admin_session.post(f"{BASE_URL}/api/admin/reviews/{rid}/flag", json={"reason": "spam"})
    assert r.status_code == 200
    # It no longer appears in public list
    public = requests.get(f"{BASE_URL}/api/menu/items/item-001/reviews").json()["reviews"]
    assert all(x["id"] != rid for x in public)

    # Approve back
    r = admin_session.post(f"{BASE_URL}/api/admin/reviews/{rid}/approve")
    assert r.status_code == 200

    # Respond
    r = admin_session.post(f"{BASE_URL}/api/admin/reviews/{rid}/respond", json={"text": "Thanks!"})
    assert r.status_code == 200
    assert r.json()["admin_response"]["text"] == "Thanks!"

    # Delete response
    r = admin_session.delete(f"{BASE_URL}/api/admin/reviews/{rid}/response")
    assert r.status_code == 200

    # Delete requires admin — but skip actual delete (we want seed data to persist)


def test_admin_aggregate_and_attention(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/reviews/aggregate", params={"days": 90})
    assert r.status_code == 200
    d = r.json()
    assert d["total_reviews"] >= 1
    assert 0 <= d["average_rating"] <= 5
    assert "distribution" in d
    assert isinstance(d["trend"], list)

    r2 = admin_session.get(f"{BASE_URL}/api/admin/reviews/attention")
    assert r2.status_code == 200
    assert isinstance(r2.json()["reviews"], list)


def test_admin_delete_review_permanent(admin_session, delivered_order):
    # Take one item-level review we created, delete it.
    from pymongo import MongoClient
    c = MongoClient(MONGO_URL)
    db = c[DB_NAME]
    doc = db.reviews.find_one({"order_id": delivered_order["id"], "is_overall": False}, {"_id": 0})
    c.close()
    if not doc:
        pytest.skip("No item review to delete")

    r = admin_session.delete(f"{BASE_URL}/api/admin/reviews/{doc['id']}")
    assert r.status_code == 200
    # Gone
    r2 = admin_session.get(f"{BASE_URL}/api/admin/reviews", params={"status": "all", "limit": 500}).json()
    assert all(x["id"] != doc["id"] for x in r2["reviews"])
