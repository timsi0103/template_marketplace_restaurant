"""Tax & service charges, delivery rules, additional fees.
Configuration is organized by *region* (multi-jurisdiction). If no region exists the
module returns sensible defaults matching the historic TAX_RATE / DELIVERY_FEE constants
so existing order flows keep working.

Also exposes:
- /api/fees/quote           (public) — live checkout preview
- /api/admin/fees/tax-report (admin)  — CSV export for accountants
"""
from fastapi import HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List, Literal
from collections import defaultdict
import io
import csv
import uuid
import copy

from core import api_router, db, require_admin


DEFAULT_REGION = {
    "id": "reg_default",
    "region_code": "default",
    "name": "Default",
    "is_default": True,
    "tax": {
        "name": "Sales Tax",
        "rate_pct": 8.75,
        "inclusive": False,
        "category_overrides": {},  # {category_slug: rate_pct}
        "item_overrides": {},       # {item_id: rate_pct}
    },
    "service_charge": {"enabled": False, "name": "Service Charge", "type": "percent", "amount": 0},
    "packaging_fee": {"enabled": False, "name": "Packaging", "type": "flat", "amount": 0, "taxable": False},
    "eco_fee": {"enabled": False, "name": "Eco-compliance", "type": "flat", "amount": 0, "taxable": False},
    "delivery_rules": {
        "type": "flat",   # flat | distance | tiered
        "flat_amount": 4.99,
        "per_km": 1.50,
        "base_distance_km": 0,
        "tiers": [],       # [{min_subtotal: number, fee: number}]
        "min_order": 0,
    },
}


async def _ensure_default_region() -> dict:
    doc = await db.tax_regions.find_one({"is_default": True}, {"_id": 0})
    if doc:
        return doc
    seed = copy.deepcopy(DEFAULT_REGION)
    seed["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.tax_regions.insert_one(dict(seed))
    return seed


async def _get_region(region_id: Optional[str] = None) -> dict:
    if region_id:
        doc = await db.tax_regions.find_one({"id": region_id}, {"_id": 0})
        if doc:
            return doc
    return await _ensure_default_region()


# ─── Schemas ──────────────────────────────────────────────

class TaxBlock(BaseModel):
    name: Optional[str] = None
    rate_pct: Optional[float] = None
    inclusive: Optional[bool] = None
    category_overrides: Optional[Dict[str, float]] = None
    item_overrides: Optional[Dict[str, float]] = None


class ChargeBlock(BaseModel):
    enabled: Optional[bool] = None
    name: Optional[str] = None
    type: Optional[Literal["flat", "percent"]] = None
    amount: Optional[float] = None
    taxable: Optional[bool] = None


class DeliveryRulesBlock(BaseModel):
    type: Optional[Literal["flat", "distance", "tiered"]] = None
    flat_amount: Optional[float] = None
    per_km: Optional[float] = None
    base_distance_km: Optional[float] = None
    tiers: Optional[List[Dict[str, float]]] = None
    min_order: Optional[float] = None


class RegionCreate(BaseModel):
    name: str
    region_code: str
    is_default: bool = False


class RegionPatch(BaseModel):
    name: Optional[str] = None
    region_code: Optional[str] = None
    is_default: Optional[bool] = None
    tax: Optional[TaxBlock] = None
    service_charge: Optional[ChargeBlock] = None
    packaging_fee: Optional[ChargeBlock] = None
    eco_fee: Optional[ChargeBlock] = None
    delivery_rules: Optional[DeliveryRulesBlock] = None


# ─── Region CRUD ──────────────────────────────────────────

@api_router.get("/admin/fees/regions")
async def list_regions(request: Request):
    await require_admin(request)
    await _ensure_default_region()
    docs = await db.tax_regions.find({}, {"_id": 0}).sort([("is_default", -1), ("created_at", 1)]).to_list(200)
    return {"regions": docs}


@api_router.post("/admin/fees/regions")
async def create_region(body: RegionCreate, request: Request):
    await require_admin(request)
    rid = f"reg_{uuid.uuid4().hex[:10]}"
    doc = copy.deepcopy(DEFAULT_REGION)
    doc.update({"id": rid, "name": body.name, "region_code": body.region_code, "is_default": False,
                "created_at": datetime.now(timezone.utc).isoformat()})
    if body.is_default:
        await db.tax_regions.update_many({}, {"$set": {"is_default": False}})
        doc["is_default"] = True
    await db.tax_regions.insert_one(dict(doc))
    return doc


def _deep_merge(base: dict, patch: dict, replace_keys: Optional[set] = None) -> dict:
    replace_keys = replace_keys or set()
    for k, v in patch.items():
        if k in replace_keys:
            base[k] = v
        elif isinstance(v, dict) and isinstance(base.get(k), dict):
            _deep_merge(base[k], v, replace_keys=replace_keys)
        else:
            base[k] = v
    return base


# Fields whose dict value should REPLACE (not merge) — so sending {} clears them.
_REPLACE_KEYS = {"category_overrides", "item_overrides"}


@api_router.patch("/admin/fees/regions/{rid}")
async def patch_region(rid: str, body: RegionPatch, request: Request):
    await require_admin(request)
    existing = await db.tax_regions.find_one({"id": rid}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Region not found")
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise HTTPException(status_code=400, detail="No changes")
    if patch.get("is_default"):
        await db.tax_regions.update_many({"id": {"$ne": rid}}, {"$set": {"is_default": False}})
    merged = _deep_merge(dict(existing), patch, replace_keys=_REPLACE_KEYS)
    merged["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.tax_regions.update_one({"id": rid}, {"$set": merged})
    return await db.tax_regions.find_one({"id": rid}, {"_id": 0})


@api_router.delete("/admin/fees/regions/{rid}")
async def delete_region(rid: str, request: Request):
    await require_admin(request)
    existing = await db.tax_regions.find_one({"id": rid}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Region not found")
    if existing.get("is_default"):
        raise HTTPException(status_code=400, detail="Cannot delete the default region")
    await db.tax_regions.delete_one({"id": rid})
    return {"deleted": True}


@api_router.get("/fees/default-region")
async def get_default_region_public():
    """Exposed to frontend so the checkout can render the right labels (Sales Tax / VAT / GST)."""
    r = await _ensure_default_region()
    return {
        "id": r["id"],
        "region_code": r["region_code"],
        "name": r["name"],
        "tax_name": r["tax"]["name"],
        "tax_inclusive": bool(r["tax"].get("inclusive")),
    }


# ─── Pricing quote ────────────────────────────────────────

class QuoteItem(BaseModel):
    item_id: Optional[str] = None
    category: Optional[str] = None
    name: Optional[str] = ""
    price: float
    qty: int = 1


class QuoteRequest(BaseModel):
    items: List[QuoteItem]
    fulfillment_type: Literal["delivery", "pickup", "dine_in"] = "pickup"
    region_id: Optional[str] = None
    region_override: Optional[Dict[str, Any]] = None  # unsaved config for live preview
    distance_km: Optional[float] = 0
    tip: float = 0
    promo_code: Optional[str] = None


def _charge_amount(cfg: dict, base: float) -> float:
    if not cfg.get("enabled"):
        return 0.0
    amt = float(cfg.get("amount") or 0)
    if cfg.get("type") == "percent":
        return round(base * amt / 100, 2)
    return round(amt, 2)


def _delivery_fee(rules: dict, subtotal: float, distance_km: float) -> float:
    t = rules.get("type", "flat")
    if t == "flat":
        return round(float(rules.get("flat_amount") or 0), 2)
    if t == "distance":
        base = float(rules.get("base_distance_km") or 0)
        per = float(rules.get("per_km") or 0)
        km = max(0.0, float(distance_km or 0) - base)
        return round(km * per, 2)
    if t == "tiered":
        best = float(rules.get("flat_amount") or 0)
        for tier in rules.get("tiers") or []:
            if subtotal >= float(tier.get("min_subtotal") or 0):
                best = float(tier.get("fee") or 0)
        return round(best, 2)
    return 0.0


async def _resolve_item_tax(region: dict, item: QuoteItem) -> float:
    tax = region["tax"]
    default_rate = float(tax.get("rate_pct") or 0) / 100
    item_ov = tax.get("item_overrides") or {}
    cat_ov = tax.get("category_overrides") or {}
    if item.item_id and item.item_id in item_ov:
        return float(item_ov[item.item_id]) / 100
    if item.category and item.category in cat_ov:
        return float(cat_ov[item.category]) / 100
    return default_rate


@api_router.post("/fees/quote")
async def pricing_quote(body: QuoteRequest):
    region = await _get_region(body.region_id)
    if body.region_override:
        region = _deep_merge(dict(region), body.region_override, replace_keys=_REPLACE_KEYS)
    tax_cfg = region["tax"]
    inclusive = bool(tax_cfg.get("inclusive"))

    lines = []
    subtotal = 0.0
    tax_by_rate: dict = defaultdict(float)

    for it in body.items:
        rate = await _resolve_item_tax(region, it)
        gross = round(it.price * it.qty, 2)
        if inclusive:
            # price already includes tax → extract it
            net = round(gross / (1 + rate), 2) if rate else gross
            line_tax = round(gross - net, 2)
            subtotal += net
        else:
            line_tax = round(gross * rate, 2)
            subtotal += gross
        tax_by_rate[round(rate * 100, 4)] += line_tax
        lines.append({
            "item_id": it.item_id, "name": it.name, "qty": it.qty,
            "unit_price": it.price, "line_total": gross,
            "tax_rate": round(rate * 100, 4), "tax": line_tax,
        })

    subtotal = round(subtotal, 2)
    tax = round(sum(tax_by_rate.values()), 2)

    # Service charge on subtotal (pre-tax base)
    service_charge = _charge_amount(region["service_charge"], subtotal)
    # Additional charges — configurable flat or percent
    packaging_fee = _charge_amount(region["packaging_fee"], subtotal)
    eco_fee = _charge_amount(region["eco_fee"], subtotal)

    # Delivery
    delivery_fee = 0.0
    rules = region.get("delivery_rules") or {}
    min_order = float(rules.get("min_order") or 0)
    delivery_blocked = False
    if body.fulfillment_type == "delivery":
        delivery_fee = _delivery_fee(rules, subtotal, body.distance_km or 0)
        if subtotal < min_order:
            delivery_blocked = True

    tip = round(max(0.0, float(body.tip or 0)), 2)
    total = round(
        (subtotal if not inclusive else subtotal + tax)
        + (0 if inclusive else tax)
        + service_charge + packaging_fee + eco_fee
        + delivery_fee + tip,
        2,
    )

    return {
        "region": {"id": region["id"], "name": region["name"], "tax_name": tax_cfg.get("name", "Tax"), "inclusive": inclusive},
        "lines": lines,
        "subtotal": subtotal,
        "tax": tax,
        "tax_breakdown": [{"rate_pct": r, "amount": round(a, 2)} for r, a in sorted(tax_by_rate.items())],
        "service_charge": service_charge,
        "service_charge_name": region["service_charge"].get("name", "Service Charge"),
        "packaging_fee": packaging_fee,
        "packaging_fee_name": region["packaging_fee"].get("name", "Packaging"),
        "eco_fee": eco_fee,
        "eco_fee_name": region["eco_fee"].get("name", "Eco"),
        "delivery_fee": delivery_fee,
        "delivery_blocked": delivery_blocked,
        "min_order": min_order,
        "tip": tip,
        "total": total,
    }


# ─── Tax Report CSV ───────────────────────────────────────

@api_router.get("/admin/fees/tax-report")
async def tax_report(
    request: Request,
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    region_id: Optional[str] = None,
):
    await require_admin(request)
    # Default last 90 days
    end_dt = datetime.fromisoformat((end or datetime.now(timezone.utc).isoformat()).replace("Z", "+00:00"))
    start_dt = datetime.fromisoformat((start or (end_dt - timedelta(days=90)).isoformat()).replace("Z", "+00:00"))
    region = await _get_region(region_id)
    cursor = db.orders.find(
        {"payment_status": "paid", "created_at": {"$gte": start_dt.isoformat(), "$lte": end_dt.isoformat()}},
        {"_id": 0},
    ).sort("created_at", 1)

    orders = await cursor.to_list(50000)

    by_category: dict = defaultdict(lambda: {"qty": 0, "taxable": 0.0, "tax": 0.0, "rate": 0.0})
    totals = {"subtotal": 0.0, "tax_collected": 0.0, "orders": 0}
    inclusive = bool(region["tax"].get("inclusive"))
    for o in orders:
        totals["orders"] += 1
        totals["subtotal"] += float(o.get("subtotal") or 0)
        totals["tax_collected"] += float(o.get("tax") or 0)
        for it in o.get("items", []):
            cat = it.get("category") or "uncategorized"
            qty = int(it.get("qty") or it.get("quantity") or 1)
            price = float(it.get("price") or 0)
            rate = 0.0
            if region["tax"].get("category_overrides", {}).get(cat) is not None:
                rate = float(region["tax"]["category_overrides"][cat])
            else:
                rate = float(region["tax"].get("rate_pct") or 0)
            gross = qty * price
            # If prices include tax, extract the net base; otherwise the line price IS the net.
            line_base = round(gross / (1 + rate / 100), 2) if inclusive and rate else gross
            line_tax = round(line_base * rate / 100, 2)
            by_category[cat]["qty"] += qty
            by_category[cat]["taxable"] += line_base
            by_category[cat]["tax"] += line_tax
            by_category[cat]["rate"] = rate

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Tax Report", region["name"], region["region_code"]])
    w.writerow(["Period", start_dt.date().isoformat(), end_dt.date().isoformat()])
    w.writerow([])
    w.writerow(["Totals"])
    w.writerow(["orders", "subtotal", "tax_collected"])
    w.writerow([totals["orders"], round(totals["subtotal"], 2), round(totals["tax_collected"], 2)])
    w.writerow([])
    w.writerow(["By category"])
    w.writerow(["category", "qty", "taxable_base", "effective_rate_pct", "tax_collected"])
    for cat, row in sorted(by_category.items(), key=lambda x: -x[1]["tax"]):
        w.writerow([cat, row["qty"], round(row["taxable"], 2), row["rate"], round(row["tax"], 2)])

    fname = f"tax_report_{region['region_code']}_{start_dt.date().isoformat()}_{end_dt.date().isoformat()}.csv"
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )
