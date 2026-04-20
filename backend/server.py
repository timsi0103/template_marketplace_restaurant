"""Composition root: mount shared api_router, CORS, exception handler, startup events."""
import os
import logging
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware

from core import app, api_router, client

# Import route modules for side-effect (registers decorators on api_router)
import routes.auth          # noqa: F401
import routes.catalog       # noqa: F401
import routes.store         # noqa: F401
import routes.orders        # noqa: F401
import routes.payments      # noqa: F401
import routes.admin         # noqa: F401
import routes.kds           # noqa: F401
import routes.printers      # noqa: F401
import routes.search        # noqa: F401
import routes.analytics     # noqa: F401
import routes.throttle      # noqa: F401
import routes.eightysix     # noqa: F401

from seed import run_startup_seed


# ─── CORS ─────────────────────────────────────────────────
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
cors_origins = [frontend_url, "http://localhost:3000"]
if "preview.emergentagent.com" in frontend_url:
    base = frontend_url.replace("https://", "").replace("http://", "")
    cors_origins.append(f"https://{base.split('.')[0]}.internal.preview.emergentagent.com")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Exception handler ───────────────────────────────────
@app.exception_handler(RequestValidationError)
async def _log_validation_error(request: Request, exc: RequestValidationError):
    try:
        body = await request.body()
        body_preview = body.decode("utf-8", errors="replace")[:2000]
    except Exception:
        body_preview = "<unreadable>"
    logging.getLogger(__name__).error(
        "422 Validation on %s %s — errors=%s body=%s",
        request.method, request.url.path, exc.errors(), body_preview,
    )
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


# Mount all API routes under /api
app.include_router(api_router)


# ─── Startup / Shutdown ──────────────────────────────────
@app.on_event("startup")
async def startup():
    await run_startup_seed()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
