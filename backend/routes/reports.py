"""Admin reporting: CSV export (orders/revenue/items) + report schedule CRUD + manual send."""
from fastapi import HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone, timedelta
from typing import List, Literal, Optional
from collections import Counter, defaultdict
import io
import csv
import uuid

from core import api_router, db, logger, require_admin


REPORT_TYPES = {"orders", "revenue", "items"}
FREQUENCIES = {"daily", "weekly", "monthly"}


def _parse_date(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def _default_range(start: Optional[str], end: Optional[str]) -> tuple[datetime, datetime]:
    end_dt = _parse_date(end) or datetime.now(timezone.utc)
    start_dt = _parse_date(start) or (end_dt - timedelta(days=30))
    return start_dt, end_dt


async def _paid_orders(start: datetime, end: datetime) -> list[dict]:
    return await db.orders.find(
        {"payment_status": "paid", "created_at": {"$gte": start.isoformat(), "$lte": end.isoformat()}},
        {"_id": 0},
    ).sort("created_at", 1).to_list(50000)


def _csv_response(rows: list[list], filename: str) -> StreamingResponse:
    buf = io.StringIO()
    writer = csv.writer(buf)
    for r in rows:
        writer.writerow(r)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _orders_rows(orders: list[dict]) -> list[list]:
    rows = [["order_number", "created_at", "status", "payment_status", "fulfillment_type", "customer_name", "customer_email", "subtotal", "discount", "tax", "tip", "delivery_fee", "total", "item_count"]]
    for o in orders:
        rows.append([
            o.get("order_number", ""), o.get("created_at", ""),
            o.get("status", ""), o.get("payment_status", ""),
            o.get("fulfillment_type", ""), o.get("contact_name", ""), o.get("contact_email", ""),
            round(float(o.get("subtotal") or 0), 2), round(float(o.get("discount") or 0), 2),
            round(float(o.get("tax") or 0), 2), round(float(o.get("tip") or 0), 2),
            round(float(o.get("delivery_fee") or 0), 2), round(float(o.get("total") or 0), 2),
            sum(int(i.get("qty") or i.get("quantity") or 1) for i in o.get("items", [])),
        ])
    return rows


def _revenue_rows(orders: list[dict]) -> list[list]:
    by_day: dict = defaultdict(lambda: {"revenue": 0.0, "orders": 0})
    for o in orders:
        try:
            d = datetime.fromisoformat(o["created_at"].replace("Z", "+00:00")).astimezone(timezone.utc).date().isoformat()
        except Exception:
            continue
        by_day[d]["revenue"] += float(o.get("total") or 0)
        by_day[d]["orders"] += 1
    rows = [["date", "orders", "revenue", "avg_order_value"]]
    for d in sorted(by_day):
        r = by_day[d]
        aov = round(r["revenue"] / r["orders"], 2) if r["orders"] else 0.0
        rows.append([d, r["orders"], round(r["revenue"], 2), aov])
    return rows


def _items_rows(orders: list[dict]) -> list[list]:
    qty: Counter = Counter()
    revenue: dict = defaultdict(float)
    category: dict = {}
    for o in orders:
        for it in o.get("items", []):
            name = it.get("name") or "Item"
            q = int(it.get("qty") or it.get("quantity") or 1)
            p = float(it.get("price") or 0)
            qty[name] += q
            revenue[name] += q * p
            if it.get("category"):
                category[name] = it["category"]
    rows = [["item_name", "category", "qty_sold", "revenue"]]
    for name, q in qty.most_common():
        rows.append([name, category.get(name, ""), q, round(revenue[name], 2)])
    return rows


@api_router.get("/admin/reports/export")
async def export_report(
    request: Request,
    type: Literal["orders", "revenue", "items"] = "orders",
    start: Optional[str] = Query(None, description="ISO date. Defaults to 30 days ago."),
    end: Optional[str] = Query(None, description="ISO date. Defaults to now."),
):
    await require_admin(request)
    if type not in REPORT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid report type")
    start_dt, end_dt = _default_range(start, end)
    orders = await _paid_orders(start_dt, end_dt)
    tag = start_dt.strftime("%Y%m%d") + "_" + end_dt.strftime("%Y%m%d")
    if type == "orders":
        return _csv_response(_orders_rows(orders), f"orders_{tag}.csv")
    if type == "revenue":
        return _csv_response(_revenue_rows(orders), f"revenue_{tag}.csv")
    return _csv_response(_items_rows(orders), f"items_{tag}.csv")


# ─── Report Schedules ──────────────────────────────────────

def _next_send(freq: str, now: Optional[datetime] = None) -> str:
    now = now or datetime.now(timezone.utc)
    delta = {"daily": timedelta(days=1), "weekly": timedelta(days=7), "monthly": timedelta(days=30)}.get(freq, timedelta(days=7))
    return (now + delta).isoformat()


class ScheduleCreate(BaseModel):
    report_type: Literal["orders", "revenue", "items"]
    frequency: Literal["daily", "weekly", "monthly"]
    email: EmailStr
    enabled: bool = True


class ScheduleUpdate(BaseModel):
    frequency: Optional[Literal["daily", "weekly", "monthly"]] = None
    email: Optional[EmailStr] = None
    enabled: Optional[bool] = None


@api_router.get("/admin/reports/schedules")
async def list_schedules(request: Request):
    await require_admin(request)
    docs = await db.report_schedules.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"schedules": docs}


@api_router.post("/admin/reports/schedules")
async def create_schedule(body: ScheduleCreate, request: Request):
    await require_admin(request)
    sid = f"sched_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": sid,
        "report_type": body.report_type,
        "frequency": body.frequency,
        "email": body.email.strip().lower(),
        "enabled": body.enabled,
        "last_sent_at": None,
        "last_status": None,
        "next_send_at": _next_send(body.frequency) if body.enabled else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.report_schedules.insert_one(dict(doc))
    return doc


@api_router.patch("/admin/reports/schedules/{sid}")
async def update_schedule(sid: str, body: ScheduleUpdate, request: Request):
    await require_admin(request)
    existing = await db.report_schedules.find_one({"id": sid}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Schedule not found")
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise HTTPException(status_code=400, detail="No changes")
    if "frequency" in patch or "enabled" in patch:
        new_freq = patch.get("frequency", existing["frequency"])
        new_enabled = patch.get("enabled", existing["enabled"])
        patch["next_send_at"] = _next_send(new_freq) if new_enabled else None
    await db.report_schedules.update_one({"id": sid}, {"$set": patch})
    return await db.report_schedules.find_one({"id": sid}, {"_id": 0})


@api_router.delete("/admin/reports/schedules/{sid}")
async def delete_schedule(sid: str, request: Request):
    await require_admin(request)
    r = await db.report_schedules.delete_one({"id": sid})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"deleted": True}


@api_router.post("/admin/reports/schedules/{sid}/send-now")
async def send_schedule_now(sid: str, request: Request):
    """Simulate sending the report immediately — MOCKED email delivery (logged only).
    Stores last_sent_at + last_status + row_count on the schedule doc so the UI can display confirmation."""
    await require_admin(request)
    sched = await db.report_schedules.find_one({"id": sid}, {"_id": 0})
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")
    # Compute report preview rows
    end_dt = datetime.now(timezone.utc)
    windows = {"daily": timedelta(days=1), "weekly": timedelta(days=7), "monthly": timedelta(days=30)}
    start_dt = end_dt - windows.get(sched["frequency"], timedelta(days=7))
    orders = await _paid_orders(start_dt, end_dt)
    if sched["report_type"] == "orders":
        rows = _orders_rows(orders)
    elif sched["report_type"] == "revenue":
        rows = _revenue_rows(orders)
    else:
        rows = _items_rows(orders)
    row_count = max(0, len(rows) - 1)
    now_iso = datetime.now(timezone.utc).isoformat()
    logger.info(f"[report-scheduler MOCKED] Sending {sched['report_type']} ({sched['frequency']}) with {row_count} rows to {sched['email']}")
    await db.report_schedules.update_one(
        {"id": sid},
        {"$set": {
            "last_sent_at": now_iso,
            "last_status": "sent",
            "last_row_count": row_count,
            "next_send_at": _next_send(sched["frequency"]) if sched.get("enabled") else None,
        }},
    )
    return {
        "sent": True,
        "mocked": True,
        "report_type": sched["report_type"],
        "frequency": sched["frequency"],
        "email": sched["email"],
        "row_count": row_count,
        "sent_at": now_iso,
    }
