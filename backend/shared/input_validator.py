"""
EconoMe Input Validation & Sanitization (Phase 6a)
OWASP-compliant input validation and sanitization
"""
from typing import Any, Pattern
import re
from enum import Enum
from pydantic import BaseModel, validator, EmailStr, Field
from loguru import logger


class ValidationRules(str, Enum):
    """Validation rule types"""
    EMAIL = "email"
    PASSWORD = "password"
    USERNAME = "username"
    AMOUNT = "amount"
    PHONE = "phone"
    URL = "url"
    UUID = "uuid"
    SLUG = "slug"


class InputValidator:
    """Centralized input validation following OWASP guidelines"""

    # Regex patterns
    PATTERNS: dict[str, Pattern] = {
        "email": re.compile(
            r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$",
            re.IGNORECASE,
        ),
        "username": re.compile(r"^[a-zA-Z0-9_-]{3,32}$"),
        "slug": re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$"),
        "uuid": re.compile(
            r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
            re.IGNORECASE,
        ),
        "phone": re.compile(r"^\+?1?\d{9,15}$"),
        "url": re.compile(r"^https?://[a-zA-Z0-9.-]+(:[0-9]+)?(/.*)?$"),
    }

    @staticmethod
    def validate_email(email: str, max_length: int = 254) -> bool:
        """Validate email address"""
        if not email or len(email) > max_length:
            return False
        return bool(InputValidator.PATTERNS["email"].match(email))

    @staticmethod
    def validate_password(password: str) -> tuple[bool, str]:
        """
        Validate password strength
        Requirements: 12+ chars, uppercase, lowercase, digit, special char
        """
        if len(password) < 12:
            return False, "Password must be at least 12 characters"
        if not re.search(r"[A-Z]", password):
            return False, "Password must contain uppercase letter"
        if not re.search(r"[a-z]", password):
            return False, "Password must contain lowercase letter"
        if not re.search(r"\d", password):
            return False, "Password must contain digit"
        if not re.search(r"[!@#$%^&*()_+\-=\[\]{};:'\",.<>?]", password):
            return False, "Password must contain special character"
        return True, "Password is valid"

    @staticmethod
    def validate_username(username: str) -> bool:
        """Validate username (3-32 chars, alphanumeric, underscore, hyphen)"""
        if not username or len(username) < 3 or len(username) > 32:
            return False
        return bool(InputValidator.PATTERNS["username"].match(username))

    @staticmethod
    def validate_amount(amount: float, min_val: float = 0.01, max_val: float = 1_000_000_000) -> bool:
        """Validate monetary amount"""
        try:
            amount = float(amount)
            return min_val <= amount <= max_val
        except (ValueError, TypeError):
            return False

    @staticmethod
    def validate_phone(phone: str) -> bool:
        """Validate phone number"""
        # Remove common separators
        clean_phone = re.sub(r"[\s\-().]", "", phone)
        return bool(InputValidator.PATTERNS["phone"].match(clean_phone))

    @staticmethod
    def validate_url(url: str) -> bool:
        """Validate URL"""
        return bool(InputValidator.PATTERNS["url"].match(url))

    @staticmethod
    def sanitize_string(
        text: str,
        max_length: int = 1000,
        allow_html: bool = False,
        strip_whitespace: bool = True,
    ) -> str:
        """
        Sanitize string input
        Prevents XSS, SQL injection at input level
        """
        if not isinstance(text, str):
            return ""

        # Limit length
        text = text[:max_length]

        # Strip whitespace
        if strip_whitespace:
            text = text.strip()

        # Remove HTML tags if not allowed
        if not allow_html:
            text = re.sub(r"<[^>]*>", "", text)

        # Escape dangerous characters
        text = text.replace("\\", "\\\\")
        text = text.replace("'", "\\'")
        text = text.replace('"', '\\"')

        return text

    @staticmethod
    def sanitize_sql_param(param: Any) -> str:
        """
        Sanitize parameter for SQL (additional layer)
        Use parameterized queries as primary defense
        """
        if param is None:
            return "NULL"

        if isinstance(param, str):
            # Escape single quotes (parameterized queries do this automatically)
            return f"'{param.replace(\"'\", \"''\")}'"
        elif isinstance(param, (int, float)):
            return str(param)
        elif isinstance(param, bool):
            return "1" if param else "0"
        else:
            raise ValueError(f"Unsupported SQL type: {type(param)}")

    @staticmethod
    def validate_json_input(data: dict, required_fields: list[str]) -> tuple[bool, str]:
        """Validate JSON input has required fields"""
        missing = [f for f in required_fields if f not in data]
        if missing:
            return False, f"Missing required fields: {', '.join(missing)}"
        return True, "Valid"


class UserCreateSchema(BaseModel):
    """Validated user creation input"""
    email: EmailStr = Field(..., max_length=254)
    password: str = Field(..., min_length=12, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=200)

    @validator("email")
    def validate_email_format(cls, v):
        if not InputValidator.validate_email(v):
            raise ValueError("Invalid email format")
        return v.lower()

    @validator("password")
    def validate_password_strength(cls, v):
        valid, msg = InputValidator.validate_password(v)
        if not valid:
            raise ValueError(msg)
        return v

    @validator("full_name")
    def sanitize_name(cls, v):
        return InputValidator.sanitize_string(v, max_length=200)


class TransactionCreateSchema(BaseModel):
    """Validated transaction creation input"""
    amount: float = Field(..., gt=0, le=1_000_000_000)
    category: str = Field(..., min_length=1, max_length=50)
    description: str = Field("", max_length=500)
    transaction_type: str = Field("expense", regex="^(income|expense|transfer)$")

    @validator("category", "description")
    def sanitize_strings(cls, v):
        return InputValidator.sanitize_string(v)

    @validator("amount")
    def validate_amount(cls, v):
        if not InputValidator.validate_amount(v):
            raise ValueError("Invalid amount")
        return v


# Singleton instance
input_validator = InputValidator()


def get_input_validator() -> InputValidator:
    """Get input validator instance"""
    return input_validator
