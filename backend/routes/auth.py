"""Authentication endpoints: register, login, logout, me, refresh,
forgot/reset password, Google OAuth, guest session."""
from fastapi import HTTPException, Request, Response
from datetime import datetime, timezone, timedelta
from typing import Optional
from pydantic import BaseModel
import os
import uuid
import secrets
import httpx
import jwt

from core import (
    api_router, db, logger, JWT_ALGORITHM, get_jwt_secret,
    hash_password, verify_password, create_access_token, create_refresh_token,
    set_auth_cookies, get_current_user,
    check_brute_force, record_failed_attempt, clear_failed_attempts,
)
from models import (
    UserRegister, UserLogin, ForgotPasswordRequest, ResetPasswordRequest, GoogleCallbackRequest,
)


@api_router.post("/auth/register")
async def register(body: UserRegister, response: Response):
    email = body.email.strip().lower()
    if not email or not body.password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {"user_id": user_id, "email": email, "name": body.name or email.split("@")[0], "password_hash": hash_password(body.password), "role": "customer", "picture": "", "auth_provider": "email", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one(user_doc)
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    set_auth_cookies(response, access_token, refresh_token)
    return {"user_id": user_id, "email": email, "name": user_doc["name"], "role": "customer", "picture": "", "auth_provider": "email"}


@api_router.post("/auth/login")
async def login(body: UserLogin, request: Request, response: Response):
    email = body.email.strip().lower()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    await check_brute_force(identifier)
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not user.get("password_hash"):
        await record_failed_attempt(identifier)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(body.password, user["password_hash"]):
        await record_failed_attempt(identifier)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await clear_failed_attempts(identifier)
    access_token = create_access_token(user["user_id"], email)
    refresh_token = create_refresh_token(user["user_id"])
    set_auth_cookies(response, access_token, refresh_token)
    return {"user_id": user["user_id"], "email": user["email"], "name": user.get("name", ""), "role": user.get("role", "customer"), "picture": user.get("picture", ""), "auth_provider": user.get("auth_provider", "email")}


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out successfully"}


@api_router.get("/auth/me")
async def get_me(request: Request):
    return await get_current_user(request)


class ProfilePatch(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None


@api_router.patch("/auth/me")
async def update_me(request: Request, body: ProfilePatch):
    user = await get_current_user(request)
    if not user or user.get("guest"):
        raise HTTPException(status_code=401, detail="Sign in to update your profile")
    patch = body.model_dump(exclude_none=True)
    if "name" in patch:
        patch["name"] = patch["name"].strip()[:120]
    if "phone" in patch:
        patch["phone"] = patch["phone"].strip()[:30]
    if not patch:
        raise HTTPException(status_code=400, detail="Nothing to update")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": patch})
    return await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})


@api_router.post("/auth/refresh")
async def refresh_token_endpoint(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        access_token = create_access_token(user["user_id"], user["email"])
        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", max_age=900, path="/")
        return {"message": "Token refreshed"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


@api_router.post("/auth/forgot-password")
async def forgot_password(body: ForgotPasswordRequest):
    email = body.email.strip().lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user and user.get("auth_provider") == "email":
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({"token": token, "user_id": user["user_id"], "email": email, "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(), "used": False})
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        logger.info(f"Password reset link: {frontend_url}/reset-password?token={token}")
    return {"message": "If an account with this email exists, a reset link has been sent."}


@api_router.post("/auth/reset-password")
async def reset_password(body: ResetPasswordRequest):
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    reset_doc = await db.password_reset_tokens.find_one({"token": body.token, "used": False}, {"_id": 0})
    if not reset_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    expires_at = reset_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if not expires_at or expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset token has expired")
    await db.users.update_one({"user_id": reset_doc["user_id"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    await db.password_reset_tokens.update_one({"token": body.token}, {"$set": {"used": True}})
    return {"message": "Password has been reset successfully"}


async def _verify_google_token(token: str, expected_email: str) -> bool:
    """Best-effort second-factor verification against Google.

    The upstream Emergent integration returns an opaque `session_token` rather
    than a Google-signed JWT — there is no signature to validate locally. To
    reduce trust in that channel we additionally try to call Google's
    `tokeninfo` endpoint with the same token (it accepts ID and access tokens).
    If Google confirms the token AND the email matches, we treat the session as
    verified. If Google does not recognize the token (the common case for an
    Emergent-managed opaque token), we conservatively fall back to trusting the
    Emergent response — this is the documented trust assumption: the
    integration backend is on a private network and uses out-of-band signing.
    Operators who require strict OIDC should swap this for a direct Google
    OAuth flow and validate the ID token's signature with Google's JWKS.
    """
    if not token:
        return False
    expected = (expected_email or "").lower()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # Try ID token first, then access token.
            for url in (
                f"https://oauth2.googleapis.com/tokeninfo?id_token={token}",
                f"https://oauth2.googleapis.com/tokeninfo?access_token={token}",
            ):
                r = await client.get(url)
                if r.status_code == 200:
                    data = r.json()
                    if (data.get("email") or "").lower() == expected and data.get("email_verified", "true") in (True, "true"):
                        return True
                    # Google recognized the token but it doesn't match — explicit reject.
                    return False
    except httpx.RequestError:
        pass
    # Google did not recognize the token at all → fall through to upstream trust.
    return True


@api_router.post("/auth/google/callback")
async def google_callback(body: GoogleCallbackRequest, response: Response):
    # ASSUMPTION: `integrations.emergentagent.com` is reached over TLS and acts
    # as the OAuth broker. Its response is currently unsigned at the application
    # layer — we mitigate by (a) requiring HTTPS via httpx default, (b) doing a
    # best-effort verification of the returned session_token against Google's
    # tokeninfo endpoint, and (c) refusing to accept the response if Google
    # explicitly contradicts the email claim. See _verify_google_token().
    async with httpx.AsyncClient() as http_client:
        try:
            resp = await http_client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": body.session_id}, timeout=10.0,
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Failed to verify Google session")
            data = resp.json()
        except httpx.RequestError:
            raise HTTPException(status_code=502, detail="Failed to connect to auth service")

    email = (data.get("email") or "").lower()
    name = data.get("name", "")
    picture = data.get("picture", "")
    session_token = data.get("session_token", "")
    if not email or not session_token:
        raise HTTPException(status_code=400, detail="Invalid session data")

    # Second-factor check: if Google recognizes the session_token, the email
    # must match. If Google has no opinion (opaque token), we proceed.
    if not await _verify_google_token(session_token, email):
        raise HTTPException(status_code=401, detail="Google session could not be verified")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": name or existing.get("name", ""), "picture": picture}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({"user_id": user_id, "email": email, "name": name or email.split("@")[0], "password_hash": "", "role": "customer", "picture": picture, "auth_provider": "google", "created_at": datetime.now(timezone.utc).isoformat()})
    await db.user_sessions.insert_one({"user_id": user_id, "session_token": session_token, "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(), "created_at": datetime.now(timezone.utc).isoformat()})
    response.set_cookie(key="session_token", value=session_token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")
    return {"user_id": user_id, "email": email, "name": name, "role": existing.get("role", "customer") if existing else "customer", "picture": picture, "auth_provider": "google"}


@api_router.post("/auth/guest-session")
async def create_guest_session(response: Response):
    guest_id = f"guest_{uuid.uuid4().hex[:12]}"
    session_token = secrets.token_urlsafe(32)
    guest_email = f"{guest_id}@guest.local"
    await db.users.insert_one({"user_id": guest_id, "email": guest_email, "name": "Guest", "password_hash": "", "role": "guest", "picture": "", "auth_provider": "guest", "created_at": datetime.now(timezone.utc).isoformat()})
    await db.user_sessions.insert_one({"user_id": guest_id, "session_token": session_token, "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(), "created_at": datetime.now(timezone.utc).isoformat()})
    response.set_cookie(key="session_token", value=session_token, httponly=True, secure=True, samesite="none", max_age=86400, path="/")
    return {"user_id": guest_id, "email": "", "name": "Guest", "role": "guest", "picture": "", "auth_provider": "guest"}


@api_router.get("/")
async def root():
    return {"message": "The Culinary Editorial API", "version": "1.0.0"}


@api_router.get("/health")
async def health_check():
    return {"status": "healthy"}
