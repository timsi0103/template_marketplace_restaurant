"""Admin analytics: revenue, top items, fulfillment mix, AOV, busy hours, customers."""
from builtins import range as _range
from fastapi import Request
from datetime import datetime, timezone, timedelta
from collections import Counter, defaultdict

from core import api_router, db, require_admin


RANGES = {
    "day": timedelta(days=1),
    "week": timedelta(days=7),
    "month": timedelta(days=30),
    "quarter": timedelta(days=90),
    "year": timedelta(days=365),
}


def _range_start(range_key: str) -> datetime:
    span = RANGES.get(range_key, RANGES["week"])
    return datetime.now(timezone.utc) - span


@api_router.get("/admin/analytics/summary")
async def analytics_summary(request: Request, range: str = "week"):
    await require_admin(request)
    since = _range_start(range)
    since_iso = since.isoformat()

    paid = await db.orders.find(
        {"payment_status": "paid", "created_at": {"$gte": since_iso}},
        {"_id": 0},
    ).to_list(5000)

    total_revenue = round(sum(float(o.get("total") or 0) for o in paid), 2)
    order_count = len(paid)
    aov = round(total_revenue / order_count, 2) if order_count else 0.0

    fulfillment_mix = Counter(o.get("fulfillment_type", "unknown") for o in paid)

    item_qty: Counter = Counter()
    item_rev: dict = defaultdict(float)
    cat_rev: dict = defaultdict(float)
    for o in paid:
        for it in o.get("items", []):
            name = it.get("name") or "Item"
            qty = int(it.get("qty") or it.get("quantity") or 1)
            price = float(it.get("price") or 0)
            item_qty[name] += qty
            item_rev[name] += qty * price
            cat_rev[(it.get("category") or "other")] += qty * price

    top_items = [
        {"name": n, "qty": q, "revenue": round(item_rev[n], 2)}
        for n, q in item_qty.most_common(8)
    ]
    top_categories = sorted(
        [{"category": k, "revenue": round(v, 2)} for k, v in cat_rev.items()],
        key=lambda x: -x["revenue"],
    )[:6]

    hours: Counter = Counter()
    for o in paid:
        created = o.get("created_at")
        try:
            dt = datetime.fromisoformat(created.replace("Z", "+00:00")) if isinstance(created, str) else created
            hours[dt.astimezone(timezone.utc).hour] += 1
        except Exception:
            continue
    busy_hours = [{"hour": h, "orders": hours.get(h, 0)} for h in _range(0, 24)]

    span_seconds = (datetime.now(timezone.utc) - since).total_seconds() or 1
    bucket_count = min(max(int(span_seconds // 86400) + 1, 1), 30)
    bucket_seconds = span_seconds / bucket_count
    buckets = [0.0] * bucket_count
    bucket_labels = []
    for i in _range(bucket_count):
        bucket_labels.append((since + timedelta(seconds=bucket_seconds * i)).strftime("%b %d"))
    for o in paid:
        try:
            dt = datetime.fromisoformat(o["created_at"].replace("Z", "+00:00"))
            idx = int(((dt - since).total_seconds()) // bucket_seconds)
            idx = max(0, min(bucket_count - 1, idx))
            buckets[idx] += float(o.get("total") or 0)
        except Exception:
            continue
    revenue_over_time = [
        {"label": bucket_labels[i], "revenue": round(buckets[i], 2)}
        for i in _range(bucket_count)
    ]

    customer_keys = [o.get("user_id") or o.get("contact_email") or "guest" for o in paid]
    unique_customers = set(customer_keys)
    earlier_paid_keys: set = set()
    async for o in db.orders.find(
        {"payment_status": "paid", "created_at": {"$lt": since_iso}},
        {"_id": 0, "user_id": 1, "contact_email": 1},
    ):
        k = o.get("user_id") or o.get("contact_email")
        if k:
            earlier_paid_keys.add(k)
    new_customers = sum(1 for k in unique_customers if k and k not in earlier_paid_keys)
    returning_customers = sum(1 for k in unique_customers if k and k in earlier_paid_keys)

    spend: dict = defaultdict(float)
    labels: dict = {}
    for o in paid:
        k = o.get("user_id") or o.get("contact_email") or "guest"
        spend[k] += float(o.get("total") or 0)
        labels[k] = o.get("contact_name") or o.get("contact_email") or "Guest"
    top_customers = sorted(
        [{"key": k, "label": labels[k], "total": round(v, 2)} for k, v in spend.items()],
        key=lambda x: -x["total"],
    )[:5]

    return {
        "range": range,
        "since": since_iso,
        "order_count": order_count,
        "total_revenue": total_revenue,
        "average_order_value": aov,
        "fulfillment_mix": [{"type": k, "count": v} for k, v in fulfillment_mix.items()],
        "top_items": top_items,
        "top_categories": top_categories,
        "busy_hours": busy_hours,
        "revenue_over_time": revenue_over_time,
        "customers": {
            "unique": len(unique_customers),
            "new": new_customers,
            "returning": returning_customers,
        },
        "top_customers": top_customers,
    }
