"""Phase 11: Tax & Service Charge Configuration tests.
Covers:
- Region CRUD (default seed, create, patch deep-merge, delete-default-forbidden)
- Public /fees/default-region
- /fees/quote (basic, item+category overrides, inclusive extraction, tiered delivery,
  delivery_blocked min_order, charges percent/flat)
- /admin/fees/tax-report CSV headers
- Auth guards on admin endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@culinaryeditorial.com", "password": "Admin123!"},
    )
    if r.status_code != 200:
        pytest.skip("Admin login failed")
    return s


@pytest.fixture(scope="module")
def default_region(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/fees/regions")
    assert r.status_code == 200
    regions = r.json()["regions"]
    default = next((x for x in regions if x.get("is_default")), None)
    assert default, "no default region found"
    return default


@pytest.fixture(scope="module")
def created_region_ids():
    ids: list = []
    yield ids


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_session, created_region_ids):
    """After all tests, delete created regions and reset default region to baseline."""
    yield
    for rid in created_region_ids:
        try:
            admin_session.delete(f"{BASE_URL}/api/admin/fees/regions/{rid}")
        except Exception:
            pass
    # Reset default region
    r = admin_session.get(f"{BASE_URL}/api/admin/fees/regions")
    if r.status_code == 200:
        default = next((x for x in r.json()["regions"] if x.get("is_default")), None)
        if default:
            admin_session.patch(
                f"{BASE_URL}/api/admin/fees/regions/{default['id']}",
                json={
                    "tax": {"name": "Sales Tax", "rate_pct": 8.75, "inclusive": False,
                            "category_overrides": {}, "item_overrides": {}},
                    "service_charge": {"enabled": False, "name": "Service Charge",
                                       "type": "percent", "amount": 0},
                    "packaging_fee": {"enabled": False, "name": "Packaging",
                                      "type": "flat", "amount": 0, "taxable": False},
                    "eco_fee": {"enabled": False, "name": "Eco-compliance",
                                "type": "flat", "amount": 0, "taxable": False},
                    "delivery_rules": {"type": "flat", "flat_amount": 4.99,
                                       "per_km": 1.50, "base_distance_km": 0,
                                       "tiers": [], "min_order": 0},
                },
            )


# ─── Auth guards ──────────────────────────────────────────

class TestAuthGuards:
    def test_list_regions_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/fees/regions")
        assert r.status_code in (401, 403)

    def test_create_region_requires_admin(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/fees/regions",
            json={"name": "X", "region_code": "x"},
        )
        assert r.status_code in (401, 403)

    def test_patch_region_requires_admin(self):
        r = requests.patch(
            f"{BASE_URL}/api/admin/fees/regions/reg_default",
            json={"name": "hax"},
        )
        assert r.status_code in (401, 403)

    def test_delete_region_requires_admin(self):
        r = requests.delete(f"{BASE_URL}/api/admin/fees/regions/reg_default")
        assert r.status_code in (401, 403)

    def test_tax_report_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/fees/tax-report")
        assert r.status_code in (401, 403)


# ─── Region seed / list ───────────────────────────────────

class TestRegionSeed:
    def test_default_region_seed_and_id(self, default_region):
        assert default_region["id"] == "reg_default"
        assert default_region["region_code"] == "default"
        assert default_region["is_default"] is True
        assert default_region["tax"]["name"] == "Sales Tax"
        assert float(default_region["tax"]["rate_pct"]) == 8.75

    def test_public_default_region(self, default_region):
        r = requests.get(f"{BASE_URL}/api/fees/default-region")
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == "reg_default"
        assert data["region_code"] == "default"
        assert data["tax_name"] == "Sales Tax"
        assert data["tax_inclusive"] is False


# ─── Region CRUD ──────────────────────────────────────────

class TestRegionCRUD:
    def test_create_region(self, admin_session, created_region_ids):
        r = admin_session.post(
            f"{BASE_URL}/api/admin/fees/regions",
            json={"name": "TEST_EU", "region_code": "TEST_eu", "is_default": False},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == "TEST_EU"
        assert data["region_code"] == "TEST_eu"
        assert data["is_default"] is False
        assert data["id"].startswith("reg_")
        created_region_ids.append(data["id"])

    def test_patch_region_deep_merge(self, admin_session, created_region_ids):
        assert created_region_ids
        rid = created_region_ids[0]
        r = admin_session.patch(
            f"{BASE_URL}/api/admin/fees/regions/{rid}",
            json={
                "tax": {"name": "VAT", "rate_pct": 20.0, "inclusive": True,
                        "category_overrides": {"desserts": 5.0}},
                "service_charge": {"enabled": True, "type": "percent", "amount": 10},
            },
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["tax"]["name"] == "VAT"
        assert data["tax"]["rate_pct"] == 20.0
        assert data["tax"]["inclusive"] is True
        assert data["tax"]["category_overrides"] == {"desserts": 5.0}
        assert data["service_charge"]["enabled"] is True
        assert data["service_charge"]["type"] == "percent"

    def test_promote_default_demotes_others(self, admin_session, default_region, created_region_ids):
        """Setting is_default=true on another region demotes the current default."""
        rid = created_region_ids[0]
        r = admin_session.patch(
            f"{BASE_URL}/api/admin/fees/regions/{rid}",
            json={"is_default": True},
        )
        assert r.status_code == 200
        r2 = admin_session.get(f"{BASE_URL}/api/admin/fees/regions")
        regions = r2.json()["regions"]
        defaults = [x for x in regions if x.get("is_default")]
        assert len(defaults) == 1
        assert defaults[0]["id"] == rid
        # restore
        admin_session.patch(
            f"{BASE_URL}/api/admin/fees/regions/{default_region['id']}",
            json={"is_default": True},
        )

    def test_cannot_delete_default(self, admin_session, default_region):
        r = admin_session.delete(f"{BASE_URL}/api/admin/fees/regions/{default_region['id']}")
        assert r.status_code == 400
        assert "default" in r.text.lower()

    def test_delete_non_default(self, admin_session):
        # create an extra region and delete it
        r = admin_session.post(
            f"{BASE_URL}/api/admin/fees/regions",
            json={"name": "TEST_DEL", "region_code": "TEST_del"},
        )
        rid = r.json()["id"]
        rd = admin_session.delete(f"{BASE_URL}/api/admin/fees/regions/{rid}")
        assert rd.status_code == 200
        assert rd.json().get("deleted") is True


# ─── Pricing Quote ────────────────────────────────────────

class TestPricingQuote:
    def test_basic_quote_uses_default_rate(self):
        r = requests.post(
            f"{BASE_URL}/api/fees/quote",
            json={"items": [{"name": "A", "price": 10.0, "qty": 2}],
                  "fulfillment_type": "pickup"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["subtotal"] == 20.0
        # 8.75% default
        assert round(data["tax"], 2) == round(20.0 * 0.0875, 2)
        assert data["delivery_fee"] == 0

    def test_quote_with_item_and_category_overrides(self, admin_session, default_region):
        # Patch default region with overrides for this test, then restore.
        rid = default_region["id"]
        admin_session.patch(
            f"{BASE_URL}/api/admin/fees/regions/{rid}",
            json={"tax": {"rate_pct": 8.75,
                          "category_overrides": {"mains": 20.0, "desserts": 5.0},
                          "item_overrides": {"itm_special": 0.0}}},
        )
        try:
            r = requests.post(
                f"{BASE_URL}/api/fees/quote",
                json={"items": [
                    {"item_id": "itm_duck", "category": "mains", "name": "Duck",
                     "price": 50.0, "qty": 1},
                    {"item_id": "itm_tart", "category": "desserts", "name": "Tart",
                     "price": 20.0, "qty": 1},
                    {"item_id": "itm_special", "category": "mains", "name": "Free-tax",
                     "price": 10.0, "qty": 1},
                ], "fulfillment_type": "pickup"},
            )
            assert r.status_code == 200
            data = r.json()
            assert data["subtotal"] == 80.0
            # duck 50*20% = 10, tart 20*5% = 1, special override=0 → 11
            assert round(data["tax"], 2) == 11.0
            rates = {b["rate_pct"] for b in data["tax_breakdown"]}
            assert 20.0 in rates and 5.0 in rates and 0.0 in rates
        finally:
            admin_session.patch(
                f"{BASE_URL}/api/admin/fees/regions/{rid}",
                json={"tax": {"rate_pct": 8.75,
                              "category_overrides": {}, "item_overrides": {}}},
            )

    def test_quote_inclusive_tax_extracted(self, admin_session, default_region):
        rid = default_region["id"]
        admin_session.patch(
            f"{BASE_URL}/api/admin/fees/regions/{rid}",
            json={"tax": {"inclusive": True, "rate_pct": 10.0}},
        )
        try:
            r = requests.post(
                f"{BASE_URL}/api/fees/quote",
                json={"items": [{"name": "A", "price": 110.0, "qty": 1}],
                      "fulfillment_type": "pickup"},
            )
            data = r.json()
            # net 100, tax 10
            assert round(data["subtotal"], 2) == 100.0
            assert round(data["tax"], 2) == 10.0
            # total = gross 110 when inclusive (no additional charges/tip/delivery)
            assert round(data["total"], 2) == 110.0
        finally:
            admin_session.patch(
                f"{BASE_URL}/api/admin/fees/regions/{rid}",
                json={"tax": {"inclusive": False, "rate_pct": 8.75}},
            )

    def test_quote_tiered_delivery_match(self, admin_session, default_region):
        rid = default_region["id"]
        admin_session.patch(
            f"{BASE_URL}/api/admin/fees/regions/{rid}",
            json={"delivery_rules": {
                "type": "tiered", "flat_amount": 5.99, "min_order": 0,
                "tiers": [
                    {"min_subtotal": 30, "fee": 3.99},
                    {"min_subtotal": 60, "fee": 0},
                ],
            }},
        )
        try:
            # subtotal 70 -> 0 (tier2 matches, highest)
            r = requests.post(
                f"{BASE_URL}/api/fees/quote",
                json={"items": [{"name": "A", "price": 70.0, "qty": 1}],
                      "fulfillment_type": "delivery", "distance_km": 3},
            )
            assert r.json()["delivery_fee"] == 0.0
            # subtotal 40 -> 3.99 (tier1 match only)
            r2 = requests.post(
                f"{BASE_URL}/api/fees/quote",
                json={"items": [{"name": "A", "price": 40.0, "qty": 1}],
                      "fulfillment_type": "delivery", "distance_km": 3},
            )
            assert r2.json()["delivery_fee"] == 3.99
            # subtotal 10 -> fallback flat 5.99
            r3 = requests.post(
                f"{BASE_URL}/api/fees/quote",
                json={"items": [{"name": "A", "price": 10.0, "qty": 1}],
                      "fulfillment_type": "delivery", "distance_km": 3},
            )
            assert r3.json()["delivery_fee"] == 5.99
        finally:
            admin_session.patch(
                f"{BASE_URL}/api/admin/fees/regions/{rid}",
                json={"delivery_rules": {"type": "flat", "flat_amount": 4.99,
                                         "per_km": 1.50, "base_distance_km": 0,
                                         "tiers": [], "min_order": 0}},
            )

    def test_quote_delivery_blocked_below_min_order(self, admin_session, default_region):
        rid = default_region["id"]
        admin_session.patch(
            f"{BASE_URL}/api/admin/fees/regions/{rid}",
            json={"delivery_rules": {"type": "flat", "flat_amount": 4.99,
                                     "min_order": 25}},
        )
        try:
            r = requests.post(
                f"{BASE_URL}/api/fees/quote",
                json={"items": [{"name": "A", "price": 10.0, "qty": 1}],
                      "fulfillment_type": "delivery"},
            )
            data = r.json()
            assert data["delivery_blocked"] is True
            assert data["min_order"] == 25
        finally:
            admin_session.patch(
                f"{BASE_URL}/api/admin/fees/regions/{rid}",
                json={"delivery_rules": {"type": "flat", "flat_amount": 4.99,
                                         "min_order": 0}},
            )

    def test_quote_service_charge_percent_and_packaging_flat(self, admin_session, default_region):
        rid = default_region["id"]
        admin_session.patch(
            f"{BASE_URL}/api/admin/fees/regions/{rid}",
            json={
                "service_charge": {"enabled": True, "type": "percent", "amount": 10},
                "packaging_fee": {"enabled": True, "type": "flat", "amount": 1.5},
                "eco_fee": {"enabled": True, "type": "percent", "amount": 2},
            },
        )
        try:
            r = requests.post(
                f"{BASE_URL}/api/fees/quote",
                json={"items": [{"name": "A", "price": 50.0, "qty": 1}],
                      "fulfillment_type": "pickup", "tip": 5},
            )
            data = r.json()
            assert data["service_charge"] == 5.0   # 10% of 50
            assert data["packaging_fee"] == 1.5    # flat
            assert data["eco_fee"] == 1.0          # 2% of 50
            assert data["tip"] == 5.0
        finally:
            admin_session.patch(
                f"{BASE_URL}/api/admin/fees/regions/{rid}",
                json={
                    "service_charge": {"enabled": False, "type": "percent", "amount": 0},
                    "packaging_fee": {"enabled": False, "type": "flat", "amount": 0},
                    "eco_fee": {"enabled": False, "type": "flat", "amount": 0},
                },
            )


# ─── Tax Report CSV ───────────────────────────────────────

class TestTaxReport:
    def test_tax_report_csv_headers(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/fees/tax-report")
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "").lower()
        assert "attachment" in r.headers.get("content-disposition", "").lower()
        body = r.text
        assert "Tax Report" in body
        assert "Period" in body
        assert "Totals" in body
        assert "By category" in body
        assert "effective_rate_pct" in body
