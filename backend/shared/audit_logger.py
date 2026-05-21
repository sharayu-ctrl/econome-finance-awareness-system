"""
EconoMe Audit Logging Service (Phase 4e)
Logs sensitive operations for compliance and security audit
"""
from datetime import datetime
from enum import Enum
from typing import Optional, Any
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import Column, String, DateTime, Integer, Text, JSON
from sqlalchemy.orm import declarative_base
from loguru import logger

Base = declarative_base()


class AuditActionType(str, Enum):
    """Types of auditable actions"""
    LOGIN = "login"
    LOGOUT = "logout"
    LOGIN_FAILED = "login_failed"
    OTP_SENT = "otp_sent"
    OTP_VERIFIED = "otp_verified"
    TRANSACTION_CREATED = "transaction_created"
    TRANSACTION_DELETED = "transaction_deleted"
    TRANSFER_COMPLETED = "transfer_completed"
    PASSWORD_CHANGED = "password_changed"
    PROFILE_UPDATED = "profile_updated"
    SETTINGS_CHANGED = "settings_changed"
    API_KEY_CREATED = "api_key_created"
    API_KEY_REVOKED = "api_key_revoked"
    DATA_EXPORT = "data_export"
    SENSITIVE_READ = "sensitive_read"


class AuditLog(Base):
    """Database model for audit logs"""
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), index=True)
    action_type = Column(String(50), index=True)
    resource_type = Column(String(100))  # e.g., "transaction", "account"
    resource_id = Column(String(36))
    ip_address = Column(String(45))  # IPv4 + IPv6
    user_agent = Column(Text)
    old_value = Column(JSON)  # Previous value for updates
    new_value = Column(JSON)  # New value
    result = Column(String(20))  # "success" or "failure"
    error_message = Column(Text)
    metadata = Column(JSON)  # Additional context
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "action_type": self.action_type,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "ip_address": self.ip_address,
            "result": self.result,
            "timestamp": self.timestamp.isoformat(),
        }


class AuditLogger:
    """Log sensitive operations to database and logs"""

    def __init__(self, db_session: AsyncSession):
        self.db = db_session

    async def log(
        self,
        user_id: str,
        action_type: AuditActionType,
        resource_type: str,
        resource_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        old_value: Optional[dict] = None,
        new_value: Optional[dict] = None,
        result: str = "success",
        error_message: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> AuditLog:
        """Log an audit event"""
        from nanoid import generate

        try:
            audit_log = AuditLog(
                id=generate(),
                user_id=user_id,
                action_type=action_type.value,
                resource_type=resource_type,
                resource_id=resource_id,
                ip_address=ip_address,
                user_agent=user_agent,
                old_value=old_value,
                new_value=new_value,
                result=result,
                error_message=error_message,
                metadata=metadata or {},
            )

            self.db.add(audit_log)
            await self.db.flush()

            # Also log to file
            log_msg = (
                f"[{action_type.value.upper()}] User: {user_id}, "
                f"Resource: {resource_type}/{resource_id}, "
                f"Result: {result}"
            )

            if result == "success":
                logger.info(f"✅ {log_msg}")
            else:
                logger.warning(f"⚠️  {log_msg} - {error_message}")

            return audit_log
        except Exception as e:
            logger.error(f"Failed to create audit log: {e}")
            raise

    async def log_transaction_created(
        self,
        user_id: str,
        transaction_id: str,
        amount: float,
        category: str,
        ip_address: Optional[str] = None,
        metadata: Optional[dict] = None,
    ):
        """Log transaction creation"""
        return await self.log(
            user_id=user_id,
            action_type=AuditActionType.TRANSACTION_CREATED,
            resource_type="transaction",
            resource_id=transaction_id,
            ip_address=ip_address,
            new_value={"amount": amount, "category": category},
            metadata=metadata,
        )

    async def log_login(
        self,
        user_id: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        metadata: Optional[dict] = None,
    ):
        """Log successful login"""
        return await self.log(
            user_id=user_id,
            action_type=AuditActionType.LOGIN,
            resource_type="user_session",
            resource_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            metadata=metadata,
        )

    async def log_login_failed(
        self,
        email: str,
        ip_address: Optional[str] = None,
        reason: str = "invalid_credentials",
    ):
        """Log failed login attempt"""
        return await self.log(
            user_id="unknown",
            action_type=AuditActionType.LOGIN_FAILED,
            resource_type="user_session",
            ip_address=ip_address,
            result="failure",
            error_message=reason,
            metadata={"email": email},
        )

    async def log_otp_verified(
        self,
        user_id: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ):
        """Log OTP verification"""
        return await self.log(
            user_id=user_id,
            action_type=AuditActionType.OTP_VERIFIED,
            resource_type="otp_verification",
            ip_address=ip_address,
            user_agent=user_agent,
        )

    async def log_password_changed(
        self,
        user_id: str,
        ip_address: Optional[str] = None,
        metadata: Optional[dict] = None,
    ):
        """Log password change"""
        return await self.log(
            user_id=user_id,
            action_type=AuditActionType.PASSWORD_CHANGED,
            resource_type="user_credentials",
            resource_id=user_id,
            ip_address=ip_address,
            metadata=metadata,
        )

    async def log_sensitive_read(
        self,
        user_id: str,
        resource_type: str,
        resource_id: str,
        ip_address: Optional[str] = None,
    ):
        """Log read of sensitive data (for compliance)"""
        return await self.log(
            user_id=user_id,
            action_type=AuditActionType.SENSITIVE_READ,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip_address,
        )

    async def log_data_export(
        self,
        user_id: str,
        export_type: str,
        record_count: int,
        ip_address: Optional[str] = None,
    ):
        """Log data export for GDPR compliance"""
        return await self.log(
            user_id=user_id,
            action_type=AuditActionType.DATA_EXPORT,
            resource_type="user_data",
            resource_id=user_id,
            ip_address=ip_address,
            metadata={"export_type": export_type, "record_count": record_count},
        )


class AuditMiddleware:
    """Middleware to capture request context for auditing"""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Extract IP address
        client_addr = scope.get("client", ("unknown", 0))[0]

        # Store in scope for handlers to access
        scope["client_ip"] = client_addr
        scope["user_agent"] = scope.get("headers", {}).get(b"user-agent", b"").decode()

        await self.app(scope, receive, send)


# Singleton instance factory
def get_audit_logger(db_session: AsyncSession) -> AuditLogger:
    """Get audit logger instance"""
    return AuditLogger(db_session)
