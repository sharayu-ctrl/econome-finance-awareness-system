"""
EconoMe — Finance Service
Phase 3: Expense/income CRUD with AES encryption + monthly summary recomputation.
NLP categorization is dispatched asynchronously to Celery workers.
"""
from datetime import date, datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_
from sqlalchemy.dialects.mysql import insert as mysql_insert

from shared.models import FinancialData, FinancialSummary
from shared.crypto import encrypt_amount, decrypt_amount, encrypt, decrypt
from shared.exceptions import FinanceEntryNotFoundError, AuthorizationError
from workers.tasks import categorize_expense_task, regenerate_insight_task


# ── Create Entry ──────────────────────────────────────────────────────────────

async def create_finance_entry(
    db: AsyncSession,
    user_id: str,
    entry_type: str,
    amount: float,
    raw_input: str,
    entry_date: date,
    currency: str = "INR",
    note: str = "",
    category: str | None = None,
) -> FinancialData:
    amount_enc = encrypt_amount(amount, user_id)
    note_enc   = encrypt(note, user_id) if note else None

    entry = FinancialData(
        user_id=user_id,
        entry_type=entry_type,
        amount_enc=amount_enc,
        currency=currency,
        category=category,
        note_enc=note_enc,
        raw_input=raw_input,
        entry_date=entry_date,
    )
    db.add(entry)
    await db.flush()

    # Dispatch async NLP categorization if category not already known
    if not category:
        categorize_expense_task.delay(entry.entry_id, raw_input, user_id)

    # Trigger insight regeneration via Redis pub/sub
    regenerate_insight_task.apply_async(args=[user_id], countdown=5)

    # Recompute monthly summary
    await _recompute_summary(db, user_id, entry_date.strftime("%Y-%m"))
    return entry


# ── Read Entries ──────────────────────────────────────────────────────────────

async def get_entries(
    db: AsyncSession,
    user_id: str,
    page: int = 1,
    page_size: int = 20,
    start_date: date | None = None,
    end_date: date | None = None,
    category: str | None = None,
) -> list[dict]:
    q = select(FinancialData).where(
        FinancialData.user_id == user_id,
        FinancialData.is_deleted == False,
    )
    if start_date:
        q = q.where(FinancialData.entry_date >= start_date)
    if end_date:
        q = q.where(FinancialData.entry_date <= end_date)
    if category:
        q = q.where(FinancialData.category == category)

    q = q.order_by(FinancialData.entry_date.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    rows = result.scalars().all()

    return [_decrypt_entry(r, user_id) for r in rows]


def _decrypt_entry(entry: FinancialData, user_id: str) -> dict:
    return {
        "entry_id":    entry.entry_id,
        "entry_type":  entry.entry_type,
        "amount":      decrypt_amount(entry.amount_enc, user_id),
        "currency":    entry.currency,
        "category":    entry.category,
        "merchant_name": entry.merchant_name,
        "note":        decrypt(entry.note_enc, user_id) if entry.note_enc else "",
        "entry_date":  str(entry.entry_date),
        "created_at":  str(entry.created_at),
    }


# ── Soft Delete ───────────────────────────────────────────────────────────────

async def delete_entry(db: AsyncSession, entry_id: str, user_id: str) -> None:
    result = await db.execute(
        select(FinancialData).where(FinancialData.entry_id == entry_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise FinanceEntryNotFoundError()
    if entry.user_id != user_id:
        raise AuthorizationError("Not your entry")
    entry.is_deleted = True


# ── Summary ───────────────────────────────────────────────────────────────────

async def get_summary(db: AsyncSession, user_id: str, period: str) -> dict:
    """Fetch and decrypt monthly financial summary."""
    result = await db.execute(
        select(FinancialSummary).where(
            FinancialSummary.user_id == user_id,
            FinancialSummary.period == period,
        )
    )
    s = result.scalar_one_or_none()
    if not s:
        return {}

    income  = decrypt_amount(s.total_income_enc,  user_id) if s.total_income_enc  else 0.0
    expense = decrypt_amount(s.total_expense_enc, user_id) if s.total_expense_enc else 0.0
    savings = income - expense

    return {
        "period":        s.period,
        "total_income":  income,
        "total_expense": expense,
        "total_savings": savings,
        "savings_rate":  round(savings / income, 4) if income else 0,
        "computed_at":   str(s.computed_at),
    }


async def _recompute_summary(db: AsyncSession, user_id: str, period: str) -> None:
    """Recompute and upsert the monthly summary for a user."""
    year, month = period.split("-")
    q = select(FinancialData).where(
        FinancialData.user_id == user_id,
        FinancialData.is_deleted == False,
        FinancialData.entry_date >= date(int(year), int(month), 1),
    )
    result = await db.execute(q)
    entries = result.scalars().all()

    totals: dict[str, float] = {"income": 0.0, "expense": 0.0, "savings": 0.0, "loan_payment": 0.0}
    categories: dict[str, float] = {}
    for e in entries:
        amt = decrypt_amount(e.amount_enc, user_id)
        totals[e.entry_type] += amt
        if e.entry_type == "expense" and e.category:
            categories[e.category] = categories.get(e.category, 0.0) + amt

    # Check existing summary
    existing = await db.execute(
        select(FinancialSummary).where(
            FinancialSummary.user_id == user_id,
            FinancialSummary.period == period,
        )
    )
    s = existing.scalar_one_or_none()
    if s:
        s.total_income_enc  = encrypt_amount(totals["income"],  user_id)
        s.total_expense_enc = encrypt_amount(totals["expense"], user_id)
        s.total_savings_enc = encrypt_amount(totals["savings"], user_id)
        s.total_debt_enc    = encrypt_amount(totals["loan_payment"], user_id)
        s.expense_by_category = categories
        s.computed_at = datetime.utcnow()
    else:
        db.add(FinancialSummary(
            user_id=user_id,
            period=period,
            total_income_enc  = encrypt_amount(totals["income"],  user_id),
            total_expense_enc = encrypt_amount(totals["expense"], user_id),
            total_savings_enc = encrypt_amount(totals["savings"], user_id),
            total_debt_enc    = encrypt_amount(totals["loan_payment"], user_id),
            expense_by_category=categories,
        ))
