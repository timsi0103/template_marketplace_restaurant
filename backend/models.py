"""All Pydantic request/response models used by the API.
These definitions are copied verbatim from the original server.py so the
behaviour of every endpoint is preserved."""
from pydantic import BaseModel
from typing import List, Optional, Dict, Any


# ─── Auth ─────────────────────────────────────────────────

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


# ─── Catalog ──────────────────────────────────────────────

class VariantItem(BaseModel):
    id: str = ""
    name: str
    price: float
    stock: int = -1
    status: str = "in_stock"
    image: str = ""

class MenuItemCreate(BaseModel):
    name: str
    description: str = ""
    price: float
    category: str = "mains"
    subcategory: Optional[str] = None
    image: str = ""
    images: List[str] = []
    tags: List[str] = []
    dietary_tags: List[str] = []
    status: str = "in_stock"
    variants: List[VariantItem] = []

class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    image: Optional[str] = None
    images: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    dietary_tags: Optional[List[str]] = None
    status: Optional[str] = None
    variants: Optional[List[VariantItem]] = None

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

class ModifierOption(BaseModel):
    id: str = ""
    name: str
    price_adjustment: float = 0

class ModifierGroupCreate(BaseModel):
    name: str
    type: str = "optional"
    min_selections: int = 0
    max_selections: int = 0
    options: List[ModifierOption] = []
    linked_item_ids: List[str] = []

class ModifierGroupUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    min_selections: Optional[int] = None
    max_selections: Optional[int] = None
    options: Optional[List[ModifierOption]] = None
    linked_item_ids: Optional[List[str]] = None


# ─── Store / Hours / Holidays ─────────────────────────────

class DayHours(BaseModel):
    open_time: str = "10:00"
    close_time: str = "22:00"
    closed: bool = False

class ServiceHours(BaseModel):
    delivery: DayHours = DayHours()
    pickup: DayHours = DayHours()
    dine_in: DayHours = DayHours()

class OperatingHoursUpdate(BaseModel):
    monday: Optional[ServiceHours] = None
    tuesday: Optional[ServiceHours] = None
    wednesday: Optional[ServiceHours] = None
    thursday: Optional[ServiceHours] = None
    friday: Optional[ServiceHours] = None
    saturday: Optional[ServiceHours] = None
    sunday: Optional[ServiceHours] = None

class HolidayCreate(BaseModel):
    date: str
    reason: str = ""
    all_day: bool = True


# ─── Orders ───────────────────────────────────────────────

class OrderLineIn(BaseModel):
    item_id: str
    variant_id: Optional[str] = None
    modifiers: List[Dict[str, Any]] = []   # [{group, name, price}]
    qty: int = 1
    instructions: Optional[str] = ""

class AddressIn(BaseModel):
    label: Optional[str] = ""
    line1: str = ""
    line2: Optional[str] = ""
    city: Optional[str] = ""
    postal_code: Optional[str] = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    notes: Optional[str] = ""

class OrderCreate(BaseModel):
    items: List[OrderLineIn]
    fulfillment_type: str  # delivery | pickup | dine_in
    address: Optional[AddressIn] = None
    table_number: Optional[str] = None
    scheduled_slot: Optional[str] = None
    tip: float = 0.0
    promo_code: Optional[str] = None
    contact_email: str
    contact_name: Optional[str] = ""
    contact_phone: Optional[str] = ""
    origin_url: str

class PromoValidate(BaseModel):
    code: str
    subtotal: float
    contact_email: Optional[str] = None
    fulfillment_type: Optional[str] = None


# ─── Coupons / Promo Codes ────────────────────────────────

class CouponCreate(BaseModel):
    code: str
    type: str                        # percent | fixed | free_delivery
    value: float = 0.0
    min_subtotal: float = 0.0
    description: Optional[str] = ""
    usage_limit: Optional[int] = None
    first_order_only: bool = False
    expires_at: Optional[str] = None  # ISO date "YYYY-MM-DD"
    active: bool = True

class CouponUpdate(BaseModel):
    code: Optional[str] = None
    type: Optional[str] = None
    value: Optional[float] = None
    min_subtotal: Optional[float] = None
    description: Optional[str] = None
    usage_limit: Optional[int] = None
    first_order_only: Optional[bool] = None
    expires_at: Optional[str] = None
    active: Optional[bool] = None


# ─── Payment Methods (mocked saved cards) ─────────────────

class PaymentMethodCreate(BaseModel):
    brand: str
    last4: str
    exp_month: int
    exp_year: int
    nickname: Optional[str] = None
    is_default: bool = False


# ─── Admin: Orders workflow ───────────────────────────────

class RejectBody(BaseModel):
    reason: Optional[str] = ""


# ─── KDS ──────────────────────────────────────────────────

class KDSSettingsBody(BaseModel):
    audio_enabled: Optional[bool] = None
    default_columns: Optional[int] = None
    target_prep_minutes_by_category: Optional[Dict[str, int]] = None
    station_routing: Optional[Dict[str, List[str]]] = None

class KDSItemStatusBody(BaseModel):
    status: str  # pending | started | ready


# ─── Printers ─────────────────────────────────────────────

class PrinterBody(BaseModel):
    name: str
    ip: Optional[str] = ""
    model: str = "generic_80mm"
    station: str = "kitchen"
    is_online: bool = True

class PrinterPatchBody(BaseModel):
    name: Optional[str] = None
    ip: Optional[str] = None
    model: Optional[str] = None
    station: Optional[str] = None
    is_online: Optional[bool] = None

class PrintSettingsBody(BaseModel):
    auto_trigger: Optional[str] = None
    auto_receipt: Optional[bool] = None

class PrintOrderBody(BaseModel):
    ticket_type: str = "kitchen"
    printer_id: Optional[str] = None
    trigger: str = "manual"
