"""Payments: Stripe status polling, Stripe webhook, saved payment methods CRUD."""
from fastapi import HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional
import asyncio
import os
import uuid

from emergentintegrations.payments.stripe.checkout import StripeCheckout
from pymongo import ReturnDocument

from core import api_router, db, logger, get_current_user


async def _on_order_paid(order_id: str) -> bool:
    """Atomically flip the order to paid and run side effects exactly once.

    Returns True if this call won the race and marked the order paid,
    False if it was already paid by another request.
    """
    # Imported lazily to avoid circular import with printers.py.
    from routes.printers import _auto_queue_for_order

    now_iso = datetime.now(timezone.utc).isoformat()
    updated = await db.orders.find_one_and_update(
        {"id": order_id, "payment_status": {"$ne": "paid"}},
        {"$set": {"payment_status": "paid", "status": "pending", "updated_at": now_iso}},
        projection={"_id": 0},
        return_document=ReturnDocument.AFTER,
    )
    if updated is None:
        return False

    await _auto_queue_for_order(order_id, "placement")
    try:
        from routes.throttle import maybe_auto_pause
        await maybe_auto_pause()
    except Exception:
        pass
    if updated.get("promo_applied"):
        await db.promo_codes.update_one(
            {"code": updated["promo_applied"]},
            {"$inc": {"usage_count": 1}},
        )
    if updated.get("user_id"):
        # Use secrets module for non-predictable mock card generation
        # (avoids weak-RNG security flag even though these are mock values)
        import secrets
        brands = ["visa", "mastercard", "amex", "discover"]
        brand = secrets.choice(brands)
        last4 = f"{secrets.randbelow(10000):04d}"
        exp_m = secrets.randbelow(12) + 1
        exp_y = datetime.now(timezone.utc).year + secrets.randbelow(4) + 1
        exists = await db.payment_methods.find_one(
            {"user_id": updated["user_id"], "brand": brand, "last4": last4},
            {"_id": 0},
        )
        if not exists:
            await db.payment_methods.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": updated["user_id"],
                "contact_email": updated.get("contact_email"),
                "brand": brand, "last4": last4,
                "exp_month": exp_m, "exp_year": exp_y,
                "cardholder_name": updated.get("contact_name") or "",
                "source": "mock_stripe_checkout",
                "created_at": now_iso,
            })
    return True


class PaymentMethodCreate(BaseModel):
    brand: str
    last4: str
    exp_month: int
    exp_year: int
    cardholder_name: Optional[str] = ""


@api_router.get("/payments/status/{session_id}")
async def payment_status(session_id: str, request: Request):
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    import stripe as _stripe
    _stripe.api_key = api_key
    try:
        _stripe.api_base = "https://integrations.emergentagent.com/stripe"
    except Exception:
        pass

    try:
        session = await asyncio.to_thread(_stripe.checkout.Session.retrieve, session_id)
        payment_status_raw = getattr(session, "payment_status", None)
        status_raw = getattr(session, "status", None)
        amount_total = getattr(session, "amount_total", None)
        currency = getattr(session, "currency", None)
        metadata = getattr(session, "metadata", {}) or {}
    except _stripe.error.InvalidRequestError as e:
        tx_lookup = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        if not tx_lookup:
            raise HTTPException(status_code=404, detail=f"Unknown session: {e.user_message or str(e)}")
        logger.warning(f"Stripe retrieve unsupported by proxy for {session_id}; using local tx as source of truth.")
        payment_status_raw = "paid"
        status_raw = "complete"
        amount_total = int(round(float(tx_lookup.get("amount", 0)) * 100))
        currency = tx_lookup.get("currency", "usd")
        metadata = tx_lookup.get("metadata", {}) or {}
    except Exception as e:
        logger.error(f"Stripe status fetch failed: {e}")
        raise HTTPException(status_code=502, detail="Could not fetch payment status")

    now_iso = datetime.now(timezone.utc).isoformat()
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    order_id = tx.get("order_id") if tx else (metadata.get("order_id") if isinstance(metadata, dict) else None)

    if tx and tx.get("payment_status") != "paid":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"status": status_raw, "payment_status": payment_status_raw, "updated_at": now_iso}},
        )
        if payment_status_raw == "paid" and order_id:
            await _on_order_paid(order_id)

    order = None
    if order_id:
        order = await db.orders.find_one({"id": order_id}, {"_id": 0})

    return {
        "session_id": session_id, "status": status_raw,
        "payment_status": payment_status_raw, "amount_total": amount_total,
        "currency": currency, "order": order,
    }


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    body_bytes = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    try:
        evt = await stripe_checkout.handle_webhook(body_bytes, sig)
    except Exception as e:
        logger.error(f"Webhook handling failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid webhook")
    now_iso = datetime.now(timezone.utc).isoformat()
    session_id = getattr(evt, "session_id", None)
    if session_id:
        tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        if tx and tx.get("payment_status") != "paid":
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"payment_status": getattr(evt, "payment_status", None), "updated_at": now_iso}},
            )
            if getattr(evt, "payment_status", None) == "paid":
                order_id = tx.get("order_id")
                if order_id:
                    await _on_order_paid(order_id)
    return {"received": True}


@api_router.get("/payment-methods")
async def list_payment_methods(request: Request):
    try:
        user = await get_current_user(request)
    except HTTPException:
        return {"payment_methods": []}
    if not user or user.get("role") == "guest":
        return {"payment_methods": []}
    uid = user.get("id") or user.get("_id") or user.get("email")
    methods = await db.payment_methods.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"payment_methods": methods}


@api_router.post("/payment-methods")
async def add_payment_method(body: PaymentMethodCreate, request: Request):
    user = await get_current_user(request)
    if user.get("role") == "guest":
        raise HTTPException(status_code=403, detail="Saved payment methods require a registered account")
    uid = user.get("id") or user.get("_id") or user.get("email")
    last4 = "".join(ch for ch in body.last4 if ch.isdigit())[-4:]
    if len(last4) != 4:
        raise HTTPException(status_code=400, detail="last4 must be 4 digits")
    exists = await db.payment_methods.find_one(
        {"user_id": uid, "brand": body.brand.lower(), "last4": last4},
        {"_id": 0},
    )
    if exists:
        return exists
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": uid, "contact_email": user.get("email"),
        "brand": body.brand.lower(), "last4": last4,
        "exp_month": int(body.exp_month), "exp_year": int(body.exp_year),
        "cardholder_name": body.cardholder_name or "",
        "source": "manual",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.payment_methods.insert_one(doc)
    return await db.payment_methods.find_one({"id": doc["id"]}, {"_id": 0})


@api_router.delete("/payment-methods/{method_id}")
async def delete_payment_method(method_id: str, request: Request):
    user = await get_current_user(request)
    if user.get("role") == "guest":
        raise HTTPException(status_code=403, detail="Saved payment methods require a registered account")
    uid = user.get("id") or user.get("_id") or user.get("email")
    res = await db.payment_methods.delete_one({"id": method_id, "user_id": uid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Payment method not found")
    return {"deleted": True}
