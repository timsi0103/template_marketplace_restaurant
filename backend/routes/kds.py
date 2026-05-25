"""Kitchen Display System (KDS) settings, board, item status, bump."""
from fastapi import HTTPException, Request
from datetime import datetime, timezone
from typing import Optional

from core import api_router, db, require_admin
from models import KDSSettingsBody, KDSItemStatusBody


DEFAULT_KDS_SETTINGS = {
    "key": "kds_settings",
    "audio_enabled": True,
    "default_columns": 3,
    "target_prep_minutes_by_category": {
        "mains": 15, "entrees": 18, "appetizers": 8, "starters": 8, "salads": 6, "sides": 7,
        "desserts": 10, "pastries": 8, "drinks": 3, "cocktails": 5,
    },
    "station_routing": {
        "grill": ["mains", "entrees"],
        "bar": ["drinks", "cocktails"],
        "dessert": ["desserts", "pastries"],
        "cold": ["salads", "appetizers", "starters", "sides"],
    },
}


@api_router.get("/admin/kds/settings")
async def kds_get_settings(request: Request):
    await require_admin(request)
    doc = await db.kds_settings.find_one({"key": "kds_settings"}, {"_id": 0})
    if not doc:
        doc = dict(DEFAULT_KDS_SETTINGS)
        await db.kds_settings.insert_one(doc)
        doc = await db.kds_settings.find_one({"key": "kds_settings"}, {"_id": 0})
    return doc


@api_router.put("/admin/kds/settings")
async def kds_update_settings(body: KDSSettingsBody, request: Request):
    await require_admin(request)
    updates = {}
    if body.audio_enabled is not None:
        updates["audio_enabled"] = bool(body.audio_enabled)
    if body.default_columns is not None:
        cols = int(body.default_columns)
        if cols not in (2, 3, 4):
            raise HTTPException(status_code=400, detail="default_columns must be 2, 3, or 4")
        updates["default_columns"] = cols
    if body.target_prep_minutes_by_category is not None:
        clean = {k.lower(): max(1, int(v)) for k, v in body.target_prep_minutes_by_category.items() if v is not None}
        updates["target_prep_minutes_by_category"] = clean
    if body.station_routing is not None:
        clean = {k.lower(): [c.lower() for c in v] for k, v in body.station_routing.items()}
        updates["station_routing"] = clean
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.kds_settings.update_one(
        {"key": "kds_settings"}, {"$set": updates}, upsert=True,
    )
    return await db.kds_settings.find_one({"key": "kds_settings"}, {"_id": 0})


@api_router.get("/admin/kds/board")
async def kds_board(
    request: Request,
    station: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
):
    await require_admin(request)
    # Bound pagination: limit is capped at 50, skip is non-negative.
    try:
        limit = max(1, min(50, int(limit)))
    except (TypeError, ValueError):
        limit = 50
    try:
        skip = max(0, int(skip))
    except (TypeError, ValueError):
        skip = 0

    settings_doc = await db.kds_settings.find_one({"key": "kds_settings"}, {"_id": 0}) or DEFAULT_KDS_SETTINGS
    query = {"payment_status": "paid", "status": {"$in": ["preparing", "ready"]}}
    orders = (
        await db.orders.find(query, {"_id": 0})
        .sort("created_at", 1).skip(skip).limit(limit).to_list(limit)
    )

    if station:
        station_cats = set(settings_doc.get("station_routing", {}).get(station.lower(), []))

        # Batch-fetch any missing categories in a single query (avoid N+1 lookups).
        missing_ids = {
            it.get("item_id") for o in orders for it in (o.get("items") or [])
            if not (it.get("category") or "").strip() and it.get("item_id")
        }
        category_by_id = {}
        if missing_ids:
            cursor = db.menu_items.find(
                {"id": {"$in": list(missing_ids)}}, {"_id": 0, "id": 1, "category": 1}
            )
            async for mi in cursor:
                category_by_id[mi["id"]] = (mi.get("category") or "").lower()

        filtered = []
        for o in orders:
            matching = []
            for idx, it in enumerate(o.get("items", [])):
                cat = (it.get("category") or "").lower()
                if not cat:
                    cat = category_by_id.get(it.get("item_id"), "")
                if cat in station_cats:
                    it_copy = dict(it)
                    it_copy["_line_index"] = idx
                    it_copy["category"] = cat
                    matching.append(it_copy)
            if matching:
                filtered.append({**o, "items": matching})
        orders = filtered

    return {
        "orders": orders, "count": len(orders),
        "limit": limit, "skip": skip,
        "settings": settings_doc,
        "server_time": datetime.now(timezone.utc).isoformat(),
    }


@api_router.patch("/admin/kds/orders/{order_id}/items/{line_index}")
async def kds_item_status(order_id: str, line_index: int, body: KDSItemStatusBody, request: Request):
    await require_admin(request)
    if body.status not in ("pending", "started", "ready"):
        raise HTTPException(status_code=400, detail="status must be pending|started|ready")
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    items = order.get("items", [])
    if line_index < 0 or line_index >= len(items):
        raise HTTPException(status_code=400, detail="Invalid line index")
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            f"items.{line_index}.kds_status": body.status,
            f"items.{line_index}.kds_updated_at": now_iso,
            "updated_at": now_iso,
        }},
    )
    return await db.orders.find_one({"id": order_id}, {"_id": 0})


@api_router.post("/admin/kds/orders/{order_id}/bump")
async def kds_bump_order(order_id: str, request: Request):
    await require_admin(request)
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    now_iso = datetime.now(timezone.utc).isoformat()
    if order.get("fulfillment_type") == "delivery":
        next_status = "out_for_delivery"
    else:
        next_status = "ready"
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": next_status, "bumped_at": now_iso, "updated_at": now_iso}},
    )
    return await db.orders.find_one({"id": order_id}, {"_id": 0})
