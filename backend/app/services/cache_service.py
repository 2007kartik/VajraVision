"""
app/services/cache_service.py — High-level caching operations built on Redis.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any, Optional

from app.redis_client import redis_get_cache, redis_set_cache
from app.config import get_settings

settings = get_settings()


def _cache_key(query: str, task_type: str, image_count: int) -> str:
    """Deterministic cache key based on query semantics."""
    raw = f"{query.strip().lower()}|{task_type}|{image_count}"
    digest = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"cache:{digest}"


async def get_cached_result(
    query: str,
    task_type: str,
    image_count: int,
) -> Optional[dict[str, Any]]:
    """Return cached analysis result or None."""
    key = _cache_key(query, task_type, image_count)
    return await redis_get_cache(key)


async def set_cached_result(
    query: str,
    task_type: str,
    image_count: int,
    result: dict[str, Any],
) -> None:
    """Cache the analysis result."""
    key = _cache_key(query, task_type, image_count)
    await redis_set_cache(key, result, ttl=settings.cache_ttl_seconds)
