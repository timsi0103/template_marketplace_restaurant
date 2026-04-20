"""Guest → account conversion helpers: email existence check, post-purchase account creation + order claim."""
from fastapi import HTTPException, Response, Request
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone
from typing import Optional
import uuid

from core import (
    api_router, db, logger,
    hash_password, create_access_token, create_refresh_token, set_auth_cookies,
)


class EmailCheckRequest(BaseModel):
    email: EmailStr


class ClaimOrdersRequest(BaseModel):
    email: EmailStr
    password: str
    order_id: str
    name: Optional[str] = None


@api_router.post("/auth/check-email")
async def check_email(body: EmailCheckRequest):
    """Returns {exists: bool} — used by checkout to nudge returning guests to sign in."""
    email = body.email.strip().lower()
    user = await db.users.find_one({"email": email}, {"_id": 0, "user_id": 1, "auth_provider": 1})
    return {
        "exists": bool(user),
        "auth_provider": (user or {}).get("auth_provider") if user else None,
    }


@api_router.post("/auth/claim-orders")
async def claim_orders(body: ClaimOrdersRequest, response: Response):
    """
    Post-purchase account creation:
    1. Validate order_id exists and its contact_email matches the supplied email.
    2. Reject if an account already exists for the email (user must sign in instead).
    3. Create user, link ALL guest orders sharing this contact_email (user_id update),
       set authentication cookies, return user + number of claimed orders + loyalty points.
    """
    email = body.email.strip().lower()
    if not body.password or len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    order = await db.orders.find_one({"id": body.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if (order.get("contact_email") or "").lower() != email:
        raise HTTPException(status_code=400, detail="Email does not match this order")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=409, detail="An account already exists for this email. Please sign in instead.")

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": email,
        "name": body.name or (order.get("contact_name") or email.split("@")[0]),
        "password_hash": hash_password(body.password),
        "role": "customer",
        "picture": "",
        "auth_provider": "email",
        "created_via": "post_purchase",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)

    # Link every guest order sharing this email (user_id is null/absent)
    result = await db.orders.update_many(
        {"contact_email": email, "$or": [{"user_id": None}, {"user_id": {"$exists": False}}]},
        {"$set": {"user_id": user_id}},
    )
    claimed = int(result.modified_count or 0)

    # Loyalty accrual (1 pt per $1 paid, across all claimed orders). Safe even if no loyalty program wired.
    loyalty_points = 0
    try:
        cursor = db.orders.find(
            {"user_id": user_id, "payment_status": "paid"},
            {"_id": 0, "total": 1},
        )
        async for o in cursor:
            loyalty_points += int(float(o.get("total") or 0))
        if loyalty_points > 0:
            await db.users.update_one({"user_id": user_id}, {"$set": {"loyalty_points": loyalty_points}})
    except Exception as e:
        logger.warning(f"Loyalty accrual skipped: {e}")

    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    set_auth_cookies(response, access_token, refresh_token)

    return {
        "user_id": user_id,
        "email": email,
        "name": user_doc["name"],
        "role": "customer",
        "picture": "",
        "auth_provider": "email",
        "claimed_orders": claimed,
        "loyalty_points": loyalty_points,
    }
