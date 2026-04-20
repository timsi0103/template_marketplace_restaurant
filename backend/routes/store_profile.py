"""Store profile extensions: multi-location CRUD, Google Business mock sync, profile completion checklist."""
from fastapi import HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import uuid

from core import api_router, db, require_admin

from routes.storefront import _get_storefront  # reuse merge helper


# ─── Multi-location CRUD ───────────────────────────────────

class LocationCreate(BaseModel):
    name: str
    address: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    hours: Optional[Dict[str, Any]] = None  # e.g. {"mon":"09:00-21:00","tue":"…"}
    is_primary: bool = False
    notes: Optional[str] = ""


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    hours: Optional[Dict[str, Any]] = None
    is_primary: Optional[bool] = None
    notes: Optional[str] = None


def _loc_doc(body: dict) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": f"loc_{uuid.uuid4().hex[:10]}",
        "name": body.get("name", ""),
        "address": body.get("address", ""),
        "phone": body.get("phone", ""),
        "email": body.get("email", ""),
        "hours": body.get("hours") or {},
        "is_primary": bool(body.get("is_primary")),
        "notes": body.get("notes", ""),
        "created_at": now,
        "updated_at": now,
    }


@api_router.get("/store/locations")
async def list_locations_public():
    """Public — returns all locations (brand inheritance happens on the client using /storefront/settings)."""
    docs = await db.store_locations.find({}, {"_id": 0}).sort([("is_primary", -1), ("created_at", 1)]).to_list(200)
    return {"locations": docs}


@api_router.get("/admin/store/locations")
async def list_locations_admin(request: Request):
    await require_admin(request)
    docs = await db.store_locations.find({}, {"_id": 0}).sort([("is_primary", -1), ("created_at", 1)]).to_list(200)
    return {"locations": docs}


@api_router.post("/admin/store/locations")
async def create_location(body: LocationCreate, request: Request):
    await require_admin(request)
    doc = _loc_doc(body.model_dump(exclude_none=False))
    if doc["is_primary"]:
        await db.store_locations.update_many({}, {"$set": {"is_primary": False}})
    await db.store_locations.insert_one(dict(doc))
    return doc


@api_router.patch("/admin/store/locations/{loc_id}")
async def update_location(loc_id: str, body: LocationUpdate, request: Request):
    await require_admin(request)
    existing = await db.store_locations.find_one({"id": loc_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Location not found")
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise HTTPException(status_code=400, detail="No changes")
    if patch.get("is_primary"):
        await db.store_locations.update_many({"id": {"$ne": loc_id}}, {"$set": {"is_primary": False}})
    patch["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.store_locations.update_one({"id": loc_id}, {"$set": patch})
    return await db.store_locations.find_one({"id": loc_id}, {"_id": 0})


@api_router.delete("/admin/store/locations/{loc_id}")
async def delete_location(loc_id: str, request: Request):
    await require_admin(request)
    r = await db.store_locations.delete_one({"id": loc_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Location not found")
    return {"deleted": True}


# ─── Google Business Profile Sync (MOCKED) ─────────────────

class GoogleBusinessConnectRequest(BaseModel):
    account_email: str
    location_id: Optional[str] = None  # Google location identifier — mocked


def _mock_gbp_state_key() -> dict:
    return {"key": "google_business_profile"}


@api_router.get("/admin/store/google-business")
async def get_google_business(request: Request):
    await require_admin(request)
    doc = await db.app_settings.find_one(_mock_gbp_state_key(), {"_id": 0})
    if not doc:
        doc = {
            "key": "google_business_profile",
            "connected": False, "account_email": None,
            "gbp_location_id": None, "last_synced_at": None,
            "last_sync_status": None, "synced_fields": [],
        }
    return {k: v for k, v in doc.items() if k != "key"}


@api_router.post("/admin/store/google-business/connect")
async def connect_google_business(body: GoogleBusinessConnectRequest, request: Request):
    await require_admin(request)
    await db.app_settings.update_one(
        _mock_gbp_state_key(),
        {"$set": {
            "key": "google_business_profile",
            "connected": True,
            "account_email": body.account_email,
            "gbp_location_id": body.location_id or f"gbp_{uuid.uuid4().hex[:8]}",
            "connected_at": datetime.now(timezone.utc).isoformat(),
            "last_sync_status": None,
        }},
        upsert=True,
    )
    doc = await db.app_settings.find_one(_mock_gbp_state_key(), {"_id": 0})
    return {k: v for k, v in doc.items() if k != "key"}


@api_router.post("/admin/store/google-business/sync")
async def sync_google_business(request: Request):
    """MOCKED sync — marks the relevant fields as synced and stamps last_synced_at.
    In production this would call Google Business API; here we just record the intent."""
    await require_admin(request)
    existing = await db.app_settings.find_one(_mock_gbp_state_key(), {"_id": 0}) or {}
    if not existing.get("connected"):
        raise HTTPException(status_code=400, detail="Google Business Profile is not connected")
    s = await _get_storefront()
    synced = []
    if s.get("brand_name"):
        synced.append("store_name")
    if s.get("contact", {}).get("address"):
        synced.append("address")
    if s.get("contact", {}).get("phone"):
        synced.append("phone")
    synced.append("menu_link")
    await db.app_settings.update_one(
        _mock_gbp_state_key(),
        {"$set": {
            "last_synced_at": datetime.now(timezone.utc).isoformat(),
            "last_sync_status": "ok",
            "synced_fields": synced,
        }},
    )
    doc = await db.app_settings.find_one(_mock_gbp_state_key(), {"_id": 0})
    return {"mocked": True, **{k: v for k, v in doc.items() if k != "key"}}


@api_router.post("/admin/store/google-business/disconnect")
async def disconnect_google_business(request: Request):
    await require_admin(request)
    await db.app_settings.update_one(
        _mock_gbp_state_key(),
        {"$set": {
            "connected": False, "account_email": None,
            "gbp_location_id": None, "last_synced_at": None,
            "last_sync_status": None, "synced_fields": [],
        }},
        upsert=True,
    )
    return {"disconnected": True}


# ─── Profile Completion Checklist ─────────────────────────

def _truthy(v) -> bool:
    if v is None:
        return False
    if isinstance(v, str):
        return bool(v.strip())
    return bool(v)


CHECKLIST_FIELDS = [
    ("brand_name", "Restaurant name", "/admin/storefront#brand"),
    ("tagline", "Tagline", "/admin/storefront#brand"),
    ("cuisine_type", "Cuisine type", "/admin/storefront#brand"),
    ("logo_url", "Logo", "/admin/storefront#media"),
    ("favicon_url", "Favicon", "/admin/storefront#media"),
    ("banner_image_url", "Hero banner", "/admin/storefront#media"),
    ("hero.title", "Hero title", "/admin/storefront#hero"),
    ("hero.image_url", "Hero image", "/admin/storefront#hero"),
    ("about.body", "About copy", "/admin/storefront#about"),
    ("about.team_image_url", "About photo", "/admin/storefront#about"),
    ("contact.email", "Contact email", "/admin/storefront#contact"),
    ("contact.phone", "Contact phone", "/admin/storefront#contact"),
    ("contact.address", "Address", "/admin/storefront#contact"),
    ("social.instagram", "Instagram", "/admin/storefront#social"),
    ("social.facebook", "Facebook", "/admin/storefront#social"),
    ("social.twitter", "Twitter / X", "/admin/storefront#social"),
    ("social.whatsapp", "WhatsApp", "/admin/storefront#social"),
    ("seo.title", "SEO title", "/admin/storefront#seo"),
    ("seo.description", "SEO description", "/admin/storefront#seo"),
    ("colors.primary", "Primary color", "/admin/storefront#colors"),
]


def _resolve(obj: dict, dotted: str):
    cur: Any = obj
    for part in dotted.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
    return cur


@api_router.get("/admin/store/profile-completion")
async def profile_completion(request: Request):
    await require_admin(request)
    s = await _get_storefront()
    location_count = await db.store_locations.count_documents({})
    gbp = await db.app_settings.find_one(_mock_gbp_state_key(), {"_id": 0}) or {}

    items = []
    for path, label, link in CHECKLIST_FIELDS:
        val = _resolve(s, path)
        items.append({"key": path, "label": label, "complete": _truthy(val), "link": link})

    items.append({
        "key": "locations",
        "label": "At least one location",
        "complete": location_count > 0,
        "link": "/admin/store-profile#locations",
    })
    items.append({
        "key": "google_business",
        "label": "Google Business Profile connected",
        "complete": bool(gbp.get("connected")),
        "link": "/admin/store-profile#gbp",
    })

    total = len(items)
    done = sum(1 for i in items if i["complete"])
    pct = round((done / total) * 100) if total else 0
    return {
        "percent": pct,
        "complete_count": done,
        "total_count": total,
        "items": items,
    }
