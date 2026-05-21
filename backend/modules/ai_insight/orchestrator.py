"""
EconoMe — AI Insight Pipeline Orchestrator (Phase 4 §4.1 Steps 1–5)
Ties together Context Engine, XAI, Foresight, Simulation, and Generative Layer.
"""
import asyncio
import hashlib
from datetime import datetime, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from shared.models import AiInsight, FinancialSummary, User
from shared.crypto import decrypt_amount, sha256_hex
from modules.macro.service import get_macro_snapshot
from modules.ai_insight.context_engine import build_context
from modules.ai_insight.xai_engine import explain, build_feature_dict
from modules.ai_insight.foresight_engine import forecast_all_categories
from modules.ai_insight.simulation_engine import simulate
from modules.ai_insight.generative_layer import generate_insight
from shared.exceptions import InsightNotFoundError


async def generate_daily_insight(db: AsyncSession, user_id: str) -> dict:
    """
    Full 5-step insight pipeline as per §4.1.
    Returns the final rendered insight dict.
    """
    today = date.today()

    # Check cache — avoid regenerating within same day
    existing = await db.execute(
        select(AiInsight).where(
            AiInsight.user_id == user_id,
            AiInsight.insight_date == today,
        )
    )
    cached = existing.scalar_one_or_none()
    if cached:
        return {
            "insight_id":    cached.insight_id,
            "insight_date":  str(cached.insight_date),
            "headline":      cached.insight_text[:80],
            "insight_body":  cached.insight_text,
            "xai_weights":   cached.feature_weights or {},
            "blockchain_hash": cached.insight_hash,
            "blockchain_tx":   cached.blockchain_tx_hash,
        }

    # ── Step 1: Data Ingestion ────────────────────────────────────────────────
    period = datetime.utcnow().strftime("%Y-%m")
    summary = await _get_summary(db, user_id, period)
    macro   = await get_macro_snapshot(db)

    # ── Step 2: Context Engine ────────────────────────────────────────────────
    feature_vector, sensitivity = await build_context(db, user_id)

    # ── Step 3: Parallel AI Modules ───────────────────────────────────────────
    prev_period = _prev_period(period)
    prev_summary = await _get_summary(db, user_id, prev_period)

    current_features  = build_feature_dict(
        summary.get("expense_by_category", {}), macro, summary
    )
    previous_features = build_feature_dict(
        prev_summary.get("expense_by_category", {}), macro, prev_summary
    )

    xai_results, category_forecasts, sim_result = await asyncio.gather(
        asyncio.to_thread(explain, current_features, previous_features, sensitivity),
        asyncio.to_thread(
            forecast_all_categories,
            {k: [v] for k, v in summary.get("expense_by_category", {}).items()},
        ),
        asyncio.to_thread(simulate, summary, {"expense_delta": 0.05}),
    )

    # ── Step 4: Generative Layer ──────────────────────────────────────────────
    user_result = await db.execute(select(User).where(User.user_id == user_id))
    user = user_result.scalar_one_or_none()
    name = user.full_name.split()[0] if user else "there"

    output = generate_insight(
        name=name,
        summary=summary,
        xai_results=xai_results,
        forecasts=category_forecasts,
        risk_flags=sim_result.risk_flags,
    )

    # ── Step 5: Store + Hash ──────────────────────────────────────────────────
    insight_text = output["insight_body"]
    insight_hash = sha256_hex(insight_text)

    insight = AiInsight(
        user_id=user_id,
        insight_date=today,
        insight_text=insight_text,
        insight_hash=insight_hash,
        feature_weights=output["xai_weights"],
        model_version="jinja2-v1.0",
    )
    db.add(insight)
    await db.flush()

    # Queue blockchain anchoring (fire-and-forget via Celery)
    from workers.tasks import anchor_insight_blockchain
    anchor_insight_blockchain.delay(insight.insight_id, insight_hash)

    output["insight_id"]   = insight.insight_id
    output["insight_date"] = str(today)
    output["blockchain_hash"] = insight_hash
    return output


async def _get_summary(db: AsyncSession, user_id: str, period: str) -> dict:
    result = await db.execute(
        select(FinancialSummary).where(
            FinancialSummary.user_id == user_id,
            FinancialSummary.period == period,
        )
    )
    s = result.scalar_one_or_none()
    if not s:
        return {"total_income": 0, "total_expense": 0, "total_savings": 0,
                "savings_rate": 0, "expense_by_category": {}}
    income  = decrypt_amount(s.total_income_enc,  user_id) if s.total_income_enc  else 0
    expense = decrypt_amount(s.total_expense_enc, user_id) if s.total_expense_enc else 0
    return {
        "total_income":       income,
        "total_expense":      expense,
        "total_savings":      income - expense,
        "savings_rate":       (income - expense) / income if income else 0,
        "expense_by_category": s.expense_by_category or {},
        "total_debt":         decrypt_amount(s.total_debt_enc, user_id) if s.total_debt_enc else 0,
    }


def _prev_period(period: str) -> str:
    year, month = map(int, period.split("-"))
    if month == 1:
        return f"{year-1}-12"
    return f"{year}-{month-1:02d}"
