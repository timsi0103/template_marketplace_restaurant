"""Menu items + categories + modifier groups (public GETs & admin CRUD)."""
from fastapi import HTTPException, Request
from datetime import datetime, timezone
from typing import Optional
import uuid

from core import api_router, db, require_admin
from models import (
    MenuItemCreate, MenuItemUpdate,
    CategoryCreate, CategoryUpdate, ReorderRequest,
    ModifierGroupCreate, ModifierGroupUpdate,
)


# ─── Menu items ──────────────────────────────────────────

@api_router.get("/menu/items")
async def get_menu_items(category: Optional[str] = None, subcategory: Optional[str] = None):
    query = {}
    if category and category != "all":
        query["category"] = category
    if subcategory and subcategory != "all":
        query["subcategory"] = subcategory
    items = await db.menu_items.find(query, {"_id": 0}).to_list(200)
    return {"items": items, "count": len(items)}


@api_router.get("/menu/items/{item_id}")
async def get_menu_item(item_id: str):
    item = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@api_router.get("/menu/categories")
async def get_categories():
    categories = await db.menu_items.distinct("category")
    return {"categories": categories}


# ─── Categories ──────────────────────────────────────────

@api_router.get("/categories/tree")
async def get_category_tree():
    cats = await db.categories.find({}, {"_id": 0}).sort("display_order", 1).to_list(200)
    top_level = [c for c in cats if not c.get("parent_id")]
    for cat in top_level:
        cat["subcategories"] = sorted(
            [c for c in cats if c.get("parent_id") == cat["id"]],
            key=lambda x: x.get("display_order", 0),
        )
    return {"categories": top_level}


@api_router.get("/categories")
async def get_all_categories():
    cats = await db.categories.find({}, {"_id": 0}).sort("display_order", 1).to_list(200)
    return {"categories": cats}


@api_router.get("/categories/{slug}")
async def get_category_by_slug(slug: str):
    cat = await db.categories.find_one({"slug": slug}, {"_id": 0})
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    subcats = await db.categories.find({"parent_id": cat["id"]}, {"_id": 0}).sort("display_order", 1).to_list(50)
    cat["subcategories"] = subcats
    return cat


@api_router.post("/admin/categories")
async def create_category(body: CategoryCreate, request: Request):
    await require_admin(request)
    cat_id = f"cat_{uuid.uuid4().hex[:8]}"
    slug = body.slug or body.name.lower().replace(" ", "-").replace("&", "and")
    existing_slug = await db.categories.find_one({"slug": slug}, {"_id": 0})
    if existing_slug:
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"
    max_order = await db.categories.find_one({"parent_id": body.parent_id}, {"_id": 0}, sort=[("display_order", -1)])
    display_order = (max_order.get("display_order", 0) + 1) if max_order else 0
    doc = {
        "id": cat_id, "name": body.name, "slug": slug, "description": body.description,
        "image": body.image, "parent_id": body.parent_id, "display_order": display_order,
        "visible": body.visible, "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.categories.insert_one(doc)
    return await db.categories.find_one({"id": cat_id}, {"_id": 0})


@api_router.put("/admin/categories/{cat_id}")
async def update_category(cat_id: str, body: CategoryUpdate, request: Request):
    await require_admin(request)
    existing = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Category not found")
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if updates:
        await db.categories.update_one({"id": cat_id}, {"$set": updates})
    return await db.categories.find_one({"id": cat_id}, {"_id": 0})


@api_router.delete("/admin/categories/{cat_id}")
async def delete_category(cat_id: str, request: Request):
    await require_admin(request)
    await db.categories.delete_many({"parent_id": cat_id})
    result = await db.categories.delete_one({"id": cat_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted"}


@api_router.patch("/admin/categories/{cat_id}/toggle")
async def toggle_category_visibility(cat_id: str, request: Request):
    await require_admin(request)
    cat = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.categories.update_one({"id": cat_id}, {"$set": {"visible": not cat.get("visible", True)}})
    return await db.categories.find_one({"id": cat_id}, {"_id": 0})


@api_router.post("/admin/categories/reorder")
async def reorder_categories(body: ReorderRequest, request: Request):
    await require_admin(request)
    for item in body.items:
        await db.categories.update_one({"id": item.id}, {"$set": {"display_order": item.display_order}})
    return {"message": "Reorder successful"}


# ─── Admin menu items ────────────────────────────────────

@api_router.post("/admin/menu/items")
async def create_menu_item(body: MenuItemCreate, request: Request):
    await require_admin(request)
    item_id = str(uuid.uuid4())[:8]
    images = body.images if body.images else ([body.image] if body.image else [])
    variants = []
    for v in body.variants:
        variants.append({"id": v.id or f"var_{uuid.uuid4().hex[:6]}", "name": v.name, "price": v.price, "stock": v.stock, "status": v.status, "image": v.image})
    doc = {
        "id": item_id,
        "name": body.name, "description": body.description, "price": body.price,
        "category": body.category,
        "image": images[0] if images else "",
        "images": images, "tags": body.tags, "status": body.status,
        "available": body.status == "in_stock",
        "variants": variants,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.menu_items.insert_one(doc)
    return await db.menu_items.find_one({"id": item_id}, {"_id": 0})


@api_router.put("/admin/menu/items/{item_id}")
async def update_menu_item(item_id: str, body: MenuItemUpdate, request: Request):
    await require_admin(request)
    existing = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Item not found")
    updates = {}
    for field, value in body.model_dump(exclude_none=True).items():
        if field == "variants" and value is not None:
            updates["variants"] = [{"id": v.get("id") or f"var_{uuid.uuid4().hex[:6]}", "name": v["name"], "price": v["price"], "stock": v.get("stock", -1), "status": v.get("status", "in_stock"), "image": v.get("image", "")} for v in value]
        else:
            updates[field] = value
    if "status" in updates:
        updates["available"] = updates["status"] == "in_stock"
    if "images" in updates and updates["images"]:
        updates["image"] = updates["images"][0]
    if updates:
        await db.menu_items.update_one({"id": item_id}, {"$set": updates})
    return await db.menu_items.find_one({"id": item_id}, {"_id": 0})


@api_router.delete("/admin/menu/items/{item_id}")
async def delete_menu_item(item_id: str, request: Request):
    await require_admin(request)
    result = await db.menu_items.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted"}


@api_router.patch("/admin/menu/items/{item_id}/toggle")
async def toggle_item_availability(item_id: str, request: Request):
    await require_admin(request)
    item = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    new_status = "sold_out" if item.get("status") == "in_stock" else "in_stock"
    await db.menu_items.update_one({"id": item_id}, {"$set": {"status": new_status, "available": new_status == "in_stock"}})
    return await db.menu_items.find_one({"id": item_id}, {"_id": 0})


# ─── Modifier Groups ─────────────────────────────────────

@api_router.get("/modifiers")
async def get_all_modifier_groups():
    groups = await db.modifier_groups.find({}, {"_id": 0}).to_list(200)
    return {"groups": groups, "count": len(groups)}


@api_router.get("/menu/items/{item_id}/modifiers")
async def get_item_modifiers(item_id: str):
    groups = await db.modifier_groups.find({"linked_item_ids": item_id}, {"_id": 0}).to_list(50)
    return {"groups": groups}


@api_router.post("/admin/modifiers")
async def create_modifier_group(body: ModifierGroupCreate, request: Request):
    await require_admin(request)
    group_id = f"mod_{uuid.uuid4().hex[:8]}"
    options = []
    for opt in body.options:
        options.append({"id": opt.id or f"opt_{uuid.uuid4().hex[:6]}", "name": opt.name, "price_adjustment": opt.price_adjustment})
    doc = {
        "id": group_id, "name": body.name, "type": body.type,
        "min_selections": body.min_selections, "max_selections": body.max_selections,
        "options": options, "linked_item_ids": body.linked_item_ids,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.modifier_groups.insert_one(doc)
    return await db.modifier_groups.find_one({"id": group_id}, {"_id": 0})


@api_router.put("/admin/modifiers/{group_id}")
async def update_modifier_group(group_id: str, body: ModifierGroupUpdate, request: Request):
    await require_admin(request)
    existing = await db.modifier_groups.find_one({"id": group_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Modifier group not found")
    updates = {}
    for field, value in body.model_dump(exclude_none=True).items():
        if field == "options" and value is not None:
            updates["options"] = [{"id": o.get("id") or f"opt_{uuid.uuid4().hex[:6]}", "name": o["name"], "price_adjustment": o.get("price_adjustment", 0)} for o in value]
        else:
            updates[field] = value
    if updates:
        await db.modifier_groups.update_one({"id": group_id}, {"$set": updates})
    return await db.modifier_groups.find_one({"id": group_id}, {"_id": 0})


@api_router.delete("/admin/modifiers/{group_id}")
async def delete_modifier_group(group_id: str, request: Request):
    await require_admin(request)
    result = await db.modifier_groups.delete_one({"id": group_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Modifier group not found")
    return {"message": "Modifier group deleted"}
