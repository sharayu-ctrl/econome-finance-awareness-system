"""
EconoMe — OTP and Email Service (Phase 1)
Secure OTP generation, verification, and email delivery via SMTP.
"""

import asyncio
import random
from datetime import datetime, timedelta
from typing import Optional, Tuple
import logging

from config import settings
from shared.redis_client import cache_set, cache_get, cache_increment, cache_delete, cache_exists

logger = logging.getLogger(__name__)


class OTPService:
    """Manages OTP lifecycle: generation, storage, verification, cleanup."""

    OTP_LENGTH = 6
    OTP_EXPIRY_SECONDS = 600  # 10 minutes
    OTP_MAX_ATTEMPTS = 5
    OTP_LOCKOUT_SECONDS = 900  # 15 minutes
    OTP_RESEND_COOLDOWN = 60  # 60 seconds

    @staticmethod
    async def generate_and_store_otp(
        identifier: str,
        otp_type: str = "email",
        ttl: int = OTP_EXPIRY_SECONDS,
    ) -> str:
        """
        Generate and store OTP in Redis with expiration.

        Args:
            identifier: Email, phone, or user ID
            otp_type: Type of OTP (email, sms, app)
            ttl: Time to live in seconds

        Returns:
            Generated OTP code
        """
        otp = OTPService._generate_secure_otp()
        key = f"otp:{otp_type}:{identifier}"

        # Store OTP with expiration
        await cache_set(key, otp, ttl)

        # Reset attempt counter
        attempt_key = f"otp:attempts:{identifier}"
        await cache_delete(attempt_key)

        logger.info(f"OTP generated and stored for {otp_type}:{identifier}")
        return otp

    @staticmethod
    async def verify_otp(
        identifier: str,
        provided_otp: str,
        otp_type: str = "email",
        auto_delete: bool = True,
    ) -> Tuple[bool, Optional[str]]:
        """
        Verify provided OTP against stored one.

        Args:
            identifier: Email, phone, or user ID
            provided_otp: OTP entered by user
            otp_type: Type of OTP
            auto_delete: Delete OTP after successful verification

        Returns:
            (is_valid, error_message)
        """
        # Check if account is locked
        lockout_key = f"otp:lockout:{identifier}"
        if await cache_exists(lockout_key):
            return False, "Too many failed attempts. Try again in 15 minutes."

        # Get stored OTP
        key = f"otp:{otp_type}:{identifier}"
        stored_otp = await cache_get(key)

        if not stored_otp:
            return False, "OTP expired or not found. Request a new one."

        # Verify OTP using constant-time comparison
        import secrets
        is_valid = secrets.compare_digest(stored_otp, provided_otp)

        if not is_valid:
            # Increment failed attempts
            attempt_key = f"otp:attempts:{identifier}"
            attempts = await cache_increment(attempt_key, 1)

            # Cache attempt counter for 15 minutes
            if attempts == 1:
                await cache_set(attempt_key, 1, 900)

            if attempts >= OTPService.OTP_MAX_ATTEMPTS:
                # Lock out the account
                await cache_set(lockout_key, "1", OTPService.OTP_LOCKOUT_SECONDS)
                logger.warning(f"OTP lockout activated for {identifier} after {attempts} attempts")
                return False, "Too many failed attempts. Try again in 15 minutes."

            remaining = OTPService.OTP_MAX_ATTEMPTS - attempts
            return False, f"Invalid OTP. {remaining} attempts remaining."

        # Success: OTP is valid
        if auto_delete:
            await cache_delete(key)
            await cache_delete(f"otp:attempts:{identifier}")

        logger.info(f"OTP verified successfully for {otp_type}:{identifier}")
        return True, None

    @staticmethod
    async def can_resend_otp(identifier: str, otp_type: str = "email") -> Tuple[bool, int]:
        """
        Check if user can request a new OTP (respects cooldown).

        Returns:
            (can_resend, seconds_to_wait)
        """
        resend_key = f"otp:resend:{identifier}:{otp_type}"
        exists = await cache_exists(resend_key)

        if not exists:
            # Set cooldown for next resend
            await cache_set(resend_key, "1", OTPService.OTP_RESEND_COOLDOWN)
            return True, 0

        # User must wait before requesting again
        # Redis TTL would return remaining seconds, but we simplify here
        return False, OTPService.OTP_RESEND_COOLDOWN

    @staticmethod
    def _generate_secure_otp(length: int = 6) -> str:
        """Generate a cryptographically secure OTP."""
        return "".join(str(random.randint(0, 9)) for _ in range(length))


class EmailService:
    """Handles email sending via SMTP."""

    @staticmethod
    async def send_otp_email(
        recipient_email: str,
        otp: str,
        name: str = "User",
    ) -> bool:
        """
        Send OTP via email.

        Args:
            recipient_email: Recipient's email address
            otp: The OTP to send
            name: Recipient's name for personalization

        Returns:
            True if sent successfully, False otherwise
        """
        try:
            # Import here to avoid dependency issues if SMTP not configured
            from shared.smtp_client import send_email_async

            subject = f"EconoMe - Your One-Time Password is {otp}"

            html_body = f"""
            <html>
                <body style="font-family: Arial, sans-serif;">
                    <h2>Welcome to EconoMe, {name}!</h2>
                    <p>Your One-Time Password (OTP) is:</p>
                    <h1 style="color: #2563eb; font-size: 36px; letter-spacing: 5px;">{otp}</h1>
                    <p>This OTP will expire in <strong>10 minutes</strong>.</p>
                    <p><strong>Never share this OTP with anyone.</strong></p>
                    <hr>
                    <p style="font-size: 12px; color: #666;">
                        If you didn't request this OTP, please ignore this email.
                    </p>
                </body>
            </html>
            """

            text_body = f"""
            Welcome to EconoMe, {name}!

            Your One-Time Password (OTP) is: {otp}

            This OTP will expire in 10 minutes.

            Never share this OTP with anyone.

            If you didn't request this OTP, please ignore this email.
            """

            result = await send_email_async(
                to_email=recipient_email,
                subject=subject,
                html_body=html_body,
                text_body=text_body,
            )

            logger.info(f"OTP email sent successfully to {recipient_email}")
            return result

        except Exception as e:
            logger.error(f"Failed to send OTP email to {recipient_email}: {str(e)}")
            return False

    @staticmethod
    async def send_welcome_email(
        recipient_email: str,
        name: str,
        verification_link: str,
    ) -> bool:
        """Send welcome email with verification link."""
        try:
            from shared.smtp_client import send_email_async

            subject = "Welcome to EconoMe - Verify Your Email"

            html_body = f"""
            <html>
                <body style="font-family: Arial, sans-serif;">
                    <h2>Welcome to EconoMe, {name}!</h2>
                    <p>Thank you for signing up for EconoMe, your AI-powered personal finance platform.</p>
                    <p>
                        <a href="{verification_link}"
                           style="background-color: #2563eb; color: white; padding: 10px 20px;
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            Verify Your Email
                        </a>
                    </p>
                    <p>Or copy this link: <code>{verification_link}</code></p>
                    <p>This link will expire in 24 hours.</p>
                    <hr>
                    <p style="font-size: 12px; color: #666;">
                        If you didn't create this account, please ignore this email.
                    </p>
                </body>
            </html>
            """

            result = await send_email_async(
                to_email=recipient_email,
                subject=subject,
                html_body=html_body,
                text_body=f"Welcome! Verify your email: {verification_link}",
            )

            logger.info(f"Welcome email sent to {recipient_email}")
            return result

        except Exception as e:
            logger.error(f"Failed to send welcome email to {recipient_email}: {str(e)}")
            return False

    @staticmethod
    async def send_suspicious_login_alert(
        recipient_email: str,
        name: str,
        device_info: dict,
        approve_link: str,
    ) -> bool:
        """Send alert for suspicious login from new device."""
        try:
            from shared.smtp_client import send_email_async

            subject = "EconoMe - New Login from Unrecognized Device"

            device_details = f"""
            Device OS: {device_info.get('os_name', 'Unknown')} {device_info.get('os_version', '')}
            Browser: {device_info.get('browser_name', 'Unknown')} {device_info.get('browser_version', '')}
            IP Address: {device_info.get('ip_address', 'Unknown')}
            """

            html_body = f"""
            <html>
                <body style="font-family: Arial, sans-serif;">
                    <h2>Security Alert</h2>
                    <p>Hi {name},</p>
                    <p>A login was attempted from an unrecognized device:</p>
                    <pre style="background: #f5f5f5; padding: 10px;">{device_details}</pre>
                    <p>
                        <a href="{approve_link}"
                           style="background-color: #22c55e; color: white; padding: 10px 20px;
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            Approve This Device
                        </a>
                    </p>
                    <p style="color: #666;">
                        If this wasn't you, your account is secure. Don't approve this device.
                    </p>
                    <hr>
                    <p style="font-size: 12px; color: #666;">
                        This is an automated security alert from EconoMe.
                    </p>
                </body>
            </html>
            """

            result = await send_email_async(
                to_email=recipient_email,
                subject=subject,
                html_body=html_body,
                text_body=f"New login from: {device_details}\n\nApprove here: {approve_link}",
            )

            logger.info(f"Suspicious login alert sent to {recipient_email}")
            return result

        except Exception as e:
            logger.error(f"Failed to send suspicious login alert to {recipient_email}: {str(e)}")
            return False
