"""
EconoMe — Macro Economic Data Service
Phase 3 §3.4: Ingestion from external APIs + Redis caching + DB storage.
"""
import json
import httpx
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from shared.models import MacroEconomicData
from shared.redis_client import cache_set, cache_get
from config import settings

INDICATORS = ["REPO_RATE", "CPI_INDIA", "USD_INR", "CRUDE_OIL", "NIFTY50"]
CACHE_TTL = {
    "REPO_RATE":  86400,   # 24h — only changes on RBI announcement days
    "CPI_INDIA":  86400 * 30,  # monthly
    "USD_INR":    900,     # 15 min
    "CRUDE_OIL":  900,
    "NIFTY50":    300,     # 5 min during market hours
}


async def get_macro_snapshot(db: AsyncSession) -> dict:
    """
    Return the latest macro values, served from Redis cache where possible.
    Falls back to DB on cache miss.
    """
    snapshot = {}
    for key in INDICATORS:
        cached = await cache_get(f"macro:{key}")
        if cached:
            snapshot[key] = json.loads(cached)
        else:
            result = await db.execute(
                select(MacroEconomicData).where(
                    MacroEconomicData.indicator_key == key,
                    MacroEconomicData.is_latest == True,
                )
            )
            row = result.scalar_one_or_none()
            if row:
                val = {
                    "value":       float(row.value),
                    "unit":        row.unit,
                    "source":      row.source,
                    "recorded_at": str(row.recorded_at),
                    "is_stale":    False,
                }
                snapshot[key] = val
                await cache_set(f"macro:{key}", json.dumps(val), CACHE_TTL.get(key, 900))
    return snapshot


async def ingest_macro_data(db: AsyncSession) -> dict[str, str]:
    """
    Called by Celery Beat scheduler every 15 minutes.
    Returns dict of {indicator: status}.
    """
    results = {}
    results["USD_INR"]   = await _fetch_usd_inr(db)
    results["CRUDE_OIL"] = await _fetch_crude_oil(db)
    # REPO_RATE and CPI are updated manually / via RBI webhook in production
    return results


async def _upsert_indicator(db: AsyncSession, key: str, value: float, unit: str, source: str):
    # Mark old latest as not latest
    await db.execute(
        update(MacroEconomicData)
        .where(MacroEconomicData.indicator_key == key, MacroEconomicData.is_latest == True)
        .values(is_latest=False)
    )
    db.add(MacroEconomicData(
        indicator_key=key,
        value=value,
        unit=unit,
        source=source,
        recorded_at=datetime.utcnow(),
        is_latest=True,
    ))
    # Bust cache
    from shared.redis_client import cache_delete
    await cache_delete(f"macro:{key}")


async def _fetch_usd_inr(db: AsyncSession) -> str:
    if not settings.OPEN_EXCHANGE_RATES_KEY:
        return "skipped (no API key)"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"https://openexchangerates.org/api/latest.json?app_id={settings.OPEN_EXCHANGE_RATES_KEY}&symbols=INR"
            )
        data = r.json()
        inr = data["rates"]["INR"]
        await _upsert_indicator(db, "USD_INR", inr, "INR", "OpenExchangeRates")
        return f"ok:{inr}"
    except Exception as e:
        return f"error:{e}"


async def _fetch_crude_oil(db: AsyncSession) -> str:
    # EIA API — Brent crude price
    if not settings.EIA_API_KEY:
        return "skipped (no API key)"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key={settings.EIA_API_KEY}&frequency=daily&data[0]=value&sort[0][column]=period&sort[0][direction]=desc&length=1"
            )
        rows = r.json()["response"]["data"]
        if rows:
            price = float(rows[0]["value"])
            await _upsert_indicator(db, "CRUDE_OIL", price, "USD/barrel", "EIA")
            return f"ok:{price}"
        return "no data"
    except Exception as e:
        return f"error:{e}"
