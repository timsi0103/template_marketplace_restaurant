from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="The Culinary Editorial API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ─── Models ───────────────────────────────────────────────

class MenuItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    price: float
    category: str = "all"
    image: str = ""
    tags: List[str] = []
    available: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class OrderItem(BaseModel):
    menu_item_id: str
    name: str
    quantity: int = 1
    price: float
    enhancements: List[str] = []
    special_instructions: str = ""

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    items: List[OrderItem] = []
    delivery_method: str = "delivery"
    status: str = "pending"
    subtotal: float = 0
    taxes: float = 0
    delivery_fee: float = 0
    total: float = 0
    customer_name: str = ""
    phone: str = ""
    address: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    slug: str
    display_order: int = 0

# ─── Placeholder Routes ──────────────────────────────────

@api_router.get("/")
async def root():
    return {"message": "The Culinary Editorial API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy"}

# Menu endpoints (skeleton)
@api_router.get("/menu/items")
async def get_menu_items():
    items = await db.menu_items.find({}, {"_id": 0}).to_list(100)
    return {"items": items, "count": len(items)}

@api_router.get("/menu/items/{item_id}")
async def get_menu_item(item_id: str):
    item = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        return {"error": "Item not found"}
    return item

@api_router.get("/menu/categories")
async def get_categories():
    categories = await db.categories.find({}, {"_id": 0}).to_list(50)
    return {"categories": categories}

# Orders endpoints (skeleton)
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

# Admin endpoints (skeleton)
@api_router.get("/admin/dashboard")
async def admin_dashboard():
    orders_count = await db.orders.count_documents({})
    menu_count = await db.menu_items.count_documents({})
    return {
        "daily_revenue": 4285.00,
        "active_orders": orders_count,
        "menu_items": menu_count,
        "top_selling": "Truffle Risotto",
    }

@api_router.get("/admin/queue")
async def admin_queue():
    orders = await db.orders.find(
        {"status": {"$in": ["pending", "preparing", "ready"]}},
        {"_id": 0}
    ).to_list(50)
    return {"queue": orders}

# Kitchen endpoints (skeleton)
@api_router.get("/kitchen/orders")
async def kitchen_orders():
    orders = await db.orders.find(
        {"status": {"$in": ["pending", "preparing", "cooking"]}},
        {"_id": 0}
    ).to_list(50)
    return {"orders": orders}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
