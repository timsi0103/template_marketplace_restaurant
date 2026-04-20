"""Store hours, holidays, special hours, pause ordering, and the public /store/status endpoint."""
from fastapi import HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
import uuid

from core import api_router, db, require_admin
from models import HolidayCreate


DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def _get_day_name():
    return DAYS[datetime.now(timezone.utc).weekday()]


def _time_to_minutes(t: str) -> int:
    parts = t.split(":")
    return int(parts[0]) * 60 + int(parts[1])


def _minutes_to_display(m: int) -> str:
    h = m // 60
    mi = m % 60
    ampm = "AM" if h < 12 else "PM"
    h12 = h % 12 or 12
    return f"{h12}:{mi:02d} {ampm}" if mi else f"{h12} {ampm}"


class PauseRequest(BaseModel):
    reason: Optional[str] = ""
    estimated_reopen: Optional[str] = None  # ISO datetime
    paused: Optional[bool] = None  # Optional explicit flag (toggles when omitted)


class SpecialHoursCreate(BaseModel):
    date: str                         # YYYY-MM-DD
    label: Optional[str] = ""        # e.g. "New Year's Eve"
    hours: Dict[str, Any]             # {delivery:{...}, pickup:{...}, dine_in:{...}}


class AdvanceOrderConfigPatch(BaseModel):
    accept_advance_orders: Optional[bool] = None
    max_days_ahead: Optional[int] = None



@api_router.get("/store/status")
async def get_store_status():
    settings = await db.store_settings.find_one({"type": "hours"}, {"_id": 0})
    if not settings:
        settings = {"hours": {}, "pause_ordering": False}
    hours = settings.get("hours", {})
    pause = settings.get("pause_ordering", False)
    pause_reason = settings.get("pause_reason", "") if pause else ""
    pause_until = settings.get("pause_until") if pause else None
    accept_advance = bool(settings.get("accept_advance_orders", True))
    max_days_ahead = int(settings.get("max_days_ahead", 7))

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    holidays = await db.store_holidays.find({}, {"_id": 0}).to_list(100)
    active_holiday = None
    upcoming_holidays = []
    for h in holidays:
        if h.get("date") == today_str:
            active_holiday = h
        elif h.get("date", "") > today_str:
            upcoming_holidays.append(h)
    upcoming_holidays.sort(key=lambda x: x.get("date", ""))

    # Special hours lookup (takes precedence over weekly schedule but not over holidays/pause)
    special_today = await db.store_special_hours.find_one({"date": today_str}, {"_id": 0})

    now = datetime.now(timezone.utc)
    day_name = _get_day_name()
    day_hours = (special_today.get("hours") if special_today else None) or hours.get(day_name, {})
    delivery_h = day_hours.get("delivery", {"open_time": "10:00", "close_time": "22:00", "closed": False})
    current_minutes = now.hour * 60 + now.minute

    is_open = False
    close_time_display = ""
    next_open = ""

    if pause:
        is_open = False
    elif active_holiday and active_holiday.get("all_day", True):
        is_open = False
    elif delivery_h.get("closed"):
        is_open = False
    else:
        open_m = _time_to_minutes(delivery_h.get("open_time", "10:00"))
        close_m = _time_to_minutes(delivery_h.get("close_time", "22:00"))
        if close_m <= open_m:
            if current_minutes >= open_m or current_minutes < close_m:
                is_open = True
                close_time_display = _minutes_to_display(close_m)
        else:
            if open_m <= current_minutes < close_m:
                is_open = True
                close_time_display = _minutes_to_display(close_m)

    if not is_open:
        for offset in range(7):
            check_day = DAYS[(now.weekday() + offset) % 7]
            check_date = (now + timedelta(days=offset)).strftime("%Y-%m-%d")
            # Holiday check for that date
            is_holiday = any(h.get("date") == check_date and h.get("all_day", True) for h in holidays)
            if is_holiday:
                continue
            sp = next((s for s in await db.store_special_hours.find({"date": check_date}, {"_id": 0}).to_list(1) or []), None)
            dh = (sp.get("hours") if sp else None) or hours.get(check_day, {})
            dh = dh.get("delivery", {"open_time": "10:00", "close_time": "22:00", "closed": False})
            if dh.get("closed"):
                continue
            open_m = _time_to_minutes(dh.get("open_time", "10:00"))
            if offset == 0 and current_minutes < open_m:
                next_open = f"today at {_minutes_to_display(open_m)}"
                break
            elif offset > 0:
                day_label = check_day.capitalize()
                next_open = f"{day_label} at {_minutes_to_display(open_m)}"
                break

    service_status = {}
    for svc in ["delivery", "pickup", "dine_in"]:
        sh = day_hours.get(svc, {"open_time": "10:00", "close_time": "22:00", "closed": False})
        if sh.get("closed") or pause or (active_holiday and active_holiday.get("all_day")):
            service_status[svc] = {"available": False, "hours": "Closed"}
        else:
            om = _time_to_minutes(sh.get("open_time", "10:00"))
            cm = _time_to_minutes(sh.get("close_time", "22:00"))
            if cm <= om:
                available = current_minutes >= om or current_minutes < cm
            else:
                available = om <= current_minutes < cm
            service_status[svc] = {
                "available": available,
                "hours": f"{_minutes_to_display(om)} - {_minutes_to_display(cm)}",
            }

    result = {
        "is_open": is_open, "pause_ordering": pause,
        "pause_reason": pause_reason, "pause_until": pause_until,
        "close_time": close_time_display, "next_open": next_open,
        "active_holiday": active_holiday, "upcoming_holidays": upcoming_holidays[:3],
        "special_today": special_today, "services": service_status, "day": day_name,
        "accept_advance_orders": accept_advance, "max_days_ahead": max_days_ahead,
    }
    await _maybe_trigger_auto_restore(is_open)
    return result


async def _maybe_trigger_auto_restore(is_open_now: bool):
    try:
        from routes.eightysix import maybe_auto_restore
        await maybe_auto_restore(is_open_now)
    except Exception:
        pass


@api_router.get("/admin/store/hours")
async def get_store_hours(request: Request):
    await require_admin(request)
    settings = await db.store_settings.find_one({"type": "hours"}, {"_id": 0})
    if not settings:
        return {"hours": {}, "pause_ordering": False}
    return {"hours": settings.get("hours", {}), "pause_ordering": settings.get("pause_ordering", False)}


@api_router.put("/admin/store/hours")
async def update_store_hours(request: Request):
    await require_admin(request)
    body = await request.json()
    hours = body.get("hours", {})
    await db.store_settings.update_one(
        {"type": "hours"},
        {"$set": {"hours": hours, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    settings = await db.store_settings.find_one({"type": "hours"}, {"_id": 0})
    return {"hours": settings.get("hours", {}), "pause_ordering": settings.get("pause_ordering", False)}


@api_router.post("/admin/store/pause")
async def toggle_pause_ordering(body: PauseRequest, request: Request):
    await require_admin(request)
    settings = await db.store_settings.find_one({"type": "hours"}, {"_id": 0})
    current = settings.get("pause_ordering", False) if settings else False
    new_state = body.paused if body.paused is not None else (not current)
    set_doc: Dict[str, Any] = {
        "pause_ordering": new_state,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if new_state:
        set_doc["pause_reason"] = (body.reason or "").strip()
        set_doc["pause_until"] = body.estimated_reopen
        set_doc["paused_at"] = datetime.now(timezone.utc).isoformat()
    else:
        set_doc["pause_reason"] = ""
        set_doc["pause_until"] = None
    await db.store_settings.update_one({"type": "hours"}, {"$set": set_doc}, upsert=True)
    return {
        "pause_ordering": new_state,
        "pause_reason": set_doc.get("pause_reason", ""),
        "pause_until": set_doc.get("pause_until"),
    }


@api_router.get("/admin/store/holidays")
async def get_holidays(request: Request):
    await require_admin(request)
    holidays = await db.store_holidays.find({}, {"_id": 0}).sort("date", 1).to_list(200)
    return {"holidays": holidays}


@api_router.post("/admin/store/holidays")
async def create_holiday(body: HolidayCreate, request: Request):
    await require_admin(request)
    hol_id = f"hol_{uuid.uuid4().hex[:8]}"
    doc = {
        "id": hol_id, "date": body.date, "reason": body.reason,
        "all_day": body.all_day, "message": (body.message or "").strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.store_holidays.insert_one(doc)
    return await db.store_holidays.find_one({"id": hol_id}, {"_id": 0})


@api_router.delete("/admin/store/holidays/{hol_id}")
async def delete_holiday(hol_id: str, request: Request):
    await require_admin(request)
    result = await db.store_holidays.delete_one({"id": hol_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Holiday not found")
    return {"message": "Holiday deleted"}


# ─── Special (extended / override) hours ──────────────

@api_router.get("/admin/store/special-hours")
async def list_special_hours(request: Request):
    await require_admin(request)
    docs = await db.store_special_hours.find({}, {"_id": 0}).sort("date", 1).to_list(500)
    return {"special_hours": docs}


@api_router.post("/admin/store/special-hours")
async def create_special_hours(body: SpecialHoursCreate, request: Request):
    await require_admin(request)
    sid = f"sp_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": sid,
        "date": body.date,
        "label": body.label or "",
        "hours": body.hours or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    # Replace any existing override for that date
    await db.store_special_hours.delete_many({"date": body.date})
    await db.store_special_hours.insert_one(dict(doc))
    return doc


@api_router.delete("/admin/store/special-hours/{sid}")
async def delete_special_hours(sid: str, request: Request):
    await require_admin(request)
    r = await db.store_special_hours.delete_one({"id": sid})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Special hours not found")
    return {"deleted": True}


# ─── Advance-order toggle ─────────────────────────────

@api_router.get("/admin/store/advance-orders")
async def get_advance_orders(request: Request):
    await require_admin(request)
    settings = await db.store_settings.find_one({"type": "hours"}, {"_id": 0}) or {}
    return {
        "accept_advance_orders": bool(settings.get("accept_advance_orders", True)),
        "max_days_ahead": int(settings.get("max_days_ahead", 7)),
    }


@api_router.patch("/admin/store/advance-orders")
async def patch_advance_orders(body: AdvanceOrderConfigPatch, request: Request):
    await require_admin(request)
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise HTTPException(status_code=400, detail="No changes")
    if "max_days_ahead" in patch:
        patch["max_days_ahead"] = max(1, min(30, int(patch["max_days_ahead"])))
    await db.store_settings.update_one({"type": "hours"}, {"$set": patch}, upsert=True)
    return await get_advance_orders(request)  # type: ignore[func-returns-value]


# ─── 7-day operational overview + conflict detection ──

def _interval_covers(outer: dict, inner: dict) -> bool:
    """True if outer time-window fully covers inner. Both are {open_time, close_time, closed?}.
    Treats 'close <= open' as an overnight window ending next day."""
    if outer.get("closed") and not inner.get("closed"):
        return False
    if inner.get("closed"):
        return True
    o_o = _time_to_minutes(outer.get("open_time", "00:00"))
    o_c = _time_to_minutes(outer.get("close_time", "23:59"))
    i_o = _time_to_minutes(inner.get("open_time", "00:00"))
    i_c = _time_to_minutes(inner.get("close_time", "23:59"))
    # Convert overnight windows to absolute minutes across 48h
    if o_c <= o_o:
        o_c += 24 * 60
    if i_c <= i_o:
        i_c += 24 * 60
    return o_o <= i_o and i_c <= o_c


@api_router.get("/admin/store/overview")
async def hours_overview(request: Request):
    """Returns the next 7 days with effective hours for each service, marking holidays,
    special-hour overrides, and conflicts (delivery extending beyond kitchen/pickup hours)."""
    await require_admin(request)
    settings = await db.store_settings.find_one({"type": "hours"}, {"_id": 0}) or {}
    hours = settings.get("hours", {})
    now = datetime.now(timezone.utc)
    # Prefetch
    holidays = {h["date"]: h for h in await db.store_holidays.find({}, {"_id": 0}).to_list(500)}
    special_cursor = db.store_special_hours.find({}, {"_id": 0})
    specials: Dict[str, dict] = {}
    async for s in special_cursor:
        specials[s["date"]] = s
    days_out = []
    for offset in range(7):
        d = now + timedelta(days=offset)
        date_str = d.strftime("%Y-%m-%d")
        dow = DAYS[d.weekday()]
        is_holiday = holidays.get(date_str)
        special = specials.get(date_str)
        base = (special.get("hours") if special else None) or hours.get(dow, {})
        services = {}
        conflicts: list[dict] = []
        for svc in ["delivery", "pickup", "dine_in"]:
            sv = base.get(svc) or {"open_time": "10:00", "close_time": "22:00", "closed": False}
            services[svc] = sv
        # Conflict detection: delivery must fit inside pickup/dine_in hours (kitchen must be on for prep)
        pickup_or_dine = base.get("pickup") or base.get("dine_in") or {}
        if services["delivery"] and pickup_or_dine and not services["delivery"].get("closed"):
            kitchen = base.get("pickup") or base.get("dine_in") or services["delivery"]
            if kitchen and not _interval_covers(kitchen, services["delivery"]):
                conflicts.append({
                    "service": "delivery",
                    "message": "Delivery hours extend beyond kitchen (pickup/dine-in) hours. Orders may arrive without a kitchen open to prep them.",
                })
        days_out.append({
            "date": date_str,
            "day_name": dow,
            "is_today": offset == 0,
            "holiday": is_holiday,
            "special": special,
            "services": services,
            "conflicts": conflicts,
        })
    return {"days": days_out}
