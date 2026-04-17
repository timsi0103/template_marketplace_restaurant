from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import secrets
import bcrypt
import jwt
import httpx
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

app = FastAPI(title="The Culinary Editorial API")
api_router = APIRouter(prefix="/api")

# ─── Password Utilities ───────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

# ─── JWT Utilities ────────────────────────────────────────

def create_access_token(user_id: str, email: str) -> str:
    return jwt.encode({"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=15), "type": "access"}, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    return jwt.encode({"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")

# ─── Auth Helpers ─────────────────────────────────────────

async def get_current_user(request: Request) -> dict:
    session_token = request.cookies.get("session_token")
    if session_token:
        session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if session:
            expires_at = session.get("expires_at")
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at and expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at and expires_at > datetime.now(timezone.utc):
                user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
                if user:
                    user.pop("password_hash", None)
                    return user
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ─── Brute Force Protection ──────────────────────────────

async def check_brute_force(identifier: str):
    attempt = await db.login_attempts.find_one({"identifier": identifier}, {"_id": 0})
    if attempt and attempt.get("count", 0) >= 5:
        locked_until = attempt.get("locked_until")
        if isinstance(locked_until, str):
            locked_until = datetime.fromisoformat(locked_until)
        if locked_until and locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        if locked_until and locked_until > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")
        else:
            await db.login_attempts.delete_one({"identifier": identifier})

async def record_failed_attempt(identifier: str):
    attempt = await db.login_attempts.find_one({"identifier": identifier}, {"_id": 0})
    if attempt:
        new_count = attempt.get("count", 0) + 1
        update = {"$set": {"count": new_count}}
        if new_count >= 5:
            update["$set"]["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        await db.login_attempts.update_one({"identifier": identifier}, update)
    else:
        await db.login_attempts.insert_one({"identifier": identifier, "count": 1})

async def clear_failed_attempts(identifier: str):
    await db.login_attempts.delete_one({"identifier": identifier})

# ─── Models ───────────────────────────────────────────────

class UserRegister(BaseModel):
    email: str
    password: str
    name: str = ""

class UserLogin(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class GoogleCallbackRequest(BaseModel):
    session_id: str

class MenuItemCreate(BaseModel):
    name: str
    description: str = ""
    price: float
    category: str = "mains"
    image: str = ""
    images: List[str] = []
    tags: List[str] = []
    status: str = "in_stock"

class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    image: Optional[str] = None
    images: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    status: Optional[str] = None

class CategoryCreate(BaseModel):
    name: str
    slug: str = ""
    description: str = ""
    image: str = ""
    parent_id: Optional[str] = None
    visible: bool = True

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    image: Optional[str] = None
    parent_id: Optional[str] = None
    visible: Optional[bool] = None
    display_order: Optional[int] = None

class ReorderItem(BaseModel):
    id: str
    display_order: int

class ReorderRequest(BaseModel):
    items: List[ReorderItem]

# ─── Auth Endpoints ───────────────────────────────────────

@api_router.post("/auth/register")
async def register(body: UserRegister, response: Response):
    email = body.email.strip().lower()
    if not email or not body.password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {"user_id": user_id, "email": email, "name": body.name or email.split("@")[0], "password_hash": hash_password(body.password), "role": "customer", "picture": "", "auth_provider": "email", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one(user_doc)
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    set_auth_cookies(response, access_token, refresh_token)
    return {"user_id": user_id, "email": email, "name": user_doc["name"], "role": "customer", "picture": "", "auth_provider": "email"}

@api_router.post("/auth/login")
async def login(body: UserLogin, request: Request, response: Response):
    email = body.email.strip().lower()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    await check_brute_force(identifier)
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not user.get("password_hash"):
        await record_failed_attempt(identifier)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(body.password, user["password_hash"]):
        await record_failed_attempt(identifier)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await clear_failed_attempts(identifier)
    access_token = create_access_token(user["user_id"], email)
    refresh_token = create_refresh_token(user["user_id"])
    set_auth_cookies(response, access_token, refresh_token)
    return {"user_id": user["user_id"], "email": user["email"], "name": user.get("name", ""), "role": user.get("role", "customer"), "picture": user.get("picture", ""), "auth_provider": user.get("auth_provider", "email")}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out successfully"}

@api_router.get("/auth/me")
async def get_me(request: Request):
    return await get_current_user(request)

@api_router.post("/auth/refresh")
async def refresh_token_endpoint(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        access_token = create_access_token(user["user_id"], user["email"])
        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", max_age=900, path="/")
        return {"message": "Token refreshed"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

@api_router.post("/auth/forgot-password")
async def forgot_password(body: ForgotPasswordRequest):
    email = body.email.strip().lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user and user.get("auth_provider") == "email":
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({"token": token, "user_id": user["user_id"], "email": email, "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(), "used": False})
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        logger.info(f"Password reset link: {frontend_url}/reset-password?token={token}")
    return {"message": "If an account with this email exists, a reset link has been sent."}

@api_router.post("/auth/reset-password")
async def reset_password(body: ResetPasswordRequest):
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    reset_doc = await db.password_reset_tokens.find_one({"token": body.token, "used": False}, {"_id": 0})
    if not reset_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    expires_at = reset_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if not expires_at or expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset token has expired")
    await db.users.update_one({"user_id": reset_doc["user_id"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    await db.password_reset_tokens.update_one({"token": body.token}, {"$set": {"used": True}})
    return {"message": "Password has been reset successfully"}

@api_router.post("/auth/google/callback")
async def google_callback(body: GoogleCallbackRequest, response: Response):
    async with httpx.AsyncClient() as http_client:
        try:
            resp = await http_client.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data", headers={"X-Session-ID": body.session_id}, timeout=10.0)
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Failed to verify Google session")
            data = resp.json()
        except httpx.RequestError:
            raise HTTPException(status_code=502, detail="Failed to connect to auth service")
    email = data.get("email", "").lower()
    name = data.get("name", "")
    picture = data.get("picture", "")
    session_token = data.get("session_token", "")
    if not email or not session_token:
        raise HTTPException(status_code=400, detail="Invalid session data")
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": name or existing.get("name", ""), "picture": picture}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({"user_id": user_id, "email": email, "name": name or email.split("@")[0], "password_hash": "", "role": "customer", "picture": picture, "auth_provider": "google", "created_at": datetime.now(timezone.utc).isoformat()})
    await db.user_sessions.insert_one({"user_id": user_id, "session_token": session_token, "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(), "created_at": datetime.now(timezone.utc).isoformat()})
    response.set_cookie(key="session_token", value=session_token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")
    return {"user_id": user_id, "email": email, "name": name, "role": existing.get("role", "customer") if existing else "customer", "picture": picture, "auth_provider": "google"}

@api_router.post("/auth/guest-session")
async def create_guest_session(response: Response):
    guest_id = f"guest_{uuid.uuid4().hex[:12]}"
    session_token = secrets.token_urlsafe(32)
    guest_email = f"{guest_id}@guest.local"
    await db.users.insert_one({"user_id": guest_id, "email": guest_email, "name": "Guest", "password_hash": "", "role": "guest", "picture": "", "auth_provider": "guest", "created_at": datetime.now(timezone.utc).isoformat()})
    await db.user_sessions.insert_one({"user_id": guest_id, "session_token": session_token, "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(), "created_at": datetime.now(timezone.utc).isoformat()})
    response.set_cookie(key="session_token", value=session_token, httponly=True, secure=True, samesite="none", max_age=86400, path="/")
    return {"user_id": guest_id, "email": "", "name": "Guest", "role": "guest", "picture": "", "auth_provider": "guest"}

# ─── Menu CRUD Endpoints ─────────────────────────────────

@api_router.get("/")
async def root():
    return {"message": "The Culinary Editorial API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy"}

@api_router.get("/menu/items")
async def get_menu_items(category: Optional[str] = None):
    query = {}
    if category and category != "all":
        query["category"] = category
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

# ─── Category Endpoints ───────────────────────────────────

@api_router.get("/categories/tree")
async def get_category_tree():
    cats = await db.categories.find({}, {"_id": 0}).sort("display_order", 1).to_list(200)
    top_level = [c for c in cats if not c.get("parent_id")]
    for cat in top_level:
        cat["subcategories"] = sorted(
            [c for c in cats if c.get("parent_id") == cat["id"]],
            key=lambda x: x.get("display_order", 0)
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
    created = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    return created

@api_router.put("/admin/categories/{cat_id}")
async def update_category(cat_id: str, body: CategoryUpdate, request: Request):
    await require_admin(request)
    existing = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Category not found")
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if updates:
        await db.categories.update_one({"id": cat_id}, {"$set": updates})
    updated = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    return updated

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
    updated = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    return updated

@api_router.post("/admin/categories/reorder")
async def reorder_categories(body: ReorderRequest, request: Request):
    await require_admin(request)
    for item in body.items:
        await db.categories.update_one({"id": item.id}, {"$set": {"display_order": item.display_order}})
    return {"message": "Reorder successful"}

# Admin-only menu management
@api_router.post("/admin/menu/items")
async def create_menu_item(body: MenuItemCreate, request: Request):
    await require_admin(request)
    item_id = str(uuid.uuid4())[:8]
    images = body.images if body.images else ([body.image] if body.image else [])
    doc = {
        "id": item_id,
        "name": body.name,
        "description": body.description,
        "price": body.price,
        "category": body.category,
        "image": images[0] if images else "",
        "images": images,
        "tags": body.tags,
        "status": body.status,
        "available": body.status == "in_stock",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.menu_items.insert_one(doc)
    created = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    return created

@api_router.put("/admin/menu/items/{item_id}")
async def update_menu_item(item_id: str, body: MenuItemUpdate, request: Request):
    await require_admin(request)
    existing = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Item not found")
    updates = {}
    for field, value in body.model_dump(exclude_none=True).items():
        updates[field] = value
    if "status" in updates:
        updates["available"] = updates["status"] == "in_stock"
    if "images" in updates and updates["images"]:
        updates["image"] = updates["images"][0]
    if updates:
        await db.menu_items.update_one({"id": item_id}, {"$set": updates})
    updated = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    return updated

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
    updated = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    return updated

# ─── Other Routes ─────────────────────────────────────────

@api_router.get("/orders")
async def get_orders():
    orders = await db.orders.find({}, {"_id": 0}).to_list(100)
    return {"orders": orders, "count": len(orders)}

@api_router.get("/orders/{order_id}")
async def get_order(order_id: str):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        return {"error": "Order not found"}
    return order

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

frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
cors_origins = [frontend_url, "http://localhost:3000"]
# Add internal preview domain
if "preview.emergentagent.com" in frontend_url:
    base = frontend_url.replace("https://", "").replace("http://", "")
    cors_origins.append(f"https://{base.split('.')[0]}.internal.preview.emergentagent.com")
app.add_middleware(CORSMiddleware, allow_origins=cors_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

app.include_router(api_router)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── Startup ──────────────────────────────────────────────

SEED_ITEMS = [
    {"id": "item-001", "name": "Heritage Duck Breast", "description": "Pan-seared to a perfect medium-rare, accompanied by a tart Montmorency cherry reduction, roasted parsnips, and a silken potato puree. A timeless preparation elevated with seasonal ingredients.", "price": 42.00, "category": "mains", "image": "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&h=400&fit=crop", "images": ["https://images.unsplash.com/photo-1544025162-d76694265947?w=600&h=400&fit=crop", "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=400&fit=crop", "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&h=400&fit=crop"], "tags": ["CHEF'S SELECTION"], "status": "in_stock", "available": True},
    {"id": "item-002", "name": "Heirloom Burrata", "description": "Hand-pulled artisan burrata from a local creamery, served with blistered vine tomatoes, fresh basil pesto, a drizzle of 12-year aged balsamic, and crispy sourdough crostini.", "price": 24.00, "category": "starters", "image": "https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=600&h=400&fit=crop", "images": ["https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=600&h=400&fit=crop", "https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=600&h=400&fit=crop"], "tags": [], "status": "in_stock", "available": True},
    {"id": "item-003", "name": "Earth Harvest Bowl", "description": "Tri-color quinoa, fire-roasted root vegetables, Hass avocado, pickled radish, and a toasted sesame tahini dressing. A nourishing and vibrant celebration of the season's harvest.", "price": 18.00, "category": "mains", "image": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&h=400&fit=crop", "images": ["https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&h=400&fit=crop"], "tags": ["SEASONAL"], "status": "seasonal", "available": True},
    {"id": "item-004", "name": "Artisan Diavola", "description": "72-hour fermented sourdough crust, San Marzano tomato base, spicy Calabrian 'nduja salami, local hot honey, fresh mozzarella di bufala, and torn basil.", "price": 26.00, "category": "mains", "image": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=400&fit=crop", "images": ["https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=400&fit=crop", "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&h=400&fit=crop"], "tags": ["WOOD-FIRED"], "status": "in_stock", "available": True},
    {"id": "item-005", "name": "Hazelnut Ganache Tart", "description": "Dark chocolate ganache with roasted Piedmont hazelnuts, Maldon sea salt flakes, a delicate brown butter shortcrust, and a quenelle of crème fraîche.", "price": 14.00, "category": "desserts", "image": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&h=400&fit=crop", "images": ["https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&h=400&fit=crop"], "tags": [], "status": "in_stock", "available": True},
    {"id": "item-006", "name": "Truffle Infused Tagliatelle", "description": "Fresh hand-cut egg pasta with black truffle shavings from Alba, aged Parmigiano Reggiano, brown butter, and a whisper of nutmeg. Simple, luxurious, unforgettable.", "price": 34.00, "category": "mains", "image": "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=600&h=400&fit=crop", "images": ["https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=600&h=400&fit=crop", "https://images.unsplash.com/photo-1473093226795-af9932fe5856?w=600&h=400&fit=crop", "https://images.unsplash.com/photo-1556761223-4c4282c73f77?w=600&h=400&fit=crop"], "tags": ["CHEF'S SIGNATURE"], "status": "in_stock", "available": True},
    {"id": "item-007", "name": "Spiced Lamb Kofta", "description": "Charcoal-grilled lamb kofta with smoky harissa, labneh, pickled turnip, pomegranate molasses, and warm pita bread. A celebration of Middle Eastern flavors.", "price": 28.00, "category": "starters", "image": "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=600&h=400&fit=crop", "images": ["https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=600&h=400&fit=crop"], "tags": [], "status": "sold_out", "available": False},
    {"id": "item-008", "name": "Elderflower Spritz", "description": "House-made elderflower cordial, Prosecco, a splash of sparkling water, and fresh mint. Light, floral, and utterly refreshing.", "price": 16.00, "category": "drinks", "image": "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600&h=400&fit=crop", "images": ["https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600&h=400&fit=crop"], "tags": [], "status": "in_stock", "available": True},
    {"id": "item-009", "name": "Matcha Mille Crepe", "description": "Twenty delicate crepes layered with ceremonial-grade matcha cream, a light dusting of powdered sugar, and edible gold leaf. An architectural dessert.", "price": 14.00, "category": "desserts", "image": "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600&h=400&fit=crop", "images": ["https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600&h=400&fit=crop"], "tags": ["LIMITED DAILY"], "status": "in_stock", "available": True},
    {"id": "item-010", "name": "Reserve Cold Brew", "description": "Single-origin Ethiopian Yirgacheffe, cold-brewed for 18 hours, served over hand-cut ice with a twist of orange zest. Bold, smooth, and deeply aromatic.", "price": 8.00, "category": "drinks", "image": "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&h=400&fit=crop", "images": ["https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&h=400&fit=crop"], "tags": [], "status": "in_stock", "available": True},
]

@app.on_event("startup")
async def startup():
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

    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email}, {"_id": 0})
    if existing is None:
        admin_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({"user_id": admin_id, "email": admin_email, "name": "Chef Administrator", "password_hash": hash_password(admin_password), "role": "admin", "picture": "", "auth_provider": "email", "created_at": datetime.now(timezone.utc).isoformat()})
        logger.info(f"Admin seeded: {admin_email}")
    elif not verify_password(admin_password, existing.get("password_hash", "")):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

    # Seed menu items
    existing_count = await db.menu_items.count_documents({})
    if existing_count == 0:
        for item in SEED_ITEMS:
            item["created_at"] = datetime.now(timezone.utc).isoformat()
            try:
                await db.menu_items.insert_one(item)
            except Exception:
                pass
        logger.info(f"Seeded {len(SEED_ITEMS)} menu items")

    # Seed categories
    cat_count = await db.categories.count_documents({})
    if cat_count == 0:
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

    creds_dir = Path("/app/memory")
    creds_dir.mkdir(exist_ok=True)
    with open(creds_dir / "test_credentials.md", "w") as f:
        f.write("# Test Credentials\n\n## Admin\n")
        f.write(f"- Email: {admin_email}\n- Password: {admin_password}\n- Role: admin\n\n")
        f.write("## Auth Endpoints\n- POST /api/auth/register\n- POST /api/auth/login\n- POST /api/auth/logout\n- GET /api/auth/me\n")
        f.write("## Menu Endpoints\n- GET /api/menu/items\n- GET /api/menu/items/:id\n- POST /api/admin/menu/items (admin)\n- PUT /api/admin/menu/items/:id (admin)\n- DELETE /api/admin/menu/items/:id (admin)\n- PATCH /api/admin/menu/items/:id/toggle (admin)\n")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
