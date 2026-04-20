"""Unified search: public menu search + admin order/catalog search."""
from fastapi import HTTPException, Request
from typing import Optional
import re

from core import api_router, db, require_admin


def _escape(q: str) -> str:
    return re.escape(q.strip())


# ─── Public: search menu items ────────────────────────────

@api_router.get("/search/menu")
async def search_menu(q: str = "", category: Optional[str] = None, tag: Optional[str] = None, limit: int = 30):
    """Search visible menu items by name/description/tags (case-insensitive)."""
    q = (q or "").strip()
    limit = max(1, min(int(limit or 30), 50))
    query: dict = {}
    if q:
        rx = {"$regex": _escape(q), "$options": "i"}
        query["$or"] = [
            {"name": rx},
            {"description": rx},
            {"tags": rx},
        ]
    if category and category != "all":
        query["category"] = category
    if tag:
        query["tags"] = {"$regex": _escape(tag), "$options": "i"}
    items = await db.menu_items.find(query, {"_id": 0}).limit(limit).to_list(limit)
    return {"items": items, "count": len(items), "query": q}


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
