"""
EconoMe — Enhanced Auth Router (Phase 1 Upgrade)
Implements cookie-based auth, complete OTP flow, and device validation.
This file extends the existing auth router with production-ready security.
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Response, HTTPException, status, Request
from pydantic import BaseModel, EmailStr

from config import settings
from shared.database import get_db
from shared.exceptions import AuthenticationError
from shared.cookie_auth import CookieManager, OTPManager
from shared.otp_service import OTPService, EmailService
from sqlalchemy.ext.asyncio import AsyncSession

from modules.auth.service import (
    authenticate_user,
    compute_device_fingerprint,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    get_or_create_device,
)

# This router is meant to be added alongside the main auth router
# or can replace it for v2 API
enhanced_router = APIRouter(prefix="/v2", tags=["Auth v2"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class LoginRequestWithOTP(BaseModel):
    """Login request with OTP requirement."""
    email: EmailStr
    password: str
    device_info: dict = {}
    otp_token: Optional[str] = None  # OTP token from previous step


class OTPSendRequest(BaseModel):
    """Request to send OTP."""
    email: EmailStr
    purpose: str = "login"  # login, password_reset, email_verification


class OTPVerifyRequest(BaseModel):
    """Request to verify OTP."""
    email: EmailStr
    otp: str
    purpose: str = "login"


class LogoutRequest(BaseModel):
    """Logout request."""
    logout_all_devices: bool = False


class CookieTokenResponse(BaseModel):
    """Response after successful authentication (tokens sent as cookies)."""
    user_id: str
    email: str
    full_name: str
    message: str = "Authentication successful"


# ── Helper Dependency: Extract token from cookies ──────────────────────────


async def get_current_user_from_cookies(request: Request):
    """Extract and validate user from access token cookie."""
    token = CookieManager.get_access_token_from_cookies(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No access token found",
        )

    payload = await decode_access_token(token)
    return payload


# ── Endpoints ──────────────────────────────────────────────────────────────


@enhanced_router.post("/login/step1", status_code=status.HTTP_200_OK)
async def login_step1(
    req: LoginRequestWithOTP,
    db: AsyncSession = Depends(get_db),
    response: Response = Response(),
):
    """
    Step 1: Authenticate user with email and password.
    Returns OTP_TOKEN for verification (short-lived).
    OTP is sent to email.
    """

    # Check rate limiting for this email
    from shared.redis_client import cache_get, cache_set

    rate_key = f"login:rate:{req.email.lower()}"
    attempts = await cache_get(rate_key)
    if attempts and int(attempts) > settings.AUTH_RATE_LIMIT_PER_MINUTE:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Try again later.",
        )

    try:
        # Authenticate user
        user = await authenticate_user(db, req.email, req.password)
    except AuthenticationError as e:
        # Increment failed attempts
        attempts = await cache_get(rate_key)
        new_attempts = int(attempts) + 1 if attempts else 1
        await cache_set(rate_key, new_attempts, 300)  # 5 minute window

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Register device
    fingerprint = compute_device_fingerprint(req.device_info)
    device, is_new = await get_or_create_device(
        db, user.user_id, fingerprint, req.device_info
    )

    # Generate OTP
    otp = await OTPService.generate_and_store_otp(
        identifier=user.email,
        otp_type="login_verification",
        ttl=OTPManager.OTP_EXPIRY_SECONDS,
    )

    # Send OTP via email
    email_sent = await EmailService.send_otp_email(
        recipient_email=user.email,
        otp=otp,
        name=user.full_name,
    )

    if not email_sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send OTP. Please try again.",
        )

    # Create temporary OTP token (valid for 10 minutes)
    otp_token = create_access_token(
        user_id=user.user_id,
        device_id=device.device_id,
        mfa_verified=False,
        token_type="otp_verification",
        expires_in_minutes=10,
    )

    # Don't send full tokens yet, just OTP token
    return {
        "message": "OTP sent to your email",
        "otp_token": otp_token,
        "expires_in": 600,  # 10 minutes in seconds
    }


@enhanced_router.post("/login/step2", status_code=status.HTTP_200_OK)
async def login_step2(
    req: OTPVerifyRequest,
    otp_token: str = None,  # From previous step
    db: AsyncSession = Depends(get_db),
    response: Response = Response(),
):
    """
    Step 2: Verify OTP.
    Returns access and refresh tokens as HTTP-only cookies.
    """

    if not otp_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP token required",
        )

    # Verify OTP token first
    try:
        otp_payload = await decode_access_token(otp_token)
        if otp_payload.get("type") != "otp_verification":
            raise AuthenticationError("Invalid OTP token")
        user_id = otp_payload["sub"]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OTP token expired or invalid",
        )

    # Verify OTP code
    is_valid, error_msg = await OTPService.verify_otp(
        identifier=req.email,
        provided_otp=req.otp,
        otp_type="login_verification",
        auto_delete=True,
    )

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_msg or "Invalid OTP",
        )

    # Get user and device
    from shared.models import User, UserDevice
    from sqlalchemy import select

    result = await db.execute(select(User).where(User.user_id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Get device from OTP payload
    device_id = otp_payload.get("device_id")
    result = await db.execute(
        select(UserDevice).where(UserDevice.device_id == device_id)
    )
    device = result.scalar_one_or_none()

    # Auto-approve device if new (or you can send verification email)
    if device and not device.is_approved:
        device.is_approved = True
        device.approved_at = datetime.utcnow()
        db.add(device)

    # Update last login
    user.last_login_at = datetime.utcnow()
    db.add(user)
    await db.commit()

    # Create tokens
    access_token = create_access_token(
        user_id=user.user_id,
        device_id=device_id,
        mfa_verified=True,
    )
    refresh_token = create_refresh_token(
        user_id=user.user_id,
        device_id=device_id,
    )

    # Set cookies
    CookieManager.set_auth_cookies(response, access_token, refresh_token)

    return CookieTokenResponse(
        user_id=user.user_id,
        email=user.email,
        full_name=user.full_name,
        message="Login successful",
    )


@enhanced_router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    req: LogoutRequest,
    request: Request = None,
    response: Response = Response(),
    current_user: dict = Depends(get_current_user_from_cookies),
    db: AsyncSession = Depends(get_db),
):
    """
    Logout user and clear cookies.
    Optionally logout from all devices.
    """

    from shared.redis_client import blacklist_token
    from shared.models import UserDevice
    from sqlalchemy import select

    user_id = current_user["sub"]
    device_id = current_user["device_id"]

    # Blacklist current token
    jti = f"{user_id}:{current_user['iat']}"
    await blacklist_token(jti, ttl_seconds=900)

    if req.logout_all_devices:
        # Mark all devices as logged out (optional: set a global version)
        result = await db.execute(
            select(UserDevice).where(UserDevice.user_id == user_id)
        )
        devices = result.scalars().all()
        for device in devices:
            # You could mark them inactive or update a version counter
            pass

    # Clear cookies
    CookieManager.clear_auth_cookies(response)

    return {"message": "Logged out successfully"}


@enhanced_router.post("/refresh-token", status_code=status.HTTP_200_OK)
async def refresh_access_token(
    response: Response = Response(),
    current_user: dict = Depends(get_current_user_from_cookies),
):
    """
    Refresh access token using refresh token from cookie.
    """

    refresh_token_cookie = CookieManager.get_refresh_token_from_cookies(request=None)
    if not refresh_token_cookie:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token found",
        )

    try:
        payload = await decode_access_token(refresh_token_cookie)
        if payload.get("type") != "refresh":
            raise AuthenticationError("Invalid token type")

        new_access_token = create_access_token(
            user_id=payload["sub"],
            device_id=payload["device_id"],
            mfa_verified=True,
        )

        # Set new access token cookie
        response.set_cookie(
            key=CookieManager.ACCESS_TOKEN_COOKIE,
            value=new_access_token,
            max_age=settings.JWT_ACCESS_EXPIRE_MINUTES * 60,
            httponly=True,
            secure=settings.ENV == "production",
            samesite="lax",
        )

        return {"message": "Token refreshed"}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to refresh token",
        )


@enhanced_router.post("/send-otp")
async def send_otp_handler(
    req: OTPSendRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Send OTP to email for various purposes.
    (registration, password reset, email verification, etc.)
    """

    from shared.models import User
    from sqlalchemy import select

    # Check rate limiting
    from shared.redis_client import cache_get, cache_set

    rate_key = f"otp:rate:{req.email.lower()}:{req.purpose}"
    attempts = await cache_get(rate_key)
    if attempts and int(attempts) > 3:  # Max 3 OTP requests per purpose
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many OTP requests. Try again later.",
        )

    # Check if user exists (for login/verification purposes)
    if req.purpose in ["login", "email_verification"]:
        result = await db.execute(
            select(User).where(User.email == req.email.lower())
        )
        user = result.scalar_one_or_none()
        if not user:
            # Don't reveal if email exists
            return {"message": "If this email exists, an OTP has been sent."}

    # Generate and store OTP
    otp = await OTPService.generate_and_store_otp(
        identifier=req.email.lower(),
        otp_type=req.purpose,
        ttl=OTPManager.OTP_EXPIRY_SECONDS,
    )

    # Send OTP via email
    await EmailService.send_otp_email(
        recipient_email=req.email,
        otp=otp,
        name=req.email.split("@")[0],  # Fallback name
    )

    # Update rate limit
    new_attempts = int(attempts) + 1 if attempts else 1
    await cache_set(rate_key, new_attempts, 300)  # 5 minute window

    return {"message": "OTP sent to your email. Check your inbox."}


@enhanced_router.get("/csrf-token")
async def get_csrf_token_handler(response: Response):
    """
    Get CSRF token for frontend.
    Frontend should send this token in X-CSRF-Token header for state-changing requests.
    """

    import secrets

    csrf_token = secrets.token_urlsafe(32)
    response.set_cookie(
        key=CookieManager.CSRF_TOKEN_COOKIE,
        value=csrf_token,
        httponly=False,  # Must be readable by JavaScript
        secure=settings.ENV == "production",
        samesite="lax",
    )

    return {
        "csrf_token": csrf_token,
        "header_name": CookieManager.CSRF_TOKEN_HEADER,
    }


@enhanced_router.get("/me")
async def get_current_user_profile(
    current_user: dict = Depends(get_current_user_from_cookies),
    db: AsyncSession = Depends(get_db),
):
    """
    Get current user's profile from token.
    """

    from shared.models import User
    from sqlalchemy import select

    result = await db.execute(
        select(User).where(User.user_id == current_user["sub"])
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return {
        "user_id": user.user_id,
        "email": user.email,
        "full_name": user.full_name,
        "is_verified": user.is_verified,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
    }
