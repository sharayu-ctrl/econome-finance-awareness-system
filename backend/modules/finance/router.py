"""
EconoMe — Finance Router
Phase 3: Expense, income, summary endpoints (§3.3).
"""
from datetime import date
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db
from modules.auth.router import get_current_user
from modules.finance.service import (
    create_finance_entry, get_entries, delete_entry, get_summary
)

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class AddExpenseRequest(BaseModel):
    raw_text: str               # natural language: "Spent 300 on Swiggy"
    amount: float
    entry_date: date = date.today()
    note: str = ""
    currency: str = "INR"


class AddIncomeRequest(BaseModel):
    amount: float
    entry_date: date = date.today()
    note: str = ""
    currency: str = "INR"
    source: str = ""


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/expense", status_code=201)
async def add_expense(
    req: AddExpenseRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    POST /finance/expense
    Journey 1 from §1.4: NL input → async NLP categorization → AES encrypt → store.
    """
    entry = await create_finance_entry(
        db=db,
        user_id=current_user["sub"],
        entry_type="expense",
        amount=req.amount,
        raw_input=req.raw_text,
        entry_date=req.entry_date,
        currency=req.currency,
        note=req.note,
    )
    return {
        "expense_id": entry.entry_id,
        "message": "Expense recorded. Category being assigned...",
        "status": "categorizing",
    }


@router.post("/income", status_code=201)
async def add_income(
    req: AddIncomeRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entry = await create_finance_entry(
        db=db,
        user_id=current_user["sub"],
        entry_type="income",
        amount=req.amount,
        raw_input=f"Income: {req.source}",
        entry_date=req.entry_date,
        currency=req.currency,
        note=req.note,
        category="Income",
    )
    return {"income_id": entry.entry_id, "message": "Income recorded"}


@router.get("/summary")
async def get_monthly_summary(
    period: str = Query(default="", description="YYYY-MM, defaults to current month"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not period:
        from datetime import datetime
        period = datetime.utcnow().strftime("%Y-%m")
    return await get_summary(db, current_user["sub"], period)


@router.get("/entries")
async def list_entries(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, le=100),
    start_date: date | None = None,
    end_date: date | None = None,
    category: str | None = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_entries(
        db, current_user["sub"], page, page_size, start_date, end_date, category
    )


@router.delete("/entry/{entry_id}")
async def remove_entry(
    entry_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await delete_entry(db, entry_id, current_user["sub"])
    return {"message": "Entry deleted"}
