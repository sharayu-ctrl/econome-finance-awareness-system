"""
EconoMe — Context-Aware Engine (Phase 4 §4.2)
Builds a real-time financial profile per user.
Maps macro sensitivity via Pearson correlation.
"""
import numpy as np
from scipy.stats import pearsonr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, date
from dateutil.relativedelta import relativedelta

from shared.models import FinancialSummary, AiContext
from shared.crypto import decrypt_amount


async def build_context(db: AsyncSession, user_id: str) -> tuple[np.ndarray, dict]:
    """
    Returns (feature_vector, macro_sensitivity_dict).

    Steps:
    1. Load last 6 months of monthly summaries.
    2. Load last 90 days of macro series.
    3. Compute Pearson correlation between expense totals and each macro indicator.
    4. Normalise into a unified feature vector.
    """
    # ── Monthly expense totals (last 6 months) ────────────────────────────────
    expense_series = await _load_expense_series(db, user_id, months=6)

    # ── Category ratios (current month) ──────────────────────────────────────
    current_period = datetime.utcnow().strftime("%Y-%m")
    ratios = await _load_category_ratios(db, user_id, current_period)

    # ── Macro series (last 6 months of monthly averages) ─────────────────────
    macro_series = await _load_macro_series(db)

    # ── Pearson correlation per indicator ─────────────────────────────────────
    sensitivity: dict[str, float] = {}
    for key, series in macro_series.items():
        aligned = _align_series(series, len(expense_series))
        if len(aligned) < 3:
            sensitivity[key] = 0.0
            continue
        try:
            r, _ = pearsonr(expense_series[:len(aligned)], aligned)
            sensitivity[key] = abs(float(r))
        except Exception:
            sensitivity[key] = 0.0

    # ── Build and normalise feature vector ────────────────────────────────────
    ratio_values = list(ratios.values()) or [0.0]
    sens_values  = list(sensitivity.values()) or [0.0]
    raw_vec = np.array(ratio_values + sens_values, dtype=float)
    norm = np.linalg.norm(raw_vec)
    feature_vector = raw_vec / norm if norm > 0 else raw_vec

    # ── Persist context snapshot ──────────────────────────────────────────────
    await _save_context(db, user_id, {
        "category_ratios": ratios,
        "macro_sensitivity": sensitivity,
        "expense_series": expense_series,
    })

    return feature_vector, sensitivity


async def _load_expense_series(db: AsyncSession, user_id: str, months: int) -> list[float]:
    """Load total monthly expenses for the last N months."""
    series = []
    now = datetime.utcnow()
    for i in range(months - 1, -1, -1):
        period = (now - relativedelta(months=i)).strftime("%Y-%m")
        result = await db.execute(
            select(FinancialSummary).where(
                FinancialSummary.user_id == user_id,
                FinancialSummary.period == period,
            )
        )
        s = result.scalar_one_or_none()
        if s and s.total_expense_enc:
            series.append(decrypt_amount(s.total_expense_enc, user_id))
        else:
            series.append(0.0)
    return series


async def _load_category_ratios(db: AsyncSession, user_id: str, period: str) -> dict:
    result = await db.execute(
        select(FinancialSummary).where(
            FinancialSummary.user_id == user_id,
            FinancialSummary.period == period,
        )
    )
    s = result.scalar_one_or_none()
    if not s or not s.expense_by_category:
        return {}
    total = sum(s.expense_by_category.values()) or 1
    return {k: v / total for k, v in s.expense_by_category.items()}


async def _load_macro_series(db: AsyncSession) -> dict[str, list[float]]:
    """
    Load macro indicators from the DB. Returns simplified monthly averages.
    In production this would aggregate from macro_economic_data by month.
    """
    from shared.models import MacroEconomicData
    indicators = ["REPO_RATE", "CPI_INDIA", "USD_INR", "CRUDE_OIL"]
    series: dict[str, list[float]] = {}
    for key in indicators:
        result = await db.execute(
            select(MacroEconomicData)
            .where(MacroEconomicData.indicator_key == key)
            .order_by(MacroEconomicData.recorded_at.desc())
            .limit(6)
        )
        rows = result.scalars().all()
        series[key] = [float(r.value) for r in reversed(rows)]
    return series


def _align_series(series: list[float], target_len: int) -> list[float]:
    if len(series) >= target_len:
        return series[-target_len:]
    return series


async def _save_context(db: AsyncSession, user_id: str, context_json: dict):
    from datetime import timedelta
    existing = await db.execute(
        select(AiContext).where(
            AiContext.user_id == user_id,
            AiContext.context_type == "insight",
        )
    )
    ctx = existing.scalar_one_or_none()
    expires = datetime.utcnow() + timedelta(hours=24)
    if ctx:
        ctx.context_json = context_json
        ctx.expires_at   = expires
    else:
        db.add(AiContext(
            user_id=user_id,
            context_type="insight",
            context_json=context_json,
            expires_at=expires,
        ))
