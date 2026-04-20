"""File uploads for branding assets (logo, favicon, hero, about photos).
Uses Emergent Object Storage. Frontend downloads via authenticated proxy endpoint
/api/files/{file_id}/download which streams the object with correct Content-Type."""
from fastapi import HTTPException, Request, UploadFile, File, Form, Response
from datetime import datetime, timezone
import os
import uuid
import requests

from core import api_router, db, logger, require_admin


STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = "culinary-editorial"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
MAX_UPLOAD_BYTES = 6 * 1024 * 1024  # 6 MB
ALLOWED_CONTENT_TYPES = {
    "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif",
    "image/x-icon", "image/vnd.microsoft.icon",
}

_storage_key = None


def _ensure_storage_key() -> str:
    global _storage_key
    if _storage_key:
        return _storage_key
    if not EMERGENT_KEY:
        raise HTTPException(status_code=500, detail="Object storage not configured (missing EMERGENT_LLM_KEY)")
    try:
        r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        r.raise_for_status()
        _storage_key = r.json()["storage_key"]
        logger.info("Object storage initialized")
        return _storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        raise HTTPException(status_code=503, detail="Could not connect to object storage")


def _put_object(path: str, data: bytes, content_type: str) -> dict:
    key = _ensure_storage_key()
    r = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    r.raise_for_status()
    return r.json()


def _get_object(path: str):
    key = _ensure_storage_key()
    r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")


@api_router.post("/admin/uploads")
async def upload_file(request: Request, file: UploadFile = File(...), purpose: str = Form("misc")):
    """Admin-only file upload. Returns {id, url, filename, size, content_type}.
    `url` is a backend proxy path (publicly reachable via our domain) usable in <img src>."""
    user = await require_admin(request)

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large (max {MAX_UPLOAD_BYTES // (1024*1024)} MB)")

    ext = (file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "bin").lower()
    file_id = f"up_{uuid.uuid4().hex[:12]}"
    storage_path = f"{APP_NAME}/uploads/{user['user_id']}/{uuid.uuid4()}.{ext}"
    try:
        result = _put_object(storage_path, data, file.content_type)
    except Exception as e:
        logger.error(f"Object storage PUT failed: {e}")
        raise HTTPException(status_code=502, detail="Storage upload failed")

    record = {
        "id": file_id,
        "storage_path": result.get("path") or storage_path,
        "original_filename": file.filename or f"{file_id}.{ext}",
        "content_type": file.content_type,
        "size": result.get("size") or len(data),
        "purpose": purpose,
        "uploaded_by": user["user_id"],
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.uploads.insert_one(dict(record))

    return {
        "id": file_id,
        "url": f"/api/files/{file_id}",
        "filename": record["original_filename"],
        "size": record["size"],
        "content_type": record["content_type"],
        "purpose": purpose,
    }


@api_router.get("/files/{file_id}")
async def download_file(file_id: str):
    """Public proxy to stream the file from object storage. Used in <img src>."""
    record = await db.uploads.find_one({"id": file_id, "is_deleted": {"$ne": True}}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        data, content_type = _get_object(record["storage_path"])
    except Exception as e:
        logger.error(f"Object storage GET failed for {file_id}: {e}")
        raise HTTPException(status_code=502, detail="Storage fetch failed")
    headers = {"Cache-Control": "public, max-age=86400"}
    return Response(content=data, media_type=record.get("content_type", content_type), headers=headers)


@api_router.get("/admin/uploads")
async def list_uploads(request: Request, purpose: str = None, limit: int = 50):
    await require_admin(request)
    query = {"is_deleted": {"$ne": True}}
    if purpose:
        query["purpose"] = purpose
    docs = await db.uploads.find(query, {"_id": 0, "storage_path": 0}).sort("created_at", -1).limit(min(limit, 200)).to_list(200)
    for d in docs:
        d["url"] = f"/api/files/{d['id']}"
    return {"uploads": docs}


@api_router.delete("/admin/uploads/{file_id}")
async def soft_delete(file_id: str, request: Request):
    await require_admin(request)
    r = await db.uploads.update_one({"id": file_id}, {"$set": {"is_deleted": True}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="File not found")
    return {"deleted": True}
