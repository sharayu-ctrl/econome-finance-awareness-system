"""EconoMe — AI Insight Router"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db
from modules.auth.router import get_current_user
from modules.ai_insight.orchestrator import generate_daily_insight
from modules.ai_insight.simulation_engine import simulate

router = APIRouter()


class SimulationRequest(BaseModel):
    expense_delta: float = 0.0
    income_delta: float = 0.0
    emi_delta: float = 0.0


@router.get("/today")
async def today_insight(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate (or return cached) today's AI insight for the authenticated user."""
    return await generate_daily_insight(db, current_user["sub"])


@router.post("/simulate")
async def run_simulation(
    req: SimulationRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """What-if simulation on the user's current financial summary."""
    from modules.ai_insight.orchestrator import _get_summary
    from datetime import datetime
    period = datetime.utcnow().strftime("%Y-%m")
    summary = await _get_summary(db, current_user["sub"], period)
    result = simulate(summary, req.dict(exclude_none=True))
    return {
        "health_score":      result.health_score,
        "risk_flags":        result.risk_flags,
        "delta":             result.delta,
        "simulated_summary": result.simulated_summary,
    }
