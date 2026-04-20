"""Store hours, holidays, pause ordering, and the public /store/status endpoint."""
from fastapi import HTTPException, Request
from datetime import datetime, timezone
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


@api_router.get("/store/status")
async def get_store_status():
    settings = await db.store_settings.find_one({"type": "hours"}, {"_id": 0})
    if not settings:
        settings = {"hours": {}, "pause_ordering": False}
    hours = settings.get("hours", {})
    pause = settings.get("pause_ordering", False)

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

    now = datetime.now(timezone.utc)
    day_name = _get_day_name()
    day_hours = hours.get(day_name, {})
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
            dh = hours.get(check_day, {}).get("delivery", {"open_time": "10:00", "close_time": "22:00", "closed": False})
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

    return {
        "is_open": is_open, "pause_ordering": pause,
        "close_time": close_time_display, "next_open": next_open,
        "active_holiday": active_holiday, "upcoming_holidays": upcoming_holidays[:3],
        "services": service_status, "day": day_name,
    }


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
async def toggle_pause_ordering(request: Request):
    await require_admin(request)
    settings = await db.store_settings.find_one({"type": "hours"}, {"_id": 0})
    current = settings.get("pause_ordering", False) if settings else False
    await db.store_settings.update_one(
        {"type": "hours"},
        {"$set": {"pause_ordering": not current, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"pause_ordering": not current}


@api_router.get("/admin/store/holidays")
async def get_holidays(request: Request):
    await require_admin(request)
    holidays = await db.store_holidays.find({}, {"_id": 0}).sort("date", 1).to_list(200)
    return {"holidays": holidays}


@api_router.post("/admin/store/holidays")
async def create_holiday(body: HolidayCreate, request: Request):
    await require_admin(request)
    hol_id = f"hol_{uuid.uuid4().hex[:8]}"
    doc = {"id": hol_id, "date": body.date, "reason": body.reason, "all_day": body.all_day, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.store_holidays.insert_one(doc)
    return await db.store_holidays.find_one({"id": hol_id}, {"_id": 0})


@api_router.delete("/admin/store/holidays/{hol_id}")
async def delete_holiday(hol_id: str, request: Request):
    await require_admin(request)
    result = await db.store_holidays.delete_one({"id": hol_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Holiday not found")
    return {"message": "Holiday deleted"}
