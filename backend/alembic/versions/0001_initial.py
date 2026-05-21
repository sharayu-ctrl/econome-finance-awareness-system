"""
EconoMe — Alembic Initial Migration
Phase 2 + 10: Creates all tables defined in shared/models.py.
Run: alembic upgrade head
"""
from alembic import op
import sqlalchemy as sa


revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users ─────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("user_id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(320), unique=True, nullable=False),
        sa.Column("phone_hash", sa.String(64), unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("is_verified", sa.Boolean(), default=False),
        sa.Column("mfa_secret_enc", sa.Text()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("last_login_at", sa.DateTime()),
        sa.Column("is_deleted", sa.Boolean(), default=False),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # ── financial_data ────────────────────────────────────────────────────────
    op.create_table(
        "financial_data",
        sa.Column("entry_id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.user_id"), nullable=False),
        sa.Column("entry_type", sa.Enum("income","expense","savings","loan_payment"), nullable=False),
        sa.Column("amount_enc", sa.Text(), nullable=False),
        sa.Column("currency", sa.String(3), server_default="INR"),
        sa.Column("category", sa.String(50)),
        sa.Column("merchant_name", sa.String(200)),
        sa.Column("note_enc", sa.Text()),
        sa.Column("raw_input", sa.Text()),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("is_deleted", sa.Boolean(), default=False),
    )
    op.create_index("ix_fd_user_date", "financial_data", ["user_id", "entry_date"])
    op.create_index("ix_fd_user_category", "financial_data", ["user_id", "category"])

    # ── financial_summary ─────────────────────────────────────────────────────
    op.create_table(
        "financial_summary",
        sa.Column("summary_id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.user_id"), nullable=False),
        sa.Column("period", sa.String(7), nullable=False),
        sa.Column("total_income_enc", sa.Text()),
        sa.Column("total_expense_enc", sa.Text()),
        sa.Column("total_savings_enc", sa.Text()),
        sa.Column("total_debt_enc", sa.Text()),
        sa.Column("expense_by_category", sa.JSON()),
        sa.Column("computed_at", sa.DateTime()),
        sa.UniqueConstraint("user_id", "period", name="uq_summary_user_period"),
    )

    # ── macro_economic_data ───────────────────────────────────────────────────
    op.create_table(
        "macro_economic_data",
        sa.Column("record_id", sa.String(36), primary_key=True),
        sa.Column("indicator_key", sa.String(50), nullable=False),
        sa.Column("value", sa.Numeric(18, 6), nullable=False),
        sa.Column("unit", sa.String(20)),
        sa.Column("source", sa.String(100)),
        sa.Column("recorded_at", sa.DateTime(), nullable=False),
        sa.Column("is_latest", sa.Boolean(), default=False),
    )
    op.create_index("ix_macro_key_date", "macro_economic_data", ["indicator_key", "recorded_at"])

    # ── ai_insights ───────────────────────────────────────────────────────────
    op.create_table(
        "ai_insights",
        sa.Column("insight_id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.user_id"), nullable=False),
        sa.Column("insight_date", sa.Date(), nullable=False),
        sa.Column("insight_text", sa.Text(), nullable=False),
        sa.Column("insight_hash", sa.String(64)),
        sa.Column("feature_weights", sa.JSON()),
        sa.Column("model_version", sa.String(20)),
        sa.Column("generated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("blockchain_tx_hash", sa.String(66)),
    )
    op.create_index("ix_insight_user_date", "ai_insights", ["user_id", "insight_date"])

    # ── ai_context ────────────────────────────────────────────────────────────
    op.create_table(
        "ai_context",
        sa.Column("context_id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.user_id"), nullable=False),
        sa.Column("context_type", sa.String(50), nullable=False),
        sa.Column("context_json", sa.JSON()),
        sa.Column("expires_at", sa.DateTime()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── learning_content ──────────────────────────────────────────────────────
    op.create_table(
        "learning_content",
        sa.Column("lesson_id", sa.String(36), primary_key=True),
        sa.Column("topic", sa.String(100), nullable=False),
        sa.Column("difficulty", sa.Enum("beginner","intermediate","advanced"), nullable=False),
        sa.Column("content_md", sa.Text(), nullable=False),
        sa.Column("tags", sa.JSON()),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── user_learning_progress ────────────────────────────────────────────────
    op.create_table(
        "user_learning_progress",
        sa.Column("progress_id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.user_id"), nullable=False),
        sa.Column("lesson_id", sa.String(36), sa.ForeignKey("learning_content.lesson_id"), nullable=False),
        sa.Column("status", sa.Enum("not_started","in_progress","completed"), default="not_started"),
        sa.Column("score", sa.Numeric(5, 2)),
        sa.Column("completed_at", sa.DateTime()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "lesson_id", name="uq_progress_user_lesson"),
    )

    # ── ai_chat_history ───────────────────────────────────────────────────────
    op.create_table(
        "ai_chat_history",
        sa.Column("message_id", sa.String(36), primary_key=True),
        sa.Column("session_id", sa.String(36), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.user_id"), nullable=False),
        sa.Column("role", sa.Enum("user","assistant"), nullable=False),
        sa.Column("message_enc", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_chat_session_time", "ai_chat_history", ["session_id", "created_at"])

    # ── user_preferences ──────────────────────────────────────────────────────
    op.create_table(
        "user_preferences",
        sa.Column("pref_id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.user_id"), nullable=False),
        sa.Column("pref_key", sa.String(100), nullable=False),
        sa.Column("pref_value", sa.Text()),
        sa.Column("updated_at", sa.DateTime()),
        sa.UniqueConstraint("user_id", "pref_key", name="uq_pref_user_key"),
    )

    # ── user_devices ──────────────────────────────────────────────────────────
    op.create_table(
        "user_devices",
        sa.Column("device_id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.user_id"), nullable=False),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("os_info", sa.String(100)),
        sa.Column("browser_info", sa.String(100)),
        sa.Column("is_approved", sa.Boolean(), default=False),
        sa.Column("approved_at", sa.DateTime()),
        sa.Column("last_used", sa.DateTime()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    tables = [
        "user_devices", "user_preferences", "ai_chat_history",
        "user_learning_progress", "learning_content", "ai_context",
        "ai_insights", "macro_economic_data", "financial_summary",
        "financial_data", "users",
    ]
    for t in tables:
        op.drop_table(t)
