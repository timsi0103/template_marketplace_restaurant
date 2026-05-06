"""Startup seeding: admin user, menu items, categories, modifiers, store hours, promo codes,
subcategory backfill, and writing /app/memory/test_credentials.md."""
from datetime import datetime, timezone
from pathlib import Path
import os
import uuid

from core import db, logger, hash_password, verify_password
from routes.store import DAYS
from routes.orders import SEED_COUPONS


SEED_ITEMS = [
    {"id": "item-001", "name": "Heritage Duck Breast", "description": "Pan-seared to a perfect medium-rare, accompanied by a tart Montmorency cherry reduction, roasted parsnips, and a silken potato puree. A timeless preparation elevated with seasonal ingredients.", "price": 42.00, "category": "mains", "image": "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&h=400&fit=crop", "images": ["https://images.unsplash.com/photo-1544025162-d76694265947?w=600&h=400&fit=crop", "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=400&fit=crop", "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&h=400&fit=crop"], "tags": ["CHEF'S SELECTION"], "status": "in_stock", "available": True, "variants": [{"id": "var-duck-250", "name": "250g", "price": 42.00, "stock": 15, "status": "in_stock", "image": ""}, {"id": "var-duck-500", "name": "500g", "price": 72.00, "stock": 8, "status": "in_stock", "image": ""}, {"id": "var-duck-1kg", "name": "1kg", "price": 130.00, "stock": 0, "status": "sold_out", "image": ""}]},
    {"id": "item-002", "name": "Heirloom Burrata", "description": "Hand-pulled artisan burrata from a local creamery, served with blistered vine tomatoes, fresh basil pesto, a drizzle of 12-year aged balsamic, and crispy sourdough crostini.", "price": 24.00, "category": "starters", "image": "https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=600&h=400&fit=crop", "images": ["https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=600&h=400&fit=crop", "https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=600&h=400&fit=crop"], "tags": [], "status": "in_stock", "available": True},
    {"id": "item-003", "name": "Earth Harvest Bowl", "description": "Tri-color quinoa, fire-roasted root vegetables, Hass avocado, pickled radish, and a toasted sesame tahini dressing. A nourishing and vibrant celebration of the season's harvest.", "price": 18.00, "category": "mains", "image": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&h=400&fit=crop", "images": ["https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&h=400&fit=crop"], "tags": ["SEASONAL"], "status": "seasonal", "available": True},
    {"id": "item-004", "name": "Artisan Diavola", "description": "72-hour fermented sourdough crust, San Marzano tomato base, spicy Calabrian 'nduja salami, local hot honey, fresh mozzarella di bufala, and torn basil.", "price": 26.00, "category": "mains", "image": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=400&fit=crop", "images": ["https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=400&fit=crop", "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&h=400&fit=crop"], "tags": ["WOOD-FIRED"], "status": "in_stock", "available": True},
    {"id": "item-005", "name": "Hazelnut Ganache Tart", "description": "Dark chocolate ganache with roasted Piedmont hazelnuts, Maldon sea salt flakes, a delicate brown butter shortcrust, and a quenelle of crème fraîche.", "price": 14.00, "category": "desserts", "image": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&h=400&fit=crop", "images": ["https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&h=400&fit=crop"], "tags": [], "status": "in_stock", "available": True, "variants": [{"id": "var-tart-single", "name": "Single", "price": 14.00, "stock": 20, "status": "in_stock", "image": ""}, {"id": "var-tart-6pack", "name": "6-Pack", "price": 72.00, "stock": 5, "status": "in_stock", "image": ""}, {"id": "var-tart-12pack", "name": "12-Pack", "price": 132.00, "stock": 2, "status": "in_stock", "image": ""}, {"id": "var-tart-case", "name": "Case (24)", "price": 240.00, "stock": 0, "status": "sold_out", "image": ""}]},
    {"id": "item-006", "name": "Truffle Infused Tagliatelle", "description": "Fresh hand-cut egg pasta with black truffle shavings from Alba, aged Parmigiano Reggiano, brown butter, and a whisper of nutmeg. Simple, luxurious, unforgettable.", "price": 34.00, "category": "mains", "image": "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=600&h=400&fit=crop", "images": ["https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=600&h=400&fit=crop", "https://images.unsplash.com/photo-1473093226795-af9932fe5856?w=600&h=400&fit=crop", "https://images.unsplash.com/photo-1556761223-4c4282c73f77?w=600&h=400&fit=crop"], "tags": ["CHEF'S SIGNATURE"], "status": "in_stock", "available": True, "variants": [{"id": "var-tag-reg", "name": "Regular (200g)", "price": 34.00, "stock": -1, "status": "in_stock", "image": ""}, {"id": "var-tag-large", "name": "Large (350g)", "price": 48.00, "stock": 6, "status": "in_stock", "image": ""}]},
    {"id": "item-007", "name": "Spiced Lamb Kofta", "description": "Charcoal-grilled lamb kofta with smoky harissa, labneh, pickled turnip, pomegranate molasses, and warm pita bread. A celebration of Middle Eastern flavors.", "price": 28.00, "category": "starters", "image": "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=600&h=400&fit=crop", "images": ["https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=600&h=400&fit=crop"], "tags": [], "status": "sold_out", "available": False},
    {"id": "item-008", "name": "Elderflower Spritz", "description": "House-made elderflower cordial, Prosecco, a splash of sparkling water, and fresh mint. Light, floral, and utterly refreshing.", "price": 16.00, "category": "drinks", "image": "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600&h=400&fit=crop", "images": ["https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600&h=400&fit=crop"], "tags": [], "status": "in_stock", "available": True},
    {"id": "item-009", "name": "Matcha Mille Crepe", "description": "Twenty delicate crepes layered with ceremonial-grade matcha cream, a light dusting of powdered sugar, and edible gold leaf. An architectural dessert.", "price": 14.00, "category": "desserts", "image": "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600&h=400&fit=crop", "images": ["https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600&h=400&fit=crop"], "tags": ["LIMITED DAILY"], "status": "in_stock", "available": True},
    {"id": "item-010", "name": "Reserve Cold Brew", "description": "Single-origin Ethiopian Yirgacheffe, cold-brewed for 18 hours, served over hand-cut ice with a twist of orange zest. Bold, smooth, and deeply aromatic.", "price": 8.00, "category": "drinks", "image": "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&h=400&fit=crop", "images": ["https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&h=400&fit=crop"], "tags": [], "status": "in_stock", "available": True, "variants": [{"id": "var-brew-sm", "name": "Small (250ml)", "price": 8.00, "stock": -1, "status": "in_stock", "image": ""}, {"id": "var-brew-md", "name": "Medium (500ml)", "price": 12.00, "stock": -1, "status": "in_stock", "image": ""}, {"id": "var-brew-lg", "name": "Large (750ml)", "price": 16.00, "stock": 3, "status": "in_stock", "image": ""}]},
]


async def run_startup_seed():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token")
    await db.login_attempts.create_index("identifier")
    await db.password_reset_tokens.create_index("token")
    await db.menu_items.create_index("id", unique=True)
    await db.menu_items.create_index("category")
    await db.categories.create_index("id", unique=True)
    await db.categories.create_index("slug", unique=True)
    await db.categories.create_index("parent_id")
    await db.modifier_groups.create_index("id", unique=True)
    await db.modifier_groups.create_index("linked_item_ids")
    await db.store_holidays.create_index("id")
    await db.store_holidays.create_index("date")

    # Admin seed
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email}, {"_id": 0})
    if existing is None:
        admin_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({"user_id": admin_id, "email": admin_email, "name": "Chef Administrator", "password_hash": hash_password(admin_password), "role": "admin", "picture": "", "auth_provider": "email", "created_at": datetime.now(timezone.utc).isoformat()})
        logger.info(f"Admin seeded: {admin_email}")
    elif not verify_password(admin_password, existing.get("password_hash", "")):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

    # Demo customer seed — powers the one-tap demo login on /login
    demo_email = "demo@culinaryeditorial.com"
    demo_password = "Demo123!"
    demo_existing = await db.users.find_one({"email": demo_email}, {"_id": 0})
    if demo_existing is None:
        await db.users.insert_one({
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": demo_email,
            "name": "Ishika M.",
            "password_hash": hash_password(demo_password),
            "role": "customer",
            "picture": "",
            "auth_provider": "email",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Demo customer seeded: {demo_email}")
    elif not verify_password(demo_password, demo_existing.get("password_hash", "")):
        await db.users.update_one({"email": demo_email}, {"$set": {"password_hash": hash_password(demo_password)}})

    # Menu items
    if await db.menu_items.count_documents({}) == 0:
        for item in SEED_ITEMS:
            item["created_at"] = datetime.now(timezone.utc).isoformat()
            try:
                await db.menu_items.insert_one(item)
            except Exception:
                pass
        logger.info(f"Seeded {len(SEED_ITEMS)} menu items")

    # Categories
    if await db.categories.count_documents({}) == 0:
        seed_cats = [
            {"id": "cat-starters", "name": "Starters", "slug": "starters", "description": "Begin your journey with our carefully curated selection of appetizers and small plates.", "image": "https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=800&h=400&fit=crop", "parent_id": None, "display_order": 0, "visible": True},
            {"id": "cat-mains", "name": "Mains", "slug": "mains", "description": "The heart of our collection. Signature entrees crafted with the finest seasonal ingredients.", "image": "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&h=400&fit=crop", "parent_id": None, "display_order": 1, "visible": True},
            {"id": "cat-drinks", "name": "Drinks", "slug": "drinks", "description": "Artisanal beverages and curated libations to complement every course.", "image": "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=800&h=400&fit=crop", "parent_id": None, "display_order": 2, "visible": True},
            {"id": "cat-desserts", "name": "Desserts", "slug": "desserts", "description": "The sweet finale. Indulgent creations from our patisserie.", "image": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&h=400&fit=crop", "parent_id": None, "display_order": 3, "visible": True},
            {"id": "sub-soups", "name": "Soups", "slug": "soups", "description": "Seasonal soups and broths.", "image": "", "parent_id": "cat-starters", "display_order": 0, "visible": True},
            {"id": "sub-salads", "name": "Salads", "slug": "salads", "description": "Fresh garden salads.", "image": "", "parent_id": "cat-starters", "display_order": 1, "visible": True},
            {"id": "sub-small-plates", "name": "Small Plates", "slug": "small-plates", "description": "Shareable small plates.", "image": "", "parent_id": "cat-starters", "display_order": 2, "visible": True},
            {"id": "sub-meat", "name": "Meat", "slug": "meat", "description": "Premium cuts and preparations.", "image": "", "parent_id": "cat-mains", "display_order": 0, "visible": True},
            {"id": "sub-seafood", "name": "Seafood", "slug": "seafood", "description": "Fresh catch and ocean fare.", "image": "", "parent_id": "cat-mains", "display_order": 1, "visible": True},
            {"id": "sub-vegetarian", "name": "Vegetarian", "slug": "vegetarian", "description": "Plant-forward dishes.", "image": "", "parent_id": "cat-mains", "display_order": 2, "visible": True},
            {"id": "sub-red-wine", "name": "Red Wine", "slug": "red-wine", "description": "Full-bodied reds.", "image": "", "parent_id": "cat-drinks", "display_order": 0, "visible": True},
            {"id": "sub-white-wine", "name": "White Wine", "slug": "white-wine", "description": "Crisp whites.", "image": "", "parent_id": "cat-drinks", "display_order": 1, "visible": True},
            {"id": "sub-sparkling", "name": "Sparkling", "slug": "sparkling", "description": "Champagne and prosecco.", "image": "", "parent_id": "cat-drinks", "display_order": 2, "visible": True},
            {"id": "sub-non-alcoholic", "name": "Non-Alcoholic", "slug": "non-alcoholic", "description": "Refreshing beverages.", "image": "", "parent_id": "cat-drinks", "display_order": 3, "visible": True},
            {"id": "sub-pastries", "name": "Pastries", "slug": "pastries", "description": "Freshly baked pastries.", "image": "", "parent_id": "cat-desserts", "display_order": 0, "visible": True},
            {"id": "sub-chocolate", "name": "Chocolate", "slug": "chocolate", "description": "Chocolate indulgences.", "image": "", "parent_id": "cat-desserts", "display_order": 1, "visible": True},
        ]
        for cat in seed_cats:
            cat["created_at"] = datetime.now(timezone.utc).isoformat()
            try:
                await db.categories.insert_one(cat)
            except Exception:
                pass
        logger.info(f"Seeded {len(seed_cats)} categories")

    # Modifiers
    if await db.modifier_groups.count_documents({}) == 0:
        all_item_ids = [i["id"] for i in SEED_ITEMS]
        drink_ids = [i["id"] for i in SEED_ITEMS if i["category"] == "drinks"]
        main_ids = [i["id"] for i in SEED_ITEMS if i["category"] == "mains"]
        seed_mods = [
            {"id": "mod-size", "name": "Size", "type": "required", "min_selections": 1, "max_selections": 1, "options": [{"id": "opt-sm", "name": "Small", "price_adjustment": 0}, {"id": "opt-md", "name": "Medium", "price_adjustment": 3}, {"id": "opt-lg", "name": "Large", "price_adjustment": 6}], "linked_item_ids": all_item_ids},
            {"id": "mod-extras", "name": "Add-Ons", "type": "optional", "min_selections": 0, "max_selections": 5, "options": [{"id": "opt-cheese", "name": "Extra Cheese", "price_adjustment": 1.5}, {"id": "opt-shot", "name": "Extra Shot", "price_adjustment": 0.75}, {"id": "opt-truffle", "name": "Truffle Oil Drizzle", "price_adjustment": 3}, {"id": "opt-avocado", "name": "Avocado", "price_adjustment": 2.5}], "linked_item_ids": all_item_ids},
            {"id": "mod-temp", "name": "Temperature", "type": "required", "min_selections": 1, "max_selections": 1, "options": [{"id": "opt-hot", "name": "Hot", "price_adjustment": 0}, {"id": "opt-iced", "name": "Iced", "price_adjustment": 0.5}], "linked_item_ids": drink_ids},
            {"id": "mod-protein", "name": "Protein Choice", "type": "optional", "min_selections": 0, "max_selections": 1, "options": [{"id": "opt-chicken", "name": "Grilled Chicken", "price_adjustment": 4}, {"id": "opt-salmon", "name": "Pan-Seared Salmon", "price_adjustment": 6}, {"id": "opt-tofu", "name": "Crispy Tofu", "price_adjustment": 3}], "linked_item_ids": main_ids},
        ]
        for mod in seed_mods:
            mod["created_at"] = datetime.now(timezone.utc).isoformat()
            try:
                await db.modifier_groups.insert_one(mod)
            except Exception:
                pass
        logger.info(f"Seeded {len(seed_mods)} modifier groups")

    # Store hours
    if not await db.store_settings.find_one({"type": "hours"}):
        default_svc = {"open_time": "10:00", "close_time": "22:00", "closed": False}
        default_hours = {d: {"delivery": {**default_svc}, "pickup": {**default_svc}, "dine_in": {**default_svc}} for d in DAYS}
        for svc in ("delivery", "pickup", "dine_in"):
            default_hours["sunday"][svc]["open_time"] = "11:00"
        await db.store_settings.insert_one({"type": "hours", "hours": default_hours, "pause_ordering": False, "created_at": datetime.now(timezone.utc).isoformat()})
        logger.info("Seeded default store hours")

    # Promo codes
    existing_codes = {d["code"] async for d in db.promo_codes.find({}, {"_id": 0, "code": 1})}
    for seed in SEED_COUPONS:
        if seed["code"] not in existing_codes:
            await db.promo_codes.insert_one({
                "id": str(uuid.uuid4()), **seed,
                "usage_count": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
    logger.info(f"Promo codes seeded (total in DB after seed: {await db.promo_codes.count_documents({})})")

    # Subcategory + dietary backfill — explicit, idempotent, repairs incorrect prior data
    # Each seed item gets its semantically-correct subcategory and dietary tags so vegetarian
    # filters don't show meat/seafood and vice-versa.
    SEED_TAXONOMY = {
        "item-001": {"subcategory": "meat",         "dietary_tags": ["halal"]},
        "item-002": {"subcategory": "small-plates", "dietary_tags": ["vegetarian", "nut_free"]},
        "item-003": {"subcategory": "vegetarian",   "dietary_tags": ["vegan", "vegetarian", "gluten_free", "dairy_free", "nut_free"]},
        "item-004": {"subcategory": "meat",         "dietary_tags": ["spicy"]},                # 'nduja salami → not vegetarian
        "item-005": {"subcategory": "pastries",     "dietary_tags": ["vegetarian"]},
        "item-006": {"subcategory": "vegetarian",   "dietary_tags": ["vegetarian"]},
        "item-007": {"subcategory": "small-plates", "dietary_tags": ["halal", "spicy", "dairy_free"]},
        "item-008": {"subcategory": "sparkling",    "dietary_tags": ["vegan", "gluten_free", "dairy_free", "nut_free"]},
        "item-009": {"subcategory": "pastries",     "dietary_tags": ["vegetarian"]},
        "item-010": {"subcategory": "non-alcoholic","dietary_tags": ["vegan", "gluten_free", "dairy_free", "nut_free"]},
    }
    for iid, fix in SEED_TAXONOMY.items():
        await db.menu_items.update_one(
            {"id": iid},
            {"$set": {"subcategory": fix["subcategory"], "dietary_tags": fix["dietary_tags"]}},
        )
    logger.info("Reconciled subcategory + dietary tags for seed items")

    # Test credentials file
    creds_dir = Path("/app/memory")
    creds_dir.mkdir(exist_ok=True)
    with open(creds_dir / "test_credentials.md", "w") as f:
        f.write("# Test Credentials\n\n## Admin\n")
        f.write(f"- Email: {admin_email}\n- Password: {admin_password}\n- Role: admin\n\n")
        f.write("## Auth Endpoints\n- POST /api/auth/register\n- POST /api/auth/login\n- POST /api/auth/logout\n- GET /api/auth/me\n")
        f.write("## Menu Endpoints\n- GET /api/menu/items\n- GET /api/menu/items/:id\n- POST /api/admin/menu/items (admin)\n- PUT /api/admin/menu/items/:id (admin)\n- DELETE /api/admin/menu/items/:id (admin)\n- PATCH /api/admin/menu/items/:id/toggle (admin)\n")

    # Seed review data (idempotent: only if empty)
    if await db.reviews.count_documents({}) == 0:
        await db.reviews.create_index("item_id")
        await db.reviews.create_index("order_id")
        now = datetime.now(timezone.utc)
        from datetime import timedelta as _td
        demo_reviews = [
            ("item-001", 5, "Extraordinary — the cherry reduction paired beautifully with the duck. Will be back.", "Martine L.", 2, 4),
            ("item-001", 4, "Perfectly cooked, though the parsnip could have used more seasoning.", "Jerome T.", 7, 2),
            ("item-002", 5, "Best burrata in the city. Creamy, fresh, and the balsamic was a revelation.", "Celine R.", 1, 6),
            ("item-002", 5, "I'd come back just for this.", "Anonymous", 3, 3),
            ("item-004", 5, "Worth every penny. The crust is unreal.", "Dominic V.", 0, 8),
            ("item-004", 2, "Crust was burnt on the edges, sauce overly salty. Disappointed for the price.", "Avery K.", 5, 1),
            ("item-006", 5, "Truffle tagliatelle dreams. A once-a-season splurge.", "Liu W.", 4, 5),
            ("item-006", 3, "Good flavor but the portion was smaller than expected.", "Noah P.", 6, 0),
            ("item-009", 5, "Gorgeous presentation, melts in the mouth.", "Anonymous", 1, 2),
        ]
        docs = []
        for item_id, rating, text, name, days_ago, helpful in demo_reviews:
            when = (now - _td(days=days_ago)).isoformat()
            docs.append({
                "id": f"rev_{uuid.uuid4().hex[:10]}",
                "order_id": f"seed_{uuid.uuid4().hex[:8]}",
                "order_number": f"ORD-SEED-{uuid.uuid4().hex[:4].upper()}",
                "item_id": item_id,
                "item_name": next((x["name"] for x in SEED_ITEMS if x["id"] == item_id), None),
                "rating": rating,
                "text": text,
                "photos": [],
                "anonymous": name == "Anonymous",
                "verified_purchase": True,
                "user_id": None,
                "user_name": name,
                "user_email": None,
                "status": "approved",
                "admin_response": None,
                "helpful_count": helpful,
                "created_at": when,
                "updated_at": when,
                "is_overall": False,
            })
        # One with admin response as demo
        docs[5]["admin_response"] = {
            "text": "We're sorry to hear this Avery — we've shared your feedback with the kitchen and would love to have you back on the house next time. Please reach out to us.",
            "responded_by": "Chef Administrator",
            "responded_at": now.isoformat(),
        }
        await db.reviews.insert_many(docs)
        # Aggregate per item
        item_ids = {d["item_id"] for d in docs}
        for iid in item_ids:
            pipeline = [
                {"$match": {"item_id": iid, "status": "approved"}},
                {"$group": {"_id": None, "count": {"$sum": 1}, "avg": {"$avg": "$rating"},
                            "r1": {"$sum": {"$cond": [{"$eq": ["$rating", 1]}, 1, 0]}},
                            "r2": {"$sum": {"$cond": [{"$eq": ["$rating", 2]}, 1, 0]}},
                            "r3": {"$sum": {"$cond": [{"$eq": ["$rating", 3]}, 1, 0]}},
                            "r4": {"$sum": {"$cond": [{"$eq": ["$rating", 4]}, 1, 0]}},
                            "r5": {"$sum": {"$cond": [{"$eq": ["$rating", 5]}, 1, 0]}}}},
            ]
            agg = await db.reviews.aggregate(pipeline).to_list(1)
            if agg:
                r = agg[0]
                await db.menu_items.update_one({"id": iid}, {"$set": {
                    "rating_avg": round(float(r["avg"] or 0), 2),
                    "rating_count": int(r["count"]),
                    "rating_distribution": {str(i): r[f"r{i}"] for i in range(1, 6)},
                }})
        logger.info(f"Seeded {len(docs)} demo reviews")
