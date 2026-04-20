"""Admin analytics: revenue, top items, fulfillment mix, AOV, busy hours, customers,
heatmap (day-of-week x hour), today KPIs, and period-over-period comparison."""
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


def _parse(iso):
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")) if isinstance(iso, str) else iso
    except Exception:
        return None


async def _paid_between(start: datetime, end: datetime):
    return await db.orders.find(
        {"payment_status": "paid", "created_at": {"$gte": start.isoformat(), "$lt": end.isoformat()}},
        {"_id": 0},
    ).to_list(10000)


async def _item_image_map() -> dict:
    items = await db.menu_items.find({}, {"_id": 0, "id": 1, "name": 1, "image": 1, "category": 1}).to_list(1000)
    by_name = {it["name"]: it for it in items if it.get("name")}
    return by_name


@api_router.get("/admin/analytics/summary")
async def analytics_summary(request: Request, range: str = "week"):
    await require_admin(request)
    now = datetime.now(timezone.utc)
    since = _range_start(range)
    span = now - since
    prev_since = since - span
    since_iso = since.isoformat()

    # Current & previous period paid orders
    paid = await _paid_between(since, now)
    prev_paid = await _paid_between(prev_since, since)

    def _agg(orders):
        total = round(sum(float(o.get("total") or 0) for o in orders), 2)
        count = len(orders)
        aov = round(total / count, 2) if count else 0.0
        return total, count, aov

    total_revenue, order_count, aov = _agg(paid)
    prev_revenue, prev_count, prev_aov = _agg(prev_paid)

    def _delta(curr, prev):
        if prev <= 0:
            return None if curr <= 0 else 100.0
        return round(((curr - prev) / prev) * 100, 1)

    # Today KPIs (start of today UTC → now)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_orders = await _paid_between(today_start, now)
    today_total, today_count, today_aov = _agg(today_orders)
    today_fulfillment = Counter(o.get("fulfillment_type", "unknown") for o in today_orders)

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

    # Previous period item qty for trend
    prev_item_qty: Counter = Counter()
    for o in prev_paid:
        for it in o.get("items", []):
            prev_item_qty[it.get("name") or "Item"] += int(it.get("qty") or it.get("quantity") or 1)

    img_map = await _item_image_map()
    top_items = []
    for n, q in item_qty.most_common(8):
        prev_q = prev_item_qty.get(n, 0)
        trend_pct = _delta(q, prev_q)
        meta = img_map.get(n) or {}
        top_items.append({
            "name": n,
            "qty": q,
            "revenue": round(item_rev[n], 2),
            "image": meta.get("image", ""),
            "item_id": meta.get("id"),
            "category": meta.get("category"),
            "trend_pct": trend_pct,
            "direction": "up" if (trend_pct or 0) > 0 else ("down" if (trend_pct or 0) < 0 else "flat"),
        })

    top_categories = sorted(
        [{"category": k, "revenue": round(v, 2)} for k, v in cat_rev.items()],
        key=lambda x: -x["revenue"],
    )[:6]

    # Flat hour counts (kept for backwards compat)
    hours: Counter = Counter()
    # Heatmap: day_of_week (0=Mon..6=Sun) x hour (0..23)
    heatmap = [[0] * 24 for _ in _range(7)]
    for o in paid:
        dt = _parse(o.get("created_at"))
        if not dt:
            continue
        h = dt.astimezone(timezone.utc).hour
        d = dt.astimezone(timezone.utc).weekday()  # 0=Monday
        hours[h] += 1
        heatmap[d][h] += 1
    busy_hours = [{"hour": h, "orders": hours.get(h, 0)} for h in _range(0, 24)]

    # Revenue over time with previous-period series
    span_seconds = span.total_seconds() or 1
    bucket_count = min(max(int(span_seconds // 86400) + 1, 1), 30)
    bucket_seconds = span_seconds / bucket_count
    buckets = [0.0] * bucket_count
    prev_buckets = [0.0] * bucket_count
    bucket_labels = [(since + timedelta(seconds=bucket_seconds * i)).strftime("%b %d") for i in _range(bucket_count)]
    for o in paid:
        dt = _parse(o.get("created_at"))
        if not dt:
            continue
        idx = int(((dt - since).total_seconds()) // bucket_seconds)
        idx = max(0, min(bucket_count - 1, idx))
        buckets[idx] += float(o.get("total") or 0)
    for o in prev_paid:
        dt = _parse(o.get("created_at"))
        if not dt:
            continue
        idx = int(((dt - prev_since).total_seconds()) // bucket_seconds)
        idx = max(0, min(bucket_count - 1, idx))
        prev_buckets[idx] += float(o.get("total") or 0)
    revenue_over_time = [
        {"label": bucket_labels[i], "revenue": round(buckets[i], 2), "previous": round(prev_buckets[i], 2)}
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
        "heatmap": heatmap,
        "revenue_over_time": revenue_over_time,
        "customers": {
            "unique": len(unique_customers),
            "new": new_customers,
            "returning": returning_customers,
        },
        "top_customers": top_customers,
        "today": {
            "order_count": today_count,
            "total_revenue": today_total,
            "average_order_value": today_aov,
            "fulfillment_mix": [{"type": k, "count": v} for k, v in today_fulfillment.items()],
        },
        "previous_period": {
            "order_count": prev_count,
            "total_revenue": prev_revenue,
            "average_order_value": prev_aov,
            "revenue_delta_pct": _delta(total_revenue, prev_revenue),
            "order_delta_pct": _delta(order_count, prev_count),
            "aov_delta_pct": _delta(aov, prev_aov),
        },
    }
