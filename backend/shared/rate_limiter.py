"""
EconoMe API Rate Limiter (Phase 6d)
Rate limiting to prevent brute force, DDoS, and abuse
"""
from typing import Optional
from datetime import datetime, timedelta
import asyncio
from loguru import logger
from shared.redis_client import redis_client


class RateLimiter:
    """Rate limiting using Redis"""

    # Limit configurations (requests per time window)
    LIMITS = {
        "login_attempts": (5, 300),  # 5 attempts per 5 minutes
        "otp_send": (3, 300),  # 3 OTP sends per 5 minutes
        "otp_verify": (10, 300),  # 10 verify attempts per 5 minutes
        "api_endpoint": (100, 60),  # 100 requests per minute (per user)
        "public_endpoint": (1000, 60),  # 1000 requests per minute (per IP)
        "password_reset": (3, 3600),  # 3 resets per hour
        "invite_code": (5, 3600),  # 5 invites per hour
        "export_data": (2, 86400),  # 2 exports per day
    }

    def __init__(self, redis=None):
        self.redis = redis or redis_client

    async def is_allowed(
        self,
        identifier: str,
        limit_type: str,
        limit: Optional[int] = None,
        window: Optional[int] = None,
    ) -> tuple[bool, dict]:
        """
        Check if request is allowed under rate limit

        Returns: (is_allowed, stats)
        Stats includes: current_count, limit, reset_at, retry_after
        """
        if not self.redis:
            return True, {"limited": False}

        try:
            # Get limit and window
            if limit is None or window is None:
                limit, window = self.LIMITS.get(limit_type, (100, 60))

            # Create rate limit key
            now = datetime.utcnow().timestamp()
            window_key = f"ratelimit:{limit_type}:{identifier}:{int(now // window)}"

            # Increment counter
            current = await self.redis.incr(window_key)

            # Set expiration on first request
            if current == 1:
                await self.redis.expire(window_key, window)

            # Check if over limit
            is_allowed = current <= limit

            # Calculate reset time
            reset_at = int(now) + window

            stats = {
                "current_count": current,
                "limit": limit,
                "window_seconds": window,
                "reset_at": reset_at,
                "retry_after": max(0, reset_at - int(now)) if not is_allowed else 0,
            }

            if not is_allowed:
                logger.warning(
                    f"⚠️  Rate limit exceeded: {limit_type} for {identifier} "
                    f"({current}/{limit})"
                )

            return is_allowed, stats

        except Exception as e:
            logger.error(f"Rate limiter error: {e}")
            # Fail open on Redis error
            return True, {"error": str(e)}

    async def check_brute_force(
        self,
        identifier: str,
        action: str,
        max_attempts: int = 5,
        lockout_duration: int = 900,  # 15 minutes
    ) -> tuple[bool, Optional[int]]:
        """
        Check for brute force attempts

        Returns: (is_allowed, lockout_remaining_seconds)
        """
        if not self.redis:
            return True, None

        try:
            lockout_key = f"lockout:{action}:{identifier}"
            attempts_key = f"attempts:{action}:{identifier}"

            # Check if already locked out
            lockout_time = await self.redis.get(lockout_key)
            if lockout_time:
                lockout_remaining = int(lockout_time) - int(datetime.utcnow().timestamp())
                if lockout_remaining > 0:
                    logger.warning(f"🔒 Account locked: {identifier}")
                    return False, lockout_remaining

            # Increment attempts
            attempts = await self.redis.incr(attempts_key)
            await self.redis.expire(attempts_key, lockout_duration)

            # Lock account if max attempts exceeded
            if attempts >= max_attempts:
                await self.redis.set(
                    lockout_key,
                    int(datetime.utcnow().timestamp()) + lockout_duration,
                    ex=lockout_duration,
                )
                logger.warning(
                    f"🔒 Account locked due to {attempts} failed attempts: {identifier}"
                )
                return False, lockout_duration

            return True, None

        except Exception as e:
            logger.error(f"Brute force check error: {e}")
            return True, None

    async def reset_attempts(self, identifier: str, action: str):
        """Reset failed attempts after successful action"""
        if not self.redis:
            return

        try:
            attempts_key = f"attempts:{action}:{identifier}"
            await self.redis.delete(attempts_key)
            logger.info(f"✅ Reset attempts for {action}: {identifier}")
        except Exception as e:
            logger.error(f"Failed to reset attempts: {e}")

    async def get_stats(self, identifier: str) -> dict:
        """Get rate limit stats for identifier"""
        if not self.redis:
            return {}

        try:
            stats = {}
            for limit_type in self.LIMITS:
                now = datetime.utcnow().timestamp()
                window_key = f"ratelimit:{limit_type}:{identifier}:{int(now // self.LIMITS[limit_type][1])}"
                count = await self.redis.get(window_key) or 0
                stats[limit_type] = int(count)

            return stats
        except Exception as e:
            logger.error(f"Failed to get stats: {e}")
            return {}


# Singleton instance
rate_limiter = RateLimiter()


def get_rate_limiter() -> RateLimiter:
    """Get rate limiter instance"""
    return rate_limiter
