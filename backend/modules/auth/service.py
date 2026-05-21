"""
EconoMe — Authentication Service
Phase 3 + 6: Registration, login, JWT (RS256), TOTP 2FA, device verification.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import pyotp
from config import settings
from jose import ExpiredSignatureError, JWTError, jwt
from shared.crypto import sha3_256_hex
from shared.exceptions import (
    AuthenticationError,
    TokenBlacklistedError,
    TokenExpiredError,
)
from shared.models import User, UserDevice
from shared.redis_client import is_token_blacklisted
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# ── Key Loading ───────────────────────────────────────────────────────────────


def _load_private_key() -> str:
    with open(settings.JWT_PRIVATE_KEY_PATH) as f:
        return f.read()


def _load_public_key() -> str:
    with open(settings.JWT_PUBLIC_KEY_PATH) as f:
        return f.read()


# ── Password Hashing ──────────────────────────────────────────────────────────


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


# ── JWT ───────────────────────────────────────────────────────────────────────


def create_access_token(
    user_id: str,
    device_id: str,
    mfa_verified: bool,
    token_type: str = "access",
    expires_in_minutes: Optional[int] = None,
) -> str:
    now = datetime.now(timezone.utc)
    expires = expires_in_minutes or settings.JWT_ACCESS_EXPIRE_MINUTES
    payload = {
        "sub": user_id,
        "device_id": device_id,
        "mfa_verified": mfa_verified,
        "iat": now,
        "exp": now + timedelta(minutes=expires),
        "type": token_type,
    }
    return jwt.encode(payload, _load_private_key(), algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: str, device_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "device_id": device_id,
        "iat": now,
        "exp": now + timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, _load_private_key(), algorithm=settings.JWT_ALGORITHM)


async def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token, _load_public_key(), algorithms=[settings.JWT_ALGORITHM]
        )
        jti = f"{payload['sub']}:{payload['iat']}"
        if await is_token_blacklisted(jti):
            raise TokenBlacklistedError()
        return payload
    except ExpiredSignatureError:
        raise TokenExpiredError()
    except JWTError:
        raise AuthenticationError("Invalid token")


# ── Device Fingerprint ────────────────────────────────────────────────────────


def compute_device_fingerprint(device_info: dict) -> str:
    """
    Compute SHA-3-256 of the device composite string.
    device_info keys: os_name, os_version, browser_name, browser_version,
                      screen_resolution, timezone, font_hash
    """
    composite = "|".join(
        [
            device_info.get("os_name", ""),
            device_info.get("os_version", ""),
            device_info.get("browser_name", ""),
            device_info.get("browser_version", ""),
            device_info.get("screen_resolution", ""),
            device_info.get("timezone", ""),
            device_info.get("font_hash", ""),
        ]
    )
    return sha3_256_hex(composite)


async def get_or_create_device(
    db: AsyncSession, user_id: str, fingerprint: str, device_info: dict
) -> tuple["UserDevice", bool]:
    """
    Returns (device, is_new).
    If new, device is saved but not approved — triggers email flow.
    """
    result = await db.execute(
        select(UserDevice).where(
            UserDevice.user_id == user_id,
            UserDevice.fingerprint == fingerprint,
        )
    )
    device = result.scalar_one_or_none()
    if device:
        device.last_used = datetime.utcnow()
        return device, False

    new_device = UserDevice(
        user_id=user_id,
        fingerprint=fingerprint,
        os_info=device_info.get("os_name"),
        browser_info=device_info.get("browser_name"),
        is_approved=False,
    )
    db.add(new_device)
    await db.flush()
    return new_device, True


# ── TOTP 2FA ──────────────────────────────────────────────────────────────────


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str) -> str:
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name="EconoMe")


def verify_totp(secret: str, code: str) -> bool:
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)


# ── Registration ──────────────────────────────────────────────────────────────


async def register_user(
    db: AsyncSession, email: str, password: str, full_name: str
) -> User:
    email = email.lower().strip()
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise AuthenticationError("Email already registered")

    user = User(
        email=email,
        password_hash=hash_password(password),
        full_name=full_name,
        is_verified=False,
    )
    db.add(user)
    await db.flush()
    return user


# ── Login ─────────────────────────────────────────────────────────────────────


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    result = await db.execute(
        select(User).where(User.email == email.lower(), User.is_deleted == False)
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        raise AuthenticationError("Invalid credentials")
    return user


import smtplib
from email.mime.text import MIMEText


async def send_email_otp(email: str, otp: str):
    """Send a 6-digit OTP to the user's registered email via SMTP."""
    msg = MIMEText(
        f"Your EconoMe OTP is: {otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.",
        "plain",
    )
    msg["Subject"] = "Your EconoMe Login OTP"
    msg["From"] = settings.SENDER_EMAIL
    msg["To"] = email

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()
        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.sendmail(settings.SENDER_EMAIL, email, msg.as_string())


async def send_email_otp(email: str, otp: str):
    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        print(
            f"[DEV] OTP for {email}: {otp}"
        )  # prints to terminal if SMTP not configured
        return
    msg = MIMEText(
        f"Your EconoMe OTP is: {otp}\n\nThis code is valid for 10 minutes. Do not share it with anyone.",
        "plain",
    )
    msg["Subject"] = "Your EconoMe Login OTP"
    msg["From"] = settings.SENDER_EMAIL
    msg["To"] = email
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()
        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.sendmail(settings.SENDER_EMAIL, email, msg.as_string())
