"""
EconoMe — Database Models (Phase 2)
All tables as specified in the system design blueprint.
Financial columns are AES-256-GCM encrypted at the application layer
before being written; the DB only ever sees ciphertext.
"""
import uuid
from datetime import datetime, date
from sqlalchemy import (
    Column, String, Boolean, Text, Date, DateTime,
    Numeric, Enum as SAEnum, JSON, ForeignKey, Index,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from shared.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


# ─────────────────────────────────────────────────────────────────────────────
# users
# ─────────────────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    user_id       = Column(String(36),  primary_key=True, default=gen_uuid)
    email         = Column(String(320), unique=True, nullable=False, index=True)
    phone_hash    = Column(String(64),  unique=True)
    password_hash = Column(String(255), nullable=False)
    full_name     = Column(String(200), nullable=False)
    is_verified   = Column(Boolean, default=False)
    mfa_secret_enc= Column(Text)          # encrypted TOTP secret
    created_at    = Column(DateTime, default=datetime.utcnow)
    last_login_at = Column(DateTime)
    is_deleted    = Column(Boolean, default=False)

    financial_data     = relationship("FinancialData",    back_populates="user")
    financial_summary  = relationship("FinancialSummary", back_populates="user")
    ai_insights        = relationship("AiInsight",        back_populates="user")
    devices            = relationship("UserDevice",       back_populates="user")
    preferences        = relationship("UserPreference",   back_populates="user")
    learning_progress  = relationship("UserLearningProgress", back_populates="user")
    chat_history       = relationship("AiChatHistory",    back_populates="user")


# ─────────────────────────────────────────────────────────────────────────────
# financial_data
# ─────────────────────────────────────────────────────────────────────────────
class FinancialData(Base):
    __tablename__ = "financial_data"
    __table_args__ = (
        Index("ix_fd_user_date",     "user_id", "entry_date"),
        Index("ix_fd_user_category", "user_id", "category"),
    )

    entry_id     = Column(String(36), primary_key=True, default=gen_uuid)
    user_id      = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    entry_type   = Column(SAEnum("income","expense","savings","loan_payment"), nullable=False)
    amount_enc   = Column(Text, nullable=False)   # AES-256-GCM ciphertext
    currency     = Column(String(3), default="INR")
    category     = Column(String(50))
    merchant_name= Column(String(200))
    note_enc     = Column(Text)
    raw_input    = Column(Text)                   # original NL text for AI audit
    entry_date   = Column(Date, nullable=False)
    created_at   = Column(DateTime, default=datetime.utcnow)
    is_deleted   = Column(Boolean, default=False)

    user = relationship("User", back_populates="financial_data")


# ─────────────────────────────────────────────────────────────────────────────
# financial_summary  (monthly aggregates — pre-computed for insight speed)
# ─────────────────────────────────────────────────────────────────────────────
class FinancialSummary(Base):
    __tablename__ = "financial_summary"
    __table_args__ = (
        UniqueConstraint("user_id", "period", name="uq_summary_user_period"),
    )

    summary_id          = Column(String(36), primary_key=True, default=gen_uuid)
    user_id             = Column(String(36), ForeignKey("users.user_id"), nullable=False, index=True)
    period              = Column(String(7),  nullable=False)   # YYYY-MM
    total_income_enc    = Column(Text)
    total_expense_enc   = Column(Text)
    total_savings_enc   = Column(Text)
    total_debt_enc      = Column(Text)
    expense_by_category = Column(JSON)   # { Food: enc_val, ... }
    computed_at         = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="financial_summary")


# ─────────────────────────────────────────────────────────────────────────────
# macro_economic_data
# ─────────────────────────────────────────────────────────────────────────────
class MacroEconomicData(Base):
    __tablename__ = "macro_economic_data"
    __table_args__ = (
        Index("ix_macro_key_date", "indicator_key", "recorded_at"),
    )

    record_id     = Column(String(36), primary_key=True, default=gen_uuid)
    indicator_key = Column(String(50), nullable=False)  # REPO_RATE | CPI | USD_INR | ...
    value         = Column(Numeric(18, 6), nullable=False)
    unit          = Column(String(20))
    source        = Column(String(100))
    recorded_at   = Column(DateTime, nullable=False)
    is_latest     = Column(Boolean, default=False)


# ─────────────────────────────────────────────────────────────────────────────
# ai_insights
# ─────────────────────────────────────────────────────────────────────────────
class AiInsight(Base):
    __tablename__ = "ai_insights"
    __table_args__ = (
        Index("ix_insight_user_date", "user_id", "insight_date"),
    )

    insight_id        = Column(String(36), primary_key=True, default=gen_uuid)
    user_id           = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    insight_date      = Column(Date, nullable=False)
    insight_text      = Column(Text, nullable=False)
    insight_hash      = Column(String(64))   # SHA-256 for blockchain anchoring
    feature_weights   = Column(JSON)          # XAI explanation
    model_version     = Column(String(20))
    generated_at      = Column(DateTime, default=datetime.utcnow)
    blockchain_tx_hash= Column(String(66))

    user = relationship("User", back_populates="ai_insights")


# ─────────────────────────────────────────────────────────────────────────────
# ai_context  (assembled context per LLM call)
# ─────────────────────────────────────────────────────────────────────────────
class AiContext(Base):
    __tablename__ = "ai_context"

    context_id   = Column(String(36), primary_key=True, default=gen_uuid)
    user_id      = Column(String(36), ForeignKey("users.user_id"), nullable=False, index=True)
    context_type = Column(String(50), nullable=False)  # insight | chat | tutor
    context_json = Column(JSON)
    expires_at   = Column(DateTime)
    created_at   = Column(DateTime, default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────────────────────
# learning_content
# ─────────────────────────────────────────────────────────────────────────────
class LearningContent(Base):
    __tablename__ = "learning_content"

    lesson_id   = Column(String(36), primary_key=True, default=gen_uuid)
    topic       = Column(String(100), nullable=False)
    difficulty  = Column(SAEnum("beginner","intermediate","advanced"), nullable=False)
    content_md  = Column(Text, nullable=False)
    tags        = Column(JSON)           # list of tag strings
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

    progress = relationship("UserLearningProgress", back_populates="lesson")


# ─────────────────────────────────────────────────────────────────────────────
# user_learning_progress
# ─────────────────────────────────────────────────────────────────────────────
class UserLearningProgress(Base):
    __tablename__ = "user_learning_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "lesson_id", name="uq_progress_user_lesson"),
    )

    progress_id  = Column(String(36), primary_key=True, default=gen_uuid)
    user_id      = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    lesson_id    = Column(String(36), ForeignKey("learning_content.lesson_id"), nullable=False)
    status       = Column(SAEnum("not_started","in_progress","completed"), default="not_started")
    score        = Column(Numeric(5, 2))
    completed_at = Column(DateTime)
    created_at   = Column(DateTime, default=datetime.utcnow)

    user   = relationship("User",            back_populates="learning_progress")
    lesson = relationship("LearningContent", back_populates="progress")


# ─────────────────────────────────────────────────────────────────────────────
# ai_chat_history
# ─────────────────────────────────────────────────────────────────────────────
class AiChatHistory(Base):
    __tablename__ = "ai_chat_history"
    __table_args__ = (
        Index("ix_chat_session_time", "session_id", "created_at"),
    )

    message_id  = Column(String(36), primary_key=True, default=gen_uuid)
    session_id  = Column(String(36), nullable=False, index=True)
    user_id     = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    role        = Column(SAEnum("user","assistant"), nullable=False)
    message_enc = Column(Text, nullable=False)   # AES-encrypted chat message
    created_at  = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="chat_history")


# ─────────────────────────────────────────────────────────────────────────────
# user_preferences  (privacy settings, notification prefs, DEK reference)
# ─────────────────────────────────────────────────────────────────────────────
class UserPreference(Base):
    __tablename__ = "user_preferences"
    __table_args__ = (
        UniqueConstraint("user_id", "pref_key", name="uq_pref_user_key"),
    )

    pref_id    = Column(String(36), primary_key=True, default=gen_uuid)
    user_id    = Column(String(36), ForeignKey("users.user_id"), nullable=False, index=True)
    pref_key   = Column(String(100), nullable=False)
    pref_value = Column(Text)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="preferences")


# ─────────────────────────────────────────────────────────────────────────────
# user_devices  (device-based 3rd factor authentication)
# ─────────────────────────────────────────────────────────────────────────────
class UserDevice(Base):
    __tablename__ = "user_devices"

    device_id   = Column(String(36), primary_key=True, default=gen_uuid)
    user_id     = Column(String(36), ForeignKey("users.user_id"), nullable=False, index=True)
    fingerprint = Column(String(64), nullable=False)   # SHA-3-256 of device composite
    os_info     = Column(String(100))
    browser_info= Column(String(100))
    is_approved = Column(Boolean, default=False)
    approved_at = Column(DateTime)
    last_used   = Column(DateTime, default=datetime.utcnow)
    created_at  = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="devices")
