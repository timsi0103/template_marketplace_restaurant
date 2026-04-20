"""SEO Optimization & Structured Data.

Provides:
- Global + per-page SEO settings (title, description, OG, canonical, noindex, keywords).
- Per-page public lookup for frontend meta injection.
- URL redirects CRUD + public lookup (301/302) with hit tracking.
- Dynamic sitemap.xml generation (static pages + catalog).
- robots.txt generation.
- Structured Data (JSON-LD) builder per page (Restaurant, Menu, MenuItem,
  Organization, LocalBusiness, BreadcrumbList, WebSite).
- SEO health audit (missing/short/long titles, descriptions, OG images, duplicates, etc.).
"""
from fastapi import HTTPException, Request, Response, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from typing import Optional, List, Literal, Dict, Any
from datetime import datetime, timezone
from collections import Counter
import uuid
import os

from core import api_router, db, require_admin


# ─── Defaults ────────────────────────────────────────────────────

PAGE_KEYS = [
    "home", "menu", "category", "product", "checkout",
    "orders", "order_success", "order_tracking", "about",
    "contact", "login", "signup", "search", "loyalty",
]

PAGE_LABELS = {
    "home": "Home",
    "menu": "Menu",
    "category": "Category Landing (template)",
    "product": "Product Detail (template)",
    "checkout": "Checkout",
    "orders": "Customer Orders",
    "order_success": "Order Success",
    "order_tracking": "Order Tracking",
    "about": "About",
    "contact": "Contact",
    "login": "Login",
    "signup": "Sign Up",
    "search": "Search Results",
    "loyalty": "Loyalty",
}

PAGE_PATHS = {
    "home": "/",
    "menu": "/menu",
    "category": "/menu/{slug}",
    "product": "/product/{id}",
    "checkout": "/checkout",
    "orders": "/orders",
    "order_success": "/order/success",
    "order_tracking": "/orders/track/{order_id}",
    "about": "/about",
    "contact": "/contact",
    "login": "/login",
    "signup": "/signup",
    "search": "/search",
    "loyalty": "/loyalty",
}

# Which pages appear in sitemap by default (noindex overrides this)
SITEMAP_INCLUDED = {"home", "menu", "about", "contact", "loyalty"}

DEFAULT_STRUCTURED_TYPES = {
    "home": ["Organization", "Restaurant", "WebSite"],
    "menu": ["Menu", "BreadcrumbList"],
    "category": ["Menu", "BreadcrumbList"],
    "product": ["MenuItem", "BreadcrumbList"],
    "about": ["Organization"],
    "contact": ["LocalBusiness"],
}


def _default_page_seo(key: str) -> dict:
    return {
        "page_key": key,
        "title": "",
        "description": "",
        "keywords": [],
        "og_title": "",
        "og_description": "",
        "og_image_url": "",
        "canonical_url": "",
        "noindex": False,
        "nofollow": False,
        "twitter_card": "summary_large_image",
        "structured_data_types": DEFAULT_STRUCTURED_TYPES.get(key, []),
        "updated_at": None,
    }


DEFAULT_GLOBAL_SEO = {
    "key": "seo_settings",
    "default_title_suffix": " — The Culinary Editorial",
    "default_description": "",
    "default_og_image_url": "",
    "site_url": "",
    "google_verification": "",
    "bing_verification": "",
    "facebook_app_id": "",
    "twitter_handle": "",
    "organization": {
        "legal_name": "",
        "founding_date": "",
        "tax_id": "",
    },
    "robots": {
        "allow_all": True,
        "disallow_paths": ["/admin", "/checkout", "/order/success", "/orders"],
        "crawl_delay": 0,
        "extra_lines": [],
    },
    "sitemap": {
        "auto_include_products": True,
        "auto_include_categories": True,
        "change_frequency": "weekly",
        "priority_home": 1.0,
        "priority_menu": 0.9,
        "priority_product": 0.7,
    },
    "updated_at": None,
}


# ─── Settings helpers ───────────────────────────────────────────

async def _get_global() -> dict:
    doc = await db.seo_settings.find_one({"key": "seo_settings"}, {"_id": 0})
    if not doc:
        doc = dict(DEFAULT_GLOBAL_SEO)
        doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.seo_settings.insert_one(doc)
        doc = await db.seo_settings.find_one({"key": "seo_settings"}, {"_id": 0})
    merged = dict(DEFAULT_GLOBAL_SEO)
    for k, v in (doc or {}).items():
        if isinstance(v, dict) and isinstance(merged.get(k), dict):
            merged[k] = {**merged[k], **v}
        elif v is not None:
            merged[k] = v
    return merged


async def _get_page(key: str) -> dict:
    doc = await db.seo_pages.find_one({"page_key": key}, {"_id": 0})
    merged = _default_page_seo(key)
    if doc:
        for k, v in doc.items():
            if v is not None:
                merged[k] = v
    return merged


async def _get_all_pages() -> List[dict]:
    docs = await db.seo_pages.find({}, {"_id": 0}).to_list(200)
    by_key = {d["page_key"]: d for d in docs if d.get("page_key")}
    out = []
    for k in PAGE_KEYS:
        merged = _default_page_seo(k)
        if k in by_key:
            for kk, vv in by_key[k].items():
                if vv is not None:
                    merged[kk] = vv
        merged["path"] = PAGE_PATHS.get(k, "/")
        merged["label"] = PAGE_LABELS.get(k, k)
        out.append(merged)
    return out


async def _storefront() -> dict:
    return await db.app_settings.find_one({"key": "storefront_settings"}, {"_id": 0}) or {}


def _resolve_base_url(request: Request, global_seo: dict) -> str:
    if global_seo.get("site_url"):
        return global_seo["site_url"].rstrip("/")
    try:
        return f"{request.url.scheme}://{request.url.netloc}"
    except Exception:
        return ""


def _resolve_meta(page: dict, global_seo: dict, storefront: dict) -> dict:
    """Merge page-level values with storefront + global fallbacks."""
    sf_seo = (storefront or {}).get("seo") or {}
    brand_name = (storefront or {}).get("brand_name", "")
    title = page.get("title") or sf_seo.get("title") or brand_name
    suffix = global_seo.get("default_title_suffix") or ""
    if title and suffix and not title.endswith(suffix) and page.get("title"):
        title = f"{title}{suffix}"
    description = page.get("description") or global_seo.get("default_description") or sf_seo.get("description") or ""
    og_image = page.get("og_image_url") or global_seo.get("default_og_image_url") or sf_seo.get("og_image_url") or ""
    og_title = page.get("og_title") or title
    og_description = page.get("og_description") or description
    return {
        "title": title,
        "description": description,
        "og_title": og_title,
        "og_description": og_description,
        "og_image_url": og_image,
        "canonical_url": page.get("canonical_url") or "",
        "noindex": bool(page.get("noindex")),
        "nofollow": bool(page.get("nofollow")),
        "twitter_card": page.get("twitter_card") or "summary_large_image",
        "twitter_handle": global_seo.get("twitter_handle", ""),
        "keywords": page.get("keywords") or [],
    }


# ─── Structured Data builder ──────────────────────────────────

async def _build_structured_data(page_key: str, base_url: str, global_seo: dict, storefront: dict, context: dict | None = None) -> List[dict]:
    types = (await _get_page(page_key)).get("structured_data_types") or []
    sf = storefront or {}
    contact = sf.get("contact") or {}
    social = sf.get("social") or {}
    brand_name = sf.get("brand_name") or "Restaurant"
    logo_url = sf.get("logo_url") or ""
    address_str = contact.get("address", "")
    phone = contact.get("phone", "")
    email = contact.get("email", "")
    same_as = [v for v in [social.get("instagram"), social.get("facebook"), social.get("twitter"), social.get("tiktok")] if v]

    blocks: List[dict] = []
    for t in types:
        if t == "Organization":
            blocks.append({
                "@context": "https://schema.org",
                "@type": "Organization",
                "name": global_seo.get("organization", {}).get("legal_name") or brand_name,
                "url": base_url,
                "logo": logo_url,
                "email": email,
                "telephone": phone,
                "sameAs": same_as,
            })
        elif t == "Restaurant":
            blocks.append({
                "@context": "https://schema.org",
                "@type": "Restaurant",
                "name": brand_name,
                "url": base_url,
                "image": (sf.get("hero") or {}).get("image_url") or logo_url,
                "servesCuisine": sf.get("cuisine_type") or "",
                "priceRange": "$$",
                "telephone": phone,
                "address": {"@type": "PostalAddress", "streetAddress": address_str},
                "sameAs": same_as,
            })
        elif t == "LocalBusiness":
            blocks.append({
                "@context": "https://schema.org",
                "@type": "LocalBusiness",
                "name": brand_name,
                "url": base_url,
                "telephone": phone,
                "address": {"@type": "PostalAddress", "streetAddress": address_str},
                "image": logo_url,
            })
        elif t == "WebSite":
            blocks.append({
                "@context": "https://schema.org",
                "@type": "WebSite",
                "name": brand_name,
                "url": base_url,
                "potentialAction": {
                    "@type": "SearchAction",
                    "target": f"{base_url}/search?q={{search_term_string}}",
                    "query-input": "required name=search_term_string",
                },
            })
        elif t == "Menu":
            sections: List[dict] = []
            async for cat in db.categories.find({"is_active": {"$ne": False}}, {"_id": 0}).sort("sort_order", 1):
                items_cur = db.menu_items.find({"category": cat.get("slug") or cat.get("id"), "is_available": {"$ne": False}}, {"_id": 0}).limit(30)
                menu_items: List[dict] = []
                async for it in items_cur:
                    menu_items.append({
                        "@type": "MenuItem",
                        "name": it.get("name", ""),
                        "description": it.get("description", "") or "",
                        "offers": {"@type": "Offer", "price": str(it.get("price") or 0), "priceCurrency": "USD"},
                    })
                sections.append({
                    "@type": "MenuSection",
                    "name": cat.get("name", ""),
                    "hasMenuItem": menu_items,
                })
            blocks.append({
                "@context": "https://schema.org",
                "@type": "Menu",
                "name": f"{brand_name} Menu",
                "hasMenuSection": sections,
            })
        elif t == "MenuItem":
            it = (context or {}).get("product") or {}
            if it:
                blocks.append({
                    "@context": "https://schema.org",
                    "@type": "MenuItem",
                    "name": it.get("name", ""),
                    "description": it.get("description", "") or "",
                    "image": (it.get("gallery") or [None])[0] or it.get("image") or "",
                    "offers": {"@type": "Offer", "price": str(it.get("price") or 0), "priceCurrency": "USD", "availability": "https://schema.org/InStock" if it.get("is_available", True) else "https://schema.org/OutOfStock"},
                })
        elif t == "BreadcrumbList":
            crumbs = (context or {}).get("breadcrumbs") or [{"name": "Home", "path": "/"}]
            item_list = []
            for i, c in enumerate(crumbs, start=1):
                item_list.append({
                    "@type": "ListItem",
                    "position": i,
                    "name": c.get("name"),
                    "item": f"{base_url}{c.get('path') or '/'}",
                })
            blocks.append({
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": item_list,
            })
    return blocks


# ─── Public: per-page meta & structured data ────────────────────

@api_router.get("/seo/page/{page_key}")
async def public_page_seo(page_key: str, request: Request, product_id: Optional[str] = None, category_slug: Optional[str] = None):
    if page_key not in PAGE_KEYS:
        raise HTTPException(status_code=404, detail="Unknown page key")
    global_seo = await _get_global()
    page = await _get_page(page_key)
    storefront = await _storefront()
    base_url = _resolve_base_url(request, global_seo)

    context: Dict[str, Any] = {}
    if page_key == "product" and product_id:
        prod = await db.menu_items.find_one({"id": product_id}, {"_id": 0})
        if prod:
            context["product"] = prod
            if not page.get("title"):
                page = {**page, "title": prod.get("name", "")}
            if not page.get("description"):
                page = {**page, "description": (prod.get("description") or "")[:160]}
            if not page.get("og_image_url"):
                img = (prod.get("gallery") or [None])[0] or prod.get("image") or ""
                page = {**page, "og_image_url": img}
            context["breadcrumbs"] = [
                {"name": "Home", "path": "/"},
                {"name": "Menu", "path": "/menu"},
                {"name": prod.get("name", ""), "path": f"/product/{prod.get('id')}"},
            ]
    if page_key == "category" and category_slug:
        cat = await db.categories.find_one({"slug": category_slug}, {"_id": 0})
        if cat:
            if not page.get("title"):
                page = {**page, "title": cat.get("name", "")}
            if not page.get("description"):
                page = {**page, "description": (cat.get("description") or "")[:160]}
            context["breadcrumbs"] = [
                {"name": "Home", "path": "/"},
                {"name": "Menu", "path": "/menu"},
                {"name": cat.get("name", ""), "path": f"/menu/{cat.get('slug')}"},
            ]

    meta = _resolve_meta(page, global_seo, storefront)
    structured = await _build_structured_data(page_key, base_url, global_seo, storefront, context)
    path = PAGE_PATHS.get(page_key, "/")
    canonical = meta.get("canonical_url") or f"{base_url}{path}"
    return {
        "page_key": page_key,
        "path": path,
        "meta": meta,
        "canonical_url": canonical,
        "structured_data": structured,
        "verification": {
            "google": global_seo.get("google_verification", ""),
            "bing": global_seo.get("bing_verification", ""),
        },
        "facebook_app_id": global_seo.get("facebook_app_id", ""),
    }


# ─── Admin: global + per-page SEO CRUD ──────────────────────────

class GlobalSeoPatch(BaseModel):
    default_title_suffix: Optional[str] = None
    default_description: Optional[str] = None
    default_og_image_url: Optional[str] = None
    site_url: Optional[str] = None
    google_verification: Optional[str] = None
    bing_verification: Optional[str] = None
    facebook_app_id: Optional[str] = None
    twitter_handle: Optional[str] = None
    organization: Optional[dict] = None
    robots: Optional[dict] = None
    sitemap: Optional[dict] = None


@api_router.get("/admin/seo/settings")
async def admin_get_seo(request: Request):
    await require_admin(request)
    g = await _get_global()
    pages = await _get_all_pages()
    return {"global": g, "pages": pages, "available_structured_types": sorted({t for lst in DEFAULT_STRUCTURED_TYPES.values() for t in lst} | {"LocalBusiness"})}


@api_router.patch("/admin/seo/settings")
async def admin_patch_seo(body: GlobalSeoPatch, request: Request):
    await require_admin(request)
    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(status_code=400, detail="No changes")
    current = await _get_global()
    for k, v in payload.items():
        if isinstance(v, dict) and isinstance(current.get(k), dict):
            current[k] = {**current[k], **v}
        else:
            current[k] = v
    current["updated_at"] = datetime.now(timezone.utc).isoformat()
    current["key"] = "seo_settings"
    await db.seo_settings.update_one({"key": "seo_settings"}, {"$set": current}, upsert=True)
    return await _get_global()


class PageSeoPatch(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    keywords: Optional[List[str]] = None
    og_title: Optional[str] = None
    og_description: Optional[str] = None
    og_image_url: Optional[str] = None
    canonical_url: Optional[str] = None
    noindex: Optional[bool] = None
    nofollow: Optional[bool] = None
    twitter_card: Optional[Literal["summary", "summary_large_image"]] = None
    structured_data_types: Optional[List[str]] = None


@api_router.get("/admin/seo/pages/{page_key}")
async def admin_get_page(page_key: str, request: Request):
    await require_admin(request)
    if page_key not in PAGE_KEYS:
        raise HTTPException(status_code=404, detail="Unknown page key")
    return await _get_page(page_key)


@api_router.patch("/admin/seo/pages/{page_key}")
async def admin_patch_page(page_key: str, body: PageSeoPatch, request: Request):
    await require_admin(request)
    if page_key not in PAGE_KEYS:
        raise HTTPException(status_code=404, detail="Unknown page key")
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise HTTPException(status_code=400, detail="No changes")
    patch["page_key"] = page_key
    patch["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.seo_pages.update_one({"page_key": page_key}, {"$set": patch}, upsert=True)
    return await _get_page(page_key)


# ─── URL Redirects ──────────────────────────────────────────────

class RedirectIn(BaseModel):
    from_path: str
    to_path: str
    status_code: Literal[301, 302] = 301
    note: Optional[str] = ""


class RedirectPatch(BaseModel):
    from_path: Optional[str] = None
    to_path: Optional[str] = None
    status_code: Optional[Literal[301, 302]] = None
    note: Optional[str] = None


def _norm_path(p: str) -> str:
    if not p:
        return "/"
    if not p.startswith("/") and not p.startswith("http"):
        p = "/" + p
    return p.rstrip("/") or "/"


@api_router.get("/admin/seo/redirects")
async def list_redirects(request: Request):
    await require_admin(request)
    docs = await db.seo_redirects.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"redirects": docs}


@api_router.post("/admin/seo/redirects")
async def create_redirect(body: RedirectIn, request: Request):
    await require_admin(request)
    from_path = _norm_path(body.from_path)
    to_path = _norm_path(body.to_path)
    if from_path == to_path:
        raise HTTPException(status_code=400, detail="from and to paths cannot match")
    existing = await db.seo_redirects.find_one({"from_path": from_path}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=409, detail=f"Redirect already exists for {from_path}")
    rid = f"rdr_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": rid,
        "from_path": from_path,
        "to_path": to_path,
        "status_code": body.status_code,
        "note": body.note or "",
        "hits": 0,
        "last_hit_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.seo_redirects.insert_one(dict(doc))
    return doc


@api_router.patch("/admin/seo/redirects/{rid}")
async def patch_redirect(rid: str, body: RedirectPatch, request: Request):
    await require_admin(request)
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise HTTPException(status_code=400, detail="No changes")
    if "from_path" in patch:
        patch["from_path"] = _norm_path(patch["from_path"])
    if "to_path" in patch:
        patch["to_path"] = _norm_path(patch["to_path"])
    r = await db.seo_redirects.update_one({"id": rid}, {"$set": patch})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Redirect not found")
    return await db.seo_redirects.find_one({"id": rid}, {"_id": 0})


@api_router.delete("/admin/seo/redirects/{rid}")
async def delete_redirect(rid: str, request: Request):
    await require_admin(request)
    r = await db.seo_redirects.delete_one({"id": rid})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Redirect not found")
    return {"deleted": True}


@api_router.get("/seo/redirect-check")
async def public_redirect_check(path: str = Query(...)):
    """Public: looks up a redirect by path. Increments hit counters when matched."""
    key = _norm_path(path)
    doc = await db.seo_redirects.find_one({"from_path": key}, {"_id": 0})
    if not doc:
        return {"found": False}
    await db.seo_redirects.update_one(
        {"id": doc["id"]},
        {"$inc": {"hits": 1}, "$set": {"last_hit_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"found": True, "to_path": doc["to_path"], "status_code": doc["status_code"]}


# ─── Sitemap & Robots ───────────────────────────────────────────

def _xml_escape(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


async def _build_sitemap_entries(base_url: str, global_seo: dict) -> List[dict]:
    pages = await _get_all_pages()
    sm_cfg = global_seo.get("sitemap", {})
    freq = sm_cfg.get("change_frequency", "weekly")
    priority_home = float(sm_cfg.get("priority_home", 1.0))
    priority_menu = float(sm_cfg.get("priority_menu", 0.9))
    priority_product = float(sm_cfg.get("priority_product", 0.7))

    entries: List[dict] = []
    for p in pages:
        if p.get("noindex"):
            continue
        if p["page_key"] not in SITEMAP_INCLUDED:
            continue
        pri = priority_home if p["page_key"] == "home" else (priority_menu if p["page_key"] == "menu" else 0.5)
        entries.append({
            "loc": f"{base_url}{p['path']}",
            "changefreq": freq,
            "priority": round(pri, 2),
            "lastmod": p.get("updated_at") or datetime.now(timezone.utc).isoformat(),
        })

    if sm_cfg.get("auto_include_categories", True):
        async for cat in db.categories.find({"is_active": {"$ne": False}}, {"_id": 0}):
            slug = cat.get("slug") or cat.get("id")
            if not slug:
                continue
            entries.append({
                "loc": f"{base_url}/menu/{slug}",
                "changefreq": freq,
                "priority": round(priority_menu, 2),
                "lastmod": (cat.get("updated_at") or datetime.now(timezone.utc).isoformat()),
            })

    if sm_cfg.get("auto_include_products", True):
        async for it in db.menu_items.find({"is_available": {"$ne": False}}, {"_id": 0}):
            iid = it.get("id")
            if not iid:
                continue
            entries.append({
                "loc": f"{base_url}/product/{iid}",
                "changefreq": freq,
                "priority": round(priority_product, 2),
                "lastmod": (it.get("updated_at") or datetime.now(timezone.utc).isoformat()),
            })
    return entries


@api_router.get("/seo/sitemap.xml")
async def public_sitemap(request: Request):
    global_seo = await _get_global()
    base_url = _resolve_base_url(request, global_seo)
    entries = await _build_sitemap_entries(base_url, global_seo)
    parts = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for e in entries:
        parts.append(
            "  <url>"
            f"<loc>{_xml_escape(e['loc'])}</loc>"
            f"<changefreq>{e['changefreq']}</changefreq>"
            f"<priority>{e['priority']}</priority>"
            f"<lastmod>{_xml_escape(e['lastmod'][:10])}</lastmod>"
            "</url>"
        )
    parts.append("</urlset>")
    return Response(content="\n".join(parts), media_type="application/xml")


@api_router.get("/seo/robots.txt", response_class=PlainTextResponse)
async def public_robots(request: Request):
    global_seo = await _get_global()
    base_url = _resolve_base_url(request, global_seo)
    robots = global_seo.get("robots", {})
    lines = ["User-agent: *"]
    if robots.get("allow_all", True):
        lines.append("Allow: /")
    for d in (robots.get("disallow_paths") or []):
        lines.append(f"Disallow: {d}")
    if robots.get("crawl_delay"):
        lines.append(f"Crawl-delay: {robots['crawl_delay']}")
    for extra in (robots.get("extra_lines") or []):
        lines.append(extra)
    lines.append("")
    lines.append(f"Sitemap: {base_url}/api/seo/sitemap.xml")
    return "\n".join(lines)


@api_router.get("/admin/seo/sitemap-preview")
async def admin_sitemap_preview(request: Request):
    await require_admin(request)
    global_seo = await _get_global()
    base_url = _resolve_base_url(request, global_seo)
    entries = await _build_sitemap_entries(base_url, global_seo)
    return {"base_url": base_url, "entries": entries, "count": len(entries)}


@api_router.get("/admin/seo/robots-preview")
async def admin_robots_preview(request: Request):
    await require_admin(request)
    # Re-render robots preview via the public handler logic (no request-aware rewriting)
    global_seo = await _get_global()
    base_url = _resolve_base_url(request, global_seo)
    robots = global_seo.get("robots", {})
    lines = ["User-agent: *"]
    if robots.get("allow_all", True):
        lines.append("Allow: /")
    for d in (robots.get("disallow_paths") or []):
        lines.append(f"Disallow: {d}")
    if robots.get("crawl_delay"):
        lines.append(f"Crawl-delay: {robots['crawl_delay']}")
    for extra in (robots.get("extra_lines") or []):
        lines.append(extra)
    lines.append("")
    lines.append(f"Sitemap: {base_url}/api/seo/sitemap.xml")
    return {"content": "\n".join(lines)}


# ─── Health Audit ───────────────────────────────────────────────

@api_router.get("/admin/seo/health")
async def admin_seo_health(request: Request):
    await require_admin(request)
    global_seo = await _get_global()
    pages = await _get_all_pages()
    storefront = await _storefront()

    checks: List[dict] = []

    def add(status: str, severity: str, code: str, label: str, detail: str = "", fix_link: str = ""):
        checks.append({
            "status": status, "severity": severity, "code": code,
            "label": label, "detail": detail, "fix_link": fix_link,
        })

    # Global
    if global_seo.get("site_url"):
        add("pass", "high", "site_url", "Canonical site URL configured",
            detail=global_seo.get("site_url"), fix_link="/admin/seo")
    else:
        add("warn", "high", "site_url", "Canonical site URL is not set",
            detail="Set site_url so sitemap.xml and canonical tags resolve correctly.", fix_link="/admin/seo")
    if global_seo.get("default_og_image_url") or (storefront.get("seo") or {}).get("og_image_url"):
        add("pass", "medium", "default_og_image", "Default Open Graph image present", fix_link="/admin/seo")
    else:
        add("warn", "medium", "default_og_image", "No default Open Graph image",
            detail="Social shares without og:image look flat.", fix_link="/admin/seo")
    if global_seo.get("google_verification"):
        add("pass", "low", "google_verification", "Google Search Console verified", fix_link="/admin/seo")
    else:
        add("warn", "low", "google_verification", "Google Search Console not verified", fix_link="/admin/seo")

    # Per-page checks
    title_values: list[str] = []
    description_values: list[str] = []
    for p in pages:
        meta = _resolve_meta(p, global_seo, storefront)
        key = p["page_key"]
        t = (meta.get("title") or "").strip()
        d = (meta.get("description") or "").strip()
        title_values.append(t.lower())
        description_values.append(d.lower())

        if not t:
            add("fail", "high", f"title_missing:{key}", f"Missing title — {PAGE_LABELS.get(key, key)}",
                detail="Every indexed page should have a unique <title>.", fix_link="/admin/seo")
        elif len(t) > 65:
            add("warn", "medium", f"title_long:{key}", f"Title too long — {PAGE_LABELS.get(key, key)} ({len(t)} chars)",
                detail="Google typically truncates titles after ~60 chars.", fix_link="/admin/seo")
        elif len(t) < 20:
            add("warn", "low", f"title_short:{key}", f"Title feels short — {PAGE_LABELS.get(key, key)} ({len(t)} chars)",
                detail="Aim for 30–60 characters with at least one branded keyword.", fix_link="/admin/seo")

        if not d:
            add("fail", "medium", f"description_missing:{key}", f"Missing description — {PAGE_LABELS.get(key, key)}",
                detail="Meta descriptions drive CTR from search results.", fix_link="/admin/seo")
        elif len(d) > 170:
            add("warn", "medium", f"description_long:{key}", f"Description too long — {PAGE_LABELS.get(key, key)} ({len(d)} chars)",
                detail="Google truncates at ~160 chars on desktop.", fix_link="/admin/seo")
        elif len(d) < 70:
            add("warn", "low", f"description_short:{key}", f"Description feels short — {PAGE_LABELS.get(key, key)} ({len(d)} chars)",
                detail="Aim for 120–160 characters.", fix_link="/admin/seo")

        if not meta.get("og_image_url") and key in SITEMAP_INCLUDED:
            add("warn", "medium", f"og_image_missing:{key}", f"No Open Graph image — {PAGE_LABELS.get(key, key)}",
                detail="Upload an OG image or set a default so previews render.", fix_link="/admin/seo")

        if p.get("noindex") and key in SITEMAP_INCLUDED:
            add("warn", "high", f"noindex_public:{key}", f"Public page is set to noindex — {PAGE_LABELS.get(key, key)}",
                detail="This page would normally appear in search, but it's being hidden.", fix_link="/admin/seo")

    # Duplicates
    t_counter = Counter(t for t in title_values if t)
    for t, n in t_counter.items():
        if n > 1:
            add("warn", "medium", f"title_dup:{t[:20]}", "Duplicate page title detected",
                detail=f'"{t[:80]}" is used across {n} pages.', fix_link="/admin/seo")
    d_counter = Counter(d for d in description_values if d)
    for d, n in d_counter.items():
        if n > 1:
            add("warn", "low", f"desc_dup:{d[:20]}", "Duplicate meta description detected",
                detail=f"Reused across {n} pages.", fix_link="/admin/seo")

    # Redirect loops
    redirects = await db.seo_redirects.find({}, {"_id": 0}).to_list(500)
    froms = {r["from_path"]: r["to_path"] for r in redirects}
    for r in redirects:
        if r["to_path"] in froms:
            add("fail", "medium", f"redirect_chain:{r['id']}", f"Redirect chain detected at {r['from_path']}",
                detail=f"{r['from_path']} → {r['to_path']} → {froms[r['to_path']]}", fix_link="/admin/seo")
        if r["to_path"] == r["from_path"]:
            add("fail", "high", f"redirect_loop:{r['id']}", "Redirect points to itself", fix_link="/admin/seo")

    # Sitemap reachable
    site_url = global_seo.get("site_url")
    if site_url:
        add("pass", "low", "sitemap", "Sitemap endpoint available",
            detail=f"{site_url.rstrip('/')}/api/seo/sitemap.xml", fix_link="/admin/seo")
    else:
        add("warn", "low", "sitemap", "Configure site_url so sitemap links resolve externally",
            fix_link="/admin/seo")

    summary = {
        "pass": sum(1 for c in checks if c["status"] == "pass"),
        "warn": sum(1 for c in checks if c["status"] == "warn"),
        "fail": sum(1 for c in checks if c["status"] == "fail"),
    }
    score = 100
    score -= summary["fail"] * 10
    score -= summary["warn"] * 3
    score = max(0, min(100, score))
    return {
        "score": score,
        "summary": summary,
        "checks": checks,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
