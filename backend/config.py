"""
EconoMe — Configuration
Phase 1: All settings loaded from environment variables via Pydantic Settings.
"""

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── App ───────────────────────────────────────────────────────
    ENV: str = "development"
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION_USE_32_BYTE_RANDOM"
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8080"]
    ALLOWED_HOSTS: List[str] = ["*"]

    # ── Database ──────────────────────────────────────────────────
    DATABASE_URL: str = "mysql+aiomysql://econome:econome@localhost:3306/econome"
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 40

    # ── Redis ─────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── JWT ───────────────────────────────────────────────────────
    JWT_ALGORITHM: str = "RS256"
    JWT_ACCESS_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_EXPIRE_DAYS: int = 7
    JWT_PRIVATE_KEY_PATH: str = "keys/private.pem"
    JWT_PUBLIC_KEY_PATH: str = "keys/public.pem"

    # ── Encryption ────────────────────────────────────────────────
    MASTER_ENCRYPTION_KEY: str = "CHANGE_ME_32_BYTE_BASE64_ENCODED_KEY"
    KMS_KEY_ID: str = ""  # AWS KMS key ID for production

    # ── AI ────────────────────────────────────────────────────────
    LOCAL_LLM_ENABLED: bool = False
    LOCAL_LLM_MODEL_PATH: str = "models/mistral-7b-q4.gguf"
    ONNX_MODEL_PATH: str = "models/expense_categorizer.onnx"
    LLM_CONFIDENCE_THRESHOLD: float = 0.75

    # ── Celery ────────────────────────────────────────────────────
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # ── AWS ───────────────────────────────────────────────────────
    AWS_REGION: str = "ap-south-1"
    AWS_S3_BUCKET: str = "econome-media"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""

    # ── Blockchain ────────────────────────────────────────────────
    POLYGON_RPC_URL: str = "https://polygon-rpc.com"
    SMART_CONTRACT_ADDRESS: str = ""
    BLOCKCHAIN_WALLET_PRIVATE_KEY: str = ""
    BLOCKCHAIN_ENABLED: bool = False

    # ── SMTP / Email ──────────────────────────
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USE_TLS: bool = True
    SMTP_USERNAME: str = ""  # Gmail email or SMTP username
    SMTP_PASSWORD: str = ""  # Gmail App Password (not regular password)
    SENDER_EMAIL: str = ""  # Email to send from (usually same as SMTP_USERNAME)
    SENDER_NAME: str = "EconoMe"

    # ── Cookies & Security ────────────────────
    COOKIE_DOMAIN: str = ".localhost"  # Set to your domain in production
    SECURE_COOKIES: bool = False  # Set to True in production (requires HTTPS)
    COOKIE_SAME_SITE: str = "lax"  # Can be "strict", "lax", or "none"
    ENABLE_CSRF_PROTECTION: bool = True

    # ── External APIs ─────────────────────────────────────────────
    OPEN_EXCHANGE_RATES_KEY: str = ""
    EIA_API_KEY: str = ""

    # ── Rate Limiting ─────────────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 100
    AUTH_RATE_LIMIT_PER_MINUTE: int = 10

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
