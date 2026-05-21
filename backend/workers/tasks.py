"""
EconoMe — Celery Worker Tasks (Phase 8)
Async task queue for:
  - NLP expense categorization
  - AI insight regeneration
  - Macro data ingestion (Beat scheduler)
  - Blockchain anchoring
  - Monthly summary recomputation
"""
import asyncio
from celery import Celery
from celery.schedules import crontab
from config import settings

# ── Celery App ────────────────────────────────────────────────────────────────

celery_app = Celery(
    "econome",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Kolkata",
    enable_utc=True,
    task_routes={
        "workers.tasks.categorize_expense_task":    {"queue": "high"},
        "workers.tasks.regenerate_insight_task":    {"queue": "high"},
        "workers.tasks.anchor_insight_blockchain":  {"queue": "low"},
        "workers.tasks.ingest_macro_data_task":     {"queue": "low"},
        "workers.tasks.recompute_all_summaries":    {"queue": "low"},
    },
    beat_schedule={
        "ingest-macro-every-15min": {
            "task": "workers.tasks.ingest_macro_data_task",
            "schedule": crontab(minute="*/15"),
        },
        "recompute-summaries-nightly": {
            "task": "workers.tasks.recompute_all_summaries",
            "schedule": crontab(hour=2, minute=0),  # 2AM IST
        },
    },
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_max_retries=3,
)


def _run_async(coro):
    """Helper to run async code from a sync Celery task."""
    return asyncio.get_event_loop().run_until_complete(coro)


# ── Task 1: NLP Expense Categorization ───────────────────────────────────────

@celery_app.task(bind=True, name="workers.tasks.categorize_expense_task",
                 max_retries=3, default_retry_delay=10)
def categorize_expense_task(self, entry_id: str, raw_text: str, user_id: str):
    """
    Pipeline 1 (§4.1): Fast ONNX categorization with LLM fallback.
    Updates the financial_data.category column after processing.
    """
    try:
        category, confidence, merchant = _classify_expense(raw_text)

        # Write back to DB
        async def _update():
            from shared.database import AsyncSessionLocal
            from shared.models import FinancialData
            from sqlalchemy import select, update
            async with AsyncSessionLocal() as db:
                await db.execute(
                    update(FinancialData)
                    .where(FinancialData.entry_id == entry_id)
                    .values(category=category, merchant_name=merchant)
                )
                await db.commit()

        _run_async(_update())
        return {"entry_id": entry_id, "category": category, "confidence": confidence}

    except Exception as exc:
        raise self.retry(exc=exc)


def _classify_expense(raw_text: str) -> tuple[str, float, str]:
    """
    ONNX classification path (< 50ms).
    Falls back to keyword rules if model not loaded.
    """
    text_lower = raw_text.lower()

    # Rule-based keyword classifier (replaces ONNX model in dev environment)
    KEYWORD_RULES = {
        "food":       ["swiggy", "zomato", "restaurant", "coffee", "eat", "food", "grocery", "bigbasket", "blinkit"],
        "transport":  ["uber", "ola", "petrol", "diesel", "metro", "bus", "train", "rapido", "irctc"],
        "medical":    ["apollo", "pharmacy", "doctor", "hospital", "medicine", "clinic", "health"],
        "rent":       ["rent", "landlord", "pg", "hostel", "accommodation"],
        "utilities":  ["electricity", "water", "internet", "wifi", "jio", "airtel", "gas", "lpg"],
        "emi":        ["emi", "loan", "mortgage", "equated"],
        "entertainment": ["netflix", "amazon prime", "hotstar", "movie", "concert", "gaming", "spotify"],
    }

    for category, keywords in KEYWORD_RULES.items():
        for kw in keywords:
            if kw in text_lower:
                merchant = _extract_merchant(raw_text)
                return category.capitalize(), 0.85, merchant

    return "Other", 0.60, ""


def _extract_merchant(text: str) -> str:
    """Simple merchant name extraction — first capitalized word after 'to' or 'at'."""
    import re
    match = re.search(r"\b(?:to|at|on|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)", text)
    return match.group(1) if match else ""


# ── Task 2: Regenerate AI Insight ────────────────────────────────────────────

@celery_app.task(bind=True, name="workers.tasks.regenerate_insight_task",
                 max_retries=2, default_retry_delay=30)
def regenerate_insight_task(self, user_id: str):
    """
    Triggered via Redis pub/sub after new expense entry.
    Deletes today's cached insight and triggers regeneration.
    """
    try:
        async def _regen():
            from shared.database import AsyncSessionLocal
            from shared.models import AiInsight
            from sqlalchemy import delete
            from datetime import date
            async with AsyncSessionLocal() as db:
                # Remove today's insight so next fetch regenerates fresh
                await db.execute(
                    delete(AiInsight).where(
                        AiInsight.user_id == user_id,
                        AiInsight.insight_date == date.today(),
                    )
                )
                await db.commit()
        _run_async(_regen())
    except Exception as exc:
        raise self.retry(exc=exc)


# ── Task 3: Blockchain Anchoring ──────────────────────────────────────────────

@celery_app.task(bind=True, name="workers.tasks.anchor_insight_blockchain",
                 max_retries=5, default_retry_delay=60)
def anchor_insight_blockchain(self, insight_id: str, insight_hash: str):
    """Phase 7: Anchor insight hash on Polygon L2."""
    try:
        from shared.blockchain import anchor_insight
        tx_hash = anchor_insight(insight_id, insight_hash)
        if tx_hash:
            async def _save_tx():
                from shared.database import AsyncSessionLocal
                from shared.models import AiInsight
                from sqlalchemy import update
                async with AsyncSessionLocal() as db:
                    await db.execute(
                        update(AiInsight)
                        .where(AiInsight.insight_id == insight_id)
                        .values(blockchain_tx_hash=tx_hash)
                    )
                    await db.commit()
            _run_async(_save_tx())
        return {"tx_hash": tx_hash}
    except Exception as exc:
        raise self.retry(exc=exc)


# ── Task 4: Macro Data Ingestion (Beat) ───────────────────────────────────────

@celery_app.task(name="workers.tasks.ingest_macro_data_task")
def ingest_macro_data_task():
    """Phase 3 §3.4: Called every 15 minutes by Celery Beat."""
    async def _ingest():
        from shared.database import AsyncSessionLocal
        from modules.macro.service import ingest_macro_data
        async with AsyncSessionLocal() as db:
            result = await ingest_macro_data(db)
            await db.commit()
            return result
    return _run_async(_ingest())


# ── Task 5: Nightly Summary Recomputation ─────────────────────────────────────

@celery_app.task(name="workers.tasks.recompute_all_summaries")
def recompute_all_summaries():
    """Nightly 2AM: recompute financial summaries for all active users."""
    async def _recompute():
        from shared.database import AsyncSessionLocal
        from shared.models import User
        from sqlalchemy import select
        from datetime import datetime
        from modules.finance.service import _recompute_summary

        async with AsyncSessionLocal() as db:
            users = (await db.execute(
                select(User).where(User.is_deleted == False, User.is_verified == True)
            )).scalars().all()
            period = datetime.utcnow().strftime("%Y-%m")
            for user in users:
                try:
                    from datetime import date
                    await _recompute_summary(db, user.user_id, period)
                except Exception as e:
                    print(f"[summary] failed for {user.user_id}: {e}")
            await db.commit()
    _run_async(_recompute())
