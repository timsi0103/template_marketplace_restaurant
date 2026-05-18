"""Footer fixes backend tests: newsletter subscribe + storefront social URLs."""
import os
import requests
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://restaurant-stack.preview.emergentagent.com").rstrip("/")


def test_storefront_settings_returns_social_urls():
    r = requests.get(f"{BASE_URL}/api/storefront/settings", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "social" in data, "social key missing"
    social = data["social"]
    for k in ["instagram", "twitter", "facebook", "pinterest"]:
        assert k in social, f"{k} missing in social"
        assert isinstance(social[k], str)
    # placeholder URLs should be set by default
    assert social["instagram"].startswith("http"), f"instagram not populated: {social['instagram']}"
    assert social["twitter"].startswith("http")
    assert social["facebook"].startswith("http")
    assert social["pinterest"].startswith("http")


def test_newsletter_subscribe_success():
    email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(
        f"{BASE_URL}/api/newsletter/subscribe",
        json={"email": email, "source": "footer"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("subscribed") is True


def test_newsletter_subscribe_idempotent():
    email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
    r1 = requests.post(f"{BASE_URL}/api/newsletter/subscribe", json={"email": email}, timeout=15)
    r2 = requests.post(f"{BASE_URL}/api/newsletter/subscribe", json={"email": email}, timeout=15)
    assert r1.status_code == 200 and r2.status_code == 200


def test_newsletter_subscribe_invalid_email():
    r = requests.post(f"{BASE_URL}/api/newsletter/subscribe", json={"email": "notanemail"}, timeout=15)
    assert r.status_code == 400


def test_newsletter_subscribe_empty_email():
    r = requests.post(f"{BASE_URL}/api/newsletter/subscribe", json={"email": ""}, timeout=15)
    assert r.status_code == 400
