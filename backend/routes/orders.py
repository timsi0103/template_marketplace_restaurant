"""Orders: create, validate-promo, list, get, favorite. Includes totals helpers."""
from fastapi import HTTPException, Request
from datetime import datetime, timezone
from typing import List, Optional
import uuid
import os
import secrets

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest, CheckoutSessionResponse,
)

from core import api_router, db, get_current_user
from models import OrderCreate, OrderLineIn, PromoValidate

TAX_RATE = 0.0875
DELIVERY_FEE = 4.99

SEED_COUPONS = [
    {"code": "SAVE10", "type": "percent", "value": 10.0, "min_subtotal": 0.0,
     "description": "10% off your order", "usage_limit": None, "first_order_only": False,
     "expires_at": None, "active": True},
    {"code": "WELCOME5", "type": "fixed", "value": 5.0, "min_subtotal": 20.0,
     "description": "$5 off orders over $20 (first order)", "usage_limit": None,
     "first_order_only": True, "expires_at": None, "active": True},
    {"code": "FREESHIP", "type": "free_delivery", "value": 0.0, "min_subtotal": 25.0,
     "description": "Free delivery on orders over $25", "usage_limit": None,
     "first_order_only": False, "expires_at": None, "active": True},
    {"code": "EXPIRED10", "type": "percent", "value": 10.0, "min_subtotal": 0.0,
     "description": "Demo expired coupon", "usage_limit": None, "first_order_only": False,
     "expires_at": "2020-01-01", "active": True},
]


async def _fetch_active_coupon(code: str):
    if not code:
        return None, None
    doc = await db.promo_codes.find_one({"code": code.strip().upper()}, {"_id": 0})
    if not doc:
        return None, "Invalid promo code"
    if not doc.get("active", True):
        return doc, "Code is inactive"
    if doc.get("expires_at"):
        try:
            exp = datetime.fromisoformat(doc["expires_at"]).date()
            if exp < datetime.now(timezone.utc).date():
                return doc, "Code expired"
        except Exception:
            pass
    if doc.get("usage_limit") is not None:
        if int(doc.get("usage_count", 0)) >= int(doc["usage_limit"]):
            return doc, "Code usage limit reached"
    return doc, None


async def _is_first_order(contact_email: Optional[str], user_id: Optional[str]) -> bool:
    q = []
    if user_id:
        q.append({"user_id": user_id, "payment_status": "paid"})
    if contact_email:
        q.append({"contact_email": contact_email, "payment_status": "paid"})
    if not q:
        return True
    count = await db.orders.count_documents({"$or": q})
    return count == 0


async def _compute_order_totals(items_enriched, fulfillment_type, promo_code, tip,
                                contact_email=None, user_id=None):
    subtotal = round(sum(i["price"] * i["qty"] for i in items_enriched), 2)
    delivery_fee = round(DELIVERY_FEE, 2) if fulfillment_type == "delivery" else 0.0
    discount = 0.0
    promo_applied = None
    promo_type = None
    if promo_code:
        doc, err = await _fetch_active_coupon(promo_code)
        if doc and not err:
            if subtotal < float(doc.get("min_subtotal", 0) or 0):
                pass
            elif doc.get("first_order_only") and not await _is_first_order(contact_email, user_id):
                pass
            else:
                promo_applied = doc["code"]
                promo_type = doc["type"]
                if doc["type"] == "percent":
                    discount = round(subtotal * float(doc["value"]) / 100, 2)
                elif doc["type"] == "fixed":
                    discount = round(float(doc["value"]), 2)
                elif doc["type"] == "free_delivery":
                    discount = round(delivery_fee, 2)
    taxable = max(0.0, subtotal - discount)
    tax = round(taxable * TAX_RATE, 2)
    tip_val = round(max(0.0, float(tip or 0)), 2)
    total = round(max(0.0, subtotal - discount + delivery_fee + tax + tip_val), 2)
    return {
        "subtotal": subtotal, "delivery_fee": delivery_fee, "discount": discount,
        "tax": tax, "tip": tip_val, "total": total,
        "promo_applied": promo_applied, "promo_type": promo_type,
    }


async def _enrich_items(items_in: List[OrderLineIn]):
    enriched = []
    for line in items_in:
        prod = await db.menu_items.find_one({"id": line.item_id}, {"_id": 0})
        if not prod:
            raise HTTPException(status_code=400, detail=f"Item {line.item_id} not found")
        base_price = prod["price"]
        variant_name = None
        if line.variant_id:
            variants = prod.get("variants") or []
            v = next((x for x in variants if x.get("id") == line.variant_id), None)
            if not v:
                raise HTTPException(status_code=400, detail=f"Variant {line.variant_id} not found for {prod['name']}")
            base_price = v["price"]
            variant_name = v.get("name")
        mod_total = sum(max(0.0, float(m.get("price") or 0)) for m in (line.modifiers or []))
        enriched.append({
            "item_id": line.item_id,
            "name": prod["name"],
            "image": prod.get("image") or "",
            "variant_id": line.variant_id,
            "variant_name": variant_name,
            "modifiers": line.modifiers or [],
            "instructions": line.instructions or "",
            "qty": max(1, int(line.qty)),
            "unit_base": float(base_price),
            "unit_modifiers_total": float(mod_total),
            "price": round(float(base_price) + float(mod_total), 2),
        })
    return enriched


def _make_order_number():
    return "ORD-" + datetime.now(timezone.utc).strftime("%y%m%d") + "-" + secrets.token_hex(2).upper()


@api_router.post("/orders/validate-promo")
async def validate_promo(body: PromoValidate):
    doc, err = await _fetch_active_coupon(body.code)
    if err:
        return {"valid": False, "error": err}
    if body.subtotal < float(doc.get("min_subtotal", 0) or 0):
        return {"valid": False, "error": f"Minimum order ${float(doc['min_subtotal']):.2f} required"}
    if doc.get("first_order_only"):
        first = await _is_first_order(body.contact_email, None)
        if not first:
            return {"valid": False, "error": "This code is for first-time customers only"}
    if doc["type"] == "free_delivery" and body.fulfillment_type and body.fulfillment_type != "delivery":
        return {"valid": False, "error": "Free delivery code requires delivery fulfillment"}
    rule = {
        "type": doc["type"],
        "value": float(doc.get("value") or 0),
        "min_subtotal": float(doc.get("min_subtotal") or 0),
        "description": doc.get("description") or "",
    }
    return {"valid": True, "code": doc["code"], "rule": rule, "description": rule["description"]}


@api_router.post("/orders")
async def create_order(body: OrderCreate, request: Request):
    if body.fulfillment_type not in ("delivery", "pickup", "dine_in"):
        raise HTTPException(status_code=400, detail="Invalid fulfillment_type")
    if body.fulfillment_type == "delivery" and (not body.address or not body.address.line1):
        raise HTTPException(status_code=400, detail="Address is required for delivery")
    if body.fulfillment_type == "dine_in" and not body.table_number:
        raise HTTPException(status_code=400, detail="Table number is required for dine-in")
    if not body.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    items_enriched = await _enrich_items(body.items)

    user_id = None
    try:
        user = await get_current_user(request)
        if user and not user.get("guest"):
            user_id = user.get("id") or user.get("_id") or user.get("email")
    except Exception:
        user_id = None

    totals = await _compute_order_totals(
        items_enriched, body.fulfillment_type, body.promo_code, body.tip,
        contact_email=body.contact_email, user_id=user_id,
    )

    order_id = str(uuid.uuid4())
    order_number = _make_order_number()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Compute a smart estimated_minutes from current kitchen load + item prep times
    try:
        from routes.throttle import _compute_eta_payload
        cats = list({(it.get("name") and it.get("name")) for it in items_enriched})  # dummy placeholder
        cats = []
        for it in items_enriched:
            prod = await db.menu_items.find_one({"id": it["item_id"]}, {"_id": 0, "category": 1})
            if prod and prod.get("category"):
                cats.append(prod["category"])
        eta_payload = await _compute_eta_payload(cats)
        estimated = int(eta_payload.get("eta_minutes") or 0)
        if body.fulfillment_type == "delivery":
            estimated += 15  # add driving buffer
        if estimated <= 0:
            estimated = 30 if body.fulfillment_type == "delivery" else 20
    except Exception:
        estimated = 30 if body.fulfillment_type == "delivery" else 20

    order_doc = {
        "id": order_id, "order_number": order_number, "user_id": user_id,
        "contact_email": body.contact_email,
        "contact_name": body.contact_name or "",
        "contact_phone": body.contact_phone or "",
        "items": items_enriched,
        "fulfillment_type": body.fulfillment_type,
        "address": body.address.model_dump() if body.address else None,
        "table_number": body.table_number,
        "scheduled_slot": body.scheduled_slot or "ASAP",
        **totals,
        "status": "pending",
        "payment_status": "initiated",
        "estimated_minutes": estimated,
        "created_at": now_iso, "updated_at": now_iso,
    }

    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    origin = body.origin_url.rstrip("/")
    success_url = f"{origin}/order/success?session_id={{CHECKOUT_SESSION_ID}}&order_id={order_id}"
    cancel_url = f"{origin}/checkout?cancelled=1&order_id={order_id}"

    checkout_req = CheckoutSessionRequest(
        amount=float(totals["total"]),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "order_id": order_id, "order_number": order_number,
            "contact_email": body.contact_email,
            "fulfillment_type": body.fulfillment_type,
        },
    )
    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_req)

    order_doc["stripe_session_id"] = session.session_id

    await db.orders.insert_one(order_doc)
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "order_id": order_id, "order_number": order_number,
        "amount": float(totals["total"]), "currency": "usd",
        "user_id": user_id, "contact_email": body.contact_email,
        "status": "initiated", "payment_status": "initiated",
        "metadata": {"order_id": order_id, "order_number": order_number, "fulfillment_type": body.fulfillment_type},
        "created_at": now_iso, "updated_at": now_iso,
    })

    return {
        "order_id": order_id, "order_number": order_number,
        "session_id": session.session_id, "checkout_url": session.url,
        "total": totals["total"],
    }


@api_router.get("/orders")
async def list_orders(request: Request, email: Optional[str] = None):
    query = {}
    try:
        user = await get_current_user(request)
        if user and not user.get("guest"):
            uid = user.get("user_id") or user.get("id") or user.get("email")
            query = {"user_id": uid}
        elif email:
            query = {"contact_email": email}
    except Exception:
        if email:
            query = {"contact_email": email}
        else:
            return {"orders": [], "count": 0}
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"orders": orders, "count": len(orders)}


@api_router.get("/orders/{order_id}")
async def get_order(order_id: str):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@api_router.patch("/orders/{order_id}/favorite")
async def toggle_order_favorite(order_id: str, request: Request):
    user = await get_current_user(request)
    if not user or user.get("guest"):
        raise HTTPException(status_code=401, detail="Login required")
    uid = user.get("user_id") or user.get("id") or user.get("email")
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("user_id") != uid and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not your order")
    new_state = not bool(order.get("starred", False))
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"starred": new_state, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"id": order_id, "starred": new_state}
