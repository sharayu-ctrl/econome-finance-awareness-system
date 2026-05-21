"""
EconoMe — Cookie-Based Authentication (Phase 1)
Secure HTTP-only cookie handling for auth tokens with CSRF protection.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
import secrets

from fastapi import Request, Response, HTTPException, status
from config import settings
from shared.exceptions import AuthenticationError


class CookieManager:
    """Manages secure HTTP-only cookies for authentication."""

    # Cookie names
    ACCESS_TOKEN_COOKIE = "access_token"
    REFRESH_TOKEN_COOKIE = "refresh_token"
    CSRF_TOKEN_COOKIE = "csrf_token"
    CSRF_TOKEN_HEADER = "X-CSRF-Token"

    @staticmethod
    def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
        """
        Set secure HTTP-only cookies for access and refresh tokens.

        Args:
            response: FastAPI Response object
            access_token: JWT access token
            refresh_token: JWT refresh token
        """
        # Determine cookie settings based on environment
        is_secure = settings.ENV == "production"
        same_site = "strict" if is_secure else "lax"
        domain = settings.COOKIE_DOMAIN if hasattr(settings, "COOKIE_DOMAIN") else None

        # Access token cookie (15 minutes, short-lived)
        response.set_cookie(
            key=CookieManager.ACCESS_TOKEN_COOKIE,
            value=access_token,
            max_age=settings.JWT_ACCESS_EXPIRE_MINUTES * 60,
            httponly=True,  # Prevents JavaScript access
            secure=is_secure,  # Only sent over HTTPS in production
            samesite=same_site,  # CSRF protection
            domain=domain,
        )

        # Refresh token cookie (7 days, long-lived)
        response.set_cookie(
            key=CookieManager.REFRESH_TOKEN_COOKIE,
            value=refresh_token,
            max_age=settings.JWT_REFRESH_EXPIRE_DAYS * 24 * 60 * 60,
            httponly=True,
            secure=is_secure,
            samesite=same_site,
            domain=domain,
        )

        # Set CSRF token (accessible to JavaScript but not sent automatically)
        csrf_token = secrets.token_urlsafe(32)
        response.set_cookie(
            key=CookieManager.CSRF_TOKEN_COOKIE,
            value=csrf_token,
            max_age=settings.JWT_ACCESS_EXPIRE_MINUTES * 60,
            httponly=False,  # Must be accessible to JavaScript
            secure=is_secure,
            samesite=same_site,
            domain=domain,
        )

    @staticmethod
    def clear_auth_cookies(response: Response) -> None:
        """Clear all authentication cookies (logout)."""
        response.delete_cookie(
            key=CookieManager.ACCESS_TOKEN_COOKIE,
            secure=settings.ENV == "production",
            samesite="lax",
        )
        response.delete_cookie(
            key=CookieManager.REFRESH_TOKEN_COOKIE,
            secure=settings.ENV == "production",
            samesite="lax",
        )
        response.delete_cookie(
            key=CookieManager.CSRF_TOKEN_COOKIE,
            secure=settings.ENV == "production",
            samesite="lax",
        )

    @staticmethod
    def get_access_token_from_cookies(request: Request) -> Optional[str]:
        """Extract access token from request cookies."""
        return request.cookies.get(CookieManager.ACCESS_TOKEN_COOKIE)

    @staticmethod
    def get_refresh_token_from_cookies(request: Request) -> Optional[str]:
        """Extract refresh token from request cookies."""
        return request.cookies.get(CookieManager.REFRESH_TOKEN_COOKIE)

    @staticmethod
    def validate_csrf_token(request: Request) -> None:
        """
        Validate CSRF token for state-changing requests (POST, PUT, DELETE, PATCH).

        Args:
            request: FastAPI Request object

        Raises:
            HTTPException: If CSRF token is invalid or missing
        """
        # GET requests don't need CSRF protection
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return

        cookie_csrf = request.cookies.get(CookieManager.CSRF_TOKEN_COOKIE)
        header_csrf = request.headers.get(CookieManager.CSRF_TOKEN_HEADER)

        if not cookie_csrf or not header_csrf:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token missing",
            )

        if not secrets.compare_digest(cookie_csrf, header_csrf):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token mismatch",
            )


class OTPManager:
    """Manages OTP generation, verification, and rate limiting."""

    OTP_LENGTH = 6
    OTP_EXPIRY_SECONDS = 600  # 10 minutes
    OTP_MAX_ATTEMPTS = 5
    OTP_LOCKOUT_SECONDS = 900  # 15 minutes
    OTP_RESEND_COOLDOWN = 60  # 60 seconds between resends

    @staticmethod
    def generate_otp() -> str:
        """Generate a secure 6-digit OTP."""
        import random
        return str(random.randint(100000, 999999))

    @staticmethod
    def get_otp_key(identifier: str, otp_type: str = "email") -> str:
        """Get Redis key for storing OTP."""
        return f"otp:{otp_type}:{identifier}"

    @staticmethod
    def get_otp_attempts_key(identifier: str) -> str:
        """Get Redis key for tracking OTP attempts."""
        return f"otp:attempts:{identifier}"

    @staticmethod
    def get_otp_lockout_key(identifier: str) -> str:
        """Get Redis key for OTP lockout."""
        return f"otp:lockout:{identifier}"

    @staticmethod
    def get_otp_resend_key(identifier: str) -> str:
        """Get Redis key for tracking resend cooldown."""
        return f"otp:resend:{identifier}"


def get_csrf_token(response: Response) -> dict:
    """Generate and return CSRF token for frontend to store."""
    csrf_token = secrets.token_urlsafe(32)
    response.set_cookie(
        key=CookieManager.CSRF_TOKEN_COOKIE,
        value=csrf_token,
        httponly=False,
        secure=settings.ENV == "production",
        samesite="lax",
    )
    return {"csrf_token": csrf_token}
