"""EconoMe — Macro Router"""

from fastapi import APIRouter, Depends
from shared.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession

from modules.auth.router import get_current_user
from modules.macro.service import get_macro_snapshot

router = APIRouter()


@router.get("/snapshot")
async def macro_snapshot(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return latest macro-economic indicators."""
    return await get_macro_snapshot(db)


@router.get("/live")
async def live_macro(db: AsyncSession = Depends(get_db)):
    """
    Fetches live data from free public APIs:
    - Exchange rates: exchangerate-api (free tier)
    - Crude oil: EIA
    - Inflation + Repo: seeded DB values (RBI doesn't have public API)
    """
    import httpx

    result = {}

    # USD/INR - free API no key needed
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get("https://open.er-api.com/v6/latest/USD")
            data = r.json()
            result["USD_INR"] = {
                "value": data["rates"]["INR"],
                "change_pct": 0.0,
                "source": "open.er-api.com",
                "updated": data.get("time_last_update_utc", ""),
            }
    except Exception:
        result["USD_INR"] = {"value": 83.62, "change_pct": 0.0, "source": "fallback"}

    # Macro from DB
    snapshot = await get_macro_snapshot(db)
    result["CPI_INDIA"] = snapshot.get("CPI_INDIA", {"value": 5.4})
    result["REPO_RATE"] = snapshot.get("REPO_RATE", {"value": 6.5})
    result["CRUDE_OIL"] = snapshot.get("CRUDE_OIL", {"value": 82.4})
    result["NIFTY50"] = snapshot.get("NIFTY50", {"value": 22530})

    return result
