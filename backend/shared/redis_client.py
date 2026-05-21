"""
EconoMe — Redis Client
Phase 1: Shared async Redis pool for sessions, cache, rate limiting, pub/sub.
"""
from redis.asyncio import from_url, Redis
from config import settings

_redis: Redis | None = None


async def init_redis():
    global _redis
    _redis = from_url(settings.REDIS_URL, decode_responses=True, encoding="utf-8")


def get_redis() -> Redis:
    if _redis is None:
        raise RuntimeError("Redis not initialised — call init_redis() first")
    return _redis


# ── Convenience wrappers ──────────────────────────────────────────────────────

async def cache_set(key: str, value: str, ttl_seconds: int) -> None:
    await get_redis().setex(key, ttl_seconds, value)


async def cache_get(key: str) -> str | None:
    return await get_redis().get(key)


async def cache_delete(key: str) -> None:
    await get_redis().delete(key)


async def rate_limit_check(key: str, limit: int, window_seconds: int) -> bool:
    """
    Sliding-window rate limiter.
    Returns True if request is ALLOWED, False if limit exceeded.
    """
    r = get_redis()
    current = await r.incr(key)
    if current == 1:
        await r.expire(key, window_seconds)
    return current <= limit


async def blacklist_token(jti: str, ttl_seconds: int) -> None:
    """Add a JWT ID to the blacklist (for logout / rotation)."""
    await cache_set(f"blacklist:{jti}", "1", ttl_seconds)


async def is_token_blacklisted(jti: str) -> bool:
    return await cache_get(f"blacklist:{jti}") is not None
