"""Branded storefront: public settings + social proof, admin CRUD for branding."""
from fastapi import HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional, List

from core import api_router, db, require_admin


DEFAULT_STOREFRONT = {
    "key": "storefront_settings",
    "brand_name": "The Culinary Editorial",
    "tagline": "Seasonal · Considered · Crafted",
    "logo_url": "",
    "favicon_url": "",
    "hero": {
        "image_url": "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=1600&h=900&fit=crop",
        "eyebrow": "Chef's weekly selection",
        "title": "A kitchen worth returning to.",
        "subtitle": "Thoughtful cooking, delivered or picked up — never rushed.",
        "cta_label": "Order Now",
        "cta_link": "/menu",
    },
    "about": {
        "heading": "Our Story",
        "body": "Born from a single neighbourhood kitchen, The Culinary Editorial is a love letter to seasonal ingredients, considered technique, and the people who grow our food. Every dish is built around a local supplier, an old-world method, or an ingredient at its brief moment of perfection.",
        "mission": "Serving food we'd want to cook for our own family, with the same care on a Tuesday night as for a special occasion.",
        "sourcing": "We work directly with a rotating shortlist of farms, fishermen, and makers within 150 miles — all of whom we've visited, all of whom we know by name.",
        "team_image_url": "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=1200&h=800&fit=crop",
    },
    "social": {
        "instagram": "https://instagram.com/culinaryeditorial",
        "twitter": "https://x.com/culinaryedit",
        "facebook": "https://facebook.com/culinaryeditorial",
        "pinterest": "https://pinterest.com/culinaryeditorial",
        "tiktok": "",
        "whatsapp": "",
    },
    "contact": {
        "email": "hello@culinaryeditorial.com",
        "phone": "+1 (555) 123-4567",
        "address": "12 Laurel Street, Brooklyn, NY",
    },
    "cuisine_type": "Modern American · Seasonal",
    "banner_image_url": "",
    "colors": {
        "primary": "#6E1C1E",
        "secondary": "#D4A456",
        "accent": "#1E3A2F",
    },
    "seo": {
        "title": "The Culinary Editorial — Seasonal, considered, crafted",
        "description": "Thoughtful restaurant ordering, delivery, and pickup — backed by a small kitchen and a big notebook of local suppliers.",
        "og_image_url": "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=1200&h=630&fit=crop",
    },
    "updated_at": None,
}

DEFAULT_REVIEWS = [
    {"author": "Maya K.", "rating": 5, "body": "The tagliatelle is unreal. You can taste the care.", "dish": "Truffle Infused Tagliatelle"},
    {"author": "Luis R.", "rating": 5, "body": "My go-to Friday night pickup. Duck was perfectly rested.", "dish": "Heritage Duck Breast"},
    {"author": "Priya D.", "rating": 4, "body": "Delivery was quick, packaging kept everything warm. Will order again.", "dish": "Artisan Diavola"},
    {"author": "Jordan T.", "rating": 5, "body": "Staff handled a tricky allergy request without breaking a sweat.", "dish": "Earth Harvest Bowl"},
]


class StorefrontPatch(BaseModel):
    brand_name: Optional[str] = None
    tagline: Optional[str] = None
    cuisine_type: Optional[str] = None
    banner_image_url: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    hero: Optional[dict] = None
    about: Optional[dict] = None
    social: Optional[dict] = None
    contact: Optional[dict] = None
    colors: Optional[dict] = None
    seo: Optional[dict] = None


async def _get_storefront() -> dict:
    doc = await db.app_settings.find_one({"key": "storefront_settings"}, {"_id": 0})
    if not doc:
        doc = dict(DEFAULT_STOREFRONT)
        doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.app_settings.insert_one(doc)
        doc = await db.app_settings.find_one({"key": "storefront_settings"}, {"_id": 0})
    merged = dict(DEFAULT_STOREFRONT)
    for k, v in (doc or {}).items():
        if isinstance(v, dict) and isinstance(merged.get(k), dict):
            # Drop empty strings so defaults survive when DB stored '' for unset fields.
            cleaned = {ik: iv for ik, iv in v.items() if iv not in ("", None)}
            merged[k] = {**merged[k], **cleaned}
        elif v in ("", None) and merged.get(k):
            # Same protection for top-level scalars.
            continue
        else:
            merged[k] = v
    return merged


@api_router.get("/storefront/settings")
async def get_storefront_settings_public():
    s = await _get_storefront()
    return {
        "brand_name": s["brand_name"], "tagline": s["tagline"],
        "cuisine_type": s.get("cuisine_type", ""),
        "banner_image_url": s.get("banner_image_url", ""),
        "logo_url": s.get("logo_url", ""), "favicon_url": s.get("favicon_url", ""),
        "hero": s["hero"], "about": s["about"], "social": s["social"],
        "contact": s["contact"], "colors": s["colors"], "seo": s["seo"],
    }


@api_router.get("/admin/storefront/settings")
async def get_storefront_settings_admin(request: Request):
    await require_admin(request)
    return await _get_storefront()


@api_router.patch("/admin/storefront/settings")
async def patch_storefront_settings(body: StorefrontPatch, request: Request):
    await require_admin(request)
    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(status_code=400, detail="No changes")
    # Deep-merge nested dicts
    current = await _get_storefront()
    for k, v in payload.items():
        if isinstance(v, dict) and isinstance(current.get(k), dict):
            current[k] = {**current[k], **v}
        else:
            current[k] = v
    current["updated_at"] = datetime.now(timezone.utc).isoformat()
    current["key"] = "storefront_settings"
    await db.app_settings.update_one({"key": "storefront_settings"}, {"$set": current}, upsert=True)
    return await _get_storefront()


@api_router.get("/storefront/social-proof")
async def get_social_proof():
    total_orders = await db.orders.count_documents({"payment_status": "paid"})
    # Use seeded mock reviews; could be replaced with a real reviews collection later
    reviews_doc = await db.app_settings.find_one({"key": "reviews"}, {"_id": 0})
    reviews = (reviews_doc or {}).get("reviews") if reviews_doc else None
    if not reviews:
        reviews = DEFAULT_REVIEWS
        await db.app_settings.update_one(
            {"key": "reviews"}, {"$set": {"key": "reviews", "reviews": DEFAULT_REVIEWS}}, upsert=True,
        )
    ratings = [r["rating"] for r in reviews if r.get("rating")]
    avg = round(sum(ratings) / len(ratings), 2) if ratings else 0
    return {
        "total_orders": total_orders,
        "average_rating": avg,
        "review_count": len(reviews),
        "featured_reviews": reviews[:4],
    }
