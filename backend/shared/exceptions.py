"""
EconoMe — Exception Definitions & Handlers
Phase 3: Domain-specific exceptions mapped to clean HTTP responses.
"""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


# ── Domain Exceptions ─────────────────────────────────────────────────────────

class EconoMeException(Exception):
    """Base exception for all EconoMe domain errors."""
    status_code: int = 500
    detail: str = "Internal server error"

    def __init__(self, detail: str | None = None):
        self.detail = detail or self.__class__.detail


class AuthenticationError(EconoMeException):
    status_code = 401
    detail = "Authentication required"


class AuthorizationError(EconoMeException):
    status_code = 403
    detail = "Insufficient permissions"


class TokenExpiredError(AuthenticationError):
    detail = "Access token has expired"


class TokenBlacklistedError(AuthenticationError):
    detail = "Token has been revoked"


class MFARequiredError(AuthenticationError):
    detail = "Multi-factor authentication required"


class DeviceNotApprovedError(AuthenticationError):
    detail = "New device detected — please approve via email"


class UserNotFoundError(EconoMeException):
    status_code = 404
    detail = "User not found"


class FinanceEntryNotFoundError(EconoMeException):
    status_code = 404
    detail = "Finance entry not found"


class InsightNotFoundError(EconoMeException):
    status_code = 404
    detail = "No insight found for the given date"


class ValidationError(EconoMeException):
    status_code = 422
    detail = "Validation error"


class RateLimitExceededError(EconoMeException):
    status_code = 429
    detail = "Rate limit exceeded — please slow down"


class EncryptionError(EconoMeException):
    status_code = 500
    detail = "Data processing error"   # never expose crypto details


class MacroDataUnavailableError(EconoMeException):
    status_code = 503
    detail = "Macro-economic data temporarily unavailable"


# ── FastAPI Exception Handlers ────────────────────────────────────────────────

def register_exception_handlers(app: FastAPI) -> None:

    @app.exception_handler(EconoMeException)
    async def econome_exception_handler(request: Request, exc: EconoMeException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.detail, "type": type(exc).__name__},
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        # Log the real exception internally; return a safe message
        return JSONResponse(
            status_code=500,
            content={"error": "An unexpected error occurred", "type": "InternalServerError"},
        )
