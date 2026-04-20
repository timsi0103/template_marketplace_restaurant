"""Staff accounts, roles, permissions, invitations, activity log.

6 pre-defined roles seeded on first request:
  Owner, Manager, Kitchen Staff, Delivery Staff, Front-of-House, Cashier.

Enforcement is **UI-level** in this phase — backend admin endpoints still use
`require_admin`. The `permissions` dict on each role is the source of truth for
the frontend permission matrix and staff profile views.

Invitations are **MOCKED email**: the invite link is logged + returned so the
admin can copy it; acceptance is a real public endpoint.

Activity log aggregates from existing `order_audit`, `eightysix_log`,
`print_jobs`, `refunds` plus a new appender `staff_activity` for future writes.
"""
from fastapi import HTTPException, Request, Query
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Literal
from datetime import datetime, timezone, timedelta
import uuid
import secrets

from core import api_router, db, require_admin, logger, hash_password


# ─── Feature areas + permission schema ───────────────────────

FEATURE_AREAS = [
    {"key": "orders", "label": "Orders & Queue"},
    {"key": "kds", "label": "Kitchen Display"},
    {"key": "menu", "label": "Menu & Catalog"},
    {"key": "analytics", "label": "Analytics & Reports"},
    {"key": "finance", "label": "Refunds & Finance"},
    {"key": "staff", "label": "Staff & Roles"},
    {"key": "settings", "label": "Store Settings"},
    {"key": "deliveries", "label": "Deliveries"},
]

ACTIONS = ["view", "edit", "approve"]  # approve covers sensitive ops (refunds, cancellations)


def _full_perms() -> Dict[str, Dict[str, bool]]:
    return {a["key"]: {action: True for action in ACTIONS} for a in FEATURE_AREAS}


def _empty_perms() -> Dict[str, Dict[str, bool]]:
    return {a["key"]: {action: False for action in ACTIONS} for a in FEATURE_AREAS}


def _build_perms(allow: Dict[str, List[str]]) -> Dict[str, Dict[str, bool]]:
    base = _empty_perms()
    for area, actions in allow.items():
        if area in base:
            for a in actions:
                if a in ACTIONS:
                    base[area][a] = True
    return base


SEED_ROLES = [
    {
        "id": "role_owner", "slug": "owner", "name": "Owner",
        "description": "Full access to everything, including billing and deleting staff.",
        "pre_defined": True, "sort_order": 0,
        "permissions": _full_perms(),
    },
    {
        "id": "role_manager", "slug": "manager", "name": "Manager",
        "description": "Runs day-to-day operations: orders, menu, reports, staff.",
        "pre_defined": True, "sort_order": 1,
        "permissions": _build_perms({
            "orders": ["view", "edit", "approve"],
            "kds": ["view", "edit"],
            "menu": ["view", "edit"],
            "analytics": ["view"],
            "finance": ["view", "approve"],
            "staff": ["view", "edit"],
            "settings": ["view"],
            "deliveries": ["view", "edit"],
        }),
    },
    {
        "id": "role_kitchen", "slug": "kitchen", "name": "Kitchen Staff",
        "description": "Kitchen Display System only — bump, start, and mark ready.",
        "pre_defined": True, "sort_order": 2,
        "permissions": _build_perms({"kds": ["view", "edit"], "orders": ["view"]}),
    },
    {
        "id": "role_delivery", "slug": "delivery", "name": "Delivery Staff",
        "description": "View assigned deliveries and mark them as delivered.",
        "pre_defined": True, "sort_order": 3,
        "permissions": _build_perms({"deliveries": ["view", "edit"], "orders": ["view"]}),
    },
    {
        "id": "role_foh", "slug": "foh", "name": "Front-of-House",
        "description": "Reservations, dine-in tables, and seating.",
        "pre_defined": True, "sort_order": 4,
        "permissions": _build_perms({"orders": ["view", "edit"], "settings": ["view"]}),
    },
    {
        "id": "role_cashier", "slug": "cashier", "name": "Cashier",
        "description": "Point of sale and low-value refunds up to a daily limit.",
        "pre_defined": True, "sort_order": 5,
        "permissions": _build_perms({"orders": ["view", "edit"], "finance": ["view"]}),
    },
]


async def _ensure_seeded():
    for r in SEED_ROLES:
        existing = await db.roles.find_one({"slug": r["slug"]}, {"_id": 0})
        if not existing:
            doc = dict(r)
            doc["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.roles.insert_one(doc)


# ─── Roles ───────────────────────────────────────────────────

@api_router.get("/admin/roles")
async def list_roles(request: Request):
    await require_admin(request)
    await _ensure_seeded()
    roles = await db.roles.find({}, {"_id": 0}).sort("sort_order", 1).to_list(100)
    # Staff counts per role
    counts: Dict[str, int] = {}
    async for u in db.users.find({"role_id": {"$exists": True}}, {"_id": 0, "role_id": 1}):
        counts[u["role_id"]] = counts.get(u["role_id"], 0) + 1
    for r in roles:
        r["staff_count"] = counts.get(r["id"], 0)
    return {"roles": roles, "feature_areas": FEATURE_AREAS, "actions": ACTIONS}


class RoleIn(BaseModel):
    name: str
    description: Optional[str] = ""
    permissions: Optional[Dict[str, Dict[str, bool]]] = None


class RolePatch(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[Dict[str, Dict[str, bool]]] = None


@api_router.post("/admin/roles")
async def create_role(body: RoleIn, request: Request):
    await require_admin(request)
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    slug = "custom_" + "".join(c.lower() if c.isalnum() else "_" for c in name)[:24]
    # Ensure unique
    if await db.roles.find_one({"slug": slug}, {"_id": 0}):
        slug = f"{slug}_{uuid.uuid4().hex[:4]}"
    role = {
        "id": f"role_{uuid.uuid4().hex[:10]}",
        "slug": slug,
        "name": name,
        "description": (body.description or "").strip()[:240],
        "pre_defined": False,
        "sort_order": 100,
        "permissions": body.permissions or _empty_perms(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.roles.insert_one(dict(role))
    return role


@api_router.patch("/admin/roles/{role_id}")
async def update_role(role_id: str, body: RolePatch, request: Request):
    await require_admin(request)
    role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.get("pre_defined"):
        raise HTTPException(status_code=403, detail="Pre-defined roles cannot be edited. Create a custom role instead.")
    patch = {}
    if body.name:
        patch["name"] = body.name.strip()
    if body.description is not None:
        patch["description"] = body.description.strip()[:240]
    if body.permissions is not None:
        patch["permissions"] = body.permissions
    if not patch:
        raise HTTPException(status_code=400, detail="No changes")
    patch["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.roles.update_one({"id": role_id}, {"$set": patch})
    return await db.roles.find_one({"id": role_id}, {"_id": 0})


@api_router.delete("/admin/roles/{role_id}")
async def delete_role(role_id: str, request: Request):
    await require_admin(request)
    role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.get("pre_defined"):
        raise HTTPException(status_code=403, detail="Pre-defined roles cannot be deleted")
    in_use = await db.users.count_documents({"role_id": role_id})
    if in_use > 0:
        raise HTTPException(status_code=409, detail=f"Role is assigned to {in_use} staff — reassign first")
    await db.roles.delete_one({"id": role_id})
    return {"deleted": True}


# ─── Staff ────────────────────────────────────────────────────

@api_router.get("/admin/staff")
async def list_staff(request: Request):
    await require_admin(request)
    await _ensure_seeded()
    roles = {r["id"]: r async for r in db.roles.find({}, {"_id": 0})}  # type: ignore
    staff = []
    async for u in db.users.find({"is_staff": True}, {"_id": 0, "password_hash": 0}).sort("created_at", -1):
        r = roles.get(u.get("role_id"))
        staff.append({
            **u,
            "role_name": r["name"] if r else "—",
            "role_slug": r["slug"] if r else None,
        })
    # Pending invites
    invites = []
    async for i in db.staff_invites.find({"accepted_at": None, "revoked_at": None}, {"_id": 0}).sort("created_at", -1):
        r = roles.get(i.get("role_id"))
        i["role_name"] = r["name"] if r else "—"
        invites.append(i)
    return {"staff": staff, "invites": invites}


class StaffUpdate(BaseModel):
    name: Optional[str] = None
    role_id: Optional[str] = None
    is_active: Optional[bool] = None
    phone: Optional[str] = None


@api_router.get("/admin/staff/{user_id}")
async def get_staff(user_id: str, request: Request):
    await require_admin(request)
    user = await db.users.find_one({"user_id": user_id, "is_staff": True}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Staff not found")
    role = await db.roles.find_one({"id": user.get("role_id")}, {"_id": 0}) if user.get("role_id") else None
    # Activity summary counts
    orders_accepted = await db.order_audit.count_documents({"actor_id": user_id, "action": {"$in": ["admin_cancel", "admin_modify"]}})
    eightysix = await db.eightysix_log.count_documents({"actor_id": user_id}) if "eightysix_log" in await db.list_collection_names() else 0
    summary = {
        "orders_actions": orders_accepted,
        "eightysix_actions": eightysix,
    }
    user["role"] = role
    user["activity_summary"] = summary
    return user


@api_router.patch("/admin/staff/{user_id}")
async def update_staff(user_id: str, body: StaffUpdate, request: Request):
    await require_admin(request)
    user = await db.users.find_one({"user_id": user_id, "is_staff": True}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Staff not found")
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise HTTPException(status_code=400, detail="No changes")
    if "role_id" in patch:
        role = await db.roles.find_one({"id": patch["role_id"]}, {"_id": 0})
        if not role:
            raise HTTPException(status_code=400, detail="Invalid role_id")
        patch["role"] = role["slug"]  # keep legacy `role` field in sync
    patch["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"user_id": user_id}, {"$set": patch})
    return await get_staff(user_id, request)


@api_router.post("/admin/staff/{user_id}/deactivate")
async def deactivate_staff(user_id: str, request: Request):
    admin = await require_admin(request)
    if admin.get("user_id") == user_id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    r = await db.users.update_one({"user_id": user_id, "is_staff": True}, {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Staff not found")
    return {"deactivated": True}


@api_router.post("/admin/staff/{user_id}/reactivate")
async def reactivate_staff(user_id: str, request: Request):
    await require_admin(request)
    r = await db.users.update_one({"user_id": user_id, "is_staff": True}, {"$set": {"is_active": True, "updated_at": datetime.now(timezone.utc).isoformat()}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Staff not found")
    return {"reactivated": True}


# ─── Invitations (MOCKED email) ──────────────────────────────

class InviteIn(BaseModel):
    email: EmailStr
    role_id: str
    name: Optional[str] = ""


@api_router.post("/admin/staff/invite")
async def invite_staff(body: InviteIn, request: Request):
    admin = await require_admin(request)
    await _ensure_seeded()
    role = await db.roles.find_one({"id": body.role_id}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=400, detail="Invalid role")
    email = body.email.lower().strip()
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    if existing_user and existing_user.get("is_staff"):
        raise HTTPException(status_code=409, detail="This email is already a staff member")
    pending = await db.staff_invites.find_one({"email": email, "accepted_at": None, "revoked_at": None}, {"_id": 0})
    if pending:
        raise HTTPException(status_code=409, detail="An invite is already pending for this email")

    token = secrets.token_urlsafe(24)
    origin = request.headers.get("origin") or str(request.base_url).rstrip("/")
    invite = {
        "id": f"inv_{uuid.uuid4().hex[:10]}",
        "token": token,
        "email": email,
        "name": (body.name or "").strip(),
        "role_id": body.role_id,
        "role_name": role["name"],
        "invited_by": admin.get("email"),
        "accept_url": f"{origin}/accept-invite/{token}",
        "accepted_at": None,
        "revoked_at": None,
        "mocked_email": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
    }
    await db.staff_invites.insert_one(dict(invite))
    logger.info(f"[staff-invite MOCKED email] → {email} ({role['name']}): {invite['accept_url']}")
    return invite


@api_router.post("/admin/staff/invites/{invite_id}/revoke")
async def revoke_invite(invite_id: str, request: Request):
    await require_admin(request)
    r = await db.staff_invites.update_one(
        {"id": invite_id, "accepted_at": None, "revoked_at": None},
        {"$set": {"revoked_at": datetime.now(timezone.utc).isoformat()}},
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Active invite not found")
    return {"revoked": True}


@api_router.get("/invitations/{token}")
async def view_invitation(token: str):
    inv = await db.staff_invites.find_one({"token": token}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if inv.get("accepted_at"):
        return {"status": "accepted", "email": inv["email"], "role_name": inv.get("role_name", "")}
    if inv.get("revoked_at"):
        return {"status": "revoked"}
    if datetime.now(timezone.utc) > datetime.fromisoformat(inv["expires_at"]):
        return {"status": "expired"}
    return {"status": "pending", "email": inv["email"], "name": inv.get("name", ""), "role_name": inv.get("role_name", "")}


class AcceptInvite(BaseModel):
    password: str = Field(min_length=6)
    name: Optional[str] = ""


@api_router.post("/invitations/{token}/accept")
async def accept_invitation(token: str, body: AcceptInvite):
    inv = await db.staff_invites.find_one({"token": token, "accepted_at": None, "revoked_at": None}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found or already used")
    if datetime.now(timezone.utc) > datetime.fromisoformat(inv["expires_at"]):
        raise HTTPException(status_code=410, detail="Invitation expired")

    role = await db.roles.find_one({"id": inv["role_id"]}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=500, detail="Role disappeared")

    existing = await db.users.find_one({"email": inv["email"]}, {"_id": 0})
    now_iso = datetime.now(timezone.utc).isoformat()
    if existing:
        await db.users.update_one({"user_id": existing["user_id"]}, {"$set": {
            "is_staff": True, "is_active": True, "role": role["slug"], "role_id": role["id"],
            "password_hash": hash_password(body.password),
            "name": (body.name or existing.get("name") or inv.get("name") or "").strip() or existing.get("name", ""),
            "updated_at": now_iso,
        }})
        user_id = existing["user_id"]
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": inv["email"],
            "name": (body.name or inv.get("name") or inv["email"].split("@")[0]).strip(),
            "password_hash": hash_password(body.password),
            "role": role["slug"], "role_id": role["id"],
            "is_staff": True, "is_active": True,
            "picture": "", "auth_provider": "email",
            "created_at": now_iso,
        })
    await db.staff_invites.update_one({"id": inv["id"]}, {"$set": {"accepted_at": now_iso, "accepted_user_id": user_id}})
    return {"accepted": True, "email": inv["email"]}


# ─── Staff activity log ─────────────────────────────────────

async def append_staff_activity(*, actor_id: str, actor_name: str, area: str, action: str, subject: str = "", meta: Optional[dict] = None):
    """Helper for future feature writes. Not currently wired from existing routes
    to keep this phase low-risk; instead the GET aggregates existing sources."""
    doc = {
        "id": f"act_{uuid.uuid4().hex[:10]}",
        "actor_id": actor_id, "actor_name": actor_name,
        "area": area, "action": action, "subject": subject,
        "meta": meta or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.staff_activity.insert_one(dict(doc))
    return doc


@api_router.get("/admin/staff/{user_id}/activity")
async def staff_activity(user_id: str, request: Request, limit: int = Query(50, ge=1, le=200)):
    await require_admin(request)
    user = await db.users.find_one({"user_id": user_id, "is_staff": True}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Staff not found")

    actor_keys = {user_id, user.get("email", "")}
    entries: List[dict] = []

    # Source 1: order_audit (captures modify/cancel)
    async for a in db.order_audit.find({"actor_id": {"$in": list(actor_keys)}}, {"_id": 0}).sort("created_at", -1).limit(limit):
        entries.append({
            "id": a.get("id"),
            "when": a.get("created_at"),
            "area": "orders",
            "action": a.get("action"),
            "subject": a.get("order_id"),
            "meta": a.get("changes") or {},
        })

    # Source 2: print_jobs
    try:
        async for p in db.print_jobs.find({"triggered_by": user.get("email")}, {"_id": 0}).sort("created_at", -1).limit(limit):
            entries.append({
                "id": p.get("id"),
                "when": p.get("created_at"),
                "area": "orders",
                "action": f"print_{p.get('type', 'ticket')}",
                "subject": p.get("order_id"),
                "meta": {"printer_id": p.get("printer_id")},
            })
    except Exception:
        pass

    # Source 3: staff_activity
    async for s in db.staff_activity.find({"actor_id": {"$in": list(actor_keys)}}, {"_id": 0}).sort("created_at", -1).limit(limit):
        entries.append({
            "id": s["id"], "when": s["created_at"],
            "area": s["area"], "action": s["action"], "subject": s.get("subject"),
            "meta": s.get("meta") or {},
        })

    entries.sort(key=lambda x: x.get("when") or "", reverse=True)
    return {"entries": entries[:limit], "count": len(entries[:limit])}


# ─── Admin: global activity feed (all staff) ─────────────

@api_router.get("/admin/staff-activity")
async def global_staff_activity(request: Request, limit: int = Query(50, ge=1, le=200)):
    await require_admin(request)
    staff_ids = set()
    async for u in db.users.find({"is_staff": True}, {"_id": 0, "user_id": 1, "email": 1}):
        staff_ids.add(u["user_id"])
        if u.get("email"):
            staff_ids.add(u["email"])
    entries = []
    async for a in db.order_audit.find({"actor_id": {"$in": list(staff_ids)}}, {"_id": 0}).sort("created_at", -1).limit(limit):
        entries.append({"when": a["created_at"], "actor_id": a["actor_id"], "actor_name": a.get("actor_name", ""), "area": "orders", "action": a["action"], "subject": a.get("order_id")})
    entries.sort(key=lambda e: e.get("when") or "", reverse=True)
    return {"entries": entries[:limit]}
