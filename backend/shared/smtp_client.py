"""
EconoMe — SMTP Email Client (Phase 1)
Async email sending via SMTP for OTP verification and alerts.
"""

import smtplib
import asyncio
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

from config import settings

logger = logging.getLogger(__name__)


class SMTPConfig:
    """SMTP Configuration"""

    # Gmail SMTP settings (for Gmail App Passwords)
    GMAIL_SMTP_HOST = "smtp.gmail.com"
    GMAIL_SMTP_PORT = 587

    # Generic SMTP settings
    SMTP_HOST = settings.SMTP_HOST if hasattr(settings, "SMTP_HOST") else "smtp.gmail.com"
    SMTP_PORT = settings.SMTP_PORT if hasattr(settings, "SMTP_PORT") else 587
    SMTP_USE_TLS = settings.SMTP_USE_TLS if hasattr(settings, "SMTP_USE_TLS") else True
    SMTP_USERNAME = settings.SMTP_USERNAME if hasattr(settings, "SMTP_USERNAME") else ""
    SMTP_PASSWORD = settings.SMTP_PASSWORD if hasattr(settings, "SMTP_PASSWORD") else ""
    SENDER_EMAIL = settings.SENDER_EMAIL if hasattr(settings, "SENDER_EMAIL") else SMTP_USERNAME
    SENDER_NAME = settings.SENDER_NAME if hasattr(settings, "SENDER_NAME") else "EconoMe"


async def send_email_async(
    to_email: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
) -> bool:
    """
    Send email asynchronously using SMTP.

    Args:
        to_email: Recipient's email address
        subject: Email subject
        html_body: Email HTML body
        text_body: Plain text fallback body

    Returns:
        True if sent successfully, False otherwise
    """

    # Validate configuration
    if not SMTPConfig.SMTP_USERNAME or not SMTPConfig.SMTP_PASSWORD:
        logger.error("SMTP credentials not configured")
        return False

    try:
        # Run blocking SMTP operations in thread pool
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            _send_email_sync,
            to_email,
            subject,
            html_body,
            text_body,
        )

    except Exception as e:
        logger.error(f"Error sending email to {to_email}: {str(e)}")
        return False


def _send_email_sync(
    to_email: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
) -> bool:
    """Blocking SMTP send (run in executor)."""

    try:
        # Create message
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = f"{SMTPConfig.SENDER_NAME} <{SMTPConfig.SENDER_EMAIL}>"
        message["To"] = to_email

        # Add text and HTML parts
        if text_body:
            message.attach(MIMEText(text_body, "plain"))
        message.attach(MIMEText(html_body, "html"))

        # Connect and send
        with smtplib.SMTP(SMTPConfig.SMTP_HOST, SMTPConfig.SMTP_PORT) as server:
            if SMTPConfig.SMTP_USE_TLS:
                server.starttls()

            server.login(SMTPConfig.SMTP_USERNAME, SMTPConfig.SMTP_PASSWORD)
            server.send_message(message)

        logger.info(f"Email sent successfully to {to_email}")
        return True

    except smtplib.SMTPAuthenticationError:
        logger.error("SMTP authentication failed. Check credentials.")
        return False

    except smtplib.SMTPException as e:
        logger.error(f"SMTP error: {str(e)}")
        return False

    except Exception as e:
        logger.error(f"Email send error: {str(e)}")
        return False


async def send_batch_emails(emails: list[dict]) -> dict:
    """
    Send multiple emails concurrently.

    Args:
        emails: List of dicts with keys: to_email, subject, html_body, text_body

    Returns:
        Dict with success/failure counts
    """
    tasks = [
        send_email_async(
            e["to_email"],
            e["subject"],
            e["html_body"],
            e.get("text_body"),
        )
        for e in emails
    ]

    results = await asyncio.gather(*tasks)
    return {
        "total": len(results),
        "successful": sum(results),
        "failed": len(results) - sum(results),
    }
