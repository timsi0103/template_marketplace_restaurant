"""Daily end-of-day summary report: compute, snapshot, history, delivery settings.
Email delivery is MOCKED (logged + recorded in the snapshot)."""
from fastapi import HTTPException, Query, Request
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone, timedelta, date, time
from typing import Optional, List, Literal
from collections import Counter, defaultdict
import uuid

from core import api_router, db, logger, require_admin


def _parse_date(s: Optional[str]) -> date:
    if not s:
        return datetime.now(timezone.utc).date()
    try:
        return datetime.fromisoformat(s).date()
    except Exception:
        return datetime.now(timezone.utc).date()


def _day_bounds(d: date) -> tuple[datetime, datetime]:
    start = datetime.combine(d, time.min, tzinfo=timezone.utc)
    end = datetime.combine(d, time.max, tzinfo=timezone.utc)
    return start, end


async def _orders_in_range(start: datetime, end: datetime, *, paid_only: bool = False) -> list[dict]:
    q: dict = {"created_at": {"$gte": start.isoformat(), "$lte": end.isoformat()}}
    if paid_only:
        q["payment_status"] = "paid"
    return await db.orders.find(q, {"_id": 0}).to_list(50000)


async def _compute_daily_summary(d: date) -> dict:
    start, end = _day_bounds(d)

    # All orders of the day (for refunds/cancellations)
    all_orders = await _orders_in_range(start, end)
    paid = [o for o in all_orders if o.get("payment_status") == "paid"]
    refunded = [o for o in all_orders if o.get("payment_status") == "refunded"]
    cancelled = [o for o in all_orders if o.get("status") == "cancelled"]

    total_revenue = round(sum(float(o.get("total") or 0) for o in paid), 2)
    tips = round(sum(float(o.get("tip") or 0) for o in paid), 2)
    order_count = len(paid)
    aov = round(total_revenue / order_count, 2) if order_count else 0.0

    mix = Counter(o.get("fulfillment_type", "unknown") for o in paid)
    fulfillment_mix = [{"type": k, "count": v} for k, v in mix.items()]

    item_qty: Counter = Counter()
    item_rev: dict = defaultdict(float)
    for o in paid:
        for it in o.get("items", []):
            n = it.get("name") or "Item"
            qty = int(it.get("qty") or it.get("quantity") or 1)
            item_qty[n] += qty
            item_rev[n] += qty * float(it.get("price") or 0)
    top_items = [{"name": n, "qty": q, "revenue": round(item_rev[n], 2)} for n, q in item_qty.most_common(5)]

    # Customer split — new vs returning (vs all paid orders before this day)
    customer_keys = {(o.get("user_id") or o.get("contact_email")) for o in paid if (o.get("user_id") or o.get("contact_email"))}
    earlier_keys: set = set()
    async for o in db.orders.find(
        {"payment_status": "paid", "created_at": {"$lt": start.isoformat()}},
        {"_id": 0, "user_id": 1, "contact_email": 1},
    ):
        k = o.get("user_id") or o.get("contact_email")
        if k:
            earlier_keys.add(k)
    new_customers = sum(1 for k in customer_keys if k not in earlier_keys)
    returning_customers = sum(1 for k in customer_keys if k in earlier_keys)

    # Comparisons
    def _day_totals(orders):
        paid_o = [o for o in orders if o.get("payment_status") == "paid"]
        total = round(sum(float(o.get("total") or 0) for o in paid_o), 2)
        count = len(paid_o)
        return {"order_count": count, "total_revenue": total, "aov": round(total / count, 2) if count else 0.0}

    # Same day last week
    lw_start, lw_end = _day_bounds(d - timedelta(days=7))
    lw_orders = await _orders_in_range(lw_start, lw_end)
    lw = _day_totals(lw_orders)

    # Month-to-date comparisons: this-month-up-to-day vs prior-month-up-to-day
    mtd_start = datetime(d.year, d.month, 1, tzinfo=timezone.utc)
    mtd_end = end
    mtd_orders = await _orders_in_range(mtd_start, mtd_end)
    mtd = _day_totals(mtd_orders)
    prev_month_end_year = d.year if d.month > 1 else d.year - 1
    prev_month = d.month - 1 if d.month > 1 else 12
    prev_mtd_start = datetime(prev_month_end_year, prev_month, 1, tzinfo=timezone.utc)
    try:
        prev_mtd_end = datetime(prev_month_end_year, prev_month, min(d.day, 28), 23, 59, 59, tzinfo=timezone.utc)
    except ValueError:
        prev_mtd_end = datetime(prev_month_end_year, prev_month, 28, 23, 59, 59, tzinfo=timezone.utc)
    prev_mtd_orders = await _orders_in_range(prev_mtd_start, prev_mtd_end)
    prev_mtd = _day_totals(prev_mtd_orders)

    def _delta(curr: float, prev: float) -> Optional[float]:
        if prev <= 0:
            return None if curr <= 0 else 100.0
        return round(((curr - prev) / prev) * 100, 1)

    today_totals = {"order_count": order_count, "total_revenue": total_revenue, "aov": aov}  # noqa: F841

    return {
        "date": d.isoformat(),
        "order_count": order_count,
        "total_revenue": total_revenue,
        "average_order_value": aov,
        "tips": tips,
        "fulfillment_mix": fulfillment_mix,
        "top_items": top_items,
        "refunds_count": len(refunded),
        "cancellations_count": len(cancelled),
        "customers": {
            "total": len(customer_keys),
            "new": new_customers,
            "returning": returning_customers,
            "returning_ratio": round((returning_customers / len(customer_keys)) * 100, 1) if customer_keys else 0.0,
        },
        "compare_last_week": {
            "date": (d - timedelta(days=7)).isoformat(), **lw,
            "revenue_delta_pct": _delta(total_revenue, lw["total_revenue"]),
            "order_delta_pct": _delta(order_count, lw["order_count"]),
            "aov_delta_pct": _delta(aov, lw["aov"]),
        },
        "compare_last_month": {
            "mtd": mtd, "prev_mtd": prev_mtd,
            "revenue_delta_pct": _delta(mtd["total_revenue"], prev_mtd["total_revenue"]),
            "order_delta_pct": _delta(mtd["order_count"], prev_mtd["order_count"]),
        },
    }


# ─── Endpoints ────────────────────────────────────────────

@api_router.get("/admin/daily-summary")
async def daily_summary(request: Request, date: Optional[str] = None):
    """Live summary for the given date. Does not persist a snapshot."""
    await require_admin(request)
    d = _parse_date(date)
    return await _compute_daily_summary(d)


class GenerateRequest(BaseModel):
    date: Optional[str] = None
    send_email: bool = False  # If True, also simulate emailing the report


@api_router.post("/admin/daily-summary/generate")
async def generate_daily_summary(body: GenerateRequest, request: Request):
    """Compute + persist a snapshot + (optionally) simulate email delivery."""
    await require_admin(request)
    d = _parse_date(body.date)
    summary = await _compute_daily_summary(d)

    sid = f"ds_{uuid.uuid4().hex[:12]}"
    snapshot = {
        "id": sid,
        "date": summary["date"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": summary,
        "delivery_status": None,
        "delivery_log": [],
    }

    recipients: list[str] = []
    if body.send_email:
        settings = await db.app_settings.find_one({"key": "daily_report_settings"}, {"_id": 0}) or {}
        recipients = list(settings.get("recipients") or [])
        log_entry = {
            "attempted_at": datetime.now(timezone.utc).isoformat(),
            "recipients": recipients,
            "status": "sent" if recipients else "skipped_no_recipients",
            "mocked": True,
        }
        snapshot["delivery_log"] = [log_entry]
        snapshot["delivery_status"] = log_entry["status"]
        logger.info(f"[daily-summary MOCKED] {snapshot['date']} → {recipients or '(no recipients)'}")

    # Snapshot is appended (history keeps every generation — even multiple for the same day).
    await db.daily_summaries.insert_one(dict(snapshot))
    return {"snapshot": snapshot, "mocked_email": body.send_email, "recipients": recipients}


@api_router.get("/admin/daily-summary/history")
async def summary_history(request: Request, limit: int = Query(30, ge=1, le=200), date_from: Optional[str] = None, date_to: Optional[str] = None):
    await require_admin(request)
    q: dict = {}
    if date_from or date_to:
        q["date"] = {}
        if date_from:
            q["date"]["$gte"] = date_from
        if date_to:
            q["date"]["$lte"] = date_to
    docs = await db.daily_summaries.find(q, {"_id": 0}).sort("generated_at", -1).limit(limit).to_list(limit)
    return {"snapshots": docs}


# ─── Delivery settings (declared BEFORE /{sid} to avoid path collision) ──

class DeliverySettingsPatch(BaseModel):
    enabled: Optional[bool] = None
    recipients: Optional[List[EmailStr]] = None
    send_at: Optional[str] = None
    format: Optional[Literal["pdf", "html", "csv"]] = None


DEFAULT_DELIVERY_SETTINGS = {
    "key": "daily_report_settings",
    "enabled": False,
    "recipients": [],
    "send_at": "21:00",
    "format": "pdf",
    "last_sent_date": None,
}


@api_router.get("/admin/daily-summary/delivery-settings")
async def get_delivery_settings(request: Request):
    await require_admin(request)
    doc = await db.app_settings.find_one({"key": "daily_report_settings"}, {"_id": 0}) or {}
    merged = {**DEFAULT_DELIVERY_SETTINGS, **doc}
    merged.pop("key", None)
    return merged


@api_router.patch("/admin/daily-summary/delivery-settings")
async def patch_delivery_settings(body: DeliverySettingsPatch, request: Request):
    await require_admin(request)
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise HTTPException(status_code=400, detail="No changes")
    if "recipients" in patch:
        patch["recipients"] = [str(e).lower() for e in patch["recipients"]]
    if "send_at" in patch:
        try:
            h, m = patch["send_at"].split(":")
            int(h)
            int(m)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid send_at format (HH:MM required)")
    await db.app_settings.update_one(
        {"key": "daily_report_settings"},
        {"$set": {**patch, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return await get_delivery_settings(request)


@api_router.get("/admin/daily-summary/{sid}")
async def get_snapshot(sid: str, request: Request):
    await require_admin(request)
    doc = await db.daily_summaries.find_one({"id": sid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return doc


@api_router.delete("/admin/daily-summary/{sid}")
async def delete_snapshot(sid: str, request: Request):
    await require_admin(request)
    r = await db.daily_summaries.delete_one({"id": sid})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return {"deleted": True}


# ─── Delivery settings ────────────────────────────────────
# (Moved above to avoid /{sid} catching "delivery-settings")

