"""Prep time estimation + order throttling (capacity config, status, customer ETA)."""
from fastapi import HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List
import math

from core import api_router, db, require_admin


DEFAULT_THROTTLE = {
    "key": "throttle_settings",
    "max_concurrent_orders": 15,
    "auto_pause_threshold": 0,      # 0 = disabled
    "slot_granularity_minutes": 15,  # customer next-available slot rounding
    "base_buffer_minutes": 5,        # added once queue depth > 0
    "updated_at": None,
}


class ThrottleBody(BaseModel):
    max_concurrent_orders: Optional[int] = None
    auto_pause_threshold: Optional[int] = None
    slot_granularity_minutes: Optional[int] = None
    base_buffer_minutes: Optional[int] = None


class PrepTimesBody(BaseModel):
    target_prep_minutes_by_category: Dict[str, int]


class ETARequestBody(BaseModel):
    categories: List[str] = []          # list of category names present in cart
    item_ids: List[str] = []            # optional: resolve categories from menu_items


async def _get_throttle() -> dict:
    doc = await db.app_settings.find_one({"key": "throttle_settings"}, {"_id": 0})
    if not doc:
        doc = dict(DEFAULT_THROTTLE)
        doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.app_settings.insert_one(doc)
        doc = await db.app_settings.find_one({"key": "throttle_settings"}, {"_id": 0})
    return {**DEFAULT_THROTTLE, **doc}


async def _active_order_count() -> int:
    return await db.orders.count_documents({
        "payment_status": "paid",
        "status": {"$in": ["pending", "preparing", "ready", "out_for_delivery"]},
    })


async def _prep_times_map() -> Dict[str, int]:
    kds = await db.kds_settings.find_one({"key": "kds_settings"}, {"_id": 0}) or {}
    m = kds.get("target_prep_minutes_by_category", {}) or {}
    return {str(k).lower(): int(v) for k, v in m.items()}


def _load_state(active: int, cap: int) -> str:
    if cap <= 0:
        return "normal"
    ratio = active / cap
    if ratio >= 1:
        return "at_capacity"
    if ratio >= 0.7:
        return "busy"
    return "normal"


def _next_slot_iso(now: datetime, granularity_min: int, buffer_min: int = 0) -> str:
    target = now + timedelta(minutes=buffer_min)
    rem = target.minute % granularity_min
    if rem or target.second or target.microsecond:
        target = target + timedelta(minutes=granularity_min - rem)
        target = target.replace(second=0, microsecond=0)
    return target.isoformat()


async def _is_store_paused() -> bool:
    settings = await db.store_settings.find_one({"type": "hours"}, {"_id": 0})
    return bool((settings or {}).get("pause_ordering"))


async def _compute_eta_payload(categories: List[str], active_count: Optional[int] = None) -> dict:
    prep_map = await _prep_times_map()
    throttle = await _get_throttle()
    cap = int(throttle.get("max_concurrent_orders") or 0) or 15
    buffer_base = int(throttle.get("base_buffer_minutes") or 5)
    granularity = int(throttle.get("slot_granularity_minutes") or 15)

    if active_count is None:
        active_count = await _active_order_count()
    paused = await _is_store_paused()

    cats = [c.lower() for c in (categories or []) if c]
    max_cat_prep = max([prep_map.get(c, 10) for c in cats], default=10) if cats else 10

    # Queue-depth surcharge: every bucket of `cap/3` already-active orders adds +3 min
    queue_adder = int(math.floor(active_count / max(1, cap / 3))) * 3
    eta_minutes = max_cat_prep + (buffer_base if active_count > 0 else 0) + queue_adder

    state = "paused" if paused else _load_state(active_count, cap)
    asap_available = state not in ("paused", "at_capacity")

    next_slot = None
    if not asap_available:
        # Wait until queue drains below 70% → approximate by extra eta minutes
        spacing = max(2, int(math.ceil(eta_minutes / 2)))
        next_slot = _next_slot_iso(datetime.now(timezone.utc), granularity, spacing)

    return {
        "asap_available": asap_available,
        "eta_minutes": int(eta_minutes),
        "eta_label": f"Ready in ~{int(eta_minutes)} min" if asap_available else "Scheduled for later",
        "capacity_state": state,
        "active_count": active_count,
        "max_concurrent_orders": cap,
        "paused": paused,
        "next_available_slot": next_slot,
    }


# ─── Public: customer-facing ETA ──────────────────────────

@api_router.post("/store/eta")
async def store_eta(body: ETARequestBody):
    categories = list(body.categories or [])
    if body.item_ids:
        async for it in db.menu_items.find({"id": {"$in": body.item_ids}}, {"_id": 0, "category": 1}):
            if it.get("category"):
                categories.append(it["category"])
    return await _compute_eta_payload(categories)


# ─── Admin: throttle settings ─────────────────────────────

@api_router.get("/admin/throttle/settings")
async def get_throttle_settings(request: Request):
    await require_admin(request)
    return await _get_throttle()


@api_router.patch("/admin/throttle/settings")
async def patch_throttle_settings(body: ThrottleBody, request: Request):
    await require_admin(request)
    updates = {}
    if body.max_concurrent_orders is not None:
        if body.max_concurrent_orders < 1:
            raise HTTPException(status_code=400, detail="max_concurrent_orders must be >= 1")
        updates["max_concurrent_orders"] = int(body.max_concurrent_orders)
    if body.auto_pause_threshold is not None:
        if body.auto_pause_threshold < 0:
            raise HTTPException(status_code=400, detail="auto_pause_threshold must be >= 0")
        updates["auto_pause_threshold"] = int(body.auto_pause_threshold)
    if body.slot_granularity_minutes is not None:
        if body.slot_granularity_minutes not in (5, 10, 15, 30, 60):
            raise HTTPException(status_code=400, detail="slot_granularity_minutes must be 5|10|15|30|60")
        updates["slot_granularity_minutes"] = int(body.slot_granularity_minutes)
    if body.base_buffer_minutes is not None:
        if body.base_buffer_minutes < 0:
            raise HTTPException(status_code=400, detail="base_buffer_minutes must be >= 0")
        updates["base_buffer_minutes"] = int(body.base_buffer_minutes)
    if not updates:
        raise HTTPException(status_code=400, detail="No changes")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.app_settings.update_one(
        {"key": "throttle_settings"}, {"$set": updates}, upsert=True,
    )
    return await _get_throttle()


# ─── Admin: live throttle status ─────────────────────────

@api_router.get("/admin/throttle/status")
async def get_throttle_status(request: Request):
    await require_admin(request)
    active = await _active_order_count()
    throttle = await _get_throttle()
    cap = int(throttle.get("max_concurrent_orders") or 0) or 15
    paused = await _is_store_paused()
    state = "paused" if paused else _load_state(active, cap)
    return {
        "state": state,
        "active_count": active,
        "max_concurrent_orders": cap,
        "auto_pause_threshold": int(throttle.get("auto_pause_threshold") or 0),
        "utilization": round(active / cap, 3) if cap else 0,
        "paused": paused,
        "server_time": datetime.now(timezone.utc).isoformat(),
    }


# ─── Admin: prep times (proxy to KDS settings for DRY) ───

@api_router.get("/admin/prep-times")
async def get_prep_times(request: Request):
    await require_admin(request)
    return {"target_prep_minutes_by_category": await _prep_times_map()}


@api_router.put("/admin/prep-times")
async def put_prep_times(body: PrepTimesBody, request: Request):
    await require_admin(request)
    clean = {str(k).strip().lower(): max(1, int(v)) for k, v in body.target_prep_minutes_by_category.items() if v is not None}
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.kds_settings.update_one(
        {"key": "kds_settings"},
        {"$set": {"target_prep_minutes_by_category": clean, "updated_at": now_iso}},
        upsert=True,
    )
    return {"target_prep_minutes_by_category": clean}


# ─── Internal: auto-pause hook (called after order state changes) ──

async def maybe_auto_pause():
    """If auto_pause_threshold set and active count crosses it, flip pause on.
    Returns True if the pause flag was just turned on by this call."""
    throttle = await _get_throttle()
    threshold = int(throttle.get("auto_pause_threshold") or 0)
    if threshold <= 0:
        return False
    active = await _active_order_count()
    if active >= threshold:
        now_iso = datetime.now(timezone.utc).isoformat()
        res = await db.store_settings.update_one(
            {"type": "hours", "$or": [{"pause_ordering": {"$ne": True}}, {"pause_ordering": {"$exists": False}}]},
            {"$set": {"pause_ordering": True, "auto_paused_at": now_iso, "updated_at": now_iso}},
            upsert=True,
        )
        return bool(res.modified_count or res.upserted_id)
    return False
