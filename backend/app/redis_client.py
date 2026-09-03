"""
app/redis_client.py — Async Redis client singleton.
Uses redis-py v5 with asyncio support.
"""
import json
import logging
from typing import Any, Optional

import redis.asyncio as aioredis

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ── Singleton connection pool ──────────────────────────────────────────────────
_redis_pool: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    """Return the global Redis client, creating it if necessary."""
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            max_connections=20,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
        )
    return _redis_pool


async def close_redis() -> None:
    """Close the Redis connection pool on app shutdown."""
    global _redis_pool
    if _redis_pool is not None:
        await _redis_pool.aclose()
        _redis_pool = None
        logger.info("Redis connection pool closed.")


# ── Utility helpers ────────────────────────────────────────────────────────────

async def redis_publish_event(run_id: str, event: dict) -> None:
    """Push a JSON-serialised event onto a run's SSE queue (Redis list)."""
    r = await get_redis()
    key = f"run:{run_id}:events"
    await r.rpush(key, json.dumps(event))
    await r.expire(key, settings.sse_event_ttl_seconds)


async def redis_get_events(run_id: str, start: int = 0) -> list[dict]:
    """Return all events for a run from the Redis list."""
    r = await get_redis()
    raw = await r.lrange(f"run:{run_id}:events", start, -1)
    return [json.loads(e) for e in raw]


async def redis_set_cache(key: str, value: Any, ttl: int | None = None) -> None:
    """Store a JSON-serialisable value in Redis with optional TTL."""
    r = await get_redis()
    ttl = ttl or settings.cache_ttl_seconds
    await r.set(key, json.dumps(value), ex=ttl)


async def redis_get_cache(key: str) -> Optional[Any]:
    """Retrieve and deserialise a cached value, or None if missing."""
    r = await get_redis()
    raw = await r.get(key)
    return json.loads(raw) if raw else None


async def redis_rate_limit(session_id: str) -> bool:
    """
    Sliding-window rate limiter.
    Returns True if the request is ALLOWED, False if it exceeds the limit.
    """
    r = await get_redis()
    key = f"ratelimit:{session_id}"
    count = await r.incr(key)
    if count == 1:
        await r.expire(key, settings.rate_limit_window_seconds)
    return count <= settings.rate_limit_requests
