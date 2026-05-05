"""Unified search: public menu search + admin order/catalog search."""
from fastapi import HTTPException, Query, Request
from typing import List, Optional
import re

from core import api_router, db, require_admin


def _escape(q: str) -> str:
    return re.escape(q.strip())


SORT_WHITELIST = {
    "popularity": [("popularity_score", -1), ("created_at", -1)],
    "price_asc": [("price", 1)],
    "price_desc": [("price", -1)],
    "newest": [("created_at", -1)],
    "name_asc": [("name", 1)],
}


# ─── Public: search menu items ────────────────────────────

@api_router.get("/search/menu")
async def search_menu(
    q: str = "",
    category: Optional[str] = None,
    tag: Optional[str] = None,
    dietary: Optional[List[str]] = Query(None),
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    in_stock_only: bool = False,
    sort: str = "popularity",
    limit: int = 30,
):
    """Search menu items with text, category, dietary tags, price range, stock, sort."""
    q = (q or "").strip()
    limit = max(1, min(int(limit or 30), 60))
    query: dict = {}
    if q:
        rx = {"$regex": _escape(q), "$options": "i"}
        query["$or"] = [{"name": rx}, {"description": rx}, {"tags": rx}, {"dietary_tags": rx}]
    if category and category != "all":
        query["category"] = category
    if tag:
        query["tags"] = {"$regex": _escape(tag), "$options": "i"}
    if dietary:
        cleaned = [d for d in dietary if d and d.strip()]
        if cleaned:
            query["dietary_tags"] = {"$all": cleaned}
    if min_price is not None or max_price is not None:
        price_q = {}
        if min_price is not None:
            price_q["$gte"] = float(min_price)
        if max_price is not None:
            price_q["$lte"] = float(max_price)
        query["price"] = price_q
    if in_stock_only:
        query["status"] = {"$ne": "sold_out"}

    # Customer-facing search hides archived items
    query["is_archived"] = {"$ne": True}

    sort_spec = SORT_WHITELIST.get(sort, SORT_WHITELIST["popularity"])
    cursor = db.menu_items.find(query, {"_id": 0}).sort(sort_spec).limit(limit)
    items = await cursor.to_list(limit)
    return {"items": items, "count": len(items), "query": q, "sort": sort}


# ─── Admin: search orders + catalog ───────────────────────

@api_router.get("/admin/search/orders")
async def admin_search_orders(request: Request, q: str = "", limit: int = 30):
    await require_admin(request)
    q = (q or "").strip()
    limit = max(1, min(int(limit or 30), 100))
    if not q:
        return {"orders": [], "count": 0}
    rx = {"$regex": _escape(q), "$options": "i"}
    query = {"$or": [
        {"order_number": rx},
        {"contact_email": rx},
        {"contact_name": rx},
        {"contact_phone": rx},
        {"id": rx},
    ]}
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"orders": orders, "count": len(orders), "query": q}


@api_router.get("/admin/search/catalog")
async def admin_search_catalog(request: Request, q: str = "", limit: int = 30):
    await require_admin(request)
    q = (q or "").strip()
    limit = max(1, min(int(limit or 30), 100))
    if not q:
        return {"items": [], "count": 0}
    rx = {"$regex": _escape(q), "$options": "i"}
    query = {"$or": [
        {"name": rx},
        {"description": rx},
        {"tags": rx},
        {"category": rx},
        {"subcategory": rx},
        {"id": rx},
    ]}
    items = await db.menu_items.find(query, {"_id": 0}).limit(limit).to_list(limit)
    return {"items": items, "count": len(items), "query": q}
