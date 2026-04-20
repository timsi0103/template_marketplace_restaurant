"""Catalog browsing configuration: dietary filter visibility, default sort, quick-view toggle, price bounds."""
from fastapi import Request, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import List, Optional

from core import api_router, db, require_admin


ALL_DIETARY_TAGS = [
    "vegan", "vegetarian", "gluten_free", "dairy_free",
    "halal", "kosher", "nut_free", "spicy", "low_carb",
]

DEFAULT_CATALOG_SETTINGS = {
    "key": "catalog_settings",
    "visible_dietary_tags": ["vegan", "vegetarian", "gluten_free", "halal", "nut_free", "spicy"],
    "default_sort": "popularity",  # popularity | price_asc | price_desc | newest | name_asc
    "quick_view_enabled": True,
    "price_min": 0,
    "price_max": 100,
    "sticky_category_bar": True,
    "show_in_stock_toggle": True,
    "updated_at": None,
}


class CatalogSettingsPatch(BaseModel):
    visible_dietary_tags: Optional[List[str]] = None
    default_sort: Optional[str] = None
    quick_view_enabled: Optional[bool] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    sticky_category_bar: Optional[bool] = None
    show_in_stock_toggle: Optional[bool] = None


async def _get_catalog_settings() -> dict:
    doc = await db.app_settings.find_one({"key": "catalog_settings"}, {"_id": 0})
    if not doc:
        doc = dict(DEFAULT_CATALOG_SETTINGS)
        doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.app_settings.insert_one(doc)
        doc = await db.app_settings.find_one({"key": "catalog_settings"}, {"_id": 0})
    merged = dict(DEFAULT_CATALOG_SETTINGS)
    merged.update(doc or {})
    return merged


@api_router.get("/catalog/settings")
async def catalog_settings_public():
    s = await _get_catalog_settings()
    return {
        "visible_dietary_tags": s["visible_dietary_tags"],
        "default_sort": s["default_sort"],
        "quick_view_enabled": s["quick_view_enabled"],
        "price_min": s["price_min"],
        "price_max": s["price_max"],
        "sticky_category_bar": s["sticky_category_bar"],
        "show_in_stock_toggle": s["show_in_stock_toggle"],
        "all_dietary_tags": ALL_DIETARY_TAGS,
    }


@api_router.get("/admin/catalog/settings")
async def catalog_settings_admin(request: Request):
    await require_admin(request)
    s = await _get_catalog_settings()
    s["all_dietary_tags"] = ALL_DIETARY_TAGS
    return s


@api_router.patch("/admin/catalog/settings")
async def patch_catalog_settings(body: CatalogSettingsPatch, request: Request):
    await require_admin(request)
    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(status_code=400, detail="No changes")
    if "default_sort" in payload and payload["default_sort"] not in {"popularity", "price_asc", "price_desc", "newest", "name_asc"}:
        raise HTTPException(status_code=400, detail="Invalid sort option")
    if "visible_dietary_tags" in payload:
        payload["visible_dietary_tags"] = [t for t in payload["visible_dietary_tags"] if t in ALL_DIETARY_TAGS]
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.app_settings.update_one(
        {"key": "catalog_settings"},
        {"$set": payload},
        upsert=True,
    )
    result = await _get_catalog_settings()
    result["all_dietary_tags"] = ALL_DIETARY_TAGS
    return result
