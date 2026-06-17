"""Printers + print settings + print jobs + ticket rendering + auto-queue hook."""
from fastapi import HTTPException, Request
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
import uuid
import logging

from core import api_router, db, require_admin
from models import PrinterBody, PrinterPatchBody, PrintSettingsBody, PrintOrderBody


DEFAULT_PRINT_SETTINGS = {
    "key": "print_settings",
    "auto_trigger": "on_acceptance",
    "auto_receipt": True,
    "updated_at": None,
}

PRINTER_MODELS = [
    "epson_tm_t20", "epson_tm_t88", "epson_tm_m30",
    "star_tsp100", "star_tsp650", "star_sm_s230i",
    "generic_80mm", "generic_58mm",
]


async def _get_print_settings() -> dict:
    doc = await db.print_settings.find_one({"key": "print_settings"}, {"_id": 0})
    if not doc:
        doc = dict(DEFAULT_PRINT_SETTINGS)
        doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.print_settings.insert_one(doc)
        doc = await db.print_settings.find_one({"key": "print_settings"}, {"_id": 0})
    return {**DEFAULT_PRINT_SETTINGS, **doc}


def _build_ticket_payload(order: dict, ticket_type: str, printer: Optional[dict] = None) -> dict:
    return {
        "ticket_type": ticket_type,
        "order": order,
        "printer": printer,
        "printed_at": datetime.now(timezone.utc).isoformat(),
        "brand": {"name": "The Culinary Editorial", "tagline": "Seasonal · Considered · Crafted"},
    }


async def _resolve_printers_for_order(order: dict) -> List[dict]:
    kds = await db.kds_settings.find_one({"key": "kds_settings"}, {"_id": 0}) or {}
    routing = kds.get("station_routing", {}) or {}
    items = order.get("items", []) or []
    # Batch fetch menu_items for lines missing a category to avoid N+1.
    missing_ids = list({
        it.get("item_id") for it in items
        if not (it.get("category") or "") and it.get("item_id")
    })
    cats_by_id: Dict[str, str] = {}
    if missing_ids:
        cursor = db.menu_items.find(
            {"id": {"$in": missing_ids}}, {"_id": 0, "id": 1, "category": 1}
        )
        cats_by_id = {m["id"]: (m.get("category") or "") async for m in cursor}
    order_cats = set()
    for it in items:
        cat = (it.get("category") or "").lower()
        if not cat:
            cat = cats_by_id.get(it.get("item_id"), "").lower()
        if cat:
            order_cats.add(cat)
    stations_hit = [s for s, cats in routing.items() if set(c.lower() for c in cats) & order_cats]
    printers_cur = db.printers.find({"is_online": True}, {"_id": 0})
    all_online = await printers_cur.to_list(50)
    if stations_hit:
        matched = [p for p in all_online if (p.get("station", "").lower() in stations_hit)]
        if matched:
            return matched
    return [p for p in all_online if p.get("station", "").lower() == "kitchen"]


async def _queue_print_job(order_id: str, printer: Optional[dict], ticket_type: str, trigger: str) -> dict:
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    job = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "order_number": order.get("order_number", ""),
        "printer_id": (printer or {}).get("id"),
        "printer_name": (printer or {}).get("name", "—"),
        "printer_station": (printer or {}).get("station"),
        "ticket_type": ticket_type,
        "trigger": trigger,
        "status": "queued",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.print_jobs.insert_one(job)
    return {k: v for k, v in job.items() if k != "_id"}


async def _auto_queue_for_order(order_id: str, trigger_stage: str):
    try:
        settings = await _get_print_settings()
        mode = settings.get("auto_trigger", "off")
        stage_match = (
            (mode == "on_placement" and trigger_stage == "placement") or
            (mode == "on_acceptance" and trigger_stage == "acceptance")
        )
        if not stage_match:
            return
        order = await db.orders.find_one({"id": order_id}, {"_id": 0})
        if not order:
            return
        printers = await _resolve_printers_for_order(order)
        for p in printers:
            await _queue_print_job(order_id, p, "kitchen", f"auto_{trigger_stage}")
        if settings.get("auto_receipt", True):
            receipt_printer = await db.printers.find_one(
                {"station": "receipt", "is_online": True}, {"_id": 0}
            )
            await _queue_print_job(order_id, receipt_printer, "receipt", f"auto_{trigger_stage}")
    except Exception as e:
        logging.getLogger(__name__).warning(f"auto_queue failed for {order_id}: {e}")


# ─── Printers CRUD ────────────────────────────────────────

@api_router.get("/admin/printers")
async def list_printers(request: Request):
    await require_admin(request)
    docs = await db.printers.find({}, {"_id": 0}).sort("created_at", 1).to_list(100)
    return {"printers": docs, "models": PRINTER_MODELS}


@api_router.post("/admin/printers")
async def create_printer(body: PrinterBody, request: Request):
    await require_admin(request)
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Name required")
    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "ip": (body.ip or "").strip(),
        "model": body.model,
        "station": (body.station or "kitchen").strip().lower() or "kitchen",
        "is_online": bool(body.is_online),
        "last_test_at": None,
        "created_at": now_iso, "updated_at": now_iso,
    }
    await db.printers.insert_one(dict(doc))
    return doc


@api_router.patch("/admin/printers/{printer_id}")
async def update_printer(printer_id: str, body: PrinterPatchBody, request: Request):
    await require_admin(request)
    updates: Dict[str, Any] = {}
    if body.name is not None:
        updates["name"] = body.name.strip()
    if body.ip is not None:
        updates["ip"] = body.ip.strip()
    if body.model is not None:
        updates["model"] = body.model
    if body.station is not None:
        updates["station"] = body.station.strip().lower() or "kitchen"
    if body.is_online is not None:
        updates["is_online"] = bool(body.is_online)
    if not updates:
        raise HTTPException(status_code=400, detail="No changes")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.printers.update_one({"id": printer_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Printer not found")
    return await db.printers.find_one({"id": printer_id}, {"_id": 0})


@api_router.delete("/admin/printers/{printer_id}")
async def delete_printer(printer_id: str, request: Request):
    await require_admin(request)
    res = await db.printers.delete_one({"id": printer_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Printer not found")
    return {"ok": True}


@api_router.post("/admin/printers/{printer_id}/test")
async def test_printer(printer_id: str, request: Request):
    await require_admin(request)
    printer = await db.printers.find_one({"id": printer_id}, {"_id": 0})
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
    if not printer.get("is_online"):
        raise HTTPException(status_code=400, detail="Printer is offline — turn it on first")
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.printers.update_one({"id": printer_id}, {"$set": {"last_test_at": now_iso, "updated_at": now_iso}})
    job = {
        "id": str(uuid.uuid4()),
        "order_id": None, "order_number": "TEST-PRINT",
        "printer_id": printer_id, "printer_name": printer.get("name"),
        "printer_station": printer.get("station"),
        "ticket_type": "test", "trigger": "test", "status": "queued",
        "created_at": now_iso,
    }
    await db.print_jobs.insert_one(dict(job))
    return {"ok": True, "last_test_at": now_iso, "job_id": job["id"]}


# ─── Print Settings ───────────────────────────────────────

@api_router.get("/admin/print-settings")
async def get_print_settings(request: Request):
    await require_admin(request)
    return await _get_print_settings()


@api_router.patch("/admin/print-settings")
async def patch_print_settings(body: PrintSettingsBody, request: Request):
    await require_admin(request)
    updates: Dict[str, Any] = {}
    if body.auto_trigger is not None:
        if body.auto_trigger not in ("on_placement", "on_acceptance", "off"):
            raise HTTPException(status_code=400, detail="Invalid auto_trigger")
        updates["auto_trigger"] = body.auto_trigger
    if body.auto_receipt is not None:
        updates["auto_receipt"] = bool(body.auto_receipt)
    if not updates:
        raise HTTPException(status_code=400, detail="No changes")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.print_settings.update_one(
        {"key": "print_settings"}, {"$set": updates}, upsert=True,
    )
    return await _get_print_settings()


# ─── Print Jobs (history) ────────────────────────────────

@api_router.get("/admin/print-jobs")
async def list_print_jobs(request: Request, limit: int = 100, order_id: Optional[str] = None):
    await require_admin(request)
    query: Dict[str, Any] = {}
    if order_id:
        query["order_id"] = order_id
    docs = await db.print_jobs.find(query, {"_id": 0}).sort("created_at", -1).to_list(max(1, min(limit, 500)))
    return {"jobs": docs, "count": len(docs)}


@api_router.post("/admin/orders/{order_id}/print")
async def admin_print_order(order_id: str, body: PrintOrderBody, request: Request):
    await require_admin(request)
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if body.ticket_type not in ("kitchen", "receipt"):
        raise HTTPException(status_code=400, detail="ticket_type must be kitchen|receipt")

    printer = None
    if body.printer_id:
        printer = await db.printers.find_one({"id": body.printer_id}, {"_id": 0})
        if not printer:
            raise HTTPException(status_code=404, detail="Printer not found")

    job = await _queue_print_job(order_id, printer, body.ticket_type, body.trigger or "manual")
    return {"job": job, "ticket": _build_ticket_payload(order, body.ticket_type, printer)}


@api_router.get("/orders/{order_id}/receipt")
async def get_order_receipt(order_id: str):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return _build_ticket_payload(order, "receipt", None)
