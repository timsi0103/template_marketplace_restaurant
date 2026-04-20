"""Admin-side order workflow + dashboard + kitchen queue + coupons CRUD."""
from fastapi import HTTPException, Request
from datetime import datetime, timezone
from typing import Optional
import uuid

from core import api_router, db, require_admin
from models import CouponCreate, CouponUpdate, RejectBody


# ─── Coupons helpers ──────────────────────────────────────

def _coupon_doc(c: dict) -> dict:
    return {
        "id": c.get("id"),
        "code": c.get("code"),
        "type": c.get("type"),
        "value": float(c.get("value") or 0),
        "min_subtotal": float(c.get("min_subtotal") or 0),
        "description": c.get("description") or "",
        "usage_limit": c.get("usage_limit"),
        "usage_count": int(c.get("usage_count") or 0),
        "first_order_only": bool(c.get("first_order_only") or False),
        "expires_at": c.get("expires_at"),
        "active": bool(c.get("active", True)),
        "created_at": c.get("created_at"),
    }


@api_router.get("/admin/coupons")
async def admin_list_coupons(request: Request):
    await require_admin(request)
    docs = await db.promo_codes.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"coupons": [_coupon_doc(d) for d in docs]}


@api_router.get("/admin/coupons/{coupon_id}")
async def admin_get_coupon(coupon_id: str, request: Request):
    await require_admin(request)
    doc = await db.promo_codes.find_one({"id": coupon_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return _coupon_doc(doc)


@api_router.post("/admin/coupons")
async def admin_create_coupon(body: CouponCreate, request: Request):
    await require_admin(request)
    code = body.code.strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Code is required")
    if body.type not in ("percent", "fixed", "free_delivery"):
        raise HTTPException(status_code=400, detail="type must be percent|fixed|free_delivery")
    existing = await db.promo_codes.find_one({"code": code})
    if existing:
        raise HTTPException(status_code=400, detail="Coupon code already exists")
    doc = {
        "id": str(uuid.uuid4()),
        "code": code, "type": body.type,
        "value": float(body.value or 0),
        "min_subtotal": float(body.min_subtotal or 0),
        "description": body.description or "",
        "usage_limit": body.usage_limit, "usage_count": 0,
        "first_order_only": bool(body.first_order_only),
        "expires_at": body.expires_at or None,
        "active": bool(body.active),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.promo_codes.insert_one(doc)
    return _coupon_doc(doc)


@api_router.put("/admin/coupons/{coupon_id}")
async def admin_update_coupon(coupon_id: str, body: CouponUpdate, request: Request):
    await require_admin(request)
    current = await db.promo_codes.find_one({"id": coupon_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Coupon not found")
    updates = {}
    if body.code is not None:
        new_code = body.code.strip().upper()
        if new_code != current["code"]:
            dup = await db.promo_codes.find_one({"code": new_code})
            if dup:
                raise HTTPException(status_code=400, detail="Coupon code already exists")
        updates["code"] = new_code
    if body.type is not None:
        if body.type not in ("percent", "fixed", "free_delivery"):
            raise HTTPException(status_code=400, detail="Invalid type")
        updates["type"] = body.type
    for k in ("value", "min_subtotal"):
        v = getattr(body, k)
        if v is not None:
            updates[k] = float(v)
    if body.description is not None:
        updates["description"] = body.description
    if body.usage_limit is not None:
        updates["usage_limit"] = body.usage_limit
    if body.first_order_only is not None:
        updates["first_order_only"] = bool(body.first_order_only)
    if body.expires_at is not None:
        updates["expires_at"] = body.expires_at or None
    if body.active is not None:
        updates["active"] = bool(body.active)
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.promo_codes.update_one({"id": coupon_id}, {"$set": updates})
    doc = await db.promo_codes.find_one({"id": coupon_id}, {"_id": 0})
    return _coupon_doc(doc)


@api_router.delete("/admin/coupons/{coupon_id}")
async def admin_delete_coupon(coupon_id: str, request: Request):
    await require_admin(request)
    res = await db.promo_codes.delete_one({"id": coupon_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return {"deleted": True}


@api_router.patch("/admin/coupons/{coupon_id}/toggle")
async def admin_toggle_coupon(coupon_id: str, request: Request):
    await require_admin(request)
    current = await db.promo_codes.find_one({"id": coupon_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Coupon not found")
    new_state = not bool(current.get("active", True))
    await db.promo_codes.update_one(
        {"id": coupon_id},
        {"$set": {"active": new_state, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    doc = await db.promo_codes.find_one({"id": coupon_id}, {"_id": 0})
    return _coupon_doc(doc)


# ─── Admin: Order workflow ────────────────────────────────

@api_router.get("/admin/orders/new")
async def admin_new_orders(since: Optional[str] = None, request: Request = None):
    await require_admin(request)
    query = {"payment_status": "paid", "status": "pending"}
    if since:
        query["created_at"] = {"$gt": since}
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"orders": orders, "count": len(orders), "server_time": datetime.now(timezone.utc).isoformat()}


@api_router.post("/admin/orders/{order_id}/accept")
async def admin_accept_order(order_id: str, request: Request):
    from routes.printers import _auto_queue_for_order
    await require_admin(request)
    now_iso = datetime.now(timezone.utc).isoformat()
    res = await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": "preparing", "accepted_at": now_iso, "updated_at": now_iso}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    await _auto_queue_for_order(order_id, "acceptance")
    return await db.orders.find_one({"id": order_id}, {"_id": 0})


@api_router.post("/admin/orders/{order_id}/reject")
async def admin_reject_order(order_id: str, body: RejectBody, request: Request):
    await require_admin(request)
    now_iso = datetime.now(timezone.utc).isoformat()
    res = await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "rejected",
            "rejection_reason": body.reason or "",
            "rejected_at": now_iso,
            "updated_at": now_iso,
        }},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return await db.orders.find_one({"id": order_id}, {"_id": 0})


@api_router.post("/admin/orders/{order_id}/advance")
async def admin_advance_order(order_id: str, request: Request):
    await require_admin(request)
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    current = order.get("status", "pending")
    flow = {
        "pending": "preparing",
        "preparing": "ready",
        "ready": "delivered" if order.get("fulfillment_type") == "delivery" else "completed",
        "out_for_delivery": "delivered",
    }
    if order.get("fulfillment_type") == "delivery":
        flow["ready"] = "out_for_delivery"
    next_status = flow.get(current, current)
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": next_status, "updated_at": now_iso}},
    )
    return await db.orders.find_one({"id": order_id}, {"_id": 0})


# ─── Admin: dashboard + queue + kitchen ───────────────────

@api_router.get("/admin/dashboard")
async def admin_dashboard(request: Request):
    await require_admin(request)
    orders_count = await db.orders.count_documents({})
    menu_count = await db.menu_items.count_documents({})
    return {"daily_revenue": 4285.00, "active_orders": orders_count, "menu_items": menu_count, "top_selling": "Truffle Risotto"}


@api_router.get("/admin/queue")
async def admin_queue(request: Request):
    await require_admin(request)
    orders = await db.orders.find({"status": {"$in": ["pending", "preparing", "ready"]}}, {"_id": 0}).to_list(50)
    return {"queue": orders}


@api_router.get("/kitchen/orders")
async def kitchen_orders():
    orders = await db.orders.find({"status": {"$in": ["pending", "preparing", "cooking"]}}, {"_id": 0}).to_list(50)
    return {"orders": orders}
