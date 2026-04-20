"""Quick '86' / sold-out management: per-item toggle, batch toggle, auto-restore, history log."""
from fastapi import HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional, List
import uuid

from core import api_router, db, require_admin


DEFAULT_86_SETTINGS = {
    "key": "86_settings",
    "auto_restore_on_open": True,
    "last_auto_restore_date": None,     # YYYY-MM-DD
    "updated_at": None,
}


class ToggleBody(BaseModel):
    status: Optional[str] = None        # "in_stock" | "sold_out" | None (flip)
    source: Optional[str] = "admin_86"  # tracking: admin_86 | queue | batch


class BatchBody(BaseModel):
    item_ids: Optional[List[str]] = None
    category: Optional[str] = None
    status: str = "sold_out"            # "sold_out" | "in_stock"
    source: Optional[str] = "batch"


class SettingsBody(BaseModel):
    auto_restore_on_open: Optional[bool] = None


async def _get_settings() -> dict:
    doc = await db.app_settings.find_one({"key": "86_settings"}, {"_id": 0})
    if not doc:
        doc = dict(DEFAULT_86_SETTINGS)
        doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.app_settings.insert_one(doc)
        doc = await db.app_settings.find_one({"key": "86_settings"}, {"_id": 0})
    return {**DEFAULT_86_SETTINGS, **doc}


async def _log_86(item: dict, new_status: str, actor: dict, source: str):
    await db.item_86_log.insert_one({
        "id": str(uuid.uuid4()),
        "item_id": item["id"],
        "item_name": item.get("name", ""),
        "category": item.get("category", ""),
        "prev_status": item.get("status", "in_stock"),
        "new_status": new_status,
        "actor_id": (actor or {}).get("user_id"),
        "actor_name": (actor or {}).get("name") or (actor or {}).get("email"),
        "source": source or "admin_86",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


async def _set_item_status(item_id: str, new_status: str, actor: dict, source: str) -> dict:
    assert new_status in ("in_stock", "sold_out"), "invalid status"
    item = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    prev = item.get("status", "in_stock")
    if prev != new_status:
        await db.menu_items.update_one(
            {"id": item_id},
            {"$set": {"status": new_status, "available": new_status == "in_stock", "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        await _log_86(item, new_status, actor, source)
    return await db.menu_items.find_one({"id": item_id}, {"_id": 0})


@api_router.post("/admin/86/items/{item_id}/toggle")
async def toggle_item_86(item_id: str, body: ToggleBody, request: Request):
    actor = await require_admin(request)
    item = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    target = body.status
    if target is None:
        target = "sold_out" if item.get("status") == "in_stock" else "in_stock"
    if target not in ("in_stock", "sold_out"):
        raise HTTPException(status_code=400, detail="status must be in_stock|sold_out")
    return await _set_item_status(item_id, target, actor, body.source or "admin_86")


@api_router.post("/admin/86/batch")
async def batch_86(body: BatchBody, request: Request):
    actor = await require_admin(request)
    if body.status not in ("sold_out", "in_stock"):
        raise HTTPException(status_code=400, detail="status must be sold_out|in_stock")
    ids: set = set()
    if body.item_ids:
        ids.update(body.item_ids)
    if body.category:
        async for it in db.menu_items.find({"category": body.category}, {"_id": 0, "id": 1}):
            ids.add(it["id"])
    if not ids:
        raise HTTPException(status_code=400, detail="No items matched")
    changed = []
    for iid in ids:
        try:
            await _set_item_status(iid, body.status, actor, body.source or "batch")
            changed.append(iid)
        except HTTPException:
            pass
    return {"updated": len(changed), "item_ids": changed, "target_status": body.status}


@api_router.get("/admin/86/log")
async def get_86_log(request: Request, limit: int = 100, item_id: Optional[str] = None):
    await require_admin(request)
    query: dict = {}
    if item_id:
        query["item_id"] = item_id
    docs = await db.item_86_log.find(query, {"_id": 0}).sort("created_at", -1).to_list(max(1, min(int(limit or 100), 500)))
    return {"logs": docs, "count": len(docs)}


@api_router.get("/admin/86/settings")
async def get_86_settings(request: Request):
    await require_admin(request)
    return await _get_settings()


@api_router.patch("/admin/86/settings")
async def patch_86_settings(body: SettingsBody, request: Request):
    await require_admin(request)
    updates = {}
    if body.auto_restore_on_open is not None:
        updates["auto_restore_on_open"] = bool(body.auto_restore_on_open)
    if not updates:
        raise HTTPException(status_code=400, detail="No changes")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.app_settings.update_one(
        {"key": "86_settings"}, {"$set": updates}, upsert=True,
    )
    return await _get_settings()


# ─── Auto-restore on open (called by /store/status) ──────

async def maybe_auto_restore(is_open_now: bool) -> int:
    """If auto_restore_on_open is enabled AND store just reopened (fresh day),
    flip all 'sold_out' items back to 'in_stock'. Returns number restored."""
    settings = await _get_settings()
    if not settings.get("auto_restore_on_open"):
        return 0
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    last = settings.get("last_auto_restore_date")
    if not is_open_now or last == today:
        return 0
    now_iso = datetime.now(timezone.utc).isoformat()
    sold = await db.menu_items.find(
        {"status": "sold_out"}, {"_id": 0, "id": 1, "name": 1, "category": 1, "status": 1},
    ).to_list(1000)
    for item in sold:
        await db.menu_items.update_one(
            {"id": item["id"]},
            {"$set": {"status": "in_stock", "available": True, "updated_at": now_iso}},
        )
        await db.item_86_log.insert_one({
            "id": str(uuid.uuid4()),
            "item_id": item["id"], "item_name": item.get("name", ""),
            "category": item.get("category", ""),
            "prev_status": "sold_out", "new_status": "in_stock",
            "actor_id": None, "actor_name": "System (auto-restore)",
            "source": "auto_restore_on_open",
            "created_at": now_iso,
        })
    await db.app_settings.update_one(
        {"key": "86_settings"},
        {"$set": {"last_auto_restore_date": today, "updated_at": now_iso}},
        upsert=True,
    )
    return len(sold)
