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
        json={"email": os.environ.get("TEST_ADMIN_EMAIL", "admin@culinaryeditorial.com"), "password": os.environ.get("TEST_ADMIN_PASSWORD", "Admin123!")},
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


# ─── BUG FIX 1: _deep_merge + _REPLACE_KEYS ───────────────

class TestDeepMergeReplaceKeys:
    """After BUG FIX 1, PATCH with category_overrides:{} or item_overrides:{} must clear."""

    def test_patch_can_clear_category_overrides(self, admin_session, default_region):
        rid = default_region["id"]
        # Seed with some overrides
        r1 = admin_session.patch(
            f"{BASE_URL}/api/admin/fees/regions/{rid}",
            json={"tax": {"category_overrides": {"desserts": 5.0, "mains": 20.0}}},
        )
        assert r1.status_code == 200
        assert r1.json()["tax"]["category_overrides"] == {"desserts": 5.0, "mains": 20.0}
        # Now clear with {}
        r2 = admin_session.patch(
            f"{BASE_URL}/api/admin/fees/regions/{rid}",
            json={"tax": {"category_overrides": {}}},
        )
        assert r2.status_code == 200
        assert r2.json()["tax"]["category_overrides"] == {}
        # Verify persisted via GET
        r3 = admin_session.get(f"{BASE_URL}/api/admin/fees/regions")
        got = next(x for x in r3.json()["regions"] if x["id"] == rid)
        assert got["tax"]["category_overrides"] == {}

    def test_patch_can_clear_item_overrides(self, admin_session, default_region):
        rid = default_region["id"]
        r1 = admin_session.patch(
            f"{BASE_URL}/api/admin/fees/regions/{rid}",
            json={"tax": {"item_overrides": {"itm_x": 0.0, "itm_y": 3.0}}},
        )
        assert r1.status_code == 200
        assert r1.json()["tax"]["item_overrides"] == {"itm_x": 0.0, "itm_y": 3.0}
        r2 = admin_session.patch(
            f"{BASE_URL}/api/admin/fees/regions/{rid}",
            json={"tax": {"item_overrides": {}}},
        )
        assert r2.status_code == 200
        assert r2.json()["tax"]["item_overrides"] == {}

    def test_patch_individual_override_still_works(self, admin_session, default_region):
        rid = default_region["id"]
        # start clean
        admin_session.patch(
            f"{BASE_URL}/api/admin/fees/regions/{rid}",
            json={"tax": {"category_overrides": {}}},
        )
        # add one
        r1 = admin_session.patch(
            f"{BASE_URL}/api/admin/fees/regions/{rid}",
            json={"tax": {"category_overrides": {"desserts": 5.0}}},
        )
        assert r1.json()["tax"]["category_overrides"] == {"desserts": 5.0}
        # cleanup
        admin_session.patch(
            f"{BASE_URL}/api/admin/fees/regions/{rid}",
            json={"tax": {"category_overrides": {}}},
        )

    def test_patch_tiers_list_replace_still_works(self, admin_session, default_region):
        rid = default_region["id"]
        r1 = admin_session.patch(
            f"{BASE_URL}/api/admin/fees/regions/{rid}",
            json={"delivery_rules": {"tiers": [{"min_subtotal": 50, "fee": 2.0}]}},
        )
        assert r1.status_code == 200
        assert r1.json()["delivery_rules"]["tiers"] == [{"min_subtotal": 50, "fee": 2.0}]
        # empty list clears
        r2 = admin_session.patch(
            f"{BASE_URL}/api/admin/fees/regions/{rid}",
            json={"delivery_rules": {"tiers": []}},
        )
        assert r2.json()["delivery_rules"]["tiers"] == []


# ─── BUG FIX 2: /fees/quote region_override for live preview ───

class TestQuoteRegionOverride:
    def test_override_tax_rate_not_persisted(self):
        """Sending region_override with tax.rate_pct=20 returns 20% even though stored is 8.75."""
        r = requests.post(
            f"{BASE_URL}/api/fees/quote",
            json={
                "items": [{"name": "A", "price": 100.0, "qty": 1}],
                "fulfillment_type": "pickup",
                "region_override": {"tax": {"rate_pct": 20.0, "name": "LIVE"}},
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert data["subtotal"] == 100.0
        assert round(data["tax"], 2) == 20.0
        assert data["region"]["tax_name"] == "LIVE"

    def test_override_service_charge_enabled(self):
        """Live-preview toggling service charge returns the override result immediately."""
        r = requests.post(
            f"{BASE_URL}/api/fees/quote",
            json={
                "items": [{"name": "A", "price": 100.0, "qty": 1}],
                "fulfillment_type": "pickup",
                "region_override": {
                    "tax": {"rate_pct": 20.0, "name": "LIVE"},
                    "service_charge": {"enabled": True, "type": "percent", "amount": 10},
                },
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert round(data["tax"], 2) == 20.0
        assert round(data["service_charge"], 2) == 10.0
        # 100 subtotal + 20 tax + 10 svc = 130
        assert round(data["total"], 2) == 130.0

    def test_override_tax_inclusive_flip(self):
        """Flipping inclusive=true at preview time: total stays ~same (gross already includes tax)."""
        # Non-inclusive baseline: 100 subtotal + 10 tax = 110
        r1 = requests.post(
            f"{BASE_URL}/api/fees/quote",
            json={
                "items": [{"name": "A", "price": 100.0, "qty": 1}],
                "fulfillment_type": "pickup",
                "region_override": {"tax": {"rate_pct": 10.0, "inclusive": False}},
            },
        )
        d1 = r1.json()
        assert round(d1["subtotal"], 2) == 100.0
        assert round(d1["tax"], 2) == 10.0
        assert round(d1["total"], 2) == 110.0
        # Inclusive: 100 gross -> net 90.91, tax 9.09, total 100
        r2 = requests.post(
            f"{BASE_URL}/api/fees/quote",
            json={
                "items": [{"name": "A", "price": 100.0, "qty": 1}],
                "fulfillment_type": "pickup",
                "region_override": {"tax": {"rate_pct": 10.0, "inclusive": True}},
            },
        )
        d2 = r2.json()
        assert round(d2["total"], 2) == 100.0
        assert round(d2["subtotal"] + d2["tax"], 2) == 100.0

    def test_override_does_not_persist(self, admin_session, default_region):
        """Sending an override must not alter the stored region."""
        rid = default_region["id"]
        r = admin_session.get(f"{BASE_URL}/api/admin/fees/regions")
        before = next(x for x in r.json()["regions"] if x["id"] == rid)
        assert float(before["tax"]["rate_pct"]) == 8.75
        # Fire a quote with override
        requests.post(
            f"{BASE_URL}/api/fees/quote",
            json={
                "items": [{"name": "A", "price": 100.0, "qty": 1}],
                "fulfillment_type": "pickup",
                "region_override": {"tax": {"rate_pct": 99.0}},
            },
        )
        r2 = admin_session.get(f"{BASE_URL}/api/admin/fees/regions")
        after = next(x for x in r2.json()["regions"] if x["id"] == rid)
        assert float(after["tax"]["rate_pct"]) == 8.75


# ─── create_region deepcopy isolation ─────────────────────

class TestCreateRegionDeepCopy:
    def test_mutating_new_region_does_not_affect_default(self, admin_session, created_region_ids):
        # Create new region
        r = admin_session.post(
            f"{BASE_URL}/api/admin/fees/regions",
            json={"name": "TEST_ISOLATE", "region_code": "TEST_iso"},
        )
        assert r.status_code == 200
        new_rid = r.json()["id"]
        created_region_ids.append(new_rid)
        # Mutate nested tax on the new region
        admin_session.patch(
            f"{BASE_URL}/api/admin/fees/regions/{new_rid}",
            json={"tax": {"rate_pct": 33.3, "category_overrides": {"zzz": 99.0}}},
        )
        # Fetch default — must NOT be mutated
        r2 = admin_session.get(f"{BASE_URL}/api/admin/fees/regions")
        default = next(x for x in r2.json()["regions"] if x.get("is_default"))
        assert float(default["tax"]["rate_pct"]) == 8.75
        assert default["tax"]["category_overrides"] == {}


# ─── Tax Report with inclusive tax ────────────────────────

class TestTaxReportInclusive:
    def test_inclusive_tax_taxable_base_is_net(self, admin_session, created_region_ids):
        """With inclusive tax, taxable_base must be the net (gross/(1+rate)), not gross."""
        from pymongo import MongoClient
        from datetime import datetime, timezone
        import os as _os

        mongo_url = _os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = _os.environ.get("DB_NAME", "test_database")
        client = MongoClient(mongo_url)
        db = client[db_name]

        # Create an inclusive region at 8%
        r = admin_session.post(
            f"{BASE_URL}/api/admin/fees/regions",
            json={"name": "TEST_INC", "region_code": "TEST_inc"},
        )
        assert r.status_code == 200
        inc_rid = r.json()["id"]
        created_region_ids.append(inc_rid)
        admin_session.patch(
            f"{BASE_URL}/api/admin/fees/regions/{inc_rid}",
            json={"tax": {"inclusive": True, "rate_pct": 8.0, "category_overrides": {}}},
        )

        # Insert an order manually: $108 subtotal @ 8% inclusive -> net $100, tax $8
        order_id = "TEST_inc_order_1"
        now_iso = datetime.now(timezone.utc).isoformat()
        db.orders.delete_many({"id": order_id})
        db.orders.insert_one({
            "id": order_id,
            "payment_status": "paid",
            "created_at": now_iso,
            "subtotal": 108.0,
            "tax": 8.0,
            "items": [{
                "category": "mains",
                "qty": 1,
                "price": 108.0,
            }],
        })

        try:
            rr = admin_session.get(
                f"{BASE_URL}/api/admin/fees/tax-report",
                params={"region_id": inc_rid},
            )
            assert rr.status_code == 200
            body = rr.text
            # Find the 'mains' row line — qty 1, taxable_base should be 100.00 (not 108.00)
            lines = [ln for ln in body.splitlines() if ln.startswith("mains,")]
            assert lines, f"No 'mains' row in CSV:\n{body}"
            parts = lines[0].split(",")
            # category, qty, taxable_base, effective_rate_pct, tax_collected
            taxable_base = float(parts[2])
            assert abs(taxable_base - 100.0) < 0.01, f"taxable_base={taxable_base}, expected 100.00"
        finally:
            db.orders.delete_many({"id": order_id})
            client.close()
