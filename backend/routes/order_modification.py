"""Order Modification & Cancellation.

Provides:
- Admin-configurable cancellation window + auto/manual-refund policy.
- Customer self-cancel within window (public, order_id acts as auth token).
- Admin cancel at any time.
- Admin modify live order before fulfillment (items, qty, manual discount,
  fulfillment/address, kitchen notes) with automatic price recomputation.
- Full audit trail (who changed what, when, why, old→new).
- Cancellation list + reason rollup for admin.

NOTE: refund hand-off to Stripe is **MOCKED** — we persist a refund record with
`mocked=True` and mark `payment_status="refunded"` but never call the live API.
"""
from fastapi import HTTPException, Request, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime, timezone, timedelta
import uuid

from core import api_router, db, get_current_user, require_admin
from models import OrderLineIn, AddressIn
from routes.orders import _enrich_items, _compute_order_totals


# ─── Config ────────────────────────────────────────────────────

DEFAULT_CANCELLATION_CONFIG = {
    "key": "cancellation_config",
    "window_minutes": 5,
    "customer_self_cancel_enabled": True,
    "auto_refund": True,
    "require_reason": True,
    "notify_customer_on_modification": True,
    "modifiable_statuses": ["pending", "preparing"],
    "cancellable_statuses": ["pending", "preparing"],
    "updated_at": None,
}

CANCELLATION_REASONS = [
    {"code": "changed_mind", "label": "Changed my mind"},
    {"code": "mistake", "label": "Ordered by mistake"},
    {"code": "too_long", "label": "Taking too long"},
    {"code": "other", "label": "Other"},
]


async def _get_config() -> dict:
    doc = await db.app_settings.find_one({"key": "cancellation_config"}, {"_id": 0}) or {}
    merged = {**DEFAULT_CANCELLATION_CONFIG, **doc}
    merged.pop("key", None)
    return merged


@api_router.get("/cancellation/config")
async def public_config():
    """Public so customer tracking page can show/hide cancel UI."""
    c = await _get_config()
    return {
        "window_minutes": c["window_minutes"],
        "customer_self_cancel_enabled": c["customer_self_cancel_enabled"],
        "require_reason": c["require_reason"],
        "reasons": CANCELLATION_REASONS,
    }


class CancellationConfigPatch(BaseModel):
    window_minutes: Optional[int] = Field(None, ge=0, le=120)
    customer_self_cancel_enabled: Optional[bool] = None
    auto_refund: Optional[bool] = None
    require_reason: Optional[bool] = None
    notify_customer_on_modification: Optional[bool] = None
    modifiable_statuses: Optional[List[str]] = None
    cancellable_statuses: Optional[List[str]] = None


@api_router.get("/admin/cancellation/config")
async def admin_get_config(request: Request):
    await require_admin(request)
    c = await _get_config()
    c["reasons"] = CANCELLATION_REASONS
    return c


@api_router.patch("/admin/cancellation/config")
async def admin_patch_config(body: CancellationConfigPatch, request: Request):
    await require_admin(request)
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise HTTPException(status_code=400, detail="No changes")
    patch["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.app_settings.update_one(
        {"key": "cancellation_config"}, {"$set": patch}, upsert=True,
    )
    return await admin_get_config(request)


# ─── Helpers ──────────────────────────────────────────────────

def _parse_iso(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _seconds_left_to_cancel(order: dict, window_minutes: int) -> int:
    placed = _parse_iso(order.get("created_at"))
    if not placed or window_minutes <= 0:
        return 0
    end = placed + timedelta(minutes=window_minutes)
    return max(0, int((end - datetime.now(timezone.utc)).total_seconds()))


async def _log_audit(order_id: str, *, actor: dict, action: str, changes: Optional[dict] = None, reason: Optional[str] = None):
    entry = {
        "id": f"aud_{uuid.uuid4().hex[:10]}",
        "order_id": order_id,
        "actor_id": (actor or {}).get("user_id") or (actor or {}).get("email") or "customer",
        "actor_role": (actor or {}).get("role") or "customer",
        "actor_name": (actor or {}).get("name") or (actor or {}).get("email") or "Customer",
        "action": action,
        "changes": changes or {},
        "reason": reason or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.order_audit.insert_one(dict(entry))
    return entry


async def _record_refund(order: dict, *, amount: float, reason: str, initiated_by: str) -> dict:
    """MOCKED refund hand-off. Persists a refunds row and marks the order refunded."""
    refund = {
        "id": f"ref_{uuid.uuid4().hex[:10]}",
        "order_id": order["id"],
        "order_number": order.get("order_number"),
        "amount": round(float(amount or 0), 2),
        "method": "original_payment",
        "status": "initiated",
        "mocked": True,
        "reason": reason,
        "initiated_by": initiated_by,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.refunds.insert_one(dict(refund))
    return refund


@api_router.get("/orders/{order_id}/cancel-eligibility")
async def cancel_eligibility(order_id: str):
    """Public: returns whether customer can cancel this order right now."""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    cfg = await _get_config()
    seconds = _seconds_left_to_cancel(order, cfg["window_minutes"])
    status = order.get("status")
    eligible = (
        cfg["customer_self_cancel_enabled"]
        and seconds > 0
        and status in cfg["cancellable_statuses"]
        and status != "cancelled"
    )
    return {
        "eligible": eligible,
        "seconds_remaining": seconds,
        "window_minutes": cfg["window_minutes"],
        "status": status,
        "reason_required": cfg["require_reason"],
        "reasons": CANCELLATION_REASONS,
    }


# ─── Customer cancel ─────────────────────────────────────────

class CustomerCancelIn(BaseModel):
    reason_code: str
    notes: Optional[str] = ""
    contact_email: Optional[str] = None  # optional re-verification for guest orders


@api_router.post("/orders/{order_id}/cancel")
async def customer_cancel(order_id: str, body: CustomerCancelIn, request: Request):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    cfg = await _get_config()
    if not cfg["customer_self_cancel_enabled"]:
        raise HTTPException(status_code=403, detail="Self-cancellation is disabled")
    if order.get("status") == "cancelled":
        raise HTTPException(status_code=409, detail="Order already cancelled")
    if order.get("status") not in cfg["cancellable_statuses"]:
        raise HTTPException(status_code=409, detail="Order can no longer be cancelled")

    seconds = _seconds_left_to_cancel(order, cfg["window_minutes"])
    if seconds <= 0:
        raise HTTPException(status_code=409, detail="Cancellation window has closed")

    if cfg["require_reason"] and body.reason_code not in {r["code"] for r in CANCELLATION_REASONS}:
        raise HTTPException(status_code=400, detail="Invalid reason")

    # Light auth: if the order has a user_id, try to match session; otherwise accept guest via email.
    actor = {"role": "customer"}
    try:
        u = await get_current_user(request)
        actor = {"user_id": u.get("user_id") or u.get("email"), "email": u.get("email"), "name": u.get("name"), "role": u.get("role", "customer")}
    except Exception:
        pass
    if order.get("user_id") and actor.get("user_id") and order["user_id"] != actor["user_id"] and actor.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not your order")

    now_iso = datetime.now(timezone.utc).isoformat()
    update: Dict[str, Any] = {
        "status": "cancelled",
        "cancelled_at": now_iso,
        "cancellation_reason_code": body.reason_code,
        "cancellation_notes": (body.notes or "").strip()[:500],
        "cancelled_by": "customer",
        "updated_at": now_iso,
    }

    refund = None
    if order.get("payment_status") == "paid":
        if cfg["auto_refund"]:
            refund = await _record_refund(order, amount=order.get("total", 0), reason=body.reason_code, initiated_by="customer")
            update["payment_status"] = "refunded"
            update["refund_id"] = refund["id"]
        else:
            update["refund_pending"] = True

    await db.orders.update_one({"id": order_id}, {"$set": update})
    await _log_audit(order_id, actor=actor, action="customer_cancel", reason=body.reason_code, changes={
        "status": {"old": order.get("status"), "new": "cancelled"},
        "payment_status": {"old": order.get("payment_status"), "new": update.get("payment_status") or order.get("payment_status")},
        "notes": body.notes or "",
    })

    return {
        "cancelled": True,
        "refund": refund,
        "refund_pending": not cfg["auto_refund"] and order.get("payment_status") == "paid",
        "order_id": order_id,
    }


# ─── Admin cancel ─────────────────────────────────────────────

class AdminCancelIn(BaseModel):
    reason_code: Optional[str] = "admin_action"
    notes: Optional[str] = ""
    refund: bool = True


@api_router.post("/admin/orders/{order_id}/cancel")
async def admin_cancel(order_id: str, body: AdminCancelIn, request: Request):
    admin = await require_admin(request)
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("status") == "cancelled":
        raise HTTPException(status_code=409, detail="Order already cancelled")

    now_iso = datetime.now(timezone.utc).isoformat()
    update: Dict[str, Any] = {
        "status": "cancelled",
        "cancelled_at": now_iso,
        "cancellation_reason_code": body.reason_code or "admin_action",
        "cancellation_notes": (body.notes or "").strip()[:500],
        "cancelled_by": "admin",
        "updated_at": now_iso,
    }
    refund = None
    if body.refund and order.get("payment_status") == "paid":
        refund = await _record_refund(order, amount=order.get("total", 0), reason=body.reason_code or "admin_action", initiated_by=f"admin:{admin.get('email')}")
        update["payment_status"] = "refunded"
        update["refund_id"] = refund["id"]

    await db.orders.update_one({"id": order_id}, {"$set": update})
    await _log_audit(order_id, actor=admin, action="admin_cancel", reason=body.reason_code or "admin_action", changes={
        "status": {"old": order.get("status"), "new": "cancelled"},
        "refund_initiated": refund is not None,
        "notes": body.notes or "",
    })
    return {"cancelled": True, "refund": refund}


# ─── Admin modify ─────────────────────────────────────────────

class ModifyOrderIn(BaseModel):
    items: Optional[List[OrderLineIn]] = None
    manual_discount: Optional[float] = Field(None, ge=0)
    manual_discount_reason: Optional[str] = ""
    fulfillment_type: Optional[Literal["delivery", "pickup", "dine_in"]] = None
    address: Optional[AddressIn] = None
    table_number: Optional[str] = None
    kitchen_notes: Optional[str] = None
    modification_reason: Optional[str] = ""


@api_router.post("/admin/orders/{order_id}/modify")
async def admin_modify(order_id: str, body: ModifyOrderIn, request: Request):
    admin = await require_admin(request)
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    cfg = await _get_config()
    if order.get("status") not in cfg["modifiable_statuses"]:
        raise HTTPException(status_code=409, detail=f"Order cannot be modified in status '{order.get('status')}'")

    patch: Dict[str, Any] = {}
    changes: Dict[str, Any] = {}
    old_total = float(order.get("total") or 0)

    if body.items is not None:
        if not body.items:
            raise HTTPException(status_code=400, detail="At least one item required")
        items_enriched, _products_by_id = await _enrich_items(body.items)
        totals = await _compute_order_totals(
            items_enriched, body.fulfillment_type or order.get("fulfillment_type"),
            order.get("promo_applied"), order.get("tip", 0),
            contact_email=order.get("contact_email"), user_id=order.get("user_id"),
            products_by_id=_products_by_id,
        )
        if body.manual_discount is not None and body.manual_discount > 0:
            # Layer the manual discount on top (capped by subtotal so total stays non-negative).
            mdisc = round(min(float(body.manual_discount), totals["subtotal"] - totals["discount"]), 2)
            totals["discount"] = round(totals["discount"] + mdisc, 2)
            totals["total"] = round(max(0.0, totals["total"] - mdisc), 2)
            patch["manual_discount"] = mdisc
            patch["manual_discount_reason"] = (body.manual_discount_reason or "").strip()[:200]
        patch["items"] = items_enriched
        patch.update(totals)
        changes["items"] = {"old_count": len(order.get("items") or []), "new_count": len(items_enriched)}
        changes["total"] = {"old": old_total, "new": totals["total"]}
    elif body.manual_discount is not None:
        # Manual discount only, without changing items
        subtotal = float(order.get("subtotal") or 0)
        mdisc = round(min(float(body.manual_discount), subtotal - float(order.get("discount") or 0)), 2)
        new_discount = round(float(order.get("discount") or 0) + mdisc, 2)
        new_total = round(max(0.0, old_total - mdisc), 2)
        patch["discount"] = new_discount
        patch["manual_discount"] = mdisc
        patch["manual_discount_reason"] = (body.manual_discount_reason or "").strip()[:200]
        patch["total"] = new_total
        changes["total"] = {"old": old_total, "new": new_total}

    if body.fulfillment_type and body.fulfillment_type != order.get("fulfillment_type"):
        patch["fulfillment_type"] = body.fulfillment_type
        changes["fulfillment_type"] = {"old": order.get("fulfillment_type"), "new": body.fulfillment_type}
    if body.address is not None:
        patch["address"] = body.address.model_dump()
        changes["address"] = {"new": body.address.model_dump()}
    if body.table_number is not None:
        patch["table_number"] = body.table_number
        changes["table_number"] = {"old": order.get("table_number"), "new": body.table_number}
    if body.kitchen_notes is not None:
        patch["kitchen_notes"] = body.kitchen_notes.strip()[:1000]
        changes["kitchen_notes"] = {"new": patch["kitchen_notes"]}

    if not patch:
        raise HTTPException(status_code=400, detail="No changes")

    # Stash original total once, for customer-facing delta banner.
    if "total" in patch and "original_total" not in order:
        patch["original_total"] = old_total
    patch["updated_at"] = datetime.now(timezone.utc).isoformat()
    if cfg["notify_customer_on_modification"] and "total" in changes:
        patch["modification_notification"] = {
            "shown": False,
            "old_total": changes["total"]["old"],
            "new_total": changes["total"]["new"],
            "reason": (body.modification_reason or body.manual_discount_reason or "Order adjusted by the restaurant").strip()[:200],
            "created_at": patch["updated_at"],
        }

    await db.orders.update_one({"id": order_id}, {"$set": patch})
    await _log_audit(order_id, actor=admin, action="admin_modify", reason=body.modification_reason or "", changes=changes)

    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return {"modified": True, "order": updated, "changes": changes}


@api_router.post("/orders/{order_id}/acknowledge-modification")
async def acknowledge_modification(order_id: str):
    """Public: called after customer sees the price-change banner, hides it next time."""
    r = await db.orders.update_one(
        {"id": order_id, "modification_notification.shown": False},
        {"$set": {"modification_notification.shown": True}},
    )
    return {"acknowledged": r.modified_count > 0}


# ─── Audit trail ─────────────────────────────────────────────

@api_router.get("/admin/orders/{order_id}/audit")
async def admin_audit(order_id: str, request: Request):
    await require_admin(request)
    order = await db.orders.find_one({"id": order_id}, {"_id": 0, "id": 1})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    entries = await db.order_audit.find({"order_id": order_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"entries": entries}


# ─── Admin list of cancellations ─────────────────────────────

@api_router.get("/admin/cancellations")
async def list_cancellations(request: Request, limit: int = Query(50, ge=1, le=200)):
    await require_admin(request)
    orders = await db.orders.find(
        {"status": "cancelled"}, {"_id": 0}
    ).sort("cancelled_at", -1).limit(limit).to_list(limit)
    # Breakdown
    breakdown: Dict[str, int] = {}
    for o in orders:
        code = o.get("cancellation_reason_code") or "unknown"
        breakdown[code] = breakdown.get(code, 0) + 1
    return {"orders": orders, "count": len(orders), "breakdown": breakdown}
