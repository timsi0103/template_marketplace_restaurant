"""Customer ratings & reviews.

Domain areas:
- Review submission (post-order, 1-hour delay default, reused on order tracking page).
- Per-item + overall rating, optional text, optional photos, optional anonymous flag.
- Public display (per menu item, aggregate summary, bulk summary for menu card badges).
- Admin moderation (approve / flag / respond / delete) & insights (trend, distribution,
  response rate, attention queue).
- Automation config (auto-send delay minutes, message template, allowed fulfillment types).

Auto-trigger is computed on-the-fly rather than via a background job: given an order's
`updated_at`/`delivered_at` timestamp, we decide whether the prompt should be visible.

Photo uploads reuse `routes.uploads.store_user_upload` with `purpose="review_photo"`.
"""
from fastapi import HTTPException, Request, Query, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid

from core import api_router, db, get_current_user, require_admin, logger
from routes.uploads import store_user_upload


# ─── Config ──────────────────────────────────────────────────────

DEFAULT_REVIEW_CONFIG = {
    "key": "review_config",
    "enabled": True,
    "auto_send_delay_minutes": 60,
    "message_template": "How was your order? Tap to leave a quick rating — it takes less than a minute.",
    "enabled_fulfillment_types": ["delivery", "pickup", "dine_in"],
    "auto_approve": True,  # if True, reviews go straight to 'approved'; else 'pending'
    "allow_photos": True,
    "allow_anonymous": True,
    "updated_at": None,
}

FULFILLED_STATUSES = {"delivered", "completed"}


async def _get_config() -> dict:
    doc = await db.app_settings.find_one({"key": "review_config"}, {"_id": 0}) or {}
    merged = {**DEFAULT_REVIEW_CONFIG, **doc}
    merged.pop("key", None)
    return merged


def _parse_iso(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _fulfilled_at(order: dict) -> Optional[datetime]:
    """Best-effort timestamp of when the order was handed to the customer."""
    for k in ("delivered_at", "completed_at", "ready_at"):
        t = _parse_iso(order.get(k))
        if t:
            return t
    if order.get("status") in FULFILLED_STATUSES:
        return _parse_iso(order.get("updated_at")) or _parse_iso(order.get("created_at"))
    return None


# ─── Admin config endpoints ─────────────────────────────────────

class ReviewConfigPatch(BaseModel):
    enabled: Optional[bool] = None
    auto_send_delay_minutes: Optional[int] = Field(None, ge=0, le=60 * 24 * 7)
    message_template: Optional[str] = None
    enabled_fulfillment_types: Optional[List[str]] = None
    auto_approve: Optional[bool] = None
    allow_photos: Optional[bool] = None
    allow_anonymous: Optional[bool] = None


@api_router.get("/admin/review-config")
async def admin_get_review_config(request: Request):
    await require_admin(request)
    return await _get_config()


@api_router.patch("/admin/review-config")
async def admin_patch_review_config(body: ReviewConfigPatch, request: Request):
    await require_admin(request)
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise HTTPException(status_code=400, detail="No changes")
    if "message_template" in patch:
        patch["message_template"] = patch["message_template"].strip()[:400]
    if "enabled_fulfillment_types" in patch:
        allowed = {"delivery", "pickup", "dine_in"}
        patch["enabled_fulfillment_types"] = [t for t in patch["enabled_fulfillment_types"] if t in allowed]
    patch["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.app_settings.update_one({"key": "review_config"}, {"$set": patch}, upsert=True)
    return await _get_config()


# ─── Eligibility / prompt ───────────────────────────────────────

@api_router.get("/reviews/request/{order_id}")
async def review_request_for_order(order_id: str):
    """Public: returns whether the customer should be prompted to review this order."""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    cfg = await _get_config()
    eligible = False
    seconds_until_prompt = 0
    if (
        cfg["enabled"]
        and order.get("fulfillment_type") in cfg["enabled_fulfillment_types"]
        and order.get("status") in FULFILLED_STATUSES
    ):
        fulfilled = _fulfilled_at(order)
        if fulfilled:
            due = fulfilled + timedelta(minutes=int(cfg["auto_send_delay_minutes"]))
            delta = (due - datetime.now(timezone.utc)).total_seconds()
            eligible = delta <= 0
            seconds_until_prompt = max(0, int(delta))

    existing = await db.reviews.find_one({"order_id": order_id}, {"_id": 0})
    submitted = bool(existing)

    return {
        "order_id": order_id,
        "order_number": order.get("order_number"),
        "eligible": eligible and not submitted,
        "seconds_until_prompt": seconds_until_prompt,
        "submitted": submitted,
        "message_template": cfg["message_template"],
        "allow_photos": cfg["allow_photos"],
        "allow_anonymous": cfg["allow_anonymous"],
        "items": [
            {"item_id": it.get("item_id"), "name": it.get("name"), "image": it.get("image")}
            for it in (order.get("items") or [])
        ],
    }


# ─── Submission ─────────────────────────────────────────────────

class PerItemReview(BaseModel):
    item_id: str
    rating: int = Field(ge=1, le=5)
    text: Optional[str] = ""


class ReviewIn(BaseModel):
    order_id: str
    overall_rating: int = Field(ge=1, le=5)
    overall_text: Optional[str] = ""
    item_reviews: Optional[List[PerItemReview]] = None
    photos: Optional[List[str]] = None  # list of file_id (from /api/reviews/photos/upload)
    anonymous: Optional[bool] = False
    contact_email: Optional[str] = None  # guest verification


async def _recompute_item_summary(item_id: str):
    """Denormalize aggregate rating onto menu_items doc."""
    pipeline = [
        {"$match": {"item_id": item_id, "status": "approved"}},
        {"$group": {
            "_id": None,
            "count": {"$sum": 1},
            "avg": {"$avg": "$rating"},
            "r1": {"$sum": {"$cond": [{"$eq": ["$rating", 1]}, 1, 0]}},
            "r2": {"$sum": {"$cond": [{"$eq": ["$rating", 2]}, 1, 0]}},
            "r3": {"$sum": {"$cond": [{"$eq": ["$rating", 3]}, 1, 0]}},
            "r4": {"$sum": {"$cond": [{"$eq": ["$rating", 4]}, 1, 0]}},
            "r5": {"$sum": {"$cond": [{"$eq": ["$rating", 5]}, 1, 0]}},
        }},
    ]
    agg = await db.reviews.aggregate(pipeline).to_list(1)
    if agg:
        r = agg[0]
        distribution = {str(i): r[f"r{i}"] for i in range(1, 6)}
        update = {
            "rating_avg": round(float(r["avg"] or 0), 2),
            "rating_count": int(r["count"]),
            "rating_distribution": distribution,
        }
    else:
        update = {"rating_avg": 0.0, "rating_count": 0, "rating_distribution": {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}}
    await db.menu_items.update_one({"id": item_id}, {"$set": update})


@api_router.post("/reviews/photos/upload")
async def upload_review_photo(
    request: Request,
    file: UploadFile = File(...),
    order_id: str = Form(...),
    contact_email: Optional[str] = Form(None),
):
    """Public review-photo upload.

    Authorization: either the caller is authenticated and owns the order, or
    (for guest orders) the caller supplies the matching `contact_email`. Max 3 MB.
    """
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    uploader_id = "guest"
    try:
        u = await get_current_user(request)
        if u and not u.get("guest"):
            uploader_id = u.get("user_id") or u.get("email") or "guest"
            owns = (order.get("user_id") or "") == uploader_id or (order.get("contact_email") or "").lower() == (u.get("email") or "").lower()
            if not owns and u.get("role") != "admin":
                raise HTTPException(status_code=403, detail="Not your order")
    except HTTPException:
        raise
    except Exception:
        pass

    if uploader_id == "guest":
        supplied = (contact_email or "").lower().strip()
        if not supplied or supplied != (order.get("contact_email") or "").lower():
            raise HTTPException(status_code=403, detail="Email verification required")

    if order.get("status") not in FULFILLED_STATUSES:
        raise HTTPException(status_code=409, detail="Order not yet fulfilled")

    return await store_user_upload(file=file, uploader_id=uploader_id, purpose="review_photo", max_bytes=3 * 1024 * 1024)


@api_router.post("/reviews")
async def create_review(body: ReviewIn, request: Request):
    order = await db.orders.find_one({"id": body.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("status") not in FULFILLED_STATUSES:
        raise HTTPException(status_code=409, detail="You can only review fulfilled orders")

    # Authorization: owner or matching guest email
    user_id = None
    user_name = None
    user_email = None
    try:
        u = await get_current_user(request)
        if u and not u.get("guest"):
            user_id = u.get("user_id") or u.get("email")
            user_name = u.get("name")
            user_email = u.get("email")
    except Exception:
        pass

    if order.get("user_id"):
        if not user_id or order["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Please log in to review this order")
    else:
        supplied = (body.contact_email or user_email or "").lower().strip()
        if not supplied or supplied != (order.get("contact_email") or "").lower():
            raise HTTPException(status_code=403, detail="Email verification required")
        user_email = supplied

    existing = await db.reviews.find_one({"order_id": body.order_id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=409, detail="You've already reviewed this order")

    cfg = await _get_config()
    initial_status = "approved" if cfg["auto_approve"] else "pending"
    now_iso = datetime.now(timezone.utc).isoformat()

    # Resolve photos → embedded {id,url}
    photos_embedded: List[dict] = []
    if body.photos and cfg["allow_photos"]:
        for fid in body.photos[:5]:
            rec = await db.uploads.find_one({"id": fid, "is_deleted": {"$ne": True}, "purpose": "review_photo"}, {"_id": 0})
            if rec:
                photos_embedded.append({"id": rec["id"], "url": f"/api/files/{rec['id']}"})

    anonymous = bool(body.anonymous) and cfg["allow_anonymous"]
    display_name = "Anonymous" if anonymous else (user_name or (user_email or "").split("@")[0] or "Customer")

    # Overall review
    overall = {
        "id": f"rev_{uuid.uuid4().hex[:10]}",
        "order_id": body.order_id,
        "order_number": order.get("order_number"),
        "item_id": None,
        "item_name": None,
        "rating": body.overall_rating,
        "text": (body.overall_text or "").strip()[:2000],
        "photos": photos_embedded,
        "anonymous": anonymous,
        "verified_purchase": True,
        "user_id": user_id,
        "user_name": display_name,
        "user_email": None if anonymous else user_email,
        "status": initial_status,
        "admin_response": None,
        "helpful_count": 0,
        "created_at": now_iso,
        "updated_at": now_iso,
        "is_overall": True,
    }
    docs = [overall]

    # Per-item reviews
    order_item_ids = {it.get("item_id") for it in (order.get("items") or [])}
    item_name_map = {it.get("item_id"): it.get("name") for it in (order.get("items") or [])}
    for ir in (body.item_reviews or []):
        if ir.item_id not in order_item_ids:
            continue
        docs.append({
            "id": f"rev_{uuid.uuid4().hex[:10]}",
            "order_id": body.order_id,
            "order_number": order.get("order_number"),
            "item_id": ir.item_id,
            "item_name": item_name_map.get(ir.item_id),
            "rating": ir.rating,
            "text": (ir.text or "").strip()[:1000],
            "photos": [],
            "anonymous": anonymous,
            "verified_purchase": True,
            "user_id": user_id,
            "user_name": display_name,
            "user_email": None if anonymous else user_email,
            "status": initial_status,
            "admin_response": None,
            "helpful_count": 0,
            "created_at": now_iso,
            "updated_at": now_iso,
            "is_overall": False,
        })

    await db.reviews.insert_many([dict(d) for d in docs])
    logger.info(f"Review submitted for order {order.get('order_number')} — {len(docs)} documents, status={initial_status}")

    # Update menu_items summary for each item reviewed (if approved)
    if initial_status == "approved":
        for d in docs:
            if d.get("item_id"):
                await _recompute_item_summary(d["item_id"])

    return {"submitted": True, "count": len(docs), "status": initial_status, "overall_id": overall["id"]}


# ─── Public display ─────────────────────────────────────────────

@api_router.get("/menu/items/{item_id}/reviews/summary")
async def item_review_summary(item_id: str):
    item = await db.menu_items.find_one({"id": item_id}, {"_id": 0, "rating_avg": 1, "rating_count": 1, "rating_distribution": 1})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return {
        "item_id": item_id,
        "rating_avg": item.get("rating_avg", 0.0),
        "rating_count": item.get("rating_count", 0),
        "distribution": item.get("rating_distribution") or {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0},
    }


@api_router.get("/menu/items/{item_id}/reviews")
async def item_reviews(
    item_id: str,
    rating: Optional[int] = Query(None, ge=1, le=5),
    sort: str = Query("recent", pattern="^(recent|helpful|highest|lowest)$"),
    limit: int = Query(20, ge=1, le=100),
):
    query: Dict[str, Any] = {"item_id": item_id, "status": "approved"}
    if rating:
        query["rating"] = rating
    sort_spec = {"recent": [("created_at", -1)], "helpful": [("helpful_count", -1), ("created_at", -1)],
                 "highest": [("rating", -1), ("created_at", -1)], "lowest": [("rating", 1), ("created_at", -1)]}[sort]

    cursor = db.reviews.find(query, {"_id": 0, "user_email": 0}).sort(sort_spec).limit(limit)
    reviews = await cursor.to_list(limit)
    return {"reviews": reviews, "count": len(reviews)}


@api_router.get("/reviews/summary-bulk")
async def bulk_summary(item_ids: str):
    """Return aggregate ratings for a comma-separated list of item_ids (used on menu card badges)."""
    ids = [x.strip() for x in (item_ids or "").split(",") if x.strip()]
    if not ids:
        return {"summaries": {}}
    out: Dict[str, Any] = {}
    async for it in db.menu_items.find({"id": {"$in": ids}}, {"_id": 0, "id": 1, "rating_avg": 1, "rating_count": 1}):
        out[it["id"]] = {
            "rating_avg": it.get("rating_avg", 0.0),
            "rating_count": it.get("rating_count", 0),
        }
    return {"summaries": out}


@api_router.post("/reviews/{review_id}/helpful")
async def mark_helpful(review_id: str):
    r = await db.reviews.update_one({"id": review_id, "status": "approved"}, {"$inc": {"helpful_count": 1}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Review not found")
    doc = await db.reviews.find_one({"id": review_id}, {"_id": 0, "user_email": 0})
    return {"review": doc}


# ─── Admin moderation ───────────────────────────────────────────

@api_router.get("/admin/reviews")
async def admin_list_reviews(
    request: Request,
    status: str = Query("all", pattern="^(all|pending|approved|flagged|rejected|attention)$"),
    rating: Optional[int] = Query(None, ge=1, le=5),
    limit: int = Query(100, ge=1, le=500),
):
    await require_admin(request)
    query: Dict[str, Any] = {}
    if status == "attention":
        query["rating"] = {"$lte": 2}
        query["status"] = "approved"
        query["admin_response"] = None
    elif status != "all":
        query["status"] = status
    if rating:
        query["rating"] = rating
    cursor = db.reviews.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    reviews = await cursor.to_list(limit)

    counts = {}
    for st in ("pending", "approved", "flagged", "rejected"):
        counts[st] = await db.reviews.count_documents({"status": st})
    counts["attention"] = await db.reviews.count_documents({"rating": {"$lte": 2}, "status": "approved", "admin_response": None})
    return {"reviews": reviews, "counts": counts, "count": len(reviews)}


@api_router.post("/admin/reviews/{review_id}/approve")
async def admin_approve(review_id: str, request: Request):
    await require_admin(request)
    doc = await db.reviews.find_one({"id": review_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Review not found")
    await db.reviews.update_one({"id": review_id}, {"$set": {"status": "approved", "updated_at": datetime.now(timezone.utc).isoformat()}})
    if doc.get("item_id"):
        await _recompute_item_summary(doc["item_id"])
    return {"approved": True}


class FlagIn(BaseModel):
    reason: Optional[str] = ""


@api_router.post("/admin/reviews/{review_id}/flag")
async def admin_flag(review_id: str, body: FlagIn, request: Request):
    await require_admin(request)
    doc = await db.reviews.find_one({"id": review_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Review not found")
    await db.reviews.update_one({"id": review_id}, {"$set": {
        "status": "flagged",
        "flag_reason": (body.reason or "").strip()[:240],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }})
    if doc.get("item_id"):
        await _recompute_item_summary(doc["item_id"])
    return {"flagged": True}


class RespondIn(BaseModel):
    text: str = Field(min_length=1, max_length=1200)


@api_router.post("/admin/reviews/{review_id}/respond")
async def admin_respond(review_id: str, body: RespondIn, request: Request):
    admin = await require_admin(request)
    now_iso = datetime.now(timezone.utc).isoformat()
    response = {
        "text": body.text.strip(),
        "responded_by": admin.get("name") or admin.get("email") or "Manager",
        "responded_at": now_iso,
    }
    r = await db.reviews.update_one(
        {"id": review_id},
        {"$set": {"admin_response": response, "updated_at": now_iso}},
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Review not found")
    return {"responded": True, "admin_response": response}


@api_router.delete("/admin/reviews/{review_id}/response")
async def admin_delete_response(review_id: str, request: Request):
    await require_admin(request)
    r = await db.reviews.update_one(
        {"id": review_id},
        {"$set": {"admin_response": None, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Review not found")
    return {"removed": True}


@api_router.delete("/admin/reviews/{review_id}")
async def admin_delete_review(review_id: str, request: Request):
    await require_admin(request)
    doc = await db.reviews.find_one({"id": review_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Review not found")
    await db.reviews.delete_one({"id": review_id})
    if doc.get("item_id"):
        await _recompute_item_summary(doc["item_id"])
    return {"deleted": True}


# ─── Admin insights / aggregate sentiment ───────────────────────

@api_router.get("/admin/reviews/aggregate")
async def admin_aggregate(request: Request, days: int = Query(30, ge=7, le=365)):
    await require_admin(request)
    since = datetime.now(timezone.utc) - timedelta(days=days)
    since_iso = since.isoformat()

    # Distribution over all approved reviews (item-level + overall)
    dist = {str(i): 0 for i in range(1, 6)}
    total_approved = 0
    total_all = 0
    total_rating_sum = 0.0
    total_responded = 0
    response_eligible = 0
    attention = 0

    async for r in db.reviews.find({}, {"_id": 0}):
        total_all += 1
        st = r.get("status")
        if st == "approved":
            total_approved += 1
            total_rating_sum += float(r.get("rating", 0))
            dist[str(r.get("rating"))] = dist.get(str(r.get("rating")), 0) + 1
            if r.get("rating", 5) <= 2:
                response_eligible += 1
                if r.get("admin_response"):
                    total_responded += 1
                else:
                    attention += 1

    avg = round(total_rating_sum / total_approved, 2) if total_approved else 0.0

    # Trend: group by day
    pipeline = [
        {"$match": {"status": "approved", "created_at": {"$gte": since_iso}}},
        {"$project": {
            "_id": 0,
            "rating": 1,
            "day": {"$substr": ["$created_at", 0, 10]},
        }},
        {"$group": {
            "_id": "$day",
            "count": {"$sum": 1},
            "avg": {"$avg": "$rating"},
        }},
        {"$sort": {"_id": 1}},
    ]
    trend = []
    async for row in db.reviews.aggregate(pipeline):
        trend.append({"day": row["_id"], "count": row["count"], "avg": round(float(row["avg"] or 0), 2)})

    response_rate = round((total_responded / response_eligible) * 100, 1) if response_eligible else 0.0

    return {
        "total_reviews": total_all,
        "approved": total_approved,
        "average_rating": avg,
        "distribution": dist,
        "trend": trend,
        "response_rate": response_rate,
        "attention_count": attention,
        "since": since_iso,
    }


@api_router.get("/admin/reviews/attention")
async def admin_attention_queue(request: Request, limit: int = Query(50, ge=1, le=200)):
    await require_admin(request)
    cursor = db.reviews.find(
        {"status": "approved", "rating": {"$lte": 2}, "admin_response": None},
        {"_id": 0},
    ).sort("created_at", -1).limit(limit)
    return {"reviews": await cursor.to_list(limit)}
